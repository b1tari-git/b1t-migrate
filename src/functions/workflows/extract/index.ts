import { app, HttpRequest } from '@azure/functions';
import { genericExtract, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

app.http('workflows-extract',{ methods:['GET'], authLevel:'anonymous', route:'workflows/extract', handler: async (req:HttpRequest)=>{ const entityCfg=GLOBAL_CONFIG.workflows; loadConfig(); const table= await getMigrationTable(); const testLimit=req.query.get('test_limit')?parseInt(req.query.get('test_limit')!,10):undefined; const res=await genericExtract('workflows', table, async (s,ps)=>({ items: mockWf(s,ps), next:(s+ps)<120? s+ps: undefined }), entityCfg.pageSize, testLimit); return { status:200, jsonBody: res }; }});
function mockWf(start=0,size=100){ return Array.from({length:size},(_,i)=>({ id:String(start+i), name:`Workflow ${start+i}` })); }
