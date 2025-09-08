import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { genericExtract, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

export async function usersExtract(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const { pageSize } = GLOBAL_CONFIG.users;
  const cfg = loadConfig();
  const table = await getTable('users');
  const webhook = cfg.webhooks.cloud.user; // full URL to users.get
  const testLimitParam = req.query.get('test_limit');
  const testLimit = testLimitParam ? parseInt(testLimitParam, 10) : undefined;
  const result = await genericExtract('users', table, async (start, size) => {
    const url = new URL(webhook);
    if (start) url.searchParams.set('start', start.toString());
    url.searchParams.set('limit', String(size));
    const { data } = await axios.get(url.toString());
    return { items: data.result || data.results || [], next: data.next };
  }, pageSize, testLimit);
  return { status: 200, jsonBody: result };
}

app.http('users-extract', { methods: ['GET','POST'], authLevel: 'anonymous', route: 'users/extract', handler: usersExtract });
