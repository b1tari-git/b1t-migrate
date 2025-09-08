import { app, HttpRequest } from '@azure/functions';
import { genericExtract, GLOBAL_CONFIG } from '../../../shared/entityBase.js';
import { loadConfig } from '../../../shared/config.js';
import { getMigrationTable } from '../../../shared/tableHelper.js';

app.http('chats-extract',{ methods:['GET'], authLevel:'anonymous', route:'chats/extract', handler: async (req:HttpRequest)=>{ const entityCfg=GLOBAL_CONFIG.chats; loadConfig(); const table= await getMigrationTable(); const testLimit=req.query.get('test_limit')?parseInt(req.query.get('test_limit')!,10):undefined; const res=await genericExtract('chats', table, async (s,ps)=>({ items: mockChats(s,ps), next:(s+ps)<400? s+ps: undefined }), entityCfg.pageSize, testLimit); return { status:200, jsonBody: res }; }});
function mockChats(start=0,size=100){ return Array.from({length:size},(_,i)=>({ id:String(start+i), lastMessage:`Message ${start+i}` })); }
