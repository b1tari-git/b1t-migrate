# 4.4 Группы (Workgroups)

Single-pass: groups-get -> groups-set -> groups-verify. Участники извлекаются в рамках groups-get и импортируются после успешного импорта группы (внутренний порядок в процессе groups-set).

## Prerequisites
- users.import.completed
- auth.cloud.groups (scope sonet_group)
- auth.target.import.groups (import.groups.batch)
- infra.storage.ready

## Metrics (минимум)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=groups} | Групп извлечено |
| records_extracted_total{entity=group_members} | Связей участников извлечено |
| records_import_ok_total{entity=groups} | Групп импортировано |
| records_import_err_total{entity=groups} | Ошибки групп |
| records_import_err_total{entity=group_members} | Ошибки участников |
| retry_attempts_total{entity=groups} | Повторы |
| verify_sample_mismatch_total{entity=groups} | Несовпадения выборки |
| duration_ms{entity=groups,phase=get|set|verify} | Длительность фаз |
Статус: draft
Зависимости: users.import.completed

## Объём
- Группы (sonet_group)
- Участники (membership)
- Основные атрибуты: NAME, DESCRIPTION, OWNER_ID, ACTIVE, DATE_CREATE/UPDATE

## Структуры
Table: Groups (PK=group, RK=sourceId)
Table: GroupMembers (PK=groupMember, RK=groupId:userId)

## Поток статусов
NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY (группы и участники аналогично)

## Экстракция (groups-get)
| Поле | Значение |
|------|----------|
| Метод | sonet_group.get |
| Paging | start (page size 50) |
| Storage | Table: Groups |
| Idempotency | PK=groups,RK=sourceId |
| Retry | 3 (0,2,6s) |

## Участники (inline)
Каждая группа после извлечения подтягивает участников (paging start). Записываются в Table: GroupMembers (PK=groupMembers,RK=<groupId>:<userId>). Status=NEW.

## Импорт (groups-set)
| Поле | Значение |
|------|----------|
| Endpoint | import.groups.batch |
| Batch size | 20 |
| Order | Сначала группа, после IMPORT_OK её участники пачками |
| Retry | 3 попытки |
| Errors | IMPORT_ERR после лимита |

## Верификация (groups-verify)
| Проверка | Критерий |
|----------|----------|
| Groups count | match |
| Members coverage | match |
| Owners | Все ownerId разрешены (иначе mismatch) |
| Sample | verify_sample групп |

## Вопросы см. groups_questions.md (решения применимы, сложные статусы сняты)

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Переведено на single-pass модель |
