# 4.6 Workflows (Bizproc)
Single-pass: только шаблоны (templates). Экземпляры не переносятся.
Последовательность: workflows-get -> workflows-set -> workflows-verify.

## Prerequisites
- authorization.bizproc.scope
- users.import.completed (для авторов / пользователей в шаблонах)
- auth.cloud.workflows (scope bizproc)
- auth.target.import.workflows (import.workflows.tpls)
- infra.storage.ready

## Metrics (минимум)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=workflow_templates} | Шаблонов извлечено |
| records_import_ok_total{entity=workflow_templates} | Импортировано |
| records_import_err_total{entity=workflow_templates} | Ошибки |
| retry_attempts_total{entity=workflows} | Повторы |
| duration_ms{entity=workflows,phase=get|set|verify} | Время фаз |
| verify_sample_mismatch_total{entity=workflows} | Несовпадения sample |
Статус: draft
Зависимости: authorization.bizproc.scope

## Объём
- Шаблоны бизнес-процессов (workflow templates)

## Экстракция (workflows-get)
| Поле | Значение |
|------|----------|
| Метод | bizproc.workflow.template.list |
| Paging | start |
| Storage | Table: WorkflowTemplates |
| Idempotency | source:workflow:tpl:<id> |
| Retry | 3 (0,2,6s) |

<!-- Экземпляры не переносятся по упрощённой модели -->

## Импорт (workflows-set)
| Поле | Значение |
|------|----------|
| Endpoint | import.workflows.tpls |
| Batch size | 20 |
| Idempotency | source:workflow:tpl:<id> |
| Retry | 3 попытки |

## Верификация (workflows-verify)
| Проверка | Критерий |
|----------|----------|
| Templates count | match |
| Sample | verify_sample (структура/XML) |

## Вопросы см. workflows_questions.md

History:
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Single-pass (только шаблоны) |
