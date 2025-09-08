# 00 Foundations: Конвенции и Глобальные Энумы

Цель: Централизовать все общие определения (статусы, enum, соглашения по именованию, политика временных зон, idempotency keys) чтобы остальные этапы не дублировали.

## 1. RecordStatus (упрощённый Enum)
```
NEW
IMPORT_OK
IMPORT_ERR
ERROR_RETRY
```
Пояснения:
- IMPORT_OK фиксирует TargetId, ImportedAt
- IMPORT_ERR записывает LastErrorCode, LastErrorAt (не ретраим)
- ERROR_RETRY промежуточный статус между попытками (max 3)

## 2. Общие столбцы (Azure Table)
| Column | Тип | Описание |
|--------|-----|----------|
| PartitionKey | string | entity / namespace |
| RowKey | string | sourceId или составной ключ |
| Status | string | RecordStatus enum |
| SourceOriginalTs | string (ISO) | Timestamp как пришёл |
| SourceUtcTs | string (ISO) | Нормализованный UTC |
| OriginalOffsetMin | int | Смещение в минутах от UTC |
| TargetId | string | ID после импорта |
| ImportedAt | string | UTC время успешного импорта |
| AttemptCount | int | Кол-во попыток импорта |
| LastErrorCode | string | Код последней ошибки |
| LastErrorAt | string | UTC время ошибки |
| RetryAfterUtc | string | Следующее время попытки |

## 3. Idempotency Key Формат
`source:<entity>:<sourceId>` (single-pass, без версионного хвоста)

## 4. Webhook Naming
| Назначение | Формат имени | Пример |
|------------|--------------|--------|
| Cloud outbound | <entity>.cloud | users.cloud |
| Target inbound import | import.<entity> | import.users |
| (Удалено) Delta | — | — |

## 5. Ограничения / Rate Limit
| Параметр | Определение |
|---------|-------------|
| MaxRps | Верхний предел вызовов в секунду |
| Burst | Допустимый кратковременный всплеск |
| Cooldown429Ms | Базовая задержка после 429 |

## 6. Стратегия Retry (упрощено)
Макс 3 попытки: 0s,2s,6s (+/- jitter). Отдельная DLQ после исчерпания.

## 7. Политика частичного импорта (Dev)
Опциональный `test_limit` (per entity) для извлечения первых N записей + pull-through зависимостей.

## 8. Временные зоны
- Приём: если API возвращает локальное время без offset — используем конфиг TimezoneSource (из анализа) для парсинга.
- Всегда вычисляем UTC и сохраняем оригинал.
- Сравнения/дельты только в UTC.

## 9. Метрики (префиксы)
| Префикс | Значение |
|---------|----------|
| migration.* | Унифицированные метрики импортного пайплайна |
| auth.* | Авторизация и webhooks |
| cutover.* | Операции cutover |

## 10. QA Minimal Dataset (Dev)
| Entity | Критерий отбора |
|--------|-----------------|
| Users | Последние активные 50 по дате изменения |
| FeedPosts | Последние 30 постов + комментарии |
| Tasks | Последние 50 изменённых |
| Companies | Последние 30 созданных |
| Contacts | Последние 30 обновлённых |
| SmartClients | Последние 30 |

## 11. Документ обновлений
Любое изменение enum / ключевых политик фиксируется здесь + ссылка на commit.

## 12. Инвентаризация исходных данных и логирование пагинации
Обязательное требование: при полном проходе по сущности фиксировать численность и параметры пагинации, чтобы:
1) Сверять полноту (reported vs retrieved)
2) Выявлять несогласованность API (drift)
3) Иметь базу для расчёта прогресса (ETA)

### Таблица `SourceInventory`
| PK | RK | Entity | ReportedTotal | RetrievedTotal | PageCount | SnapshotAtUtc | SourceMethod | Notes |
|----|----|--------|---------------|----------------|-----------|---------------|--------------|-------|
| inv | users:2025-08-30T10:00Z | users | 1342 | 1342 | 14 | 2025-08-30T10:01Z | user.get | initial full |

### Таблица `PageLog`
| PK | RK | Entity | PageIndex | PageSize | Retrieved | ApiParamsHash | StartedAtUtc | FinishedAtUtc | DurationMs |
|----|----|--------|-----------|----------|----------|---------------|--------------|---------------|------------|
| page | users:0000 | users | 0 | 100 | 100 | h1 | ts | ts | 320 |

Правила:
- `ReportedTotal` берётся из поля ответа API (если доступно) либо вычисляется после полного прохода.
- `RetrievedTotal` суммируется из `PageLog`.
- Несовпадение -> метрика alert.
- Сущности: users, im.chats, im.messages (если scope), feed.posts, feed.comments, tasks, companies, contacts, deals, smart.clients.

### Метрики
| Метрика | Описание |
|---------|----------|
| inventory.<entity>.reported | Значение ReportedTotal |
| inventory.<entity>.retrieved | Значение RetrievedTotal |
| inventory.<entity>.drift | reported - retrieved (ожидаем 0) |
| extraction.<entity>.pages | Кол-во страниц (PageCount) |

### Логика обновления
- При полном проходе создаём новую запись `SourceInventory` (ключ с датой/временем).
- Последняя запись per entity помечается флагом `IsLatest=true` (доп. колонка при необходимости).
// Удалено: ветка логики для дельты.

История:
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Упрощён: удалены DELTA_* статусы и логика дельты |
