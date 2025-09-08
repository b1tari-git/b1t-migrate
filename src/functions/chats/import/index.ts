import { InvocationContext } from '@azure/functions';
import { genericImport, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

export async function chatsImport(ctx: InvocationContext) {
	const entityCfg = GLOBAL_CONFIG.chats;
	loadConfig();
	const table = await getMigrationTable();
	const processed = await genericImport('chats', table, entityCfg.importBatch, async e => 'chat-' + e.rowKey);
	ctx.log(`chats imported ${processed}`);
}
