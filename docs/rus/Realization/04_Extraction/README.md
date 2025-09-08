# Этап 4: Экстракция (Core)

Статус: wait
Зависимости: Этап 1 (Анализ), Этап 2 (Авторизация), Этап 3 (Маппинг)

Подэтапы:
- 4.1 Users
- 4.2 Feed
- 4.3 Tasks
 - 4.4 Groups (Workgroups)
 - 4.5 Chats (IM)
 - 4.6 Workflows (Bizproc)
 - 4.7 CRM (Companies, Contacts, Deals, Smart Process)

Упрощённая модель (single-pass) для каждой сущности:
1. <entity>-custom-fields-get (опционально)
2. <entity>-custom-fields-set
3. <entity>-get (Cloud -> Azure Table записи со Status=NEW)
4. <entity>-set (импорт: NEW -> IMPORT_OK/IMPORT_ERR/ERROR_RETRY)
5. <entity>-verify (count + sample, выставление VERIFIED_FLAG на уровне сущности)

Статусная машина минимальна: NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY.

## 4.1 Users
Док: ./01_users.md
Вопросы: ./01_users_questions.md

## 4.2 Feed
Док: ./02_feed.md
Вопросы: ./02_feed_questions.md

## 4.3 Tasks
Док: ./03_tasks.md
Вопросы: ./03_tasks_questions.md

## 4.4 Groups
Док: ./04_groups.md
Вопросы: ./04_groups_questions.md

## 4.5 Chats
Док: ./05_chats.md
Вопросы: ./05_chats_questions.md

## 4.6 Workflows
Док: ./06_workflows.md
Вопросы: ./06_workflows_questions.md

## 4.7 CRM
Док: ./07_crm.md
Вопросы: ./07_crm_questions.md

## Метрики (унифицированные)
| Metric | Описание |
|--------|----------|
| records_extracted_total{entity} | Извлечено записей |
| records_import_ok_total{entity} | Импортировано успешно |
| records_import_err_total{entity} | Импорт с ошибкой (финальный) |
| retry_attempts_total{entity} | Повторные попытки |
| verify_sample_mismatch_total{entity} | Несовпадения проверки |
| custom_fields_created_total{entity} | Создано кастомных полей |
| duration_ms{entity,phase} | Длительность фаз (get/set/verify) |

## Стек и паттерны
Azure Functions v4, TypeScript, Azure Queue (work, dlq), Azure Table (entity data, id mapping), Azurite (локальная разработка), Progressive Retry (exp + jitter), Batch <= конфиг.

Часовые пояса: сохраняем SourceOriginal (как получено), вычисляем UTC, пишем OriginalOffset. При сравнении и расчёте дельт используем UTC.

Test limit: опционально ограничивает N первых записей при get для smoke (pull-through зависимостей допускается сверх N).

## Общие требования к мини-задаче
| Поле | Значение |
|------|----------|
| Обязательный предыдущий статус | mapping.done, auth.done |
| Scope webhook (cloud) | user / log / task |
| Scope webhook (target) | import.* соответствующий |
| Idempotency | source:<entity>:<id> (+checksum если изменяемая) |
| Record Status Flow | NEW -> IMPORT_OK/IMPORT_ERR/ERROR_RETRY |
| Retry Policy | Max 3 (0s,2s,6s + jitter) |
| Paging | start / OFFSET / PAGE |
| Rate Limit Strategy | concurrency cap + backoff 429 |
| Inventory & Pagination | Логирование в `SourceInventory` и `PageLog` (см. Foundations §12) |
| Test Import Throttle | Параметр `test_limit` влияет только на get (извлечение первых N) |

