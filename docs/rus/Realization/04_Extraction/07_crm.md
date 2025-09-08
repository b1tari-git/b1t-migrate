# 4.7 CRM (Companies, Contacts, Deals, Smart Process)

Single-pass последовательность для соблюдения FK:
1. Companies -> 2. Contacts -> 3. Deals -> 4. Smart Process Items.
Переход к следующей сущности после завершения импорта (нет NEW/ERROR_RETRY > 0).

## Prerequisites
- users.import.completed
- mapping.crm.initial
- auth.cloud.crm (crm.* list/read)
- auth.target.import.crm (import.crm.* endpoints)
- decision.crm.customFields (whitelist)
- infra.storage.ready

## Metrics (минимум)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=crm_companies} | Компаний извлечено |
| records_extracted_total{entity=crm_contacts} | Контактов извлечено |
| records_extracted_total{entity=crm_deals} | Сделок извлечено |
| records_extracted_total{entity=crm_spitems} | SP items извлечено |
| records_import_ok_total{entity=...} | Импортировано (каждая сущность) |
| records_import_err_total{entity=...} | Ошибки (финальные) |
| retry_attempts_total{entity=crm} | Повторные попытки |
| duration_ms{entity=crm,phase=companies|contacts|deals|spitems} | Длительность фаз |
| verify_sample_mismatch_total{entity=crm} | Несовпадения sample |
Статус: draft
Зависимости: users.import.completed, mapping.crm.initial

## Сущности
- Компании
- Контакты
- Сделки
- Smart Process Items (по entityTypeId)

## Общие правила
| Аспект | Решение |
|--------|---------|
| Поля | Whitelist + обязательные системные |
| Кастомные | Auto-create до импорта |
| Idempotency | source:crm:<entity>:<id> |
| Checksum | Только deals core hash (stage,title,responsible,amount,currency) |
| Test limit | Применяется к каждой сущности (pull-through FK) |

## 1. Companies
| Поле | Значение |
|------|----------|
| Method | crm.company.list / get |
| Paging | start |
| Import endpoint | import.crm.companies |
| Batch | 50 |

## 2. Contacts
| Поле | Значение |
|------|----------|
| Method | crm.contact.list / get |
| Depends | Companies (company_id mapping) |
| Import endpoint | import.crm.contacts |
| Batch | 50 |

## 3. Deals
| Поле | Значение |
|------|----------|
| Method | crm.deal.list / get |
| Depends | Contacts/Companies |
| Checksum | STAGE_ID, TITLE, ASSIGNED_BY_ID, AMOUNT |
| Import endpoint | import.crm.deals |
| Batch | 50 |

## 4. Smart Process
| Поле | Значение |
|------|----------|
| Method | crm.item.list (entityTypeId) |
| Param | entityTypeId per configured list |
| Import endpoint | import.crm.spitems |
| Batch | 50 |

## Верификация
| Проверка | Критерий |
|----------|----------|
| Counts | match |
| FK integrity | Нет осиротевших ссылок |
| Sample | verify_sample per entity |

## Вопросы см. crm_questions.md

History:
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Single-pass модель |
