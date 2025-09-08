import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTable } from '../../../shared/tableHelper.js';

/**
 * Lists mapping CloudId -> OnPremId from users partition. (If we introduce separate idmap table, adjust.)
 */
export async function usersIdMap(_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const table = await getTable('users_idmap');
  const mappings: any[] = [];
  for await (const e of (table as any)['client'].listEntities({ queryOptions: { filter: "PartitionKey eq 'users_idmap'" } })) {
    mappings.push({ cloudId: e.CloudId || e.RowKey, onPremId: e.OnPremId });
    if (mappings.length >= 1000) break; // safety limit
  }
  return { status: 200, jsonBody: { count: mappings.length, items: mappings } };
}

app.http('users-idmap', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/idmap',
  handler: usersIdMap
});
