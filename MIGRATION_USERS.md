# Bitrix24 Cloud -> On-Prem Плейбук Миграции (Scope: Users)

Цель: Однократная миграция полных данных пользователей (профиль + связи + кастомные поля UF_USR_*) из Bitrix24 Cloud в Bitrix24 On‑Prem с использованием каркаса Azure Functions (Tables / Queues).

> Этот документ покрывает только область `user`. Остальные области (tasks, CRM: deals/contacts/companies + smart process, groups, feed, chats (IM), workflows (bizproc)) будут добавлены позже аналогично.

---
## 0. Технические Предпосылки
- Все обращения к Cloud и On-Prem через вебхуки (`WEBHOOK_CLOUD_USER`, `WEBHOOK_ONPREM_USER`).
- Используем ТОЛЬКО inbound webhook (REST входящий) для всех вызовов – без OAuth-приложений.
- Промежуточные данные пишутся в Azure Tables:
  - Таблица `usersdata` (PartitionKey = `users`) – сырые записи пользователей.
  - Таблица `customfields` (PartitionKey = `users_custom_fields_missing`) – отсутствующие кастомные поля (UF_USR_*) найденные в Cloud и отсутствующие в On-Prem.
- Azure Queues (запланировано / для расширения) для масштабирования импорта (fan-out) – сейчас возможно заглушка.
- Retry / backoff реализован в `genericImport` (прогрессивные повторы при временных ошибках).
 - Реальные REST методы Bitrix, которые используем / будем использовать:
   - `user.fields` – метаданные (все поля, системные + UF_*).
   - `user.userfield.list` – список пользовательских полей (иногда даёт расширенный набор настроек / enum).
   - `user.userfield.add` – создание отсутствующего пользовательского поля (подтверждено доступно).
   - `user.get` – получение списка пользователей (постранично / фильтры).
   - `user.search` – дополнительный поиск (по строке, если нужно).
   - `user.add` / `user.update` – создание / обновление (использовать при импорте и 2‑pass обновлении связей). (Локальный endpoint `/users/import` внутри нашей системы оборачивает вызовы `user.add`).

---
## 1. Общий Порядок (High-Level)
1. АНАЛИЗ & DIFF КАСТОМНЫХ ПОЛЕЙ
2. ДОБАВЛЕНИЕ ОТСУТСТВУЮЩИХ ПОЛЕЙ В ON-PREM
3. ЭКСТРАКЦИЯ ПОЛЬЗОВАТЕЛЕЙ (Cloud)
4. ТРАНСФОРМАЦИЯ & МАППИНГ СВЯЗЕЙ (manager, department, avatar и т.д.) – подготовительный этап в таблице
5. (Опционально) ПОСТАНОВКА В ОЧЕРЕДЬ ИМПОРТА (Azure Queue) – разбиение на батчи
6. ИМПОРТ В ON-PREM (создание пользователей)
7. ВЕРИФИКАЦИЯ (статусы + точечные проверки)
8. ОТЧЁТ / ОЧИСТКА (фиксация завершения, архив логов)

---
## 2. Детализация Этапов
### 2.1 Diff Кастомных Полей
Цель: Найти все поля `UF_USR_*`, которые есть в Cloud и отсутствуют в On-Prem.

Локальный endpoint (Azure Functions):
- `GET /users/custom-fields/get?debug=1`
  - Вызывает `user.fields` (Cloud & On-Prem) -> фильтр `UF_*` (префикс пользователя), строит diff.
  - (Дополнительно при расширении) можно сверять деталь через `user.userfield.list` если нужны специфичные настройки типа / enum.
  - Записывает отсутствующие поля (только имя + meta) в таблицу `customfields`, PartitionKey: `users_custom_fields_missing`.
  - `debug=1` возвращает массив `missingNames`.

Шаги:
1. Запустить endpoint и сохранить JSON (для архива).  
2. Просмотреть типы (meta в `RAW`).  
3. Подготовить план создания (enum / list / file / crm / employee типы).

### 2.2 Создание Отсутствующих Полей в On-Prem
Только через REST (inbound webhook), без UI:
- Метод: `user.userfield.add`.
- Параметры: `FIELD_NAME`, `USER_TYPE_ID`, настройки / enum (должны дублировать Cloud).
- Маппинг CloudFieldName -> OnPremFieldName обычно 1:1; при необходимости переименования завести локальный словарь.

После создания повторно `GET /users/custom-fields/get` – ожидание `missingCount = 0`.

### 2.3 Экстракция Пользователей (Cloud)
Endpoint'ы:
- `GET /users/extract` (или `POST /users/extract`) – постраничное получение и запись сырых записей в `usersdata` (PartitionKey = `users`).
- Необязательный параметр: `test_limit` для быстрых прогонов.

Механика:
- Функция должна использовать реальный REST: `user.get` (с параметрами `start`, `FILTER`), опционально `user.search` для доп. выборок.  
- (На текущий момент если стоит mock – заменить реализацией вызовов webhook URL + метод).  
- Каждая запись: entity с `rowKey = id` + `PayloadJson` (сырой JSON).  

### 2.4 Трансформация & Маппинг Связей
После экстракции (до импорта) локальный скрипт / будущий endpoint:
- Парсит `PayloadJson`.
- Выделяет реляционные поля (`UF_DEPARTMENT`, manager `UF_HEAD` или `WORK_POSITION`).
- Заполняет вспомогательные структуры (departmentId -> name; managerId -> существует?).
- Проверяет целостность custom fields (нет ссылок на отсутствующие объекты).  
- (Опция) Помечает проблемные записи (`NeedsReview = true`).

### 2.5 Очередь (Опционально)
Цель: не блокировать долгий импорт.
- Разбить на батчи (напр. 25) и положить в Azure Queue (`queueUsersImport`).
- Worker (queue-trigger function) обрабатывает сообщения и вызывает импорт одной записи.
- Пока не реализовано – будущая оптимизация.

### 2.6 Импорт Пользователей
Endpoint:
- `POST /users/import` (и `GET` для теста) – использует `genericImport`.

Работа `genericImport`:
- Читает сущности со статусом `NEW` или `ERROR_RETRY` (партиция `users`).
- Для каждой вызывает реальный REST метод `user.add` (после замены заглушки) через inbound webhook On-Prem.
- Успех -> `IMPORT_OK`; временная ошибка -> повтор с увеличением задержки.
- Постоянная ошибка -> `IMPORT_ERR`.

Перед прод: дополнить заглушку:
- Валидация обязательных (LOGIN, NAME, LAST_NAME, EMAIL ...).
- Маппинг кастомных полей (enum / employee / file upload и т.п.).  

### 2.6.1 Mapping ID Cloud -> On-Prem
Проблема: ID пользователей в Cloud и On-Prem почти всегда различаются; нельзя рассчитывать, что сохранится исходный идентификатор.

Стратегия:
1. После успешного `user.add` ответ возвращает `result` (целочисленный ID On-Prem).
2. Сохраняем в исходной entity дополнительные атрибуты: `OnPremId`, `ImportedAt`.
3. (Опция) Ввести отдельную таблицу `users_idmap` (PartitionKey=`users_idmap`, RowKey=`<CloudId>`, колонка `OnPremId`).
4. При втором проходе (установка manager / department cross-ссылок) используем map CloudId -> OnPremId.
5. Если нужный manager ещё не создан – откладываем (статус `DEFERRED`) и пробуем в следующем цикле.

Обновление связей:
- Второй pass вызывает `user.update` для записей без установленных зависимостей, подставляя правильные On-Prem ID.
- Локально можно добавить endpoint `/users/relations/update` (план).

### 2.7 Верификация
Endpoint'ы:
- `GET /users/verify` – агрегирует статусы (ok / err / retry).  
- `GET /users` – список кратко (id + status).  
- `GET /users/{id}` – подробная запись.

Дополнительно проверяем:
- Наличие `OnPremId` у всех записей со статусом `IMPORT_OK`.
- Отсутствие записей в промежуточном состоянии `DEFERRED` после финального цикла.

Ручные проверки:
1. `missingCount` кастомных полей = 0.  
2. В `users/verify` нет `IMPORT_ERR`.  
3. Сравнить количество Cloud vs On-Prem (`user.get`).  
4. Spot-check аватары, отделы, критичные поля.  

### 2.8 Отчёт / Очистка
- Экспорт списка проблемных (`IMPORT_ERR`).  
- Решение: повтор или ручная правка.  
- (Опция) Архив/переименование вспомогательных таблиц.

---
## 3. Подробный Порядок Вызова Endpoint'ов (Users)
| Шаг | Endpoint | Назначение | Примечание |
|-----|----------|-----------|------------|
| 1 | `GET /users/custom-fields/get?debug=1` | Diff UF_USR_* | Пишет отсутствующие |
| 2 | (Вручную) создание полей | Выровнять схему | `user.userfield.add` |
| 3 | `GET /users/custom-fields/get` | Контроль отсутствий = 0 | Без debug |
| 4 | `GET /users/extract` | Сырые данные (Cloud) | Реализовать `user.get` |
| 5 | (Скрипт) трансформация | Mapping dept/manager | Подготовка |
| 6 | `POST /users/import` | `user.add` создание On-Prem | Запись OnPremId |
| 7 | (План) `/users/relations/update` | Второй pass `user.update` | Manager/Dept fix |
| 8 | `GET /users/verify` | Агрегация статусов | + проверка OnPremId |
| 9 | `GET /users` | Краткий список | id + status |
| 10 | `GET /users/{id}` | Деталь | PayloadJson / OnPremId |
| 11 | (Опция) Повтор `POST /users/import` | Retry временных | После анализа |

---
## 4. Ключевые Поля & Маппинги (Users)
| Тип | Пример | Действие |
|-----|--------|----------|
| System | ID, NAME, LAST_NAME, EMAIL | Копия 1:1 |
| Custom UF | UF_USR_* | Создаём заранее, переносим значения |
| Department | UF_DEPARTMENT | Сначала структура отделов – map ID |
| Manager | HEAD / MANAGER_ID | Убедиться что manager уже существует (1 или 2 pass) |
| Avatar / Photo | PERSONAL_PHOTO | Скачать + загрузить (todo) |
| Timezone / Locale | TIME_ZONE / PERSONAL_BIRTHDAY | По необходимости |

---
## 5. Стратегия Порядка (Связи)
1. Первый pass: создаём пользователей без manager ссылок (или пусто).  
2. Второй pass: обновляем manager когда все уже существуют.  
3. Отделы: подготовить до импорта пользователей (отдельный процесс).

---
## 6. Retry & Ошибки
- `ERROR_RETRY` -> будет повторно обработано при следующем запуске импорта (progressive backoff).  
- `IMPORT_ERR` -> требует ручного разбора (`LastError`).  
- Рекомендация: экспорт списка `IMPORT_ERR` в отдельный отчёт.
 - Новый статус (потенциально): `DEFERRED` – запись ожидает разрешения зависимостей (manager / department) перед вторым pass.

---
## 7. Расширения (План)
| Расширение | Описание |
|------------|----------|
| Queue trigger import | Fan-out батчей пользователей |
| Endpoint transform | `/users/transform` – нормализация связей |
| Avatar migration | Скачивание и загрузка фото (blob -> API) |
| Department sync | Экстракция структуры -> создание On-Prem |
| Manager 2-pass update | Второй проход для установки manager |
| Audit log | Отдельная таблица операционного лога |

---
## 8. Быстрый Чеклист (Users)
- [ ] Diff UF (missingCount=0 после создания)
- [ ] Полный Extract (count == Cloud)
- [ ] Transform (связи готовы)
- [ ] Import (нет постоянных ошибок)
- [ ] Verify (OK == total)
- [ ] Финальный отчёт
 - [ ] Маппинг CloudId -> OnPremId заполнен (нет пропусков)
 - [ ] Второй pass связей завершён (нет DEFERRED)

---
## 9. Минимальные Команды Теста (PowerShell)
```powershell
# Diff custom fields
Invoke-RestMethod http://localhost:7071/api/users/custom-fields/get?debug=1 | ConvertTo-Json -Depth 4

# Extract (limit testowy 30)
Invoke-RestMethod http://localhost:7071/api/users/extract?test_limit=30 | ConvertTo-Json -Depth 4

# Import
Invoke-RestMethod -Method POST http://localhost:7071/api/users/import | ConvertTo-Json -Depth 4

# Verify
Invoke-RestMethod http://localhost:7071/api/users/verify | ConvertTo-Json -Depth 4
```

---
## 10. Метрики Успеха
| Метрика | Условие |
|---------|---------|
| missingCount | 0 после создания полей |
| imported users | == активные в Cloud (или по фильтру) |
| permanent errors | 0 или допустимый список кейсов |
| время импорта | В пределах SLA (batch size / лимиты API) |

---
## 11. Итоговые Заметки
- UF типы (enum / file / employee / crm) проверить заранее.
- Экспорт Cloud (CSV/API) сохранить как snapshot (аудит).
- Throttling: `IMPORT_THROTTLE_MS` задержка между `user.add`.
- Масштабирование: очередь + fan-out (future).
- Таблица `users_idmap` создаётся автоматически при импорте.

---
> Следующий документ: MIGRATION_TASKS.md (аналогичная структура) – добавим после утверждения.

---
## 12. Описание Реализованных Endpoint'ов (Users)

| Endpoint | Метод(ы) | Назначение | Ключевые Поля Ответа / Поведение |
|----------|----------|------------|----------------------------------|
| `GET /users/custom-fields/get` | GET | Diff кастомных полей UF_USR_* Cloud vs On-Prem, запись отсутствующих | `missingCount`, `stored`, `cloudMethod`, `fallback` (при `debug=1`) |
| `GET /users/extract` | GET / POST | Постраничная экстракция Cloud (`user.get`) в таблицу | `imported`, `truncated` |
| `POST /users/import` | POST / GET | Импорт (создание) пользователей в On-Prem (`user.add`) | `processed` (число записей в батче) |
| `GET /users/verify` | GET | Агрегация статусов импортированных записей | `total`, `ok`, `err`, `retry` |
| `GET /users` | GET | Краткий список (id + статус) (уже реализован в базовом наборе) | Служебный просмотр |
| `GET /users/{id}` | GET | Деталь одной записи | Полный JSON + статусы |
| `GET /users/idmap` | GET | Просмотр соответствий CloudId -> OnPremId | `items[]` (до 1000) |
| `POST /users/relations/update` | POST / GET | Второй pass: обновление связей (manager / department) через `user.update` | `updated`, `deferred`, `errors[]` |

Заметки:
- Таблица idmap активна (PartitionKey `users_idmap`).
- `TargetId` / `OnPremId` сейчас placeholder – заменить на фактический ответ `user.add`.
- `relations/update` требует привязки к реальному маппингу департаментов и менеджеров (после их миграции).
