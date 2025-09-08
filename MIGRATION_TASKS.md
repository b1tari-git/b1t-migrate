# Bitrix24 Cloud -> On-Prem Плейбук Миграции (Scope: Tasks)

Цель: Однократная миграция задач (основные атрибуты + связи + кастомные поля UF_TASK_* + чеклисты, теги, наблюдатели, соисполнители, связанные CRM, зависимости, комментарии, вложения) из Bitrix24 Cloud в Bitrix24 On‑Prem через каркас Azure Functions (Tables / Queues, REST inbound webhooks).

> Документ строится по той же модели, что и для пользователей. Далее будет расширен для deals / contacts / groups / feed / chats / workflows / smart process.

---
## 0. Технические Предпосылки
- Только inbound webhook REST (`WEBHOOK_CLOUD_TASK`, `WEBHOOK_ONPREM_TASK`), без OAuth.
- Промежуточные таблицы Azure:
  - `tasksdata` (PartitionKey = `tasks`) – сырые задачи (первичный pass).
  - `customfields` (PartitionKey = `tasks_custom_fields_missing`) – отсутствующие кастомные поля UF_TASK_*
  - (План) `tasks_idmap` (PartitionKey = `tasks_idmap`) – CloudId -> OnPremId (создаётся при импорте аналогично users_idmap) – потребуется добавить TABLE_TASKSIDMAPDATA.
  - (Опция) `tasks_secondary` для расширенных артефактов (чеклисты, комментарии) если нужно хранить отдельно.
- Очереди Azure (future) для fan-out импорта больших объёмов.
- Progressive retry / backoff аналогично пользователям.
- Throttling через `IMPORT_THROTTLE_MS` (если задан) – пауза между `tasks.task.add`.
- Источники правды об ID пользователей / групп / CRM: соответствующие idmap таблицы (users_idmap, groups_idmap, crm_*_idmap) – должны быть готовы ДО импорта задач.

### REST методы Bitrix (актуальные / fallback)
| Назначение | Primary | Fallback / Legacy | Комментарий |
|------------|---------|-------------------|-------------|
| Метаданные полей | `tasks.task.getFields` | `task.item.getFields` | Для diff UF_TASK_* |
| Список задач | `tasks.task.list` | `task.item.getlist` | Постранично, `start` offset |
| Получить одну | `tasks.task.get` | `task.item.get` | Детализация при необходимости |
| Создать | `tasks.task.add` | `task.item.add` | Только REST через webhook |
| Обновить | `tasks.task.update` | `task.item.update` | Второй pass (связи, доп. атрибуты) |
| Кастомные поля (userfield) list | `task.userfield.list` | — | Доп. мета/enum |
| Кастомные поля add | `task.userfield.add` | — | Создание UF_TASK_* |
| Чек-лист items | `task.checklistitem.getlist` | — | Доп. pass (extract/attach) |
| Комментарии | (нет прямого универсального) `task.commentitem.getlist` | — | Опционально |
| Связи CRM | `tasks.task.get` result['UF_CRM_TASK'] | — | Строковый массив связок |

> Примечание: точные названия некоторых legacy методов могут отличаться в установленной версии On‑Prem. Использовать primary modern (`tasks.task.*`) где поддерживается.

---
## 1. High-Level Порядок
1. ПРЕДВАРИТЕЛЬНЫЕ ЗАВИСИМОСТИ (users, groups/projects, CRM idmaps готовы)
2. DIFF КАСТОМНЫХ ПОЛЕЙ UF_TASK_*
3. СОЗДАНИЕ ОТСУТСТВУЮЩИХ КАСТОМНЫХ TASK ПОЛЕЙ (REST)
4. ЭКСТРАКЦИЯ БАЗОВЫХ ЗАДАЧ (paged list)
5. ДОЭКСТРАКЦИЯ РАСШИРЕНИЙ (чеклисты, теги, CRM связи, вложения – при необходимости)
6. ТРАНСФОРМАЦИЯ (маппинг пользователей / групп / CRM / дат / статусов)
7. ПЕРВИЧНЫЙ ИМПОРТ (tasks.task.add – минимальный набор полей)
8. ВТОРОЙ PASS (tasks.task.update – статусы, дедлайны, зависимости, чеклисты, UF_TASK_* значения, CRM привязки)
9. ВЕРИФИКАЦИЯ
10. ОТЧЁТ / ОЧИСТКА / АРХИВ

---
## 2. Детализация Этапов
### 2.1 Diff Кастомных Полей (Tasks)
- Endpoint (план): `GET /tasks/custom-fields/get?debug=1`.
- Логика аналогична users: вызов `tasks.task.getFields` + fallback `task.userfield.list`; фильтр по префиксу `UF_TASK_`.
- Отсутствующие имена -> запись в PartitionKey `tasks_custom_fields_missing` таблицы `customfields`.
- `debug=1` возвращает перечисление `missingNames`, методы источников, fallback флаги.

### 2.2 Создание Отсутствующих Кастомных Полей
- Только REST: `task.userfield.add` через On-Prem webhook.
- Поля: `FIELD_NAME`, `USER_TYPE_ID`, настройки / ENUM идентичные Cloud.
- После создания повторный diff -> `missingCount=0`.

### 2.3 Экстракция Базовых Задач
- Endpoint: `GET /tasks/extract`.
- Параметры: `test_limit` (ограничение), (позже) `updated_from` (инкремент, если потребуется).
- Реализация: `tasks.task.list` с `start` offset; сохраняем массив задач в `tasksdata` (PartitionKey `tasks`, RowKey = ID задачи).
- Сохраняем сырой JSON в `PayloadJson`.

### 2.4 Доэкстракция Расширений (Опционально)
- Чеклисты: отдельный pass `task.checklistitem.getlist` (batch по ID задач) -> вложить в структуру или отдельную таблицу `tasks_secondary` (field: ChecklistJson).
- Комментарии: аналогично (если нужны исторические дискуссии) – может быть объёмно.
- Вложения: получить fileId / download URL и позже мигрировать (отложено).
- CRM связи: поле `UF_CRM_TASK` (массив строк `TYPE_ID_ID`) – сохранить.

### 2.5 Трансформация
- Применить idmap: responsible, created_by, accomplices, auditors, changed_by.
- group_id -> groups idmap.
- CRM связи: преобразовать Cloud ID => On-Prem ID (по каждой сущности) (future, когда crm_* завершены).
- Преобразовать статусы: `STATUS` (например 2 = In Progress, 5 = Completed) – сверить кодировку On-Prem.
- Отметить задачи где отсутствуют сопоставления (NeedsReview / DEFERRED_RELATIONS).

### 2.6 Первичный Импорт
- Endpoint: `POST /tasks/import` (аналог genericImport) – создаём минимальные задачи: TITLE, RESPONSIBLE_ID, CREATED_BY, DEADLINE (если критично), базовые UF_TASK_* если нужны для создания.
- Ответ `tasks.task.add` -> ID On-Prem сохраняем в `tasks_idmap` (PartitionKey `tasks_idmap`).
- Статус entity -> `IMPORT_OK`.
- Throttle (`IMPORT_THROTTLE_MS`) при большом объёме.

### 2.7 Второй Pass (Relations / Full Update)
- Endpoint (план): `POST /tasks/relations/update`.
- Действия: добавить accomplices, auditors, checklist items, dependencies, CRM bindings, оставить финальный STATUS, связать подзадачи (parentId), обновить UF_TASK_* не установленные в первой фазе.
- Если нет нужных On-Prem ID зависимостей -> пометить как `DEFERRED`.

### 2.8 Верификация
- Endpoint: `GET /tasks/verify` – агрегатные статусы (NEW / IMPORT_OK / IMPORT_ERR / ERROR_RETRY / DEFERRED).
- Дополнительно: сравнить count Cloud vs импортированных; список DEFERRED.

### 2.9 Отчёт / Очистка
- Экспорт ошибок (IMPORT_ERR) + причины (LastError).
- Экспорт DEFERRED (несопоставленные зависимости) -> повтор relations/update позже.
- Архив или snapshot итоговых таблиц.

---
## 3. Endpoint Порядок (Tasks)
| Шаг | Endpoint | Назначение | Примечание |
|-----|----------|-----------|------------|
| 1 | `GET /tasks/custom-fields/get?debug=1` | Diff UF_TASK_* | Запись отсутствующих |
| 2 | (REST) создание полей | `task.userfield.add` | Повтор diff до 0 |
| 3 | `GET /tasks/extract` | Экстракция Cloud | `test_limit` |
| 4 | (Опц) `/tasks/extract/extended` | Чеклисты/комментарии | Future |
| 5 | (Скрипт) трансформация | Применение idmap | Mark DEFERRED |
| 6 | `POST /tasks/import` | Первичное создание | write idmap |
| 7 | `POST /tasks/relations/update` | Второй pass update | dependencies/checklists |
| 8 | `GET /tasks/verify` | Проверка статусов | + deferred count |
| 9 | `GET /tasks/idmap` | Просмотр Cloud->OnPrem | До 1000 |
| 10 | (Опц) повтор 7 | Повтор отложенных | После готовности зависимостей |

---
## 4. Ключевые Поля & Маппинги
| Категория | Поле / Группа | Действие |
|-----------|---------------|----------|
| Идентификаторы | ID | Cloud -> OnPrem (tasks_idmap) |
| Ответственные | RESPONSIBLE_ID | Map через users_idmap |
| Создатель | CREATED_BY | Map users |
| Соисполнители | ACCOMPLICES | Массив map users |
| Наблюдатели | AUDITORS | Массив map users |
| Проект | GROUP_ID | Map через groups_idmap |
| Подзадача | PARENT_ID | Требует чтобы родитель уже импортирован (или DEFERRED) |
| CRM связи | UF_CRM_TASK | Map всех CRM id (после миграции crm_*) |
| Кастомные поля | UF_TASK_* | Создать заранее, затем значения |
| Чеклист | Checklist items | Второй pass add |
| Вложения | Files | Отложенное (медиа pipeline) |
| Дедлайн | DEADLINE | Формат ISO; TZ согласовать |
| Статус | STATUS | Сопоставить кодировки Cloud/On-Prem |

---
## 5. Стратегия Порядка (Связи)
1. Сначала задачи без подзадач/зависимостей (или игнорируя PARENT_ID / DEPENDS_ON).
2. Второй pass: обновить parent/dependencies, когда все базовые ID есть.
3. Checklist / комментарии / файлы отдельно (могут быть объёмные, держать под контролем rate limit).

---
## 6. Retry & Статусы
- NEW – после экстракции.
- IMPORT_OK – создана базовая задача On-Prem.
- ERROR_RETRY – временная ошибка (продолжим попытки в рамках maxRetries).
- IMPORT_ERR – постоянная ошибка (после исчерпания retry).
- DEFERRED – пропущено из-за отсутствующих зависимостей (parent / user / group / crm id) – повторить после устранения.

---
## 7. Расширения (План)
| Расширение | Описание |
|------------|----------|
| Queue fan-out import | Параллельные батчи `tasks.task.add` |
| Extended extract endpoint | Сбор чеклистов/комментариев/вложений |
| Relations update улучшения | Пакетные обновления зависимостей |
| Media pipeline | Скачивание + загрузка вложений (blob/temp) |
| CRM binding нормализация | Разбор и унификация UF_CRM_TASK |
| Audit log | Таблица логов операций задач |

---
## 8. Быстрый Чеклист
- [ ] Diff UF_TASK_* завершён (missingCount=0)
- [ ] Extract базовый (count == Cloud)
- [ ] Idmap пользователей и групп готовы
- [ ] Import (нет permanent errors)
- [ ] Второй pass применён (минимум DEFERRED)
- [ ] Verify OK == total (или объяснимые DEFERRED)
- [ ] Финальный отчёт и архив

---
## 9. Минимальные Команды (PowerShell – предполагаемые Endpoint'ы)
```powershell
# Diff task custom fields
Invoke-RestMethod http://localhost:7071/api/tasks/custom-fields/get?debug=1 | ConvertTo-Json -Depth 4

# Extract sample
Invoke-RestMethod http://localhost:7071/api/tasks/extract?test_limit=50 | ConvertTo-Json -Depth 4

# Import base
Invoke-RestMethod -Method POST http://localhost:7071/api/tasks/import | ConvertTo-Json -Depth 4

# Second pass (relations)
Invoke-RestMethod -Method POST http://localhost:7071/api/tasks/relations/update | ConvertTo-Json -Depth 4

# Verify
Invoke-RestMethod http://localhost:7071/api/tasks/verify | ConvertTo-Json -Depth 4
```

---
## 10. Метрики Успеха
| Метрика | Условие |
|---------|---------|
| missingCount (UF_TASK_*) | 0 после создания полей |
| imported tasks | == базовый count Cloud (фильтр) |
| deferred | -> 0 после финального pass |
| permanent errors | 0 или согласованный список |
| время импорта | В пределах SLA |

---
## 11. Итоговые Заметки
- Все операции только REST inbound; без UI.
- Порядок критичен: сначала сущности-пререквизиты (users, groups, crm).* 
- Большие объёмы: включить throttling (`IMPORT_THROTTLE_MS`) и очередь.
- При большом количестве чеклистов/комментариев – рассмотреть отдельные батчи и лимиты.
- Вложения лучше мигрировать отдельным пайплайном после core данных.

---
## 12. План Реализации Endpoint'ов (Mapping к будущему коду)
| Endpoint (план) | Таблица | PartitionKey | Статус | Примечание |
|-----------------|---------|--------------|--------|------------|
| `GET /tasks/custom-fields/get` | customfields | `tasks_custom_fields_missing` | NEW/— | Diff UF_TASK_* |
| `GET/POST /tasks/extract` | tasksdata | `tasks` | NEW | Сырые записи |
| `POST /tasks/import` | tasksdata + tasks_idmap | `tasks` / `tasks_idmap` | IMPORT_OK / ERROR_* | Создание базовых |
| `POST /tasks/relations/update` | tasksdata | `tasks` | IMPORT_OK / DEFERRED | Второй pass |
| `GET /tasks/verify` | tasksdata | `tasks` | aggregate | Подсчёт статусов |
| `GET /tasks/idmap` | tasks_idmap | `tasks_idmap` | — | Просмотр соответствий |

---
> После утверждения: реализация endpoint'ов и добавление TABLE_TASKSIDMAPDATA в `local.settings.json`.
