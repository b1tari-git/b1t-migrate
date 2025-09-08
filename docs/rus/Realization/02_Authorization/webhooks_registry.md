# Реестр Webhook (Cloud & On-Prem)

Назначение: централизованно хранить сведения о выданных URL вебхуков (без раскрытия секретной части), их статус, ротации и соответствующие scope.

Не храните полный секрет (`<webhook_code>`) открыто. Фиксируем:
- Base URL обрезанный до `/rest/<user_id>/`
- SHA256 хеш скрытого `webhook_code` (для верификации изменений)
- Дату выдачи и ротации

## 1. Cloud (Bitrix24) Incoming Webhooks
| Scope | Purpose | UserId | BaseURL (trim) | SecretHash (SHA256 1..12) | CreatedAtUtc | LastRotationUtc | Active | Example Method URL | Notes |
|-------|---------|--------|----------------|---------------------------|--------------|-----------------|--------|--------------------|-------|
| user | Чтение пользователей | TBD | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>user.get | Первичный |
| log | Лента | TBD | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>log.blogpost.get |  |
| task | Задачи (legacy `task.item.*`) | TBD | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>task.item.list | Alias 'tasks' не использовать |
| sonet_group | Группы | TBD | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>sonet_group.get |  |
| im | Чаты | (опц) | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>im.chat.get |  |
| bizproc | Workflows | (опц) | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>bizproc.workflow.template.list |  |
| crm | CRM | TBD | https://<portal>.bitrix24.ru/rest/123/ | sha256:xxxxxxxxxxxx | TBD | - | yes | <base>crm.deal.list |  |

Инструкции обновления:
1. При выдаче нового вебхука вычислить: `echo -n '<webhook_code>' | sha256sum` → взять первые 12 символов.
2. Заполнить CreatedAtUtc.
3. Старый перевести Active=no, указать LastRotationUtc.

## 2. On-Prem Import Webhook
| Method Prefix | BaseURL (trim) | ImportUserId | SecretHash (1..12) | CreatedAtUtc | LastRotationUtc | Active | Notes |
|---------------|----------------|--------------|--------------------|--------------|-----------------|--------|-------|
| import.* | https://onprem.example.local/webhook/9001/ | 9001 | sha256:yyyyyyyyyyyy | TBD | - | yes | Первичный код |

## 3. История изменений
| Дата | Изменение | Автор |
|------|-----------|-------|
| scaffold | Создан файл | system |

## 4. Процесс ротации (сводка)
1. Создать новый webhook в Bitrix24 (тот же набор scope).
2. Добавить строку с новым SecretHash (Active=yes).
3. Старую строку пометить Active=no, заполнить LastRotationUtc.
4. Обновить конфиг в Azure (KeyVault / AppConfig).
5. Перезапустить функции, убедиться в успешных health-check вызовах.
6. Удалить старый вебхук в B24.

Для on-prem аналогично: развернуть параллельный import_code, переключить, пометить старый неактивным.

---

# 5. CLOUD: Таблица источников данных (FULL URL – не скрывать)
Ниже перечислены все точки извлечения. Поле FullWebhookBaseUrl должно содержать ПОЛНЫЙ URL до корня `/rest/<user_id>/<webhook_code>/` (например: `https://example.bitrix24.ru/rest/123/abcdefg123456789/`) без дописывания метода. Пользователь заполняет после создания вебхука. Методы добавляются кодом.

| Entity | Description | Primary Methods | Scope(s) | Pagination | Dependencies | FullWebhookBaseUrl | Example Composed Call | Notes |
|--------|-------------|-----------------|----------|------------|--------------|--------------------|-----------------------|-------|
| users | Пользователи | user.get, user.search | user | start | (none) | <WPROWADZ_URL_TUTAJ> | <base>user.get?start=0 |  |
| groups | Группы | sonet_group.get | sonet_group | start | users | <WPROWADZ_URL_TUTAJ> | <base>sonet_group.get?start=0 |  |
| groupMembers | Участники групп | sonet_group.user.get | sonet_group | start | groups | <WPROWADZ_URL_TUTAJ> | <base>sonet_group.user.get?ID=123&start=0 | На каждый group ID |
| feedPosts | Посты ленты | log.blogpost.get | log | PAGE(start) | users | <WPROWADZ_URL_TUTAJ> | <base>log.blogpost.get?POST_ID=### | POST_ID список / paging |
| feedComments | Комментарии поста | log.blogpost.getcomments | log | PAGE(start) | feedPosts | <WPROWADZ_URL_TUTAJ> | <base>log.blogpost.getcomments?POST_ID=###&start=0 |  |
| tasksList | Задачи список | task.item.list | task | start | users, groups | <WPROWADZ_URL_TUTAJ> | <base>task.item.list?start=0 | Новый API недоступен |
| taskDetails | Детали задачи | task.item.get | task | n/a | tasksList | <WPROWADZ_URL_TUTAJ> | <base>task.item.get?TASK_ID=### |  |
| taskComments | Комментарии задач | task.commentitem.getlist | task | start | taskDetails | <WPROWADZ_URL_TUTAJ> | <base>task.commentitem.getlist?TASK_ID=###&start=0 |  |
| chats | Чаты | im.chat.get | im | n/a | users | <WPROWADZ_URL_TUTAJ> | <base>im.chat.get?CHAT_ID=### |  |
| chatMessages | Сообщения чата | im.chat.message.list | im | OFFSET/LIMIT | chats | <WPROWADZ_URL_TUTAJ> | <base>im.chat.message.list?CHAT_ID=###&LIMIT=50 |  |
| workflowsTemplates | Шаблоны процессов | bizproc.workflow.template.list | bizproc | start | (none) | <WPROWADZ_URL_TUTAJ> | <base>bizproc.workflow.template.list?start=0 |  |
| workflowsInstances | Активные инстансы | bizproc.workflow.instances | bizproc | start | workflowsTemplates | <WPROWADZ_URL_TUTAJ> | <base>bizproc.workflow.instances?start=0 | Опционально |
| crmCompanies | Компании | crm.company.list | crm | start | users | <WPROWADZ_URL_TUTAJ> | <base>crm.company.list?start=0 |  |
| crmContacts | Контакты | crm.contact.list | crm | start | users, crmCompanies? | <WPROWADZ_URL_TUTAJ> | <base>crm.contact.list?start=0 |  |
| crmDeals | Сделки | crm.deal.list | crm | start | crmCompanies/Contacts | <WPROWADZ_URL_TUTAJ> | <base>crm.deal.list?start=0 |  |
| crmSmartItems | Smart Process Items | crm.item.list | crm | start | users | <WPROWADZ_URL_TUTAJ> | <base>crm.item.list?entityTypeId=###&start=0 | entityTypeId required |
| mediaFeedImages | Изображения ленты | (download by URL from post) | log | n/a | feedPosts | <WPROWADZ_URL_TUTAJ> | <base><file_download_relative> | Ссылки извлекаются из JSON |

# 6. CLOUD: Таблица Scope (FULL URL – не скрывать)
| Scope | Purpose | FullWebhookBaseUrl | CreatedAtUtc | RotationAtUtc | Active | Comments |
|-------|---------|--------------------|-------------|--------------|--------|----------|
| user | Пользователи | https://selleris.bitrix24.com/rest/225/q17185lbve65x3o4/ |  |  | yes |  |
| log | Лента | https://selleris.bitrix24.com/rest/225/vkyfb0xh58yq1mm1/ |  |  | yes |  |
| task | Задачи (legacy) | https://selleris.bitrix24.com/rest/225/n8u3kap3v7oqxopx/ |  |  | yes | Alias 'tasks' игнорируем |
| sonet_group | Группы | https://selleris.bitrix24.com/rest/225/prtphwl82gy66097/ |  |  | yes |  |
| im | Чаты | https://selleris.bitrix24.com/rest/225/mqgj1namvtewzru2/ |  |  | yes | опционально |
| bizproc | Workflows | https://selleris.bitrix24.com/rest/225/ug3cw5tx10la0hjx/ |  |  | yes | опционально |
| crm | CRM | https://selleris.bitrix24.com/rest/225/dp8s872oq2q1e8ls/ |  |  | yes |  |

---

# 7. ON-PREM (Bitrix24 Box): Таблица целевых сущностей (FULL URL – не скрывать)
Box edition = те же реальные scope, что и в Cloud. Используем стандартные REST методы добавления / обновления. Полные URL аналогичны формату `/rest/<user_id>/<webhook_code>/`. OAuth НЕ используем (входящие вебхуки с нужными scope).

| Entity | Description | Write Methods (Primary) | Scope(s) | Idempotency Key Pattern | Dependencies | FullWebhookBaseUrl | Example Write Call | Notes |
|--------|-------------|-------------------------|----------|-------------------------|--------------|--------------------|-------------------|-------|
| users | Пользователи | user.add / user.update | user | dest:user:<id> | (none) | <WPROWADZ_URL_TUTAJ> | <base>user.update?ID=<id> | Создание требует прав admin |
| groups | Группы (Workgroups) | sonet_group.create / sonet_group.update | sonet_group | dest:group:<id> | users | <WPROWADZ_URL_TUTAJ> | <base>sonet_group.create | Добавление участников отдельно |
| groupMembers | Участники групп | sonet_group.user.add | sonet_group | dest:group:<group_id>:user:<id> | groups, users | <WPROWADZ_URL_TUTAJ> | <base>sonet_group.user.add?GROUP_ID=###&USER_ID=### | Идемпотентно через проверку состава |
| feedPosts | Посты ленты | log.blogpost.add | log | dest:feed:post:<id> | users | <WPROWADZ_URL_TUTAJ> | <base>log.blogpost.add | Original CREATED_BY маппинг |
| feedComments | Комментарии поста | log.blogpost.comment.add | log | dest:feed:comment:<id> | feedPosts | <WPROWADZ_URL_TUTAJ> | <base>log.blogpost.comment.add | Сопоставить POST_ID |
| taskItems | Задачи | task.item.add / task.item.update | task | dest:task:<id>+checksum | users, groups | <WPROWADZ_URL_TUTAJ> | <base>task.item.add | legacy API |
| taskComments | Комментарии задач | task.commentitem.add | task | dest:task:comment:<id> | taskItems | <WPROWADZ_URL_TUTAJ> | <base>task.commentitem.add | Привязка к TASK_ID |
| chats | Чаты | im.chat.add / im.chat.update | im | dest:chat:<id> | users | <WPROWADZ_URL_TUTAJ> | <base>im.chat.add | Опционально |
| chatMessages | Сообщения чатов | im.message.add | im | dest:chat:msg:<id> | chats | <WPROWADZ_URL_TUTAJ> | <base>im.message.add | Пересбор истории осторожно |
| workflowsTemplates | Шаблоны процессов | bizproc.workflow.template.add | bizproc | dest:workflow:tpl:<id> | (none) | <WPROWADZ_URL_TUTAJ> | <base>bizproc.workflow.template.add | Требует admin |
| workflowsInstances | Запуск процессов | bizproc.workflow.start | bizproc | dest:workflow:inst:<id> | workflowsTemplates | <WPROWADZ_URL_TUTAJ> | <base>bizproc.workflow.start | Опционально (cutover) |
| crmCompanies | Компании | crm.company.add / crm.company.update | crm | dest:crm:company:<id> | users | <WPROWADZ_URL_TUTAJ> | <base>crm.company.add | Preserve ID через внешнее поле |
| crmContacts | Контакты | crm.contact.add / crm.contact.update | crm | dest:crm:contact:<id> | crmCompanies? | <WPROWADZ_URL_TUTAJ> | <base>crm.contact.add | Связи после create |
| crmDeals | Сделки | crm.deal.add / crm.deal.update | crm | dest:crm:deal:<id>+checksum | crmCompanies/Contacts | <WPROWADZ_URL_TUTAJ> | <base>crm.deal.add | Стадии маппинг |
| crmSmartItems | Smart Process Items | crm.item.add / crm.item.update | crm | dest:crm:sp:<type>:<id> | users | <WPROWADZ_URL_TUTAJ> | <base>crm.item.add?entityTypeId=### | entityTypeId обязателен |
| mediaFeedImages | Медиа файлов ленты | file.upload (портал) | log | dest:feed:media:<hash> | feedPosts | <WPROWADZ_URL_TUTAJ> | <base>disk.folder.uploadfile | Используем Drive/Disk API |

Пояснение: старая таблица с «import.*» виртуальными методами удалена (box edition использует стандартные методы). Idempotency через внешний mapping оригинальных ID -> новые сущности (Store: Azure Table / локально).

# 8. ON-PREM: Таблица Scope (FULL URL – не скрывать)
Реальные scope Bitrix24 коробки (аналогично Cloud). Для записи достаточно тех же разрешений.

| Scope | Purpose | FullWebhookBaseUrl | CreatedAtUtc | RotationAtUtc | Active | Comments |
|-------|---------|--------------------|-------------|--------------|--------|----------|
| user | Пользователи | https://dev-portal.selleris.com/rest/227/ny1tswxtwr0opuk2/ |  |  | yes |  |
| sonet_group | Группы | https://dev-portal.selleris.com/rest/227/uckzpxp9d0gvns4r/ |  |  | yes |  |
| log | Лента | https://dev-portal.selleris.com/rest/227/rsykctdxnc2mgolf/ |  |  | yes |  |
| task | Задачи (legacy) | https://dev-portal.selleris.com/rest/227/wgjc8rgpoao0lcuz/ |  |  | yes |  |
| im | Чаты | https://dev-portal.selleris.com/rest/227/jvojqzendeo2nnik/ |  |  | yes | опционально |
| bizproc | Workflows | https://dev-portal.selleris.com/rest/227/ox098wqnn5e92q2n/ |  |  | yes | опционально |
| crm | CRM | https://dev-portal.selleris.com/rest/227/l3new1u2k7yqsm4k/ |  |  | yes |  |

Если решите разбить на несколько URL (по scope) — добавьте строки отдельно. Иначе один FullWebhookBaseUrl можно дублировать во всех.

---

Примечание: По запросу Заказчика полные URL с секретами НЕ маскируются. Рекомендуется ограничить доступ к репозиторию (private) и настроить процедуру ротации (см. раздел 4) при любом инциденте или после cutover. Переход: виртуальные «import.*» удалены в пользу реальных scope box edition.
