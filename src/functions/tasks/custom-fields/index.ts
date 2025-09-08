import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { getTable } from '../../../shared/tableHelper.js';
import { loadConfig } from '../../../shared/config.js';

interface FetchResult {
  fields: Map<string, any>;
  method: string; // which method succeeded
  error?: string; // final error if all attempts failed
  fallbackUsed: boolean;
}

// Pobieramy listę pól UF_TASK_* korzystając z tylko task.item.* (bez tasks.task.*) + fallback do task.userfield.list
async function fetchTaskFieldNames(webhookBase: string, ctx: InvocationContext): Promise<FetchResult> {
  const result = new Map<string, any>();
  const base = new URL(webhookBase);
  if (!base.pathname.endsWith('/')) base.pathname += '/';

  const candidates = ['task.item.getfields', 'task.item.getFields']; // próbujemy obie warianty (starsze instalacje mogą różnić case)
  for (const method of candidates) {
    const url = new URL(base.toString());
    url.pathname += method;
    try {
      const { data } = await axios.get(url.toString());
      if (data?.result && typeof data.result === 'object') {
        const obj = data.result;
        for (const [k, v] of Object.entries<any>(obj)) {
          if (k.startsWith('UF_TASK_')) result.set(k, v);
        }
        if (result.size > 0) {
          return { fields: result, method, fallbackUsed: false };
        }
      }
      ctx.log(`${method} returned 0 UF_TASK_ fields for ${webhookBase}`);
    } catch (err: any) {
      ctx.log(`${method} failed for ${webhookBase}: ${err.message}`);
    }
  }

  // Fallback: task.userfield.list (nie ma prefiksu tasks.)
  try {
    const listUrl = new URL(base.toString());
    listUrl.pathname += 'task.userfield.list';
    const { data } = await axios.get(listUrl.toString());
    const arr = Array.isArray(data.result) ? data.result : (data.result?.fields || []);
    for (const f of arr) {
      const name = f.FIELD_NAME || f.name || f.FIELD_ID;
      if (name && name.startsWith('UF_TASK_')) result.set(name, f);
    }
    return { fields: result, method: 'task.userfield.list', fallbackUsed: true };
  } catch (err: any) {
    const msg = `task.userfield.list fallback failed for ${webhookBase}: ${err.message}`;
    ctx.log(msg);
    return { fields: result, method: 'none', fallbackUsed: true, error: msg };
  }
}

export async function tasksCustomFields(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const cfg = loadConfig();
  const cloudWebhook = cfg.webhooks.cloud.tasks || cfg.webhooks.cloud.task; // tolerancja nazewnictwa
  const onPremWebhook = cfg.webhooks.onPrem.tasks || cfg.webhooks.onPrem.task;
  if (!cloudWebhook) return { status: 500, jsonBody: { error: 'WEBHOOK_CLOUD_TASKS (lub TASK) not configured' } };
  if (!onPremWebhook) return { status: 500, jsonBody: { error: 'WEBHOOK_ONPREM_TASKS (lub TASK) not configured' } };
  try {
    const [cloudRes, onPremRes] = await Promise.all([
      fetchTaskFieldNames(cloudWebhook, ctx),
      fetchTaskFieldNames(onPremWebhook, ctx)
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
        await table.upsertRaw(entityRecord, 'tasks_custom_fields_missing');
        stored++;
      } catch (err: any) {
        ctx.log(`Store error field ${m.name}: ${err.message}`);
      }
    }
    const debug = req.query.get('debug') === '1';
    const body: any = {
      entity: 'tasks',
      cloudTotal: cloudFields.size,
      onPremTotal: onPremFields.size,
      missingCount: missing.length,
      stored,
      partition: 'tasks_custom_fields_missing',
      onPremEmpty: onPremFields.size === 0
    };
    if (debug) {
      body.cloudMethod = cloudRes.method;
      body.onPremMethod = onPremRes.method;
      body.cloudError = cloudRes.error;
      body.onPremError = onPremRes.error;
      body.fallback = { cloud: cloudRes.fallbackUsed, onPrem: onPremRes.fallbackUsed };
      body.missingNames = missing.map(m => m.name).slice(0, 200);
    }
    return { status: 200, jsonBody: body };
  } catch (err: any) {
    ctx.log(`tasks-custom-fields diff error: ${err.message}`);
    return { status: 502, jsonBody: { error: 'Failed to diff task custom fields', detail: err.message } };
  }
}

app.http('tasks-custom-fields', { methods: ['GET'], authLevel: 'anonymous', route: 'tasks/custom-fields/get', handler: tasksCustomFields });
