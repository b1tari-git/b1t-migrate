# Вопросы: Группы

Примечание (simplified model): single-pass snapshot. Нет пост-дельты; решения не изменены.

| ID | Категория | Вопрос | Статус | Ответ |
|----|-----------|--------|--------|-------|
| GQ1 | Members | Импортировать ли роли (owner, moderator) отдельно? | closed | A: Одна таблица GroupMembers с полем Role. |
| GQ2 | Inactive | Переносить архивные/закрытые группы? | closed | A: Переносим все, ставим IsArchived/Closed флаг. |
| GQ3 | Visibility | Нужны ли приватные группы? | closed | A: Импортируем все типы (public/private/extranet). |
| GQ4 | Description | Санитизировать HTML описаний? | closed | A: Переносим raw HTML (опора на встроенную санитизацию on-prem). |
| GQ5 | Delta | Ловить ли дельту состава участников? | closed | Snapshot only (однократный перенос без дельта-обновлений). |
|  |  | Пример: при test_limit=5 импортируются только первые 5 групп — нужно ли логировать пропущенные как skipped=test_limit? | note |  |

## Решения и последствия
GQ1: Простая схема, изменение роли = update строки; метрика groups.members.roles_distribution.
GQ2: Полная историческая целостность; UI должен фильтровать архивные (метрика groups.archived.total).
GQ3: Полный объём данных; повышенные требования к контролю доступа (groups.private.total).
GQ4: Быстрый импорт описаний; риск XSS смещён на on-prem слой — проверить что target санитизирует.
GQ5: Только snapshot: состав участников может устареть при длительной миграции; нет фоновой дельты; фиксируем timestamp snapshot.

History:
- scaffold
- decisions applied (GQ1=A,GQ2=A,GQ3=A,GQ4=A,GQ5=snapshot-only)
