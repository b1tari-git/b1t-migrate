# Этап 2: Авторизация / Webhooks

Статус: wait
Зависимости: 01_Analysis завершён
Цель: Настроить безопасные webhook интеграции (cloud + on-prem), хранение секретов и локальную эмуляцию через Azurite.

## Объём
- Регистрация исходящих webhooks для сущностей: users, tasks, log (feed), crm.* (позже)
- Настройка входящих webhook (target import.*)
- Хранение конфигурации (Azure Table `Webhooks`)
- Поддержка локальной разработки (Azurite: Tables/Queues/Blobs)

## Мини-задачи
1. 2.1 Сбор требований по scope
2. 2.2 Регистрация cloud webhooks
3. 2.3 Регистрация on-prem import webhooks
4. 2.4 Секреты и безопасное хранение
5. 2.5 Локальная эмуляция (Azurite) + smoke tests
6. 2.6 Верификация лимитов и RPS

## Стек / Инфраструктура
Azure Functions v4 (TS), Azure Storage Tables/Queues/Blobs, Azurite (dev), App Insights, KeyVault (секреты — при прод), Retry (exp+jitter).

## Таблица конфигурации `Webhooks`
| PartitionKey | RowKey | Url | Scope | Direction | Active | CreatedAt | Notes |
|--------------|--------|-----|-------|-----------|--------|-----------|-------|
| webhook | user.cloud | https://... | user.get | outbound | true | ts |  |
| webhook | import.users | https://... | import.users.batch | inbound | true | ts |  |

## Временные зоны
- Все метки времени сохраняем в UTC в таблицах.
- Поле OriginalTzOffset (минуты) для записей, если API возвращает локальное время.
- Конвертация при выводе/верификации: original -> utc (храним оба при необходимости).

## Политика частичного импорта (dev)
| Аспект | Решение |
|--------|---------|
| Полный сбор в Azure Tables | ВСЕ данные этапов сохраняем всегда |
| Импорт в on-prem (dev) | Только минимальный набор срезов: users (<=50), feed (<=30 posts), tasks (<=50), companies (<=30), contacts (<=30) |
| Очистка on-prem | Не делаем полную очистку — наращиваем набор до контрольного минимума |
| Выборка мини-набора | Фильтр по дате создания (latest window) + ограничение count |

## Метрики
| Метрика | Цель |
|---------|------|
| auth.webhooks.registered | = planned count |
| auth.webhooks.fail | =0 |
| auth.azurite.ready | =1 локально |

## Риски
- Неверное хранение секретов (решение: только KeyVault prod, локально env file вне репо)
- Неконсистентные часовые пояса (решение: Normalize->UTC всегда)

## История
| Дата | Изменение |
|------|-----------|
| scaffold | Создан шаблон |
