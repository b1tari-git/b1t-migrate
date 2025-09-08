# Вопросы: 4.7 CRM

Примечание (simplified model): Документ уже в single-pass формате; retry профили (GEN5) остаются, но статусы сущностей сведены к NEW/IMPORT_OK/IMPORT_ERR/ERROR_RETRY (3 попытки) — отражено в общей simplified_model.md.

Политика: single-pass импорт без повторных дельт; все решения зафиксированы.

| ID | Категория | Вопрос (кратко) | Статус | Решение |
|----|-----------|-----------------|--------|---------|
| GEN1 | Общие | Feature toggles по подсущностям? | closed | A: Отдельные EXTRACT_CRM_* флаги. |
| GEN2 | Общие | test_limit per-entity? | closed | A: Per-entity. |
| GEN3 | Общие | Нужен exclude list сверх whitelist? | closed | A: Да, явный exclude. |
| GEN4 | Общие | Частичный импорт deals без contacts? | closed | A: Блокируем до готовности mapping. |
| GEN5 | Общие | Политика ретраев 429/500? | closed | B: Пер-тип профили. |
| COMP1 | Companies | Минимальный обязательный набор полей? | closed | A: TITLE + ASSIGNED_BY_ID fallback + OPENED. |
| COMP2 | Companies | Multi-fields (PHONE/EMAIL) объем? | closed | A: Все значения. |
| COMP3 | Companies | Address нормализация? | closed | B: 1:1 перенос структурированных полей (как в Cloud) без доп. парсинга. |
| COMP4 | Companies | Checksum компаний? | closed | A: Да, ключевые поля. |
| CONT1 | Contacts | Несколько компаний у контакта? | closed | A: Все связи. |
| CONT2 | Contacts | Дубликаты email/phone объединять? | closed | A: Нет, перенос как есть. |
| CONT3 | Contacts | Avatar/binary сразу? | closed | A: Сразу stream. |
| CONT4 | Contacts | UF_* auto-create? | closed | A: Auto-create. |
| DEAL1 | Deals | Отсутствующие стадии? | closed | A: Auto-create MIG_. |
| DEAL2 | Deals | Валюта копия/конверсия? | closed | A: Строго копия. |
| DEAL3 | Deals | Product rows сейчас? | closed | A: Включаем сразу. |
| DEAL4 | Deals | Исторические даты закрытия? | closed | A: Исторические даты. |
| DEAL5 | Deals | Отсутствующий pipeline? | closed | A: Auto-create. |
| SPI1 | Smart Items | Динамическая загрузка типов? | closed | A: crm.type.list. |
| SPI2 | Smart Items | Валидация FK перед импортом? | closed | A: Batch resolve + очередь ожидания. |
| SPI3 | Smart Items | Стадии типов импортировать? | closed | A: Импорт + auto-create. |
| SPI4 | Smart Items | Унифицированный checksum? | closed | A: Унифицированный. |
| CHK1 | Checksum | Deals checksum состав? | closed | A: Core бизнес поля без комментариев. |
| CHK2 | Checksum | Revision хранить? | closed | A: Revision++. |
| PERF1 | Performance | Batch size/page size? | closed | A: 50 фиксировано. |
| PERF2 | Performance | Параллелизм сущностей? | closed | A: Последовательно. |
| ERR1 | Errors | Orphan FK стратегия? | closed | A: Отложенная очередь. |
| ERR2 | Errors | Partial batch failure retry? | closed | A: Повтор только упавших. |
| OBS1 | Observability | Отдельный namespace метрик? | closed | A: Да, crm_* префиксы. |
| OBS2 | Observability | Payload sampling с маскированием? | closed | A: 1 из N. |
| TL1 | test_limit | Pull-through зависимых сущностей? | closed | A: Авто расширение. |
| TL2 | test_limit | Логирование расширений? | closed | A: Явный лог счётчиков. |

## Решения и последствия
GEN1 (A): Локализованный запуск подсущностей; ↑конфиг, ↓риск массовых сбоев.
GEN2 (A): Репрезентативный smoke по каждой сущности; нужно pull-through для связей.
GEN3 (A): Точный контроль PII; требуется поддержка списка исключений.
GEN4 (A): Гарантия ссылочной целостности; потенциальная задержка deals.
GEN5 (B): Оптимальный throughput по типам; ↑сложность конфигурации retry профилей.
COMP1 (A): Минимум для валидных записей; fallback на системного импортера исключает блок.
COMP2 (A): Полнота контактных данных; ↑объём хранения и хэширования.
COMP3 (B): 1:1 перенос адресных полей как в источнике; ↓риск искажений; нет доп структурирования.
COMP4 (A): Снижение лишних апдейтов; требуется хранить hash.
CONT1 (A): Сохранение M:N модели; ↑записей связей.
CONT2 (A): Историческая точность; возможны дубликаты в UI → ручной аудит позже.
CONT3 (A): Целостный профиль; ↑длительность и трафик.
CONT4 (A): Полнота данных; риск раздувания схемы (мониторим count UF созданных).
DEAL1 (A): Сохранение воронок; появляются MIG_ стадии (нужно последующее переименование/clean-up по желанию).
DEAL2 (A): Историческая финансовая точность; нужно гарантировать наличие валюты в справочнике.
DEAL3 (A): Полная аналитика по выручке сразу; ↑API вызовов productrows.
DEAL4 (A): Корректные отчёты; требуется маппинг временных зон.
DEAL5 (A): Целостность pipeline; возможен рост числа временных воронок.
SPI1 (A): Автоматическое покрытие новых типов; сетевой вызов перед циклом.
SPI2 (A): Избежание dangling FK; очередь ожидания может расти (метрика backlog).
SPI3 (A): Корректные статусы; auto-create увеличивает число стадий.
SPI4 (A): Простая обработка; меньше гибкости оптимизации per-type.
CHK1 (A): Стабильный hash; изменение только комментария не триггерит обновление.
CHK2 (A): Диагностика изменений; хранение integer revision поля.
PERF1 (A): Предсказуемость и совместимость; больше вызовов vs потенциальный 100.
PERF2 (A): Простая упорядоченная гарантия FK; дольше wall-clock.
ERR1 (A): Высокая целостность; нужен воркер очереди зависимостей.
ERR2 (A): Экономия API; требуется granular tracking статусов элементов batch.
OBS1 (A): Чистые дашборды; ↑количество метрик.
OBS2 (A): Баланс между дебагом и приватностью; требуется маскирование PII.
TL1 (A): Репрезентативная связанная выборка; может перерасти строгое число N.
TL2 (A): Прозрачный эффект pull-through; лёгкий аудит расширений.

## Метрики (добавить)
- crm_companies_extracted_total, crm_contacts_extracted_total, crm_deals_extracted_total, crm_spitems_extracted_total
- crm_retry_count{type=...}, crm_retry_exhausted_total
- crm_orphan_queue_size, crm_orphan_resolved_total
- crm_checksum_skipped_total (записей пропущено из-за совпадения hash)
- crm_batch_fail_partial_total
- crm_test_limit_pull_through_total

## test_limit поведение
При test_limit=N выбираем первые N записей per-entity. Если deal требует contact/company вне лимита — подтягиваем зависимость (pull-through) и увеличиваем счётчик crm_test_limit_pull_through_total.

History:
| Дата | Изменение |
|------|-----------|
| scaffold | Создан файл вопросов |
| decisions | Все вопросы закрыты (single-pass) |
