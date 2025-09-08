import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

export async function feedImport(ctx: InvocationContext) {
  const entityCfg = GLOBAL_CONFIG.feed;
  loadConfig();
  const table = await getMigrationTable();
  const processed = await genericImport('feed', table, entityCfg.importBatch, async e => 'feed-' + e.rowKey);
  ctx.log(`feed imported ${processed}`);
}
