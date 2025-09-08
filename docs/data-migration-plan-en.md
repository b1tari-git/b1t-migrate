# Bitrix24 Cloud to On-Premises Data Migration Plan

Total Estimated Effort: 120 hours
Scope: Transfer selected entities (Feed posts with images, Chats, Project Groups & Tasks, Tasks with comments, Users (profile data), Feed Workflows, CRM (Deals, Contacts, Companies, Smart Processes) – base field data only, no history/audit logs).
Out of Scope: Version history, activity logs, audit trails, task time tracking history, CRM timelines, attachments outside explicitly listed images, deleted/archived objects (unless specified), incremental sync tooling (unless added as stretch goal).

## 1. Guiding Principles
- Data Integrity First: Preserve IDs (where possible) or maintain ID mapping tables.
- Referential Consistency: Users imported before objects that reference them (tasks, feed, CRM).
- Minimal Downtime: Read-only freeze window for final delta extraction.
- Security & Compliance: Use scoped webhooks and tokens with least privilege.
- Observability: Log extraction batches, record counts, failures, retryable errors.
- Re-runnable: Idempotent import (skip-if-exists with hash or source ID mapping).

## 2. High-Level Phases & Time Allocation (Approximate)
| Phase | Description | Hours |
|-------|-------------|-------|
| P1 | Discovery & Environment Prep | 10 |
| P2 | Access, Auth & Webhook Setup | 6 |
| P3 | Data Model & Mapping Specs | 10 |
| P4 | Extraction Scripts (Feed, Users, Tasks) | 24 |
| P5 | Extraction Scripts (Chats, Groups, Workflows) | 14 |
| P6 | Extraction Scripts (CRM core entities) | 18 |
| P7 | Transformation & Media Handling | 8 |
| P8 | Import Layer & On-Prem APIs | 12 |
| P9 | Validation & QA (sampling, counts) | 8 |
| P10 | Final Delta & Cutover | 6 |
| P11 | Documentation & Handover | 4 |
| Buffer | Contingency | 0 (absorbed in phases) |
| Total |  | 120 |

## 3. Detailed Task Breakdown
### 3.1 Phase P1 – Discovery & Environment (10h)
1. Inventory current Bitrix24 modules enabled.
2. Confirm on-prem version & API compatibility.
3. Gather size metrics: counts (users, tasks, feed posts, chat messages, deals, companies, contacts, SP items).
4. Storage estimation (media total size for feed images & task attachments if included).
5. Define target infrastructure (DB schemas, file storage path / object storage).
6. Set up secure secrets storage for tokens.

### 3.2 Phase P2 – Auth & Webhook Setup (6h)
1. Register Bitrix24 webhook(s) (inbound key or OAuth token if required).
2. Define least-privilege separation (read CRM vs read Tasks vs read IM). 
3. Validate rate limits & throttling strategy (backoff, concurrency caps).
4. Build shared HTTP client wrapper (retry, logging, exponential backoff, 429 handling).
5. Smoke test each endpoint.

### 3.3 Phase P3 – Data Mapping Specifications (10h)
1. Define canonical schemas for: User, Task, TaskComment, FeedPost, FeedAttachment, Chat, ChatMessage, ProjectGroup, Deal, Company, Contact, SmartProcessItem.
2. Field-by-field mapping (source->target). Mark: required, transform, default.
3. Enumerate lookup dependencies (e.g., task -> responsible user, CRM deal -> company/contact IDs, workflow references).
4. Design ID mapping tables (source_id, target_id, entity_type, checksum, imported_at).
5. Define media handling (image naming convention, path).
6. Define error categories (validation, referential, transient) and handling policies.

### 3.4 Phase P4 – Extraction (Core: Feed, Users, Tasks) (24h)
Subtasks:
- Users (prerequisite)
  - Fetch all users `/rest/user.get` (paged) or `/rest/user.search` if filters needed.
  - Normalize emails, departments, positions.
  - Store mapping.
- Feed Posts & Attachments
  - Endpoint: `/rest/log.blogpost.get` or activity stream list (may need multiple: `/rest/log.blogpost.get`, `/rest/log.blogpost.getcomments`).
  - Download images (preserve order). Generate manifest JSON.
- Tasks & Comments
  - List tasks: `/rest/task.item.list` (legacy) or `/rest/tasks.task.list` (new) with pagination & filtering by updated range.
  - Fetch single task details if list excludes fields: `/rest/tasks.task.get`.
  - Comments: `/rest/task.commentitem.getlist` or via bizproc log if workflows linked.
  - Capture dependencies: parent tasks, responsible, accomplices, tags.
- Data persistence: write raw JSON snapshots + normalized rows.

### 3.5 Phase P5 – Extraction (Chats, Groups, Workflows) (14h)
- Project Groups (Workgroups)
  - Endpoint: `/rest/sonet_group.get` (fields: NAME, DESCRIPTION, OWNER_ID, DATE_CREATE, etc.).
  - Membership list via `/rest/sonet_group.user.get`.
- Chats & Messages
  - IM Chats: `/rest/im.chat.get` & `/rest/im.chat.message.list`.
  - For each chat ID iterate messages with pagination until oldest.
- Feed Workflows (Bizproc)
  - List workflows definitions: `/rest/bizproc.workflow.template.list`.
  - Instances (if required minimal state): `/rest/bizproc.workflow.instances` (optional; only if must preserve minimal active state).

### 3.6 Phase P6 – Extraction (CRM Core Entities) (18h)
- Deals: `/rest/crm.deal.list` (fields param for selected base fields) + `/rest/crm.deal.get` when needed.
- Contacts: `/rest/crm.contact.list` + `/rest/crm.contact.get`.
- Companies: `/rest/crm.company.list` + `/rest/crm.company.get`.
- Smart Process (SP) entities: `/rest/crm.item.list` with entityTypeId.
- Respect paging (start parameter) & rate limits.
- Only base fields: ID, TITLE/NAME, STAGE_ID / STATUS_ID, ASSIGNED_BY_ID, CREATED_TIME, MODIFIED_TIME, COMPANY_ID/CONTACT_ID references.

### 3.7 Phase P7 – Transformation & Media Handling (8h)
1. Normalize date-times to UTC ISO8601.
2. Map user IDs via mapping table.
3. Sanitize HTML / rich text fields (strip unsupported tags).
4. Compute content checksum for idempotency.
5. Store media to target filesystem or object store; update references.
6. Validate required fields populate (non-null).

### 3.8 Phase P8 – Import Layer (12h)
1. Build import API clients for On-Prem endpoints (define endpoints):
   - `POST /api/import/users`
   - `POST /api/import/feed-posts`
   - `POST /api/import/tasks`
   - `POST /api/import/chats`
   - `POST /api/import/groups`
   - `POST /api/import/crm/deals`
   - `POST /api/import/crm/contacts`
   - `POST /api/import/crm/companies`
   - `POST /api/import/crm/sp-items`
2. Batch size tuning (e.g., 100 items per request or size-based).
3. Implement idempotency (source_id + hash).
4. Implement partial failure reporting (return arrays of failed IDs with reasons).
5. Retry policy for transient errors.

### 3.9 Phase P9 – Validation & QA (8h)
1. Row counts compare (source vs target) per entity.
2. Random sampling (5-10%) field-by-field comparison.
3. Media spot check (open images).
4. Referential integrity checks (tasks -> user, deals -> company/contact). 
5. Error log review & reprocessing queue.
6. Sign-off checklist.

### 3.10 Phase P10 – Final Delta & Cutover (6h)
1. Announce read-only window start.
2. Re-extract delta (entities updated since baseline timestamp).
3. Import delta.
4. Final validation counts.
5. Switch DNS / application flag to On-Prem.
6. Post-cutover monitoring (24–48h light).

### 3.11 Phase P11 – Documentation & Handover (4h)
1. Final architecture & data flow diagrams.
2. Operations runbook (retry, re-extract, rollbacks limited scope).
3. Security review notes & webhook rotation procedure.
4. Lessons learned & backlog (stretch goals: incremental sync pipeline).

## 4. Execution Order (Dependency Aware)
1. Environment & Auth (P1-P2)
2. Mapping Specs (P3)
3. Users (start extraction) → mapping table foundation
4. Groups & Chats (membership needs users)
5. Feed posts & workflows (may refer to users/groups)
6. Tasks & task comments (need users, possibly groups)
7. CRM core entities (users needed for ownership)
8. Smart Process entities
9. Transformation & media normalization
10. Bulk import (users → groups → chats → feed → tasks → CRM)
11. Validation & QA
12. Delta & cutover
13. Documentation handover

## 5. Bitrix24 Webhook / REST Method Reference (Corrected)
(Verify against: https://apidocs.bitrix24.com/api-reference – some older cloud instances may lack newer methods.)

Calling pattern (incoming webhook):
`https://<portal>.bitrix24.<tld>/rest/<user_id>/<webhook_code>/<method>?param=value`
Method names below are listed WITHOUT the `/rest/` prefix (Bitrix internally prepends it). For OAuth apps you call `/rest/<method>` with an access token.

Pagination: most list methods use the `start` param (integer or "-1" when finished). New CRM list methods also accept `select` & `filter` objects. Rate limiting returns HTTP 200 + error in JSON with `error` = `QUERY_LIMIT_EXCEEDED`.

Notes on scopes: The earlier draft used synthetic scopes like `user.read`; Bitrix actually grants module-level scopes (e.g. `user`, `task`, `log`, `crm`, `im`, `bizproc`, `sonet_group`). CRM sub‑entities (deal/contact/company) do NOT have distinct scopes— all require `crm`.

| Domain    | Method                               | Purpose                        | Key Params / Notes                                         | Scope      |
|-----------|--------------------------------------|--------------------------------|-----------------------------------------------------------|------------|
| User      | `user.get`                           | Get single / list (paged)      | `start` for paging                                         | `user`     |
| User      | `user.search`                        | Filtered user search           | `FILTER` fields                                            | `user`     |
| Feed      | `log.blogpost.get`                   | Blog post details              | Need `POST_ID` (collect IDs via activity stream)          | `log`      |
| Feed      | `log.blogpost.getcomments`           | Post comments                  | `POST_ID`, paging (`PAGE` legacy)                         | `log`      |
| Feed      | `log.blogpost.add` (optional)        | Re-create post (not needed)    | Avoid for read-only migration                             | `log` (w)  |
| Tasks NEW | `tasks.task.list`                    | List tasks (new API)           | `filter`, `select`, `start`                               | `task`     |
| Tasks NEW | `tasks.task.get`                     | Task detail                    | `taskId`                                                   | `task`     |
| Tasks LEG | `task.item.list`                     | Legacy list tasks              | Use if NEW unavailable; similar params                    | `task`     |
| Tasks LEG | `task.item.get`                      | Legacy task detail             | `TASK_ID`                                                  | `task`     |
| Tasks     | `task.commentitem.getlist`           | Task comments (legacy path)    | `TASK_ID`, pagination                                      | `task`     |
| Groups    | `sonet_group.get`                    | Workgroups list                | `start`                                                   | `sonet_group` |
| Groups    | `sonet_group.user.get`               | Group members                  | `ID` (group), `start`                                     | `sonet_group` |
| Chat      | `im.chat.get`                        | Chat metadata                  | `CHAT_ID`                                                  | `im`       |
| Chat      | `im.chat.message.list`               | Chat messages list             | `CHAT_ID`, `LIMIT`, `OFFSET` / `MESSAGE_ID` pagination     | `im`       |
| Workflow  | `bizproc.workflow.template.list`     | Workflow templates             | `filter`, `order`                                          | `bizproc`  |
| Workflow  | `bizproc.workflow.instances`         | Active instances (*)           | Only if runtime state required                            | `bizproc`  |
| CRM       | `crm.deal.list`                      | Deals list                     | `select`, `filter`, `start`                               | `crm`      |
| CRM       | `crm.deal.get`                       | Deal detail                    | `ID`                                                       | `crm`      |
| CRM       | `crm.contact.list`                   | Contacts list                  | `select`, `filter`, `start`                               | `crm`      |
| CRM       | `crm.contact.get`                    | Contact detail                 | `ID`                                                       | `crm`      |
| CRM       | `crm.company.list`                   | Companies list                 | `select`, `filter`, `start`                               | `crm`      |
| CRM       | `crm.company.get`                    | Company detail                 | `ID`                                                       | `crm`      |
| CRM       | `crm.item.list`                      | Smart Process (SP) items       | `entityTypeId`, `filter`, `select`, `start`               | `crm`      |

(*) Consider capturing only definitions (`workflow.template.list`) unless live state is a hard requirement.

Legacy fallback logic (pseudo):
1. Attempt `tasks.task.list` (HEAD or small page). If error `ERROR_METHOD_NOT_FOUND` -> use legacy path.
2. For each task page: collect IDs, then for missing fields either rely on list `select` or call detail (`tasks.task.get` or `task.item.get`).

Deprecated but still present: `task.item.list`, `task.item.get`.

Webhook permission selection: When creating an incoming webhook select only the modules above that correspond to the needed scopes. Each selected module grants all read/write methods for that module; for read-only migration consider a temporary custom integration with restricted usage and rotate after cutover.

## 6. Security & Permissions Mapping (Cloud vs On-Prem Webhooks)

Requirement update: prior static token + HMAC model removed. Both source (Bitrix24 Cloud) and target (On-Prem import gateway) use webhook-style access (shared secret embedded in URL) plus internal allow-lists.

### 6.1 Cloud Bitrix24 (Source) Scopes
| Scope       | Entities / Methods (Read)                | Internal Usage Timing | Revoke When  |
|-------------|------------------------------------------|-----------------------|--------------|
| user        | `user.get`, `user.search`                | P1–P4                 | After delta  |
| log         | `log.blogpost.get*`                      | Feed extraction       | After feed   |
| task        | Task list/detail/comments                | Tasks + delta         | After delta  |
| sonet_group | Groups & members                         | Before tasks          | After tasks  |
| im          | Chat metadata & messages                 | If chats in scope     | After chats  |
| bizproc     | Workflow templates / instances           | If workflows in scope | After wf     |
| crm         | Deals / Contacts / Companies / SP items  | CRM extraction        | After delta  |

### 6.2 On-Prem Import Webhook (Target)
Design: a lightweight internal gateway exposes import methods via incoming webhook pattern:
`https://onprem.example.local/webhook/<import_user_id>/<import_code>/<method>`

Method naming convention: `import.<entity>.batch` (plural) + optional sub-methods.

| Module (Virtual) | Method Name              | Purpose                       | Max Batch | Rate Limit (req/min) | Idempotency Key Basis          | Notes |
|------------------|--------------------------|-------------------------------|-----------|----------------------|--------------------------------|-------|
| users            | `import.users.batch`     | Create users                  | 100       | 600                  | source:user:id                 | Reject if email dup unless same sourceId |
| groups           | `import.groups.batch`    | Create groups                 | 100       | 400                  | source:group:id                | Includes membership list optional |
| chats            | `import.chats.batch`     | Create chats                  | 50        | 300                  | source:chat:id                 | Optional scope |
| feed             | `import.feed.posts`      | Create feed posts             | 50        | 300                  | source:feed:post:id+checksum   | Images must be uploaded first |
| tasks            | `import.tasks.batch`     | Create/update tasks           | 50        | 300                  | source:task:id+checksum        | Upsert semantics |
| tasks            | `import.task.comments`   | Insert task comments          | 100       | 300                  | source:task:comment:id         | Skip if parent task missing |
| crm              | `import.crm.companies`   | Create companies              | 50        | 200                  | source:crm:company:id          | Precedes contacts/deals |
| crm              | `import.crm.contacts`    | Create contacts               | 50        | 200                  | source:crm:contact:id          | Company optional |
| crm              | `import.crm.deals`       | Create deals                  | 50        | 200                  | source:crm:deal:id+checksum    | Requires mapped company/contact |
| crm              | `import.crm.spitems`     | Create Smart Process items    | 50        | 200                  | source:crm:sp:<type>:id        | Per entityTypeId |
| workflows        | `import.workflows.tpls`  | Create workflow templates     | 20        | 100                  | source:workflow:tpl:id         | Only if in scope |

Limitations & Controls:
- Webhook secret exposure = full import ability: enforce IP allow-list + TLS only.
- No per-method secret: implement server-side allow-list of enabled methods.
- Rotate by generating new `<import_code>`; keep OLD+NEW overlap window until Azure config updated.
- Reject any method not matching `^import\.` prefix.
- Include response metadata: `{ imported, skipped, failed[], duplicate[] }`.

Soft multi-tenancy: if needed later, add `<tenant>` prefix in method (`import.<tenant>.users.batch`).

Write access to Bitrix Cloud remains blocked (read-only). Target webhook only accepts structured import methods, reducing accidental misuse.

## 7. Azure Serverless Architecture (Implementation Outline)

| Component                 | Service                | Purpose / Notes                                                                 |
|---------------------------|------------------------|----------------------------------------------------------------------------------|
| HTTP Trigger (control)    | Azure Functions v4     | Kick off orchestrations (start full extract, resume, get status)                 |
| Orchestration             | Durable Functions (opt)| Fan-out/fan-in for entity pages (optional; else queues only)                     |
| Work Queue                | Azure Storage Queue    | One message per extraction page / entity batch                                   |
| Retry / DLQ               | Azure Storage Queue    | Poison queue for >N failures                                                     |
| ID Mapping Store          | Azure Table Storage    | PartitionKey=entity_type, RowKey=source_id, columns: target_id, checksum, ts      |
| Raw JSON Archive          | Azure Blob Storage     | Persist source payload for audit                                                 |
| Media Storage             | Azure Blob Storage     | Feed images, optional task attachments                                           |
| Config / Secrets          | Azure App Config + KV  | Source & target webhook URLs, throttling config, feature flags                   |
| Telemetry                 | App Insights           | Traces, custom metrics (counts, latency, retries)                                |
| Metrics Export            | Azure Monitor          | Dashboards, alert rules (error rate, DLQ depth)                                   |

### 7.1 Batching & Throughput
Adaptive batch size: start small (50) increase until p95 latency or error rate crosses threshold. Track upstream 429 to adjust concurrency.

### 7.2 Aggressive Retry Mechanism
Per retry tier apply exponential backoff + full jitter; classify errors:
 - Transient (network timeout, 429, 5xx): retry
 - Deterministic (validation, 4xx other): no retry → dead-letter with reason
DLQ reprocessor function can requeue after manual inspection.

### 7.3 Idempotency & Checksums
Checksum (stable JSON canonicalization excluding volatile fields). If checksum unchanged skip import (log skipped_count metric).

## 8. Extraction & Ingestion Sequencing Tables

### 8.1 Extraction Order (Cloud)
| Order | Entity        | Primary Method(s)                | Legacy Fallback       | Depends On   | Parallelism | Paging Param |
|-------|---------------|----------------------------------|-----------------------|--------------|-------------|-------------|
| 1     | Users         | `user.get`                       | —                     | —            | Med         | `start`     |
| 2     | Groups        | `sonet_group.get`                | —                     | Users        | Med         | `start`     |
| 3     | Group Members | `sonet_group.user.get`           | —                     | Groups       | High        | `start`     |
| 4     | Chats         | `im.chat.get` list via stored IDs| —                     | Users        | Low         | n/a         |
| 5     | Chat Messages | `im.chat.message.list`           | —                     | Chats        | Med         | `OFFSET`    |
| 6     | Feed Posts    | `log.blogpost.get`               | —                     | Users        | Med         | `PAGE`/list |
| 7     | Feed Comments | `log.blogpost.getcomments`       | —                     | Feed Posts   | High        | `PAGE`      |
| 8     | Tasks         | `tasks.task.list`                | `task.item.list`      | Users, Groups| Med         | `start`     |
| 9     | Task Details  | `tasks.task.get`                 | `task.item.get`       | Tasks        | High        | n/a         |
| 10    | Task Comments | `task.commentitem.getlist`       | —                     | Tasks        | High        | `start`     |
| 11    | CRM Deals     | `crm.deal.list`                  | —                     | Users        | Med         | `start`     |
| 12    | CRM Companies | `crm.company.list`               | —                     | Users        | Med         | `start`     |
| 13    | CRM Contacts  | `crm.contact.list`               | —                     | Users        | Med         | `start`     |
| 14    | CRM SP Items  | `crm.item.list` (per entityType) | —                     | Users        | Med         | `start`     |
| 15    | Workflows     | `bizproc.workflow.template.list` | —                     | —            | Low         | `start` (*) |

(*) If large template count; otherwise single call.

### 8.2 Ingestion Order (On-Prem)
| Order | Entity        | Target Endpoint                  | Batch | Idempotency Key          | Pre-Validation Checks                    |
|-------|---------------|----------------------------------|-------|--------------------------|------------------------------------------|
| 1     | Users         | POST /api/import/users           | 100   | source:user:id           | Email uniqueness, required fields        |
| 2     | Groups        | POST /api/import/groups          | 100   | source:group:id          | Owner user mapped                        |
| 3     | Group Members | (inside groups import)           | 100   | source:group:id:user     | User exists                              |
| 4     | Chats         | POST /api/import/chats           | 50    | source:chat:id           | Participants mapped                      |
| 5     | Feed Posts    | POST /api/import/feed-posts      | 50    | source:feed:post:id+hash | Author user mapped                       |
| 6     | Feed Comments | (optional extension)             | 100   | source:feed:comment:id   | Parent post imported                     |
| 7     | Tasks         | POST /api/import/tasks           | 50    | source:task:id+hash      | Responsible user exists                  |
| 8     | Task Comments | (tasks endpoint nested or sep)   | 100   | source:task:comment:id   | Task imported                            |
| 9     | CRM Companies | POST /api/import/crm/companies   | 50    | source:crm:company:id    | —                                        |
| 10    | CRM Contacts  | POST /api/import/crm/contacts    | 50    | source:crm:contact:id    | Linked company (optional) imported       |
| 11    | CRM Deals     | POST /api/import/crm/deals       | 50    | source:crm:deal:id+hash  | Company/contact referenced exist         |
| 12    | CRM SP Items  | POST /api/import/crm/sp-items    | 50    | source:crm:sp:<type>:id  | Related refs (owner, company/contact) OK |
| 13    | Workflows     | POST /api/import/workflows       | 20    | source:workflow:tpl:id   | None (static templates)                  |

## 9. Custom Fields Strategy
Cloud custom CRM / task fields: enumerate via `crm.deal.fields`, `tasks.task.getFields` (if available) – decide whitelist. For on-prem, create analogous custom fields before import (migration pre-step). Store mapping: (entity_type, source_field_code, target_field_code, included:boolean).

## 10. Updated Acceptance Criteria (Additions)
Add:
- 0 unintended write calls to Bitrix (audited via allow-list logs).
- DLQ depth < 0.5% of total messages after final delta.
- Retry success rate (resolved on retry) ≥ 95% of transient failures.
- Target import webhook rotated (old code revoked) within 24h post-cutover.

---

## 7. Risk & Mitigation
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Rate limiting (429) | Slows extraction | Exponential backoff, concurrency cap |
| Large media volume | Storage overflow | Pre-calc size, throttle downloads |
| Inconsistent references | Import failures | Pre-load all users & mapping checks |
| Partial batch failures | Data gaps | Retry queue + error categorization |
| Field schema divergence (cloud vs on-prem) | Data loss | Mapping validation & test import sandbox |
| Unexpected custom fields in CRM | Missing required | Enumerate custom fields but ignore unless whitelisted |
| Timezone discrepancies | Wrong timestamps | Normalize to UTC early |

## 8. Stretch Goals (If Time Remains)
- Incremental sync tool (delta polling by last modified date)
- Hash-based change detection for re-runs
- Parallel media downloader with queue depth control
- Integrity dashboard (counts, error ratios)

## 9. Acceptance Criteria
- 100% of scoped base entities migrated (counts match)
- ≥ 99% success for feed images (document failures) 
- No orphan references (FK integrity checks pass)
- Documentation & runbook delivered
- Source & target webhooks rotated / revoked post-migration

---
Prepared for migration planning.
