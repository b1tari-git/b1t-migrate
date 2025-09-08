import { app, HttpRequest } from '@azure/functions';
import { genericExtract, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

app.http('tasks-extract',{ methods:['GET'], authLevel:'anonymous', route:'tasks/extract', handler: async (req:HttpRequest)=>{
  const entityCfg = GLOBAL_CONFIG.tasks;
  const appCfg = loadConfig();
  const table = await getMigrationTable();
  const testLimit=req.query.get('test_limit')?parseInt(req.query.get('test_limit')!,10):undefined;
  const res=await genericExtract('tasks', table, async (s,ps)=>({ items: mockTasks(s,ps), next:(s+ps)<500? s+ps: undefined }), entityCfg.pageSize, testLimit);
  return { status:200, jsonBody: res };
}});

function mockTasks(start=0,size=100){ return Array.from({length:size},(_,i)=>({ id:String(start+i), title:`Task ${start+i}` })); }
