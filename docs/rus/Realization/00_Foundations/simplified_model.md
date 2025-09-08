# Упрощённая модель миграции (Single-Pass)

Цель: минимизировать сложность для одноразового запуска миграции.

## Общий Pipeline per Entity
1. <entity>-custom-fields-get (опционально)
2. <entity>-custom-fields-set
3. <entity>-get (Cloud -> Azure Table Status=NEW)
4. <entity>-set (Импорт NEW -> IMPORT_OK / IMPORT_ERR / ERROR_RETRY)
5. <entity>-verify (count + sample; выставление VERIFIED_FLAG)

## Табличная схема (Azure Table)
PartitionKey: <entity>
RowKey: <sourceId>
Payload: JSON (оригинал)
PayloadHash: SHA256 (только feed posts, chat messages)
Status: NEW | IMPORT_OK | IMPORT_ERR | ERROR_RETRY
Attempts: int
LastError: string
TargetId: string
ImportedAtUtc: datetime
PulledThrough: bool

## Status Flow
NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY
ERROR_RETRY -> IMPORT_OK | IMPORT_ERR

## Retry Политика
Максимум 3 попытки: 0s, 2s±jitter, 6s±jitter. Ошибки 429/5xx -> retry; 4xx (кроме 429) -> IMPORT_ERR сразу.

## Checksum / Hash
Считаем PayloadHash только для крупных изменяемых сообщений (feed posts, chat messages) для устранения повторных set попыток (если payload не менялся). Для остальных пропускаем.

## Конфигурация (config.json)
{
  "defaults": { "page_size": 50, "import_batch": 20, "max_retries": 3, "verify_sample": 10 },
  "entities": {
    "users": { "enabled": true },
    "feed": { "enabled": true, "checksum": true },
    "tasks": { "enabled": true },
    "groups": { "enabled": true },
    "chats": { "enabled": true, "checksum": true },
    "workflows": { "enabled": true },
    "crm_companies": { "enabled": true },
    "crm_contacts": { "enabled": true },
    "crm_deals": { "enabled": true },
    "crm_spitems": { "enabled": true }
  }
}

## Metrics (унифицированные)
- records_extracted_total{entity}
- records_import_ok_total{entity}
- records_import_err_total{entity}
- retry_attempts_total{entity}
- verify_sample_mismatch_total{entity}
- custom_fields_created_total{entity}
- duration_ms{entity,phase}

## Verify
- Count сравнение.
- Random sample (verify_sample) — прямое сравнение ключевых полей.

## Test Limit
Опциональный параметр test_limit ограничивает число первых записей при get. Pull-through зависимостей (Deals -> Contacts/Companies) выполняется автоматически с флагом PulledThrough=true.

## Observability
Логи JSON: { ts, level, entity, op, sourceId, status, attempt, latency_ms, error_code }.

## Безопасность
Секреты: Key Vault refs. Config: версионируемый manifest. Нет динамической перезагрузки.

## Исключения / Не реализуем
- Delta / повторные синки
- Сложная нормализация адресов
- Active workflow instances
- Пер-метод адаптивный rate limiting (только базовый backoff при 429)

History:
- scaffold
