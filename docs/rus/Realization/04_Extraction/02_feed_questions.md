# Вопросы: 4.2 Feed

Примечание (simplified model): Реализация упрощена — лайки переносим агрегированным count, файлы >100MB skip+log (без chunk streaming), timestamps сохраняем raw+utc, дедупликация файлов остаётся отключённой (как решено). Ниже исходные решения сохранены для истории; помеченные «(Заменено)» скорректированы упрощением.

| ID | Категория | Вопрос | Статус | Решение |
|----|-----------|--------|--------|---------|
| FQ1 | API | Подтвердить точные REST методы (log.blogpost.get и т.д.) | closed | D: Инвентаризация (feed.log) → раздельные методы посты/комменты. | 
- nie ogarniam o co chodzi - pytanie dziwne i nie pelne
|  |  | Пример: Нужно ли дополнительно `log.blogpost.getcomments` или достаточно `log.blogpost.get` с embedded comments? | note |  |
| FQ2 | Объем | Мигрировать лайки или только counts? | closed | (Заменено) Aggregated count (без списка пользователей). |
- Nie wiem, musi spelniac kryteria zadania, ale jesli trzeba to trzeba
|  |  | Пример: Если у поста 350 лайков — переносим 350 записей лайков (userId, timestamp) или одно поле likesCount=350? | note |  |
| FQ3 | Файлы | Политика >100MB (skip/partial)? | closed | (Заменено) Skip + log large ( >100MB ). |
wszystko musimy przenosic, jesli to jest w zadaniu, lub w danych ktore musimy przenosic
|  |  | Пример: Файл 240MB превышает лимит сети — разбиваем chunk'ами или отмечаем SKIP и добавляем в отчёт LargeFiles? | note |  |
| FQ4 | Времена | Сохраняем исходные timestamps? | closed | B: raw + utc + offset (тройное хранение). |
tak
|  |  | Пример: Сохраняем поля createdAtOriginal, createdAtUtc в целевой таблице? | note |  |
| FQ5 | Оптимизация | Нужно ли дедуплицировать вложения по hash? | closed | A: Пока без дедупликации (1 файл = 1 blob). |
Wyjasnij o co chodzi bo nie rozumiem
|  |  | Пример: Один и тот же файл прикреплён к 5 постам — скачивать 5 копий или 1 файл (hash-based path) + 5 ссылок? | note |  |
## Решения и последствия
FQ1 (D): Доп. этап инвентаризации уменьшает риск пропусков, небольшая задержка старта извлечения.
FQ2: (Упрощено) Aggregated count снижает объём хранения, теряется аудит индивидуальных лайков.
FQ3: (Упрощено) Skip >100MB ускоряет реализацию; крупные файлы фиксируются в отчёте large_files.log.
FQ4 (B): Унифицированная модель времени; +2 поля; упрощает дельту и аудит.
FQ5 (A): Быстрый старт; потенциальный перерасход хранилища; позже можем собрать статистику hash повторов и включить оптимизацию.

History:
- scaffold
- decisions applied (FQ1=D,FQ2=B,FQ3=B,FQ4=B,FQ5=A)
- simplified-note (FQ2,FQ3 скорректированы)
