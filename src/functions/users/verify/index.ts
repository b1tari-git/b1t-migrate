import { app, HttpResponseInit, InvocationContext, HttpRequest } from '@azure/functions';
import { genericVerify } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

export async function usersVerify(_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  loadConfig();
  const table = await getTable('users');
  const stats = await genericVerify(table, 'users');
  return { status: 200, jsonBody: stats };
}

app.http('users-verify', { methods: ['GET'], authLevel: 'anonymous', route: 'users/verify', handler: usersVerify });
