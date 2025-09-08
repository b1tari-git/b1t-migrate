# Этап 3: Маппинг идентификаторов и полей

Статус: wait
Зависимости: 01_Analysis, 02_Authorization
Цель: Определить и зафиксировать преобразование идентификаторов и полей между cloud и on-prem, включая временные зоны.

См. глобальные конвенции: ../00_Foundations/README.md (RecordStatus, Idempotency, Timezones).

## Объём
- Маппинг Users (sourceId -> targetId)
- Маппинг Tasks, Feed Posts, Comments
- Маппинг CRM (контакты, компании) — черновик
- Маппинг кастомных полей (normalization rules)
- Хранение в Azure Table `IdMap` и `FieldMap`

## Структуры
`IdMap`:
| PK | RK | SourceType | SourceId | TargetId | ImportedAt | Status |
|----|----|------------|---------|----------|-----------|--------|
| map | user:123 | user | 123 | 987 | ts | ok |

`FieldMap`:
| PK | RK | Entity | FieldSource | FieldTarget | Transform | Notes |
|----|----|--------|-------------|-------------|-----------|-------|
| field | task:PRIORITY | task | PRIORITY | PRIORITY | none | preserve |

## Временные зоны
| Правило | Деталь |
|---------|--------|
| Сбор | Все source timestamps -> parse -> UTC |
| Хранение | UTC в основных полях + OriginalOffset минут |
| Импорт | Перед отправкой в on-prem оставляем UTC если система поддерживает, иначе reconvert |
| Верификация | Сравнение в UTC, отчёт показывает локальное и UTC |

## Мини-задачи
1. 3.1 Схема таблиц маппинга (утвердить)
2. 3.2 Users первичный маппинг после импорта пачки
3. 3.3 Tasks связки (parentId, responsibleId)
4. 3.4 Feed (authorId, comment.parentId)
5. 3.5 CRM черновик правил
6. 3.6 Тест пересоздания checksum

## Метрики
| Метрика | Цель |
|---------|------|
| mapping.users.coverage | >=98% до начала массового импорта |
| mapping.tasks.pending | -> 0 |
| mapping.field.rules | 100% нужных полей |

## Риски
- Отсутствие targetId (ошибка раннего импорта) -> статус pending
- Расхождение часовых поясов -> некорректный порядок событий

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан шаблон |
