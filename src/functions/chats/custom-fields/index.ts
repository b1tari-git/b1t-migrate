import { app, HttpRequest } from '@azure/functions';
import { getTable } from '../../../shared/tableHelper.js';
import { loadConfig } from '../../../shared/config.js';

app.http('chats-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'chats/custom-fields/get', handler: async (req:HttpRequest)=>{
	loadConfig();
	const table = await getTable('customFields');
	const partition='chats_custom_fields_missing';
	const missing: string[] = [];
	return { status:200, jsonBody:{ entity:'chats', cloudTotal:0, onPremTotal:0, missingCount:0, stored:0, partition, missingNames: req.query.get('debug')==='1'?missing:undefined } };
}});
