import { app, HttpRequest } from '@azure/functions';
import { genericExtract, GLOBAL_CONFIG } from '../../../../shared/entityBase.js';
import { loadConfig } from '../../../../shared/config.js';
import { getMigrationTable } from '../../../../shared/tableHelper.js';

app.http('crm-deals-extract',{ methods:['GET'], authLevel:'anonymous', route:'crm/deals/extract', handler: async (req:HttpRequest)=>{ const entityCfg=GLOBAL_CONFIG.crm_deals; loadConfig(); const table= await getMigrationTable(); const testLimit=req.query.get('test_limit')?parseInt(req.query.get('test_limit')!,10):undefined; const res=await genericExtract('crm_deals', table, async (s:number,ps:number)=>({ items: mockDeals(s,ps), next:(s+ps)<300? s+ps: undefined }), entityCfg.pageSize, testLimit); return { status:200, jsonBody: res }; }});
function mockDeals(start=0,size=50){ return Array.from({length:size},(_,i)=>({ id:String(start+i), amount:(start+i)*10, stage:'NEW' })); }
