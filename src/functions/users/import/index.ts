import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

export async function usersImport(ctx: InvocationContext): Promise<number> {
  const { importBatch } = GLOBAL_CONFIG.users;
  const cfg = loadConfig();
  const table = await getTable('users');
  const idMapTable = await getTable('users_idmap');
  // simulateCreate now should call real user.add (placeholder)
  const processed = await genericImport('users', table, importBatch, async e => {
    // TODO: integrate real axios POST to `${cfg.webhooks.onPrem.user}user.add`
    // Build payload from stored raw entity: adapt as needed
    const onPremId = 'tgt-' + e.rowKey; // placeholder id (real: response.result)
    // write idmap entity
    await (idMapTable as any)['client'].upsertEntity({
      partitionKey: 'users_idmap',
      rowKey: e.rowKey,
      CloudId: e.rowKey,
      OnPremId: onPremId,
      MappedAtUtc: new Date().toISOString()
    }, 'Merge');
    // optional throttle
    if (cfg.import.throttleMs) await new Promise(r => setTimeout(r, cfg.import.throttleMs));
    return onPremId;
  });
  ctx.log(`users import processed=${processed}`);
  return processed;
}
// Timer removed (manual invocation only)

app.http('users-import', {
  methods: ['POST','GET'],
  authLevel: 'anonymous',
  route: 'users/import',
  handler: async (_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const processed = await usersImport(ctx);
    return { status: 200, jsonBody: { entity: 'users', processed } };
  }
});
