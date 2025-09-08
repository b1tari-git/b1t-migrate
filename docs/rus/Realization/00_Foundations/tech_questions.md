# Технические вопросы (Tech Project) — финальные решения

Примечание (simplified model): Адаптивные механизмы (periodic reload flags, иерархический rate limiting, adaptive batches/throttling/workers) упрощены до статических. Соответствующие пункты помечены «(Заменено)».

Цель: зафиксировать принятые технические решения для одноразовой single-pass миграции. Все вопросы закрыты, ниже — итоговая таблица и краткие последствия.

| ID | Категория | Вопрос (кратко) | Статус | Решение |
|----|-----------|-----------------|--------|---------|
| TECHQ1 | Архитектура | Function App количество | closed | A: Один Function App |
| TECHQ2 | Архитектура | Orchestrator подход | closed | B: Очереди + state table |
| TECHQ3 | Архитектура | Исполнение pull/hybrid | closed | B: Hybrid webhooks+pull |
| TECHQ4 | Инфраструктура | Хранение вложений | closed | A: Прямой Blob stream |
| TECHQ5 | Конфигурация | Формат конфигов | closed | B: Manifest JSON + KV |
| TECHQ6 | Конфигурация | Reload feature flags | closed | (Заменено) A: Restart only |
| TECHQ7 | Надёжность | Rate limiting buckets | closed | (Заменено) A: Global bucket |
| TECHQ8 | Надёжность | Retry стратегия | closed | B: Exp backoff + jitter |
| TECHQ9 | Идемпотентность | Хранение ключей | closed | A: Таблица processed_keys (минимум) |
| TECHQ10 | Очереди | Dead-letter политика | closed | A: N ретраев -> DLQ |
| TECHQ11 | Логи | Формат | closed | A: JSON структурированный |
| TECHQ12 | Observability | Tracing | closed | C: Sampling p=0.1 |
| TECHQ13 | Метрики | Система | closed | A: App Insights custom |
| TECHQ14 | Алёрты | Модель | closed | C: Гибрид threshold+SLO |
| TECHQ15 | Секреты | Dev/Prod | closed | B: KV + локальный .env |
| TECHQ16 | Тестирование | Local integration | closed | C: Комбинация live+fixtures |
| TECHQ17 | Тестирование | Smoke CI | closed | C: PR + nightly |
| TECHQ18 | Performance | Tuning batches | closed | (Заменено) A: Static size |
| TECHQ19 | Performance | Кэш справочников | closed | B: Table + LRU in-mem |
| TECHQ20 | Cutover | Freeze enforcement | closed | C: Флаг + timestamp |
| TECHQ21 | Rollback | Подход | closed | A: Повтор idempotent, без rollback |
| TECHQ22 | Версионирование | migration_version | closed | A: В каждую запись |
| TECHQ23 | Схема БД | Migrations apply | closed | C: Dev auto, Prod manual |
| TECHQ24 | Очистка | Raw cleanup | closed | B: Хранить до cutover |
| TECHQ25 | Безопасность | Outbound ограничения | closed | A: NSG whitelist |
| TECHQ26 | Инциденты | Runbook формат | closed | A: Markdown в репо |
| TECHQ27 | Throttling | Adaptive 429 | closed | (Заменено) Basic exp backoff only |
| TECHQ28 | Параллелизм | Лимит воркеров | closed | (Заменено) A: Static MAX_ACTIVE_WORKERS |
| TECHQ29 | Хеширование | Алгоритм checksum | closed | B: Murmur3 (fallback SHA256) |
| TECHQ30 | Вложения | Retry скачивания | closed | A: 3 попытки (1,2,4s+jitter) |

## Решения и последствия
- TECHQ1: Один Function App — простота деплоя; минус: общий blast radius.
- TECHQ2: Очереди + state table — явный контроль, проще эволюция кода.
- TECHQ3: Hybrid — минимизируем пропуски свежих событий, ограниченная сложность.
- TECHQ4: Blob stream — отсутствует стадия temp cleanup.
- TECHQ5: Manifest версионируем — auditable diffs; секреты вне репа в KV.
- TECHQ6: (Заменено) Restart only — минимальный код; изменение фич через redeploy.
- TECHQ7: (Заменено) Global bucket — минимальное состояние; риск локальных всплесков принимаем.
- TECHQ8: Exp+jitter — устойчивость к пачкам 429/5xx.
- TECHQ9: processed_keys — явная идемпотентность, одна таблица для мониторинга.
- TECHQ10: DLQ после N — быстрая изоляция ядовитых сообщений.
- TECHQ11: JSON logs — простая фильтрация и корреляция traceId.
- TECHQ12: Sampling 10% — достаточная наблюдаемость без перегрузки.
- TECHQ13: App Insights только — минимальная интеграция (Prometheus не требуется).
- TECHQ14: Гибрид алёртов — быстрые сигналы + долгосрочные SLO.
- TECHQ15: KV + .env dev — удобство локальной разработки.
- TECHQ16: Live + fixtures — быстрые тесты и реалистичная интеграция.
- TECHQ17: PR + nightly smoke — ранняя регрессия + ежедневная гарантия.
- TECHQ18: (Заменено) Статический batch — предсказуемо; возможен недоиспользованный throughput.
- TECHQ19: Table + LRU — консистентность при нескольких инстансах + скорость.
- TECHQ20: Флаг + timestamp — трассируемое закрытие окна изменений.
- TECHQ21: No rollback — упрощение, опираемся на идемпотентность.
- TECHQ22: migration_version в записи — диагностика источника состояния.
- TECHQ23: Dev auto / Prod manual — снижает риск в проде, ускоряет dev.
- TECHQ24: Raw до cutover — возможность re-run / audit.
- TECHQ25: NSG whitelist — уменьшает поверхность атак.
- TECHQ26: Markdown repo runbook — version control, PR review.
- TECHQ27: (Заменено) Только exp backoff (TECHQ8); ручная корректировка batch при необходимости.
- TECHQ28: (Заменено) Статический лимит воркеров.
- TECHQ29: Murmur3 быстрый hash (не security), SHA256 где нужен крипто контроль.
- TECHQ30: 3 retries вложений — баланс времени и успешности.

## Импакт на реализацию
- Унифицированные операции get/set/verify реализуют retry и идемпотентность согласно TECHQ8/9/18.
- Конфиг manifest.json обязателен при старте (TECHQ5); reload периодический (TECHQ6).
- Логирование и трассировки должны включать correlation_id и sampled spans (TECHQ11/12).
- Метрики — только App Insights custom (TECHQ13), алёрты строятся комбинированно (TECHQ14).
- В кодовую базу добавляется processed_keys table (TECHQ9) и DLQ обработчик (TECHQ10).

## Метрики (тех слой)
- tech.retry.total / tech.retry.exhausted.total
- tech.queue.dlq.count
- tech.idempotent.keys_total / tech.idempotent.skips
- tech.attach.download_fail / tech.attach.retry
- tech.migration.version_active
// Удалены: per-bucket, adaptive.throttle.events, cache.hit_ratio (не критично single-pass)

History:
- scaffold
- finalized (all decisions closed)

### TECHQ1: Одно Function App или разделение
A: Один Function App. + проще деплой/конфиг; - blast radius, масштабируются все вместе.
B: Несколько (domain-based). + изоляция; - дублирование общих libs, больше DevOps.
C: Гибрид (core + extension). + баланс; - сложность оркестрации.
Рекомендация: A (миграция одноразовая, важна скорость).
A
### TECHQ2: Orchestrator
A: Durable Functions. + встроенный state; - сложность версионирования оркестраторов.
B: Очереди + state table (ручной оркестратор). + прозрачный контроль; - больше кода.
C: Event Sourcing (шина). + воспроизводимость; - чрезмерно.
Реком: B (гибкость и простота тестов).
B
### TECHQ3: Pull vs Hybrid
A: Полный pull (таймеры). + предсказуемо; - задержки между изменением и импортом.
B: Hybrid: webhooks для enqueue новых, pull для bulk. + уменьшение пропусков; - дополнительная сложность валидации подписок.
C: Только webhooks. - риск пропусков при сбоях.
Реком: B.

### TECHQ4: Хранение вложений
A: Прямо в Blob (stream). + надёжно; - несколько запросов.
B: Tmp локально -> Blob. + временный retry; - необходимость очистки.
C: Только локально (потом пакет). риск потери.
Реком: A.
A
### TECHQ5: Конфиги
A: App Settings + Key Vault refs. + nativer; - аудит сложнее.
B: Версионируемый manifest (config/*.json) + чувствительные в KV. + review diff; - нужно обновлять при деплое.
C: Смешанный (B + генерация env). + автоматизация; - сложность.
Реком: B.
config.local.settings czy cos takiego lokalnie
### TECHQ6: Feature flags reload (упрощено)
A: Только при рестарте. + минимум кода.
B: Periodic reload. + гибкость; - цикл.
C: On-demand HTTP. + мгновенно; - поверхность атак.
Первоначально выбран B, (Заменено) на A.

### TECHQ7: Rate limiting buckets (упрощено)
A: Global bucket. + простота.
B: Per-method. + точность; - состояние.
C: Иерархия. + гибкость; - сложность.
Первоначально C, (Заменено) на A.

### TECHQ8: Retries
A: Фиксированные интервалы. - неэффективно.
B: Экспоненциальный + jitter. + лучшие практики.
C: Adaptive ML. overkill.
Реком: B.

### TECHQ9: Идемпотентность хранения
A: Таблица processed_keys (PK=idempotent_key). + явная; - доп таблица.
B: Natural upsert (MERGE по BusinessKey). + меньше таблиц; - сложнее для разных сущностей.
C: Комбинированно: central + entity native. + гибкость.
Реком: A.

### TECHQ10: Dead-letter
A: Авто N ретраев → DLQ → ручной разбор. + стандарт.
B: Бесконечные ретраи с экспоненциальным. риск зацикливания.
C: Немедленный DLQ без повторов. упущенные transient.
Реком: A.

### TECHQ11: Логи формат
A: Структурированный JSON + correlation_id + entity. + парсинг и поиск.
B: Текст. - сложный анализ.
C: Dual (JSON + краткий текст). + гибкость; - двойной объём.
Реком: A.

### TECHQ12: Tracing Bitrix
A: Включить spans. + диагностика; - объём.
B: Только ошибки. + экономия; - плохая видимость.
C: Sample p=0.1. + компромисс.
Реком: C.

### TECHQ13: Метрики система
A: App Insights custom metrics. + natively.
B: Prometheus exporter + scrape. + гибкость; - развёртывание.
C: Dual (важное в AI, детальное в Prom). + покрытие; - сложность.
Реком: A (простота) или C если уже есть Prom.

### TECHQ14: Alerting
A: Пороговые (threshold). + быстро.
B: SLO/Error Budget (availability, latency). + устойчиво; - настройка.
C: Гибрид. + баланс.
Реком: C.

### TECHQ15: Секреты
A: Только KV. + безопасность; - локальная разработка сложнее.
B: KV + локальный .env (dev). + удобство.
C: Plain env vars. - риск.
Реком: B.

### TECHQ16: Local integration tests
A: Azurite + mock Bitrix sandbox (live minimal). + реализм.
B: Fixtures записанные. + скорость; - устаревание.
C: Комбинация: основные сценарии live, редкие через fixtures. Реком: C.

### TECHQ17: Smoke CI
A: Автоматический запуск test_limit nightly. + раннее обнаружение.
B: Только manual. - риск поздних сюрпризов.
C: PR + nightly. Реком: C.

### TECHQ18: Batch size (упрощено)
A: Статическое. + предсказуемо.
B: Адаптивное. + эффективность; - код.
C: ML. overkill.
Первоначально B, (Заменено) на A.

### TECHQ19: Кэш справочников
A: In-memory (per instance). + скорость; - холодный старт.
B: Таблица + LRU in-memory. + консистентность.
C: Distributed cache (Redis). + масштаб; - настройка.
Реком: B.

### TECHQ20: Freeze enforcement
A: Timestamp freeze_time stored; фильтр created_at>freeze_time - дельта.
B: Глобальный флаг STOP_WRITE (ждём стабилизации). + прост.
C: Комбинация: флаг + timestamp для аудита. Реком: C.

### TECHQ21: Rollback
A: Нет отката, только повторно idempotent. + упрощение.
B: Soft-delete маркеры и восстановление. - сложность.
C: Полный снапшот. дорого.
Реком: A.

### TECHQ22: Версия мигратора
A: Встраивать migration_version во все записи. + трассируемость.
B: Только в логах. - сложнее корреляция.
C: Только в контрольных таблицах. Реком: A.

### TECHQ23: Схема БД
A: Auto apply migrations at startup. + скорость.
B: Manual gated. + контроль; - задержки.
C: Hybrid: dev auto, prod manual. Реком: C.

### TECHQ24: Очистка raw
A: Удалять после нормализации. + экономия места.
B: Хранить до cutover + retention. + возможность пересборки.
C: Архивировать (zip) + keep manifest. Реком: B.

### TECHQ25: Ограничение outbound
A: NSG egress whitelist. + безопасность; - настройка.
B: Нет ограничения. - риск.
C: Прокси слой. + аудит; - задержка.
Реком: A.

### TECHQ26: Runbook
A: Markdown в репо (версионирование). + PR review.
B: Внешняя Wiki. + UI; - рассинхронизация.
C: Генерация из шаблонов. Реком: A.

### TECHQ27: Throttling (упрощено)
Adaptive механизм убран. Полагаться на экспоненциальные ретраи (TECHQ8); при частых 429 оператор уменьшает batch и перезапускает.

### TECHQ28: Лимит воркеров (упрощено)
Выбран статический MAX_ACTIVE_WORKERS (A). Adaptive снят.

### TECHQ29: Checksum алгоритм
A: SHA256. + стандарт; - медленнее.
B: Murmur3 128-bit. + скорость; - крипто неустойчив.
C: CRC32. - коллизии.
Реком: B (не security-critical), fallback SHA256 где нужно.

### TECHQ30: Повтор скачивания вложений
A: 3 попытки (1s,2s,4s) + jitter. + баланс.
B: 5 попыток экспоненциально. + устойчивость; - дольше.
C: Adaptive до лимита времени. Реком: A.

## Предлагаемые метрики (актуализировано)
- tech.retry.total{method}, tech.retry.exhausted.total
- tech.queue.dlq.count, tech.queue.active.count
- tech.idempotent.skips, tech.idempotent.keys_total
- tech.attach.download_fail, tech.attach.retry
- tech.freeze.violations
- tech.migration.version_active
// Убраны: rate.limit.bucket.available, batch.size_effective, adaptive.throttle.events, cache.hit_ratio (single-pass не критично)

## Следующие шаги
1. Подтвердить решения (можно списком: TECHQ1=A, ...). 
2. После утверждения: статус -> closed + блок "Решения и последствия" (кратко).
3. Обновить связанные документы (Extraction/Import) где impacted.

History:
- scaffold
- simplified-alignment (TECHQ6/7/18/27/28)
