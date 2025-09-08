import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { getTable } from '../../../shared/tableHelper.js';
import { loadConfig } from '../../../shared/config.js';
import axios from 'axios';

async function fetchGroupUF(webhook: string, ctx: InvocationContext) {
	// Placeholder: Bitrix nie udostępnia standardowego zestawu UF_* dla grup przez prosty *fields
	// Jeśli w przyszłości pojawi się metoda (np. sonet_group.userfield.list), można ją tu dodać.
	const out = new Map<string, any>();
	return out;
}

app.http('groups-custom-fields', { methods:['GET'], authLevel:'anonymous', route:'groups/custom-fields/get', handler: async (req:HttpRequest, ctx:InvocationContext) => {
	const cfg = loadConfig();
	const cloud = cfg.webhooks.cloud.sonet_group;
	const onPrem = cfg.webhooks.onPrem.sonet_group;
	if (!cloud || !onPrem) return { status:500, jsonBody:{ error:'WEBHOOK_CLOUD_SONET_GROUP or WEBHOOK_ONPREM_SONET_GROUP missing' } };
	const [cloudMap, onPremMap] = await Promise.all([
		fetchGroupUF(cloud, ctx),
		fetchGroupUF(onPrem, ctx)
	]);
	const missing: string[] = [];
	for (const k of cloudMap.keys()) if (!onPremMap.has(k)) missing.push(k);
	const table = await getTable('customFields');
	let stored = 0; const partition = 'groups_custom_fields_missing';
	for (const name of missing) {
		try { await table.upsertRaw({ ID:name, FIELD_NAME:name, SOURCE:'groups' }, partition); stored++; } catch(e:any){ ctx.log(`Store groups UF ${name} err: ${e.message}`);} }
	const debug = req.query.get('debug')==='1';
	return { status:200, jsonBody:{ entity:'groups', cloudTotal:cloudMap.size, onPremTotal:onPremMap.size, missingCount:missing.length, stored, partition, ...(debug?{missingNames:missing}:{}) } };
}});
