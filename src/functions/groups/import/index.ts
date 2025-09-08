import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

export async function groupsImport(ctx: InvocationContext) {
  const entityCfg = GLOBAL_CONFIG.groups;
  loadConfig();
  const table = await getMigrationTable();
  const processed = await genericImport('groups', table, entityCfg.importBatch, async e => 'grp-' + e.rowKey);
  ctx.log(`groups imported ${processed}`);
}
