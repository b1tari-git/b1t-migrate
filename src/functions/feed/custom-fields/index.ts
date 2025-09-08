import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { getTable } from '../../../shared/tableHelper.js';
import { loadConfig } from '../../../shared/config.js';

app.http('feed-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'feed/custom-fields/get', handler: async (req:HttpRequest, ctx:InvocationContext)=>{
	loadConfig();
	// No real UF_* extraction implemented yet; placeholder for future feed custom fields.
	const cloudTotal = 0, onPremTotal = 0; const missing: string[] = [];
	const table = await getTable('customFields');
	const partition='feed_custom_fields_missing';
	const stored=0;
	const debug = req.query.get('debug')==='1';
	return { status:200, jsonBody:{ entity:'feed', cloudTotal, onPremTotal, missingCount:missing.length, stored, partition, ...(debug?{missingNames:missing}:{}) } };
}});
