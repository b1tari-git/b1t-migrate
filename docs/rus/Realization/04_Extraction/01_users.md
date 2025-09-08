# 4.1 Users

Упрощённая single-pass модель: get -> set -> verify. Без нормализационного промежуточного слоя и сложной статусной машины.

Последовательность:
1. users-custom-fields-get (опционально)
2. users-custom-fields-set (создание недостающих UF)
3. users-get (страницы Cloud -> Azure Table `Users` записи со Status=NEW)
4. users-set (импорт в on-prem: NEW -> IMPORT_OK / IMPORT_ERR / ERROR_RETRY)
5. users-verify (count + sample проверки, фиксирует VERIFIED_FLAG=true на уровне сущности)

## Prerequisites
- analysis.completed
- auth.cloud.users (webhook scope user)
- auth.target.import.users (import.users.batch доступен)
- mapping.users.done
- decision.users.customFields (whitelist сформирован)
- infra.storage.ready (Tables + Queues)

## Metrics (минимальный набор)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=users} | Кол-во извлечённых пользователей |
| records_import_ok_total{entity=users} | Импортировано OK |
| records_import_err_total{entity=users} | Импорт с ошибкой (финальный) |
| retry_attempts_total{entity=users} | Количество повторных попыток |
| custom_fields_created_total{entity=users} | Создано кастомных полей |
| verify_sample_mismatch_total{entity=users} | Несовпадения при spot-check |
| duration_ms{entity=users,phase=get|set|verify} | Длительность фаз |

Статус документа: wait
Зависимости (миграция пользователей невозможна без):
- Анализ завершён (analysis.completed)
- Настроены webhooks (auth.cloud.users, auth.target.import.users)
- Маппинг идентификаторов и политик (mapping.users)
- Решение по кастомным полям (users.customFields.decision)

Record-level статус (Azure Table `Users`):
NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY
Колонки: PartitionKey=users, RowKey=sourceId, Payload, Status, Attempts, LastError, TargetId, ImportedAtUtc.
Retry: максимум 3 (0s,2s,6s + jitter); при окончательном провале Status=IMPORT_ERR.

## Мини-задачи
1. users-custom-fields-get
2. users-custom-fields-set
3. users-get
4. users-set
5. users-verify

## 4.1.a Custom Fields
| Пункт | Деталь |
|-------|--------|
| Метод | user.get (все страницы) |
| Доп. методы | user.search (по фильтрам если нужно) |
| Webhook scope | user |
| Target storage | Table: CustomFields (Partition=user) |
| Идемпотентность | Поле по коду |
| Риск | Отсутствие расширенных полей в некоторых изданиях |

Output: список нестандартных полей -> whitelist decision.

## Экстракция (users-get)
| Поле | Значение |
|------|----------|
| Метод | user.get |
| Page size | 50 |
| Paging | start |
| Retry | 3 попытки (0,2,6s + jitter) |
| Storage | Table: Users |
| Idempotency | PK=users,RK=sourceId (upsert) |

## Импорт (users-set)
| Поле | Значение |
|------|----------|
| Target method | import.users.batch |
| Batch size | 20 |
| Идемпотентность | source:user:<id> (upsert в on-prem) |
| Validation | NAME / EMAIL обязательны, иначе IMPORT_ERR |
| Duplicate Email | IMPORT_ERR (лог) или merge по политике таргета |

## Верификация (users-verify)
| Проверка | Критерий |
|----------|---------|
| Count | Кол-во IMPORT_OK == записей в on-prem |
| Sample | verify_sample (по умолчанию 10) записей совпадают по имени/email |
| Flag | VERIFIED_FLAG=true (контрольная таблица EntitiesState) |

## Вопросы (закрыто моделью упрощения)
- department / position: переносим как есть.
- Маскировка email: нет (внутренний контур), PII контроль через exclude list глобально.
- SLA retry: максимум 3 попытки в пределах одной сессии запуска.
- Inactive: переносим (history целостность), фильтрация в UI.

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Переведено на single-pass модель |
