import { app, HttpRequest } from '@azure/functions';
import { getTable } from '../../../shared/tableHelper.js';
import { loadConfig } from '../../../shared/config.js';

app.http('workflows-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'workflows/custom-fields/get', handler: async (req:HttpRequest)=>{
	loadConfig();
	const table = await getTable('customFields');
	const partition='workflows_custom_fields_missing';
	const missing: string[] = [];
	return { status:200, jsonBody:{ entity:'workflows', cloudTotal:0, onPremTotal:0, missingCount:0, stored:0, partition, missingNames: req.query.get('debug')==='1'?missing:undefined } };
}});
