# 4.2 Live Feed (Живая лента)

Упрощённая single-pass модель: feed-get -> feed-set -> feed-verify. Вложения скачиваются inline при необходимости. Отдельная нормализация и сложные статусные цепочки убраны.

Последовательность:
1. feed-custom-fields-get (не требуется — пропускаем)
2. feed-get (посты и комментарии страницами, attachments по мере встречаемости)
3. feed-set (записи Status=NEW => IMPORT_OK/IMPORT_ERR/ERROR_RETRY)
4. feed-verify (count + sample)

## Prerequisites
- users.import.completed
- mapping.users.done
- auth.cloud.feed (scope log/blogpost) (если требуется отдельный)
- auth.target.import.feed (import.feed.*)
- infra.storage.ready

## Metrics (минимальный набор)
| Metric | Description |
|--------|-------------|
| records_extracted_total{entity=feed_posts} | Постов извлечено |
| records_extracted_total{entity=feed_comments} | Комментариев извлечено |
| records_import_ok_total{entity=feed_posts} | Постов импортировано |
| records_import_ok_total{entity=feed_comments} | Комментариев импортировано |
| records_import_err_total{entity=feed_posts} | Ошибки постов |
| records_import_err_total{entity=feed_comments} | Ошибки комментов |
| retry_attempts_total{entity=feed} | Повторные попытки |
| duration_ms{entity=feed,phase=get|set|verify} | Время фаз |
| verify_sample_mismatch_total{entity=feed} | Несовпадения выборки |
| attachments_download_fail_total{entity=feed} | Ошибки скачивания вложений |
Статус документа: wait
Зависимости (необходимы до начала): analysis.completed, mapping.users, users.import.completed

Record-level статус (Azure Table): NEW -> IMPORT_OK | IMPORT_ERR | ERROR_RETRY. Таблицы: FeedPosts, FeedComments. Для постов и комментариев рассчитываем PayloadHash (SHA256) для опущения повторных import при дубликатах.

## Поддиапазон данных
- Сообщения (posts)
- Комментарии
- Лайки (реакции)
- Вложения (файлы)

## Мини-задачи
1. feed-get (posts+comments)
2. feed-set
3. feed-verify

## Инвентаризация
Отдельная стадия пропущена — типы событий не критичны для одноразового переноса.

## Посты и комментарии (feed-get)
| Поле | Значение |
|------|----------|
| Методы | log.blogpost.get, log.comment.get |
| Paging | start/next (page size 50) |
| Storage | Table FeedPosts / FeedComments |
| Hash | SHA256 PayloadHash для dedupe |
| Retry | 3 попытки (0,2,6s) |

## Вложения
Inline скачивание при встрече: size limit 100MB (иначе skip). Ошибки — до 3 повторов.

## Импорт (feed-set)
| Поле | Значение |
|------|----------|
| Порядок | Posts затем Comments (reactions агрегированно) |
| Batch size posts | 20 |
| Batch size comments | 50 |
| Idempotency | source:feed:post:<id> / comment:<id> |
| Retry | 3 попытки |

## Верификация (feed-verify)
| Проверка | Критерий |
|----------|----------|
| Posts count | match |
| Comments count | match |
| Attachments | Ошибок скачивания == 0 или < доп порога |
| Sample | verify_sample постов/комментариев совпадают |

## Риски
- Ограничения API на глубокий исторический доступ
- Высокий объем вложений -> время скачивания
- Возможная нехватка REST методов в on-prem редакции

## Вопросы (закрыто моделью упрощения)
- REST методы: log.blogpost.get / log.comment.get
- Лайки/реакции: агрегирован count
- Large files >100MB: skip + log
- Timestamps: переносим как есть (UTC + source)

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан документ |
| simplified | Переведено на single-pass модель |
