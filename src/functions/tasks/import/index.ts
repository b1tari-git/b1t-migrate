// Timer removed – convert to exported manual function if needed later
import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

export async function tasksImport(ctx: InvocationContext) {
  const entityCfg = GLOBAL_CONFIG.tasks;
  loadConfig();
  const table = await getMigrationTable();
  const processed = await genericImport('tasks', table, entityCfg.importBatch, async e => 'task-' + e.rowKey);
  ctx.log(`tasks imported ${processed}`);
}
