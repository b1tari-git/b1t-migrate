# 4.5 Чаты (IM)

Single-pass: chats-get собирает чаты и их сообщения (параллельно с ограничением), chats-set импортирует чаты затем сообщения, chats-verify сверяет счётчики и sample. Чек-суммы считаются только для сообщений (PayloadHash) для пропуска повторов.

## Prerequisites
- users.import.completed
- auth.cloud.chats (scope im)
- auth.target.import.chats (import.chats.batch)
- infra.storage.ready

## Metrics (минимум)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=chats} | Чатов извлечено |
| records_extracted_total{entity=chat_messages} | Сообщений извлечено |
| records_import_ok_total{entity=chats} | Чатов импортировано |
| records_import_ok_total{entity=chat_messages} | Сообщений импортировано |
| records_import_err_total{entity=chat_messages} | Ошибки сообщений |
| retry_attempts_total{entity=chats} | Повторы |
| verify_sample_mismatch_total{entity=chats} | Несовпадения sample |
| duration_ms{entity=chats,phase=get|set|verify} | Время фаз |
Статус: draft
Зависимости: users.import.completed

## Объём
- Чаты (im.chat.get)
- Сообщения (im.chat.message.list)
- Типы: private 1:1, group, channel (уточнить)

## Таблицы
Chats (PK=chats,RK=<chatId>)
ChatMessages (PK=chat_messages,RK=<chatId>:<msgId>, PayloadHash)

## Экстракция (chats-get)
| Поле | Значение |
|------|----------|
| Чаты метод | im.chat.get |
| Сообщения метод | im.chat.message.list |
| Paging сообщений | OFFSET/LIMIT=50 |
| Concurrency | Ограничение (конфигurable), queue of chatIds |
| Idempotency | source:chat:<id>, source:chat:msg:<id> |
| Hash | SHA256 для сообщений |
| Retry | 3 (0,2,6s) |

## Импорт (chats-set)
| Поле | Значение |
|------|----------|
| Endpoint | import.chats.batch |
| Batch size chats | 20 |
| Batch size messages | 100 |
| Order | Сначала чаты, затем сообщения (по chatId) |
| Retry | 3 попытки |
| Errors | IMPORT_ERR после лимита |

## Верификация (chats-verify)
| Проверка | Критерий |
|----------|----------|
| Chats count | match |
| Messages count | match |
| Sample | verify_sample сообщений (контент/text) |
| Participants | 100% user mapping (иначе mismatch) |

## Вопросы см. chats_questions.md

History:
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Single-pass модель |
