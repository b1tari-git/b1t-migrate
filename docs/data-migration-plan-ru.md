# План миграции данных Bitrix24 (Облако -> Он‑Premise)

Общая оценка: 120 часов
Объём: перенос сущностей (Лента с изображениями, Чаты, Рабочие / проектные группы и задачи, Задачи с комментариями, Пользователи (профиль), Рабочие процессы (feed workflows), CRM (Сделки, Контакты, Компании, Smart Process) — только базовые поля, без истории / таймлайнов.
Вне объёма: История изменений, аудиты, лог активности, трекинг времени задач, таймлайны CRM, вложения кроме явно указанных изображений, удалённые / архивные объекты (если не оговорено), полноценный механизм инкрементальной синхронизации.

## 1. Принципы
- Целостность данных: сохраняем исходные ID или ведём таблицу соответствий.
- Ссылочная согласованность: сначала пользователи, затем сущности их использующие.
- Минимизация простоя: финальное «окно только чтение» для дельты.
- Безопасность: вебхуки / токены с минимально необходимыми правами.
- Наблюдаемость: логируем батчи, счётчики, ошибки, ретраи.
- Повторяемость: идемпотентный импорт (skip-if-exists по source_id + hash).

## 2. Фазы и оценка (часы)
| Фаза | Описание | Часы |
|------|----------|------|
| P1 | Анализ и подготовка окружения | 10 |
| P2 | Доступы, авторизация, вебхуки | 6 |
| P3 | Спецификация моделей и маппинг | 10 |
| P4 | Экстракция (Лента, Пользователи, Задачи) | 24 |
| P5 | Экстракция (Чаты, Группы, Workflows) | 14 |
| P6 | Экстракция (CRM сущности) | 18 |
| P7 | Трансформация и медиа | 8 |
| P8 | Импортный слой (API On‑Prem) | 12 |
| P9 | Валидация и QA | 8 |
| P10 | Финальная дельта и cutover | 6 |
| P11 | Документация и передача | 4 |
| Итого |  | 120 |

## 3. Декомпозиция задач
### P1 – Анализ (10ч)
1. Инвентаризация включённых модулей.
2. Сопоставление версий облако / on‑prem API.
3. Метрики объёмов (пользователи, задачи, лента, чаты, CRM).
4. Оценка места (включая изображения ленты).
5. Целевая инфраструктура (схемы БД, хранилище файлов).
6. Секреты / vault для токенов.

### P2 – Авторизация (6ч)
1. Регистрация вебхуков.
2. Разделение токенов по зонам (CRM / Tasks / IM).
3. Лимиты и стратегия троттлинга.
4. Общий HTTP-клиент (retry, backoff, 429).
5. Smoke-тест каждого endpoint.

### P3 – Маппинг (10ч)
1. Канонические структуры: User, Task, TaskComment, FeedPost, FeedAttachment, Chat, ChatMessage, Group, Deal, Company, Contact, SmartProcessItem.
2. Таблица сопоставления полей (source->target, обязательность, трансформации).
3. Зависимости (FK) — кто от кого зависит.
4. Таблицы соответствий ID (source_id, target_id, entity_type, checksum, imported_at).
5. Правила хранения медиа (имена, пути).
6. Категории ошибок и политика.

### P4 – Экстракция Core (24ч)
- Пользователи: `/rest/user.get`, нормализация, маппинг.
- Лента: `/rest/log.blogpost.get`, `/rest/log.blogpost.getcomments`, загрузка изображений.
- Задачи (legacy API доступен): `/rest/task.item.list`, детали `/rest/task.item.get`, комментарии `/rest/task.commentitem.getlist`.
- Сохранение raw JSON + нормализованных данных.

### P5 – Экстракция Расширенная (14ч)
- Группы: `/rest/sonet_group.get`, участники `/rest/sonet_group.user.get`.
- Чаты: `/rest/im.chat.get`, сообщения `/rest/im.chat.message.list`.
- Workflows: `/rest/bizproc.workflow.template.list` (+ активные `/rest/bizproc.workflow.instances` при необходимости).

### P6 – CRM (18ч)
- Сделки: `/rest/crm.deal.list`, детали `/rest/crm.deal.get`.
- Контакты: `/rest/crm.contact.list`, `/rest/crm.contact.get`.
- Компании: `/rest/crm.company.list`, `/rest/crm.company.get`.
- Smart Process: `/rest/crm.item.list` (entityTypeId).
- Только базовые поля (ID, TITLE/NAME, STAGE_ID/STATUS_ID, ASSIGNED_BY_ID, CREATED/UPDATED, связи).

### P7 – Трансформация (8ч)
1. Временные метки в UTC.
2. Маппинг user ID.
3. Санитизация HTML.
4. Checksum контента.
5. Перенос медиа и обновление ссылок.
6. Проверка заполненности обязательных.

### P8 – Импорт (12ч)
1. On‑Prem API endpoints:
   - POST /api/import/users
   - POST /api/import/feed-posts
   - POST /api/import/tasks
   - POST /api/import/chats
   - POST /api/import/groups
   - POST /api/import/crm/deals
   - POST /api/import/crm/contacts
   - POST /api/import/crm/companies
   - POST /api/import/crm/sp-items
2. Батчирование (≈100 элементов).
3. Идемпотентность (source_id + hash).
4. Частичные ошибки (список неимпортированных ID).
5. Политика retry.
 6. (Опция теста) Все импортные endpoints поддерживают необязательный параметр `test_limit` (query param либо поле в JSON: `{ "test_limit":5, "items":[...] }`). Если задан — обрабатываются только первые N элементов для быстрого smoke-теста (остальные игнорируются с пометкой skipped=test_limit). По умолчанию параметр не указывать для полноценных прогонов.

### P9 – Валидация (8ч)
1. Сравнение количеств.
2. Выборочная проверка полей.
3. Проверка изображений.
4. Проверка ссылочной целостности.
5. Анализ логов ошибок.
6. Чеклист приёмки.

### P10 – Дельта (6ч)
1. Заморозка (read-only) облака.
2. Экспорт дельты (updated_since).
3. Импорт дельты.
4. Финальная сверка.
5. Переключение.
6. Мониторинг 24–48ч.

### P11 – Документация (4ч)
1. Диаграммы потоков.
2. Runbook (повтор / повторная загрузка / ограничения).
3. Безопасность и ротация токенов.
4. Отчёт и бэклог улучшений.

## 4. Порядок выполнения
1. P1–P2 (окружение, доступы)
2. P3 (маппинг)
3. Пользователи
4. Группы / Чаты
5. Лента & Workflows
6. Задачи
7. CRM (Deal, Company, Contact, SP)
8. Трансформация
9. Импорт
10. Валидация
11. Дельта / cutover
12. Документация

## 5. Таблица методов (Webhook / REST) – Скорректировано
(Проверяйте с официальной документацией: https://apidocs.bitrix24.com/api-reference — наличие зависит от лицензии / версии.)

Шаблон вызова входящего вебхука:
`https://<портал>.bitrix24.<tld>/rest/<user_id>/<webhook_code>/<method>?param=value`
Ниже указаны имена методов без префикса `/rest/`. Для OAuth-приложения используйте `/rest/<method>` с access token.

Пагинация: параметр `start`. CRM методы поддерживают `select`, `filter`. При лимите возвращается JSON с `error` = `QUERY_LIMIT_EXCEEDED` (HTTP 200).

Примечание о правах: Предыдущая версия использовала синтетические `user.read` и т.п. В Bitrix реальные скоупы модульные: `user`, `task`, `log`, `crm`, `im`, `bizproc`, `sonet_group`. CRM сущности не разделяются по отдельным скоупам.

| Домен     | Метод                               | Назначение                     | Параметры / примечания                                 | Скоуп         |
|-----------|-------------------------------------|--------------------------------|--------------------------------------------------------|---------------|
| User      | `user.get`                          | Пользователь / список          | `start`                                                | `user`        |
| User      | `user.search`                       | Поиск пользователей            | `FILTER`                                               | `user`        |
| Feed      | `log.blogpost.get`                  | Детали поста                   | `POST_ID`                                              | `log`         |
| Feed      | `log.blogpost.getcomments`          | Комментарии поста              | `POST_ID`, постранично                                 | `log`         |
| Feed      | `log.blogpost.add` (опционально)    | Републикация (не нужна)        | Избегать при read-only                                 | `log` (write) |
| Tasks     | `task.item.list`                    | Список задач (legacy)          | `TASK_ID` не требуется, `start`                        | `task`        |
| Tasks     | `task.item.get`                     | Детали задачи (legacy)         | `TASK_ID`                                              | `task`        |
| Tasks     | `task.commentitem.getlist`          | Комментарии задачи (legacy)    | `TASK_ID`                                              | `task`        |
| Groups    | `sonet_group.get`                   | Группы                         | `start`                                                | `sonet_group` |
| Groups    | `sonet_group.user.get`              | Участники группы               | `ID` (group), `start`                                  | `sonet_group` |
| Chat      | `im.chat.get`                       | Метаданные чата                | `CHAT_ID`                                              | `im`          |
| Chat      | `im.chat.message.list`              | Сообщения чата                 | `CHAT_ID`, `LIMIT`, `OFFSET` / пагинация               | `im`          |
| Workflow  | `bizproc.workflow.template.list`    | Шаблоны бизнес-процессов       | `filter`, `order`                                      | `bizproc`     |
| Workflow  | `bizproc.workflow.instances`        | Активные экземпляры (*)        | Только при необходимости состояния                     | `bizproc`     |
| CRM       | `crm.deal.list`                     | Сделки                         | `select`, `filter`, `start`                           | `crm`         |
| CRM       | `crm.deal.get`                      | Сделка                         | `ID`                                                   | `crm`         |
| CRM       | `crm.contact.list`                  | Контакты                       | `select`, `filter`, `start`                           | `crm`         |
| CRM       | `crm.contact.get`                   | Контакт                        | `ID`                                                   | `crm`         |
| CRM       | `crm.company.list`                  | Компании                       | `select`, `filter`, `start`                           | `crm`         |
| CRM       | `crm.company.get`                   | Компания                       | `ID`                                                   | `crm`         |
| CRM       | `crm.item.list`                     | SP элементы                    | `entityTypeId`, `filter`, `select`, `start`           | `crm`         |

(*) Если не требуется сохранять состояние исполнения, достаточно шаблонов.

Примечание: В текущем окружении доступны только legacy методы задач `task.item.list` и `task.item.get`; новый API `tasks.task.*` недоступен / не использовать.
При создании вебхука выбирайте только нужные модули. Права на запись не нужны, если выполняется только чтение.

## 6. Права и скоупы (Облако vs On‑Prem Webhook)

Требование обновлено: модель Token+HMAC заменена на вебхук‑подход и для целевой системы. Источник (Bitrix24) и целевой импорт‑шлюз используют входящие вебхуки (секрет в URL) + строгие allow‑list методов.

### 6.1 Облако (Источник) – Скоупы и ссылки (пример)
| Scope       | Сущности / Методы                | Когда используется           | Пример (обрезан)                                        | Снять |
|-------------|----------------------------------|------------------------------|---------------------------------------------------------|-------|
| user        | Пользователи                     | Ранняя экстракция / дельта   | https://selleris.../user.get                           | Да    |
| log         | Лента                            | После пользователей          | https://selleris.../log.blogpost.get                   | Да    |
| task        | Задачи + комменты                | После групп                  | https://selleris.../tasks.task.list                    | Да    |
| sonet_group | Группы                           | После пользователей          | https://selleris.../sonet_group.get                    | Да    |
| im          | Чаты                             | Опционально                  | https://selleris.../im.chat.get                        | Да    |
| bizproc     | Шаблоны / экземпляры             | Опционально                  | https://selleris.../bizproc.workflow.template.list     | Да    |
| crm         | CRM сущности                     | После задач                  | https://selleris.../crm.deal.list                      | Да    |

Примечание: Полные webhook URL (с `/<user_id>/<webhook_code>/`) намеренно НЕ сохраняются в этом общем плане по причине безопасности. Для актуального реестра (BaseURL обрезанный + хеш секрета + даты выдачи/ротации) см. `docs/rus/Realization/02_Authorization/webhooks_registry.md`. Если необходимо восстановить записи, предоставьте текущие URL — мы добавим их туда в виде BaseURL + SHA256(webhook_code) (первые 12 символов).

### 6.2 On‑Prem (Цель) – Вебхук импорт‑шлюза
Паттерн URL: `https://onprem.example.local/webhook/<import_user_id>/<import_code>/<method>`

Имена методов (префикс `import.`):
| Модуль (вирт.) | Метод                    | Назначение                      | Max Batch | Rate (req/min) | Идемпотентность ключ            | Примечания |
|----------------|--------------------------|----------------------------------|-----------|----------------|----------------------------------|------------|
| users          | `import.users.batch`     | Создание пользователей          | 100       | 600            | source:user:id                   | Email проверка / upsert |
| groups         | `import.groups.batch`    | Создание групп                  | 100       | 400            | source:group:id                  | Может включать участников |
| chats          | `import.chats.batch`     | Создание чатов                  | 50        | 300            | source:chat:id                   | Опционально |
| feed           | `import.feed.posts`      | Посты ленты                     | 50        | 300            | source:feed:post:id+checksum     | Медиа до поста |
| tasks          | `import.tasks.batch`     | Создание/обновление задач       | 50        | 300            | source:task:id+checksum          | Upsert |
| tasks          | `import.task.comments`   | Комментарии задач               | 100       | 300            | source:task:comment:id           | Skip если нет задачи |
| crm            | `import.crm.companies`   | Компании                        | 50        | 200            | source:crm:company:id            | Перед contacts/deals |
| crm            | `import.crm.contacts`    | Контакты                        | 50        | 200            | source:crm:contact:id            | Company optional |
| crm            | `import.crm.deals`       | Сделки                          | 50        | 200            | source:crm:deal:id+checksum      | FK проверки |
| crm            | `import.crm.spitems`     | Smart Process элементы          | 50        | 200            | source:crm:sp:<type>:id          | По entityTypeId |
| workflows      | `import.workflows.tpls`  | Шаблоны процессов               | 20        | 100            | source:workflow:tpl:id           | Если в scope |

Ограничения и контроль:
- Утечка import_code = полный импорт → ограничить IP + TLS.
- Разрешать только методы `^import\.` (регулярное выражение).
- Ротация: создать новый `<import_code>`, обновить конфиг Azure, затем инвалидировать старый.
- Ответ: `{ imported, skipped, failed[], duplicate[] }`.

Multi-tenant расширение: `import.<tenant>.users.batch` (зарезервировано на будущее).

## 7. Архитектура Azure Serverless
| Компонент                 | Сервис                 | Назначение / Примечание                                           |
|--------------------------|------------------------|-------------------------------------------------------------------|
| Управляющий HTTP         | Azure Functions v4     | Запуск полной / дельта экстракции, статус                         |
| Очередь работы           | Azure Storage Queue    | Сообщение = страница / партия                                    |
| Очередь DLQ              | Azure Storage Queue    | Превышен лимит ретраев                                           |
| Таблица маппинга ID      | Azure Table Storage    | PK=entity_type, RK=source_id; target_id, checksum, timestamps     |
| Архив RAW                | Azure Blob Storage     | Исходный JSON                                                    |
| Медиа                    | Azure Blob Storage     | Изображения ленты                                                |
| Секреты / URL            | Key Vault / App Config | Хранение source и target webhook URL                             |
| Конфигурация             | App Configuration      | Batch размеры, параллелизм, фичи                                  |
| Метрики / Логи           | App Insights           | Трейсы, метрики, алерты                                          |

### 7.1 Batching
Адаптивно: начинать 50, увеличивать до порога p95 или 429.

### 7.2 Агрессивный Retry
Классы: Transient (timeout, 5xx, 429) → экспоненциально с джиттером; Permanent (4xx валидация) → DLQ.

### 7.3 Идемпотентность
Ключ: entity_type + source_id (+ checksum для изменяемых). Если checksum тот же — пропускаем.

## 8. Последовательность Экстракции
| Порядок | Сущность        | Основной метод                   | Legacy              | Зависимости   | Параллель | Пагинация |
|---------|-----------------|----------------------------------|---------------------|---------------|-----------|-----------|
| 1       | Users           | `user.get`                       | —                   | —             | Средняя   | start     |
| 2       | Groups          | `sonet_group.get`                | —                   | Users         | Средняя   | start     |
| 3       | Group Members   | `sonet_group.user.get`           | —                   | Groups        | Высокая   | start     |
| 4       | Chats           | `im.chat.get`                    | —                   | Users         | Низкая    | n/a       |
| 5       | Chat Messages   | `im.chat.message.list`           | —                   | Chats         | Средняя   | OFFSET    |
| 6       | Feed Posts      | `log.blogpost.get`               | —                   | Users         | Средняя   | PAGE      |
| 7       | Feed Comments   | `log.blogpost.getcomments`       | —                   | Feed Posts    | Высокая   | PAGE      |
| 8       | Tasks           | `task.item.list`                 | —                   | Users, Groups | Средняя   | start     |
| 9       | Task Details    | `task.item.get`                  | —                   | Tasks         | Высокая   | n/a       |
| 10      | Task Comments   | `task.commentitem.getlist`       | —                   | Tasks         | Высокая   | start     |
| 11      | CRM Companies   | `crm.company.list`               | —                   | Users         | Средняя   | start     |
| 12      | CRM Contacts    | `crm.contact.list`               | —                   | Users         | Средняя   | start     |
| 13      | CRM Deals       | `crm.deal.list`                  | —                   | Companies/Contacts | Средняя| start     |
| 14      | CRM SP Items    | `crm.item.list`                  | —                   | Users         | Средняя   | start     |
| 15      | Workflows       | `bizproc.workflow.template.list` | —                   | —             | Низкая    | start(*)  |
*smart invoices
## 9. Последовательность Импорта
| Порядок | Сущность       | Endpoint                      | Batch | Ключ идемпотентности         | Проверки перед вставкой                 |
|---------|----------------|-------------------------------|-------|------------------------------|-----------------------------------------|
| 1       | Users          | POST /api/import/users        | 100   | source:user:id               | Email уникален                          |
| 2       | Groups         | POST /api/import/groups       | 100   | source:group:id              | Owner существует                        |
| 3       | Group Members  | (внутри groups)               | 100   | source:group:id:user         | User существует                         |
| 4       | Chats          | POST /api/import/chats        | 50    | source:chat:id               | Участники существуют                    |
| 5       | Feed Posts     | POST /api/import/feed-posts   | 50    | source:feed:post:id+hash     | Автор существует                        |
| 6       | Feed Comments  | (опционально)                 | 100   | source:feed:comment:id       | Пост импортирован                       |
| 7       | Tasks          | POST /api/import/tasks        | 50    | source:task:id+hash          | Ответственный существует                |
| 8       | Task Comments  | (nested или отдельный)        | 100   | source:task:comment:id       | Задача импортирована                    |
| 9       | CRM Companies  | POST /api/import/crm/companies| 50    | source:crm:company:id        | —                                       |
| 10      | CRM Contacts   | POST /api/import/crm/contacts | 50    | source:crm:contact:id        | Company (если нужна) существует         |
| 11      | CRM Deals      | POST /api/import/crm/deals    | 50    | source:crm:deal:id+hash      | Company/contact существуют              |
| 12      | CRM SP Items   | POST /api/import/crm/sp-items | 50    | source:crm:sp:<type>:id      | Владелец / связи существуют             |
| 13      | Workflows      | POST /api/import/workflows    | 20    | source:workflow:tpl:id       | —                                       |

## 10. Кастомные поля
Собрать метаданные полей: `crm.deal.fields`, `crm.contact.fields`, и т.п. — формировать whitelist. В On‑Prem создать соответствующие до импорта. Таблица маппинга: (entity_type, source_field_code, target_field_code, included:boolean).

## 11. Доп. критерии
- Нет write-вызовов к Bitrix (аудит allow‑list).
- DLQ < 0.5% сообщений.
- ≥95% transient ошибок успешно завершаются ретраями.
- Вебхуки (источник и цель) ротированы / старые коды отозваны <=24ч после cutover.

## 7. Риски
| Риск | Влияние | Митигция |
|------|---------|----------|
| Лимиты (429) | Замедление | Backoff, очередь |
| Объём медиа | Заполнение диска | Предварительная оценка, троттлинг |
| Несогласованные ссылки | Ошибки импорта | Проверка маппингов |
| Частичные батчи | Потери данных | Повторная очередь |
| Различия схем | Потери полей | Тестовый стенд |
| Кастомные поля | Пропуски | Белый список |
| Часовые пояса | Смещение времени | Нормализация UTC |

## 8. Дополнительно (Stretch)
- Инкрементальная синхронизация
- Hash‑детекция изменений
- Параллельный загрузчик медиа
- Дашборд целостности

## 9. Критерии приёмки
- 100% базовых сущностей перенесено (счётчики совпадают)
- ≥99% изображений успешно
- Нет «осиротевших» ссылок
- Runbook передан
- Вебхуки (источник и целевой импорт) ротированы / отозваны

---
Подготовлено для планирования миграции.

## 12. Практическая инструкция (Cloud ↔ Azure Functions ↔ On‑Prem Webhook) с командами

Ниже пошагово: что делаем на стороне Bitrix24 (Cloud), что в Azure (Functions), что в On‑Prem API. Примеры команд адаптированы под PowerShell (Windows). Bash вариант дан опционально.

### 12.1 Подготовка источника (Bitrix24 Cloud)
1. Создать входящий вебхук (Профиль администратора → Приложения → Вебхуки → «Добавить входящий»). Отметить модули: user, sonet_group, task, log, crm (и им, bizproc если нужны). Скопировать URL вида:
    https://<портал>.bitrix24.ru/rest/<user_id>/<webhook_code>/
2. Проверить доступ к `user.get` (первая страница):
```powershell
curl "https://<портал>.bitrix24.ru/rest/<user_id>/<webhook_code>/user.get?start=0" | jq '.'
```
3. Тест задачи (legacy API):
```powershell
curl "https://<портал>.bitrix24.ru/rest/<user_id>/<webhook_code>/task.item.list?start=0" | jq '.'
```
Проверить наличие массива задач; для деталей использовать `task.item.get?TASK_ID=<id>`.

### 12.2 Подготовка webhook On‑Prem
1. На целевой системе создать импорт‑шлюз с базовым путём `/webhook/<import_user_id>/<import_code>/`.
2. Сгенерировать `import_code` (32 случайных символа) — можно `openssl rand -base64 24`.
3. Ограничить доступ (белый список IP Azure / VPN).
4. Сохранить полный URL в Key Vault / App Configuration как `ONPREM_IMPORT_WEBHOOK_BASE`.

### 12.3 Пример импорта пользователей (webhook)
Файл users.json:
```json
[
   {"sourceId":"cloud:user:15","email":"user15@example.com","name":"User 15"},
   {"sourceId":"cloud:user:16","email":"user16@example.com","name":"User 16"}
]
```
Вызов (POST на метод `import.users.batch`):
```powershell
$body = Get-Content users.json -Raw
curl -X POST "https://onprem.example.local/webhook/9001/AbCdEfGh123/import.users.batch" `
   -H "Content-Type: application/json" `
   -H "X-Idempotency-Key: batch-users-15-16" `
   --data "$body"
```
Ответ:
```json
{"imported":2,"skipped":0,"failed":[],"duplicate":[]}
```

### 12.4 Пример импорта задач
Файл tasks.json:
```json
[
   {"sourceId":"cloud:task:101","title":"Task 101","responsibleSourceId":"cloud:user:15","checksum":"abc123"},
   {"sourceId":"cloud:task:102","title":"Task 102","responsibleSourceId":"cloud:user:16","checksum":"def456"}
]
```
Вызов:
```powershell
curl -X POST "https://onprem.example.local/webhook/9001/AbCdEfGh123/import.tasks.batch" `
   -H "Content-Type: application/json" `
   -H "X-Idempotency-Key: batch-tasks-101-102" `
   --data (Get-Content tasks.json -Raw)
```
Серверная идемпотентность: ключ на элемент = `source:task:<id>` + сравнение checksum.

### 12.5 Получение данных из Bitrix24 (webhook) в Azure Function
Упрощённый HTTP GET (PowerShell) — сохраняем первую страницу пользователей в файл:
```powershell
curl "https://<портал>.bitrix24.ru/rest/<user_id>/<webhook_code>/user.get?start=0" -o users_page0.json
```
Далее очередь: каждая страница -> сообщение:
```json
{
   "entity":"user",
   "method":"user.get",
   "start":0
}
```
Azure Function (Queue Trigger) парсит, делает вызов, сохраняет raw, нормализует, вызывает on‑prem webhook метод.

### 12.6 Пример псевдокода импорта (TypeScript фрагмент)
```ts
interface ImportUser { sourceId:string; email:string; name:string; }
async function importUsers(batch: ImportUser[], ctx: { table: TableClient }) {
   for (const u of batch) {
      const rowKey = u.sourceId;
      const exists = await ctx.table.getEntity("user", rowKey).catch(()=>null);
      if (exists) continue; // идемпотентность
      // call on-prem API
   }
}
```

### 12.7 Ротация webhook кода
1. Сгенерировать новый `import_code_new`.
2. Добавить параллельно маршрут `/webhook/<import_user_id>/<import_code_new>/...`.
3. Обновить конфиг Azure (переменная ONPREM_IMPORT_WEBHOOK_BASE_NEW).
4. Наблюдать: все новые вызовы используют новый код.
5. Удалить старый маршрут и зачистить логи.

### 12.8 Быстрая таблица кто что делает
| Шаг | Сторона        | Действие                                 |
|-----|----------------|-------------------------------------------|
| 1   | Cloud B24      | Создать вебхук                            |
| 2   | Azure          | Сохранить webhook URL (конфиг)            |
| 3   | On‑Prem        | Создать import_code                       |
| 4   | Azure / KV     | Сохранить on‑prem webhook base URL        |
| 5   | Azure Func     | Запуск экстракции (users)                 |
| 6   | Azure Queue    | Постановка страниц в очередь              |
| 7   | Azure Func     | Экстракция + нормализация                 |
| 8   | Azure Func     | Вызов on‑prem import.* методов            |
| 9   | On‑Prem        | Вставка / пропуск по идемпотентности      |
| 10  | Azure Monitor  | Метрики (успех / retry / DLQ)             |
| 11  | Все            | Ротация import_code после cutover         |

### 12.9 Диагностика типовых ошибок
| Симптом                                | Причина                          | Действие |
|----------------------------------------|----------------------------------|----------|
| 403 от On‑Prem                         | Неверный / устаревший webhook   | Проверить import_code / ротацию |
| 409 дубликат                           | Повторная отправка batch        | Проверить идемпотентность / checksum |
| Bitrix ответ error QUERY_LIMIT_EXCEEDED| Превышен лимит                   | Увеличить backoff / снизить параллель |
| DLQ растёт >0.5%                       | Постоянные ошибки данных         | Анализ логов, корректировка маппинга |

---
Эта секция даёт минимальный рабочий сценарий end‑to‑end (webhook модель обе стороны).
