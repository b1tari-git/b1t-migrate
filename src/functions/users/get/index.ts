import { app, HttpRequest } from '@azure/functions';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

app.http('users-get', { methods: ['GET'], authLevel: 'anonymous', route: 'users/{id}', handler: async (req: HttpRequest) => {
  const id = (req.params as any).id as string | undefined;
  if (!id) return { status: 400, jsonBody: { error: 'id required'} };
  loadConfig();
  const table = await getTable('users');
  for await (const e of (table as any)['client'].listEntities({ queryOptions: { filter: `PartitionKey eq 'users' and RowKey eq '${id}'` } })) {
    return { status: 200, jsonBody: { id: e.rowKey, status: e.Status, payload: e.PayloadJson ? JSON.parse(e.PayloadJson) : undefined } };
  }
  return { status: 404, jsonBody: { error: 'not found'} };
}});
