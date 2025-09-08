import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../../shared/entityBase.js';
import { loadConfig } from '../../../../shared/config.js';
import { getMigrationTable } from '../../../../shared/tableHelper.js';

export async function crmDealsImport(ctx: InvocationContext) {
	const entityCfg = GLOBAL_CONFIG.crm_deals;
	loadConfig();
	const table = await getMigrationTable();
	const processed = await genericImport('crm_deals', table, entityCfg.importBatch, async (e: any) => 'deal-' + e.rowKey);
	ctx.log(`deals imported ${processed}`);
}
