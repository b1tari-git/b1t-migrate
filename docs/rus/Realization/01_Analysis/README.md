# Этап 1: Анализ

Статус: wait
Приоритет: высокий
Зависимости: нет
Цель: Подтвердить объём, ограничения, подготовить артефакты для последующих этапов.

## 1. Требуемые входы (заполнить)
- [ ] Список включённых модулей Bitrix24 (cloud)
- [ ] Версия On-Prem Bitrix24 / схемы
- [ ] Оценка объёмов (users, tasks, feed posts, messages, deals, contacts, companies, sp items)
- [ ] Лимиты API (rate/min, burst) по модулям
- [ ] Список кастомных полей (CRM, Tasks, Deals, Contacts, Companies, SP)
- [ ] Список интеграционных вебхуков (URL + scope)
- [ ] Требования к безопасности (IP allow-list, audit)

## 2. Выходы этапа
| Артефакт | Файл / Хранилище | Описание | Статус |
|----------|------------------|----------|--------|
| Inventory modules | tables:MetaInventory | Перечень модулей | wait |
| Volume metrics | tables:MetaVolumes | Количества по сущностям | wait |
| Source inventory design | docs/rus/Realization/00_Foundations/README.md#12-инвентаризация-исходных-данных-и-логирование-пагинации | Схема учёта total/pages | wait |
| Custom fields map | tables:CustomFields | Сырые и нормализованные поля | wait |
| API limits spec | docs/rus/Realization/01_Analysis/api_limits.md | Детализация лимитов | wait |
| Webhook registry | tables:Webhooks | Список активных webhook URL | wait |
| Risk log | docs/rus/Realization/01_Analysis/risks.md | Первичный риск-лог | wait |

## 3. Технический стек (общий)
Azure Functions v4, TypeScript, Azure Storage (Tables, Queues, Blobs), Azurite (dev эмуляция), App Insights, Progressive Retry (экспоненциальный + jitter), Batch обработка.

Дополнительно: Все временные метки нормализуются в UTC + фиксируется OriginalOffset для последующей корректной репликации часового пояса.

## 4. Метрики
| Метрика | Цель |
|---------|------|
| analysis.completed | =1 при завершении |
| customFields.collected | >0 |
| apiLimits.known | =100% модулей в scope |

## 5. Примечания / Решения
- Все webhook URL храним в Table Storage (partition: webhook, row: <scope>). Секретная часть не логируется в явном виде.
- Для custom fields формируем whitelist до начала импорта.

## 6. История изменений
| Дата | Автор | Изменение |
|------|-------|-----------|
| (auto scaffold) | system | Создан шаблон |

