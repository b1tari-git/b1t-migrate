import { app } from '@azure/functions';
import { genericVerify } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

app.http('tasks-verify',{ methods:['GET'], authLevel:'anonymous', route:'tasks/verify', handler: async ()=>{
  const appCfg = loadConfig();
  const table = await getMigrationTable();
  return { status:200, jsonBody: await genericVerify(table,'tasks')};
}});
