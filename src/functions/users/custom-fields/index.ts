import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { loadConfig } from '../../../shared/config.js';
import { getTable } from '../../../shared/tableHelper.js';

// Nowa logika: pobierz user.fields dla Cloud i On-Prem, wyodrębnij UF_* i zapisz TYLKO te, które są w Cloud a brak ich w On-Prem.
// Zapis: PartitionKey = 'users_custom_fields_missing', RowKey = FIELD_NAME

interface FetchResult {
  fields: Map<string, any>;
  method: string; // which method succeeded
  error?: string; // final error if both failed
  fallbackUsed: boolean;
}

async function fetchUserFieldNames(webhookBase: string, ctx: InvocationContext): Promise<FetchResult> {
  const result = new Map<string, any>();
  const base = new URL(webhookBase);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const fieldsUrl = new URL(base.toString());
  fieldsUrl.pathname += 'user.fields';
  try {
    const { data } = await axios.get(fieldsUrl.toString());
    if (data && data.result && typeof data.result === 'object') {
      for (const [k, v] of Object.entries<any>(data.result)) {
        if (k.startsWith('UF_')) result.set(k, v);
      }
      return { fields: result, method: 'user.fields', fallbackUsed: false };
    }
  } catch (err: any) {
    ctx.log(`user.fields failed for ${webhookBase}: ${err.message}; fallback to user.userfield.list`);
  }
  // Fallback do user.userfield.list jeśli user.fields nie zwrócił / brak UF_
  try {
    const listUrl = new URL(base.toString());
    listUrl.pathname += 'user.userfield.list';
    const { data } = await axios.get(listUrl.toString());
    const arr = Array.isArray(data.result) ? data.result : (data.result?.fields || []);
    for (const f of arr) {
      const name = f.FIELD_NAME || f.name || f.FIELD_ID;
      if (name && name.startsWith('UF_')) result.set(name, f);
    }
    return { fields: result, method: 'user.userfield.list', fallbackUsed: true };
  } catch (err: any) {
    const msg = `user.userfield.list fallback failed for ${webhookBase}: ${err.message}`;
    ctx.log(msg);
    return { fields: result, method: 'none', fallbackUsed: true, error: msg };
  }
}

export async function usersCustomFields(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const cfg = loadConfig();
  const cloudWebhook = cfg.webhooks.cloud.user;
  const onPremWebhook = cfg.webhooks.onPrem.user;
  if (!cloudWebhook) return { status: 500, jsonBody: { error: 'WEBHOOK_CLOUD_USER not configured' } };
  if (!onPremWebhook) return { status: 500, jsonBody: { error: 'WEBHOOK_ONPREM_USER not configured' } };
  try {
    const [cloudRes, onPremRes] = await Promise.all([
      fetchUserFieldNames(cloudWebhook, ctx),
      fetchUserFieldNames(onPremWebhook, ctx)
    ]);
    const cloudFields = cloudRes.fields;
    const onPremFields = onPremRes.fields;
    const missing: { name: string; meta: any }[] = [];
    for (const [name, meta] of cloudFields.entries()) {
      if (!onPremFields.has(name)) missing.push({ name, meta });
    }
  const table = await getTable('customFields');
    let stored = 0;
    for (const m of missing) {
      const entityRecord = {
        ID: m.name,
        FIELD_NAME: m.name,
        FIELD_TYPE: m.meta?.USER_TYPE_ID || m.meta?.type || m.meta?.TYPE,
        RAW: m.meta
      };
      try {
        await table.upsertRaw(entityRecord, 'users_custom_fields_missing');
        stored++;
      } catch (err: any) {
        ctx.log(`Store error field ${m.name}: ${err.message}`);
      }
    }
    const debug = req.query.get('debug') === '1';
    const body: any = {
      entity: 'users',
      cloudTotal: cloudFields.size,
      onPremTotal: onPremFields.size,
      missingCount: missing.length,
      stored,
      partition: 'users_custom_fields_missing',
      onPremEmpty: onPremFields.size === 0
    };
    if (debug) {
      body.cloudMethod = cloudRes.method;
      body.onPremMethod = onPremRes.method;
      body.onPremError = onPremRes.error;
      body.cloudError = cloudRes.error;
      body.fallback = { cloud: cloudRes.fallbackUsed, onPrem: onPremRes.fallbackUsed };
      body.missingNames = missing.map(m => m.name).slice(0, 200);
    }
    return { status: 200, jsonBody: body };
  } catch (err: any) {
    ctx.log(`users-custom-fields diff error: ${err.message}`);
    return { status: 502, jsonBody: { error: 'Failed to diff custom fields', detail: err.message } };
  }
}

app.http('users-custom-fields', { methods: ['GET'], authLevel: 'anonymous', route: 'users/custom-fields/get', handler: usersCustomFields });
