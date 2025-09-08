import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

export async function workflowsImport(ctx: InvocationContext) {
	const entityCfg = GLOBAL_CONFIG.workflows;
	loadConfig();
	const table = await getMigrationTable();
	const processed = await genericImport('workflows', table, entityCfg.importBatch, async e => 'wf-' + e.rowKey);
	ctx.log(`workflows imported ${processed}`);
}
