import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

/**
 * Second-pass update of relations (manager / department) using user.update in On-Prem.
 * Assumes import already stored OnPremId inside each entity (future enhancement: id map table).
 */
export async function usersRelationsUpdate(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const cfg = loadConfig();
  const table = await getTable('users');
  const idMap = await getTable('users_idmap');
  // Build quick map CloudId->OnPremId
  const idCache: Record<string,string> = {};
  for await (const m of (idMap as any)['client'].listEntities({ queryOptions: { filter: "PartitionKey eq 'users_idmap'" } })) {
    idCache[m.RowKey] = m.OnPremId;
  }
  const onPremWebhook = cfg.webhooks.onPrem.user;
  if (!onPremWebhook) return { status: 500, jsonBody: { error: 'WEBHOOK_ONPREM_USER not configured' } };

  let scanned = 0, updated = 0, deferred = 0, skipped = 0, errors: string[] = [];
  for await (const e of (table as any)['client'].listEntities({ queryOptions: { filter: "PartitionKey eq 'users'" } })) {
    scanned++;
    if (e.Status !== 'IMPORT_OK') { skipped++; continue; }
  const raw = e.PayloadJson ? JSON.parse(e.PayloadJson) : e;
  const onPremId = e.TargetId || e.OnPremId || idCache[e.RowKey];
    if (!onPremId) { deferred++; continue; }
    // Determine if relations already set (placeholder conditions)
  const needsManager = raw.managerId && !raw.managerLinked;
  const needsDept = raw.departmentId && !raw.departmentLinked;
    if (!needsManager && !needsDept) { skipped++; continue; }
    // Build payload for user.update
    const payload: any = { ID: onPremId };
  const managerOnPrem = raw.managerId ? idCache[raw.managerId] : undefined;
  const deptOnPrem = raw.departmentId ? idCache[raw.departmentId] : undefined; // placeholder; departments likely separate entity
  if (needsManager && managerOnPrem) payload.UF_HEAD = managerOnPrem;
  if (needsDept && deptOnPrem) payload.UF_DEPARTMENT = [deptOnPrem];
    if (payload.UF_HEAD || payload.UF_DEPARTMENT) {
      try {
        const url = new URL(onPremWebhook);
        if (!url.pathname.endsWith('/')) url.pathname += '/';
        url.pathname += 'user.update';
        await axios.post(url.toString(), payload);
        updated++;
      } catch (err: any) {
        errors.push(`ID ${onPremId}: ${err.message}`);
      }
    } else {
      deferred++; // missing mapping yet
    }
  }
  return { status: 200, jsonBody: { scanned, updated, deferred, skipped, errors: errors.slice(0, 25) } };
}

app.http('users-relations-update', {
  methods: ['POST','GET'],
  authLevel: 'anonymous',
  route: 'users/relations/update',
  handler: usersRelationsUpdate
});
