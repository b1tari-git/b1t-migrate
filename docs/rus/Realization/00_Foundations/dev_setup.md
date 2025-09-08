# Dev Setup (Users First) — Упрощённые дефолты

Этот документ фиксирует минимальные настройки для локальной (dev) реализации без дополнительных инструментов (Dependabot, analyzers) — по вашему запросу они исключены.

## 1. Stack
- Azure Functions v4 (isolated .NET 8 LTS)
- Azure Table Storage (таблица `migration`)
- Azure Queue Storage (`q-users-import` для импорта; отдельная очередь extract не обязательна)
- Azure Blob Storage (контейнер `avatars`)
- Azurite (локальный эмулятор) `UseDevelopmentStorage=true`

## 2. Bitrix Users API
- Endpoint: `users.get`
- Пагинация: параметр `start` (page_size=100)
- Остановка: пустой результат / отсутствует следующий `start`

## 3. Конфиг (config.json)
```
{
  "defaults": { "page_size": 100, "import_batch": 25, "max_retries": 3, "verify_sample": 10 },
  "entities": { "users": { "enabled": true } }
}
```

## 4. Переменные (.env)
```
BITRIX_WEBHOOK_URL=...
STORAGE_CONN=UseDevelopmentStorage=true
TIMEZONE_SOURCE=Europe/Warsaw
```

## 5. Модель записи (Table `migration`)
PartitionKey=users, RowKey=<sourceId>
Fields: Status, Attempts, LastError, TargetId, ImportedAtUtc, SourceOriginalTs, SourceUtcTs, OriginalOffsetMin, Payload, PulledThrough(false)
Статусы: NEW | IMPORT_OK | IMPORT_ERR | ERROR_RETRY

## 6. Идемпотентность
Key: `source:users:<id>`
Повторный импорт при IMPORT_OK -> skip (metric users.import.skip_total)

## 7. Retry / Rate Limit
- HTTP retry (transient 429/5xx): 0s, 2s, 6s (jitter ±20%)
- Global RPS soft limit: 5 (простой счетчик + задержка)
- Max importer concurrency: 4

## 8. Import Batch
- import_batch: 25
- За итерацию функции обрабатывать максимум 5 batch (yield потом)

## 9. Avatar
- Max size: 5MB (если больше -> skip)
- Timeout: 10s
- Avatar retries: 2 (после — skip)
Metrics: users.avatar.skipped_total

## 10. test_limit
- null (по умолчанию отключено)
- При установке: прекращаем сбор после N записей

## 11. Verify
- verify_sample: 10
- Поля сравнения: FirstName, LastName, Email, IsActive, DepartmentName

## 12. Ошибки
Permanent: 400,401,403,404,409,422 (без retry)
Truncate LastError до 512 символов

## 13. Логи
JSON: { ts, level, entity=users, op=extract|import, sourceId, status, attempt, durationMs, errorCode }
App Insights не подключаем в dev (консоль достаточно)
Trace sampling = 100%

## 14. Метрики (локально — лог в консоль)
- records_extracted_total{entity=users}
- records_import_ok_total{entity=users}
- records_import_err_total{entity=users}
- retry_attempts_total{entity=users}
- users.avatar.skipped_total
- duration_ms{entity=users,phase=extract|import}
- users.import.skip_total

## 15. Исключено намеренно
- Dependabot / автоматические обновления (обновления вручную по необходимости)
- Code analyzers / EditorConfig (будет добавлено позже при необходимости)

## 16. Минимальный порядок реализации
1. Table/Queue/Blob инициализация
2. BitrixClient (mock) + UsersExtractor (запись NEW)
3. UsersImporter (обновление на IMPORT_OK / IMPORT_ERR / ERROR_RETRY)
4. VerifyFunction (count + sample)
5. Локальный smoke: test_limit=5

## 17. Отложено (возможные future tasks)
- Подключение App Insights
- Добавление analyzers + style enforcement
- Dependabot / Renovate конфигурация
- Универсальный pipeline для остальных сущностей

History:
- scaffold
