# 4.3 Задачи (Tasks)

Упрощённая single-pass модель: tasks-get извлекает задачи, подзадачи, чеклисты, комментарии и вложения; tasks-set импортирует; tasks-verify проводит выборочную проверку. Сложные окна, нормализация, отдельные стадии READY_IMPORT убраны.

## Prerequisites
- users.import.completed
- mapping.users.done
- auth.cloud.tasks (scope task)
- auth.target.import.tasks (import.tasks.batch)
- decision.tasks.customFields (если применимо)
- infra.storage.ready

## Metrics (минимальный набор)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=tasks} | Задач извлечено |
| records_import_ok_total{entity=tasks} | Импортировано |
| records_import_err_total{entity=tasks} | Ошибки |
| retry_attempts_total{entity=tasks} | Повторы |
| duration_ms{entity=tasks,phase=get|set|verify} | Длительность фаз |
| verify_sample_mismatch_total{entity=tasks} | Несовпадения выборки |
| attachments_download_fail_total{entity=tasks} | Ошибки вложений |
Статус документа: wait
Зависимости (hard): analysis.completed, mapping.users, users.import.completed

Record-level статус: NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY для всех типов (Tasks, SubTasks, TaskComments, TaskChecklists). Поля: Attempts, LastError, ParentId, TargetId.

## Объем
- Задачи + Подзадачи
- Чеклисты
- Комментарии
- Вложения (<=100MB)
- Привязки (users, groups, CRM ids) — импорт как есть (CRM связи при наличии).

## Мини-задачи
1. tasks-get
2. tasks-set
3. tasks-verify

Инвентаризация статусов не выполняется отдельно (одноразовая миграция).

## tasks-get
| Поле | Значение |
|------|----------|
| Метод | tasks.task.list |
| Paging | page/limit=50 (фиксировано) |
| Storage | Table: Tasks (+ SubTasks/Comments/Checklists таблицы) |
| Retry | 3 (0,2,6s) |
| Idempotency | PK=tasks,RK=sourceId |

## Детали (инлайн)
Подзадачи, чеклисты, комментарии извлекаются лениво при обработке каждой задачи (fan-out) с ограничением параллелизма.

## Вложения
Скачивание при встрече (limit 100MB). Ошибка -> до 3 повторов. Hash необязателен (не считаем).

## tasks-set (Импорт)
| Поле | Значение |
|------|----------|
| Batch size tasks | 20 |
| Порядок | Родительские задачи до подзадач (пакетная сортировка) |
| Idempotency | source:task:<id> |
| Retry | 3 попытки |
| Ошибки | IMPORT_ERR после 3 попыток |

## tasks-verify
| Проверка | Критерий |
|----------|----------|
| Tasks count | match |
| SubTasks | match |
| Comments | match |
| Sample | verify_sample (по умолчанию 10) |

## Риски
- Глубокая иерархия подзадач
- Высокое число мелких комментариев
- Большие вложения

## Вопросы (закрыто моделью)
- История изменений: не переносим (объём/сложность), только ключевые поля и статусы.
- Кастомные поля: перенос как есть (auto-create ранее решено).
- CRM связи: импорт при наличии маппинга, иначе оставляем пусто.
- Архив: статусы 1:1 без доп архивации.
- Expired: переносим оригинальные дедлайны.

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Переведено на single-pass модель |
