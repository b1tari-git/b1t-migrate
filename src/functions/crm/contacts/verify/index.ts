import { app } from '@azure/functions';
import { genericVerify } from '../../../../shared/entityBase.js';
import { loadConfig } from '../../../../shared/config.js';
import { getMigrationTable } from '../../../../shared/tableHelper.js';

app.http('crm-contacts-verify',{ methods:['GET'], authLevel:'anonymous', route:'crm/contacts/verify', handler: async ()=>{ loadConfig(); const table= await getMigrationTable(); return { status:200, jsonBody: await genericVerify(table,'crm_contacts')}; }});
