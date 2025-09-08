# Вопросы / Неопределенности (Этап 1 Анализ)

Добавляйте ответы ниже пунктов.

## 1. Bitrix24 Cloud
- Какие точные лимиты RPS по каждому модулю (user, task, log, crm, im, bizproc)?
Sprawdz dokumentacje i sam musisz to powpisywac dla kazdego (wersja jest ta gdzie mamy dzialajace tylko task.item.get, task.task.get - nie dziala)
- Есть ли ограничения одновременных соединений?
Sprawdz tez w B24 dokumentacji
 - Пример: Если лимит user=2 rps, crm=2 rps, tasks=2 rps и всего Users=1500 (страницы по 100), минимальное теоретическое время без параллельности ~15*0.5s при 2 rps. Уточнить фактические задержки (нужно для ETA расчёта).
 Nie wiem, mysle ze trzeba to robic w 1 watku i tylko patrzec na ograniczenia od Bitrix24

## 2. On-Prem
- Точная версия (build) On-Prem Bitrix24?
To samo jak Cloud
- Нужны ли дополнительные кастомные поля кроме перечисленных стандартных CRM?
To musi byc dokladnie jak w Cloudzie, przez to i sprawdzamy przed przenoszeniem kazdych typow danych
 - Пример: В Cloud поле DEAL.UF_CRM_STAGE_COLOR (string). В On-Prem нет. Политика: auto-create (Y/N)? Если N — включаем в отчёт пропусков.
Tak w On-premise mozn aich tworzyc z takimi samymi nazwami jak w Cloudzie, także warto ich tworzyc
## 3. Безопасность
- Список доверенных исходящих IP Azure Functions?
Tu na razie mozesz nie przejmowac sie tym
- Требуется ли шифрование аттачей на хранении (Blob SSE достаточен)?
Tu na razie mozesz nie przejmowac sie tym -wazne by dzialalo

## 4. Кастомные поля
- Нужно ли переносить все пользовательские поля или только whitelisted?
Wszystkie ktore Custom field, nie musimy przenosic dane i typy z B24, ktorych nie bylo podano w zadaniu wprost(przenosic trzeba dodatkowo cos, jesli bez tego nie dzialaja niezbedne dane)
- Требуются ли преобразования типов (enum -> строка)?
Nie wiem, ważne by bylo po przenoszeniu wszystko tak jak bylo w Cloud
 - Пример: ENUM Cloud: {10:"High",20:"Low"}. On-Prem отсутствует код 20 но есть 30:"Medium". Стратегия? a) создавать отсутствующие; b) маппить 20->30; c) сохранять текст "Low" в string поле.
Wariant A
## 5. Workflows
- Нужно ли переносить активные инстансы или только шаблоны?
Jesli w zadaniu powiedziano, to trzeba
 - Пример: Инстанс в состоянии WAIT_USER_ACTION(step=3). Требуется ли восстановление шага или достаточно шаблон + лог?
Tak trzeba
## 6. Чаты
- Все ли чаты или только групповые / проектные?
Wszystkie
 - Пример: 1:1 приватные чаты (user15<->user27) за 5 лет = 25k сообщений. Ограничивать историю (например последние 10k) или полный импорт?
Pelny import
## 7. Фильтры CRM
- Есть ли cut-off дата по сделкам / контактам?
Nie wiem, nie wiem co znaczy etc
 - Объяснение: cut-off = дата отсечения старых записей. Переносим все годы или только активности после конкретной даты (например >=2023-01-01)? Это влияет на объём и время.
Wszystkie
## 8. Дополнительно
- Есть ли требование к регулярным дельта-обновлениям после cutover?
Nie wiem, bo nie wiem co to etc
 - Объяснение: регулярная дельта = автоматический запуск (cron) каждые N минут до freeze. Пример: users/tasks каждые 30м, feed 60м. Нужен ли такой график или ручной запуск?
Nie trzeba 
