import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../../shared/entityBase.js';
import { loadConfig } from '../../../../shared/config.js';
import { getMigrationTable } from '../../../../shared/tableHelper.js';

export async function crmContactsImport(ctx: InvocationContext) {
	const entityCfg = GLOBAL_CONFIG.crm_contacts;
	loadConfig();
	const table = await getMigrationTable();
	const processed = await genericImport('crm_contacts', table, entityCfg.importBatch, async e => 'ctc-' + e.rowKey);
	ctx.log(`contacts imported ${processed}`);
}
