import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../../shared/entityBase.js';
import { loadConfig } from '../../../../shared/config.js';
import { getMigrationTable } from '../../../../shared/tableHelper.js';

export async function crmSpitemsImport(ctx: InvocationContext) {
	const entityCfg = GLOBAL_CONFIG.crm_spitems;
	loadConfig();
	const table = await getMigrationTable();
	const processed = await genericImport('crm_spitems', table, entityCfg.importBatch, async (e: any) => 'spi-' + e.rowKey);
	ctx.log(`spitems imported ${processed}`);
}
