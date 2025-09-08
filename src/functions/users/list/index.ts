import { app, HttpRequest } from '@azure/functions';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

app.http('users-list', { methods: ['GET'], authLevel: 'anonymous', route: 'users', handler: async (req: HttpRequest) => {
  const topParam = req.query.get('top');
  const top = topParam ? parseInt(topParam, 10) : 50;
  loadConfig();
  const table = await getTable('users');
  const results: any[] = [];
  for await (const e of (table as any)['client'].listEntities({ queryOptions: { filter: "PartitionKey eq 'users'" } })) {
    results.push({ id: e.rowKey, status: e.Status, targetId: e.TargetId });
    if (results.length >= top) break;
  }
  return { status: 200, jsonBody: { items: results } };
}});
