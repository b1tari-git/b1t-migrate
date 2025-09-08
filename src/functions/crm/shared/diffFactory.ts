import axios from 'axios';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';
import { HttpRequest, InvocationContext, HttpResponseInit } from '@azure/functions';

async function fetchCrmFields(entity: string, webhook: string, ctx: InvocationContext) {
  const base = new URL(webhook);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const url = new URL(base.toString());
  url.pathname += `crm.${entity}.fields`;
  try {
    const { data } = await axios.get(url.toString());
    if (data?.result && typeof data.result === 'object') return data.result;
  } catch (err: any) {
    ctx.log(`Fetch crm.${entity}.fields failed (${webhook}): ${err.message}`);
  }
  return {};
}

export function diffAndStoreFactory(entity: string) {
  return async function handler(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
    const cfg = loadConfig();
    const cloud = cfg.webhooks.cloud.crm;
    const onPrem = cfg.webhooks.onPrem.crm;
    if (!cloud) return { status:500, jsonBody:{ error:'WEBHOOK_CLOUD_CRM not configured'} };
    if (!onPrem) return { status:500, jsonBody:{ error:'WEBHOOK_ONPREM_CRM not configured'} };
    const [cloudFields, onPremFields] = await Promise.all([
      fetchCrmFields(entity, cloud, ctx),
      fetchCrmFields(entity, onPrem, ctx)
    ]);
    const cloudKeys = Object.keys(cloudFields).filter(k=>k.startsWith('UF_'));
    const onPremKeys = new Set(Object.keys(onPremFields).filter(k=>k.startsWith('UF_')));
    const missing = cloudKeys.filter(k=>!onPremKeys.has(k));
  const table = await getTable('customFields');
    let stored = 0;
    const partition = `${entity}_custom_fields_missing`;
    for (const name of missing) {
      const meta = (cloudFields as any)[name];
      const rec = { ID: `${entity}:${name}`, ENTITY: entity, FIELD_NAME: name, FIELD_SCOPE:'crm', FIELD_TYPE: meta?.type || meta?.USER_TYPE_ID || meta?.TYPE, RAW: meta };
      try { await table.upsertRaw(rec, partition); stored++; } catch(e:any){ ctx.log(`Store ${name} err: ${e.message}`);} }
    const debug = req.query.get('debug')==='1';
  return { status:200, jsonBody:{ scope:'crm', entity, cloudTotal:cloudKeys.length, onPremTotal:onPremKeys.size, missingCount:missing.length, stored, partition, ...(debug?{missingNames:missing.slice(0,200)}:{}) } };
  };
}
