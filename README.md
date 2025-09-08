# b24-cloud-to-box-migration

Minimal Azure Functions (TypeScript) skeleton for one-shot Bitrix24 cloud -> on-prem (box) migration.

## Stack
Azure Functions v4 (Isolated TS)  | Azure Storage (Table/Queue/Blob) | Azurite (local) | Axios | Progressive retry (planned)

## Configuration
All configuration lives in `local.settings.json` (never commit secrets). See `local.settings.example.json` for key names.

Key groups (env prefix):
- `TABLE_...` (e.g. `TABLE_MIGRATION`)
- `QUEUE_...`
- `WEBHOOK_CLOUD_...`, `WEBHOOK_ONPREM_...`
- Import tuning: `IMPORT_DEFAULT_BATCH_SIZE`, retry backoff vars
- Test: `TEST_LIMIT`

Loaded centrally via `src/shared/config.ts` with validation (throws if `TABLE_MIGRATION` missing).

## Function Layout (feature-first)
```
src/functions/
	users/
		extract/        users-extract (HTTP)
		import/         users-import (Timer)
		verify/         users-verify (HTTP)
		list/           users-list (HTTP)
		get/            users-get (HTTP with route param)
		custom-fields/  users-custom-fields (HTTP)
	tasks/{extract,import,verify}
	groups/{extract,import,verify,custom-fields}
	feed/{extract,import,verify,custom-fields}
	chats/{extract,import,verify,custom-fields}
	workflows/{extract,import,verify,custom-fields}
	crm/
		contacts/{extract,import,verify,custom-fields}
		deals/{extract,import,verify,custom-fields}
		spitems/{extract,import,verify,custom-fields}
```

Old flat folders removed after migration. Add new entity by copying one of the existing sets.

## Routes (manual only)

All execution is manual (one-shot). No timers remain; import steps are invoked manually (future: create dedicated HTTP triggers if desired).

HTTP (authLevel anonymous unless noted):

Users:
- GET /users/extract  (users-extract)  [query: test_limit]
- POST /users/extract (same handler)
- GET /users/verify   (users-verify)
- GET /users          (users-list) [query: top]
- GET /users/{id}     (users-get)
- GET /users/custom-fields/get (users-custom-fields)
- POST /users/import  (users-import) (now manual HTTP import)

Tasks:
- GET /tasks/extract  (tasks-extract) [query: test_limit]
- GET /tasks/verify   (tasks-verify)

Groups:
- GET /groups/extract (groups-extract) [query: test_limit]
- GET /groups/verify  (groups-verify)
- GET /groups/custom-fields/get (groups-custom-fields)

Feed:
- GET /feed/extract   (feed-extract) [query: test_limit]
- GET /feed/verify    (feed-verify)
- GET /feed/custom-fields/get (feed-custom-fields)

Chats:
- GET /chats/extract  (chats-extract) [query: test_limit]
- GET /chats/verify   (chats-verify)
- GET /chats/custom-fields/get (chats-custom-fields)

Workflows:
- GET /workflows/extract (workflows-extract) [query: test_limit]
- GET /workflows/verify  (workflows-verify)
- GET /workflows/custom-fields/get (workflows-custom-fields)

CRM Contacts:
- GET /crm/contacts/extract (crm-contacts-extract) [query: test_limit]
- GET /crm/contacts/verify  (crm-contacts-verify)
- GET /crm/contacts/custom-fields/get (crm-contacts-custom-fields)

CRM Deals:
- GET /crm/deals/extract (crm-deals-extract) [query: test_limit]
- GET /crm/deals/verify  (crm-deals-verify)
- GET /crm/deals/custom-fields/get (crm-deals-custom-fields)

CRM SPItems:
- GET /crm/spitems/extract (crm-spitems-extract) [query: test_limit]
- GET /crm/spitems/verify  (crm-spitems-verify)
- GET /crm/spitems/custom-fields/get (crm-spitems-custom-fields)

Notes:
- test_limit query param caps page processing for quick smoke tests.
- All table access centralised via getMigrationTable().

## Shared Modules
`src/shared/config.ts` - environment/config loader.
`src/shared/tableClient.ts` - thin wrapper around Azure Table client.
`src/shared/tableHelper.ts` - `getMigrationTable()` single place for ensure logic.
`src/shared/entityBase.ts` - generic extract/import/verify flows (mocked data now).

## Usage
```
npm install
func start
```
Optionally: `npm run dev` (verbose), `npm run build` (type check only), `npm run lint`.

## Adding a New Entity (Quick Recipe)
1. Create directory structure `src/functions/<entity>/{extract,import,verify}`.
2. Copy an existing extract/import/verify file and adjust entity key in `GLOBAL_CONFIG` + mock/data logic.
3. Use `getMigrationTable()` instead of repeating connection code.
4. Add custom-fields/other endpoints if needed.

## Table Access Helper
Prefer:
```ts
import { getMigrationTable } from '../../../shared/tableHelper.js';
const table = await getMigrationTable();
```
Instead of re-building connection/env logic.

## One-shot Migration Philosophy
Design assumes sequential orchestrated runs (extract -> import -> verify) per entity; idempotency and retry scaffolding prepared via generic layer. Extend `GLOBAL_CONFIG` for sizing.

## Next Improvements (Suggested)
- Implement progressive retry/backoff in generic import.
- Add queue-based fan-out for large page sets.
- Add lightweight integration smoke test script.

---
Generated structure automated by assistant; feel free to prune mocks as real Bitrix API calls are introduced.