import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { genericExtract, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

app.http('feed-extract', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'feed/extract',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const entityCfg = GLOBAL_CONFIG.feed;
    const appCfg = loadConfig();
  const table = await getMigrationTable();
    const testLimitParam = req.query.get('test_limit');
    const testLimit = testLimitParam ? parseInt(testLimitParam, 10) : undefined;
    const res = await genericExtract(
      'feed',
      table,
      async (s, ps) => ({ items: mockFeed(s, ps), next: (s + ps) < 300 ? s + ps : undefined }),
      entityCfg.pageSize,
      testLimit
    );
    return { status: 200, jsonBody: res };
  }
});

function mockFeed(start = 0, size = 100) {
  return Array.from({ length: size }, (_, i) => ({ id: String(start + i), text: `Post ${start + i}` }));
}
