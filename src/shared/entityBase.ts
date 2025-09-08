import { UsersTable } from './tableClient.js';
import { loadConfig } from './config.js';

export interface ExtractResult { imported: number; truncated?: boolean }

export interface EntityConfig {
  name: string;
  pageSize: number;
  importBatch: number;
}

export const GLOBAL_CONFIG: Record<string, EntityConfig> = {
  users: { name: 'users', pageSize: 100, importBatch: 25 },
  feed: { name: 'feed', pageSize: 100, importBatch: 25 },
  tasks: { name: 'tasks', pageSize: 100, importBatch: 25 },
  groups: { name: 'groups', pageSize: 100, importBatch: 25 },
  chats: { name: 'chats', pageSize: 100, importBatch: 25 },
  workflows: { name: 'workflows', pageSize: 100, importBatch: 25 },
  crm_companies: { name: 'crm_companies', pageSize: 50, importBatch: 20 },
  crm_contacts: { name: 'crm_contacts', pageSize: 50, importBatch: 20 },
  crm_deals: { name: 'crm_deals', pageSize: 50, importBatch: 15 },
  crm_spitems: { name: 'crm_spitems', pageSize: 50, importBatch: 15 }
};

export async function genericExtract(
  entity: string,
  table: UsersTable,
  fetchPage: (start: number, pageSize: number) => Promise<{ items: any[]; next?: number }>,
  pageSize: number,
  testLimit?: number
): Promise<ExtractResult> {
  let start = 0;
  let imported = 0;
  while (true) {
    const { items, next } = await fetchPage(start, pageSize);
    if (!items.length) break;
    for (const it of items) {
      await table.upsertRaw({ ...it, id: it.id || it.ID }, entity);
      imported++;
      if (testLimit && imported >= testLimit) return { imported, truncated: true };
    }
    if (next === undefined) break;
    start = next;
  }
  return { imported };
}

export async function genericImport(
  entity: string,
  table: UsersTable,
  batchSize: number,
  simulateCreate: (e: any) => Promise<string>
) {
  const cfg = loadConfig();
  const batch = await table.listForImport(batchSize, entity);
  for (const e of batch) {
    let attempt = 0;
    while (true) {
      try {
        const id = await simulateCreate(e);
        await table.markImported(e, id);
        break;
      } catch (err: any) {
        attempt++;
        if (attempt >= cfg.import.maxRetries) {
          await table.markError(e, err, false); // permanent failure
          break;
        }
        // mark transient error for retry visibility
        await table.markError(e, err, true);
        const base = cfg.import.retryBackoffInitialMs * Math.pow(cfg.import.retryBackoffFactor, attempt - 1);
        const jitter = Math.floor(Math.random() * cfg.import.retryBackoffJitterMs);
        const delay = base + jitter;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return batch.length;
}

export async function genericVerify(table: UsersTable, partition: string) {
  let total = 0, ok = 0, err = 0, retry = 0;
  for await (const e of (table as any)['client'].listEntities({ queryOptions: { filter: `PartitionKey eq '${partition}'` } })) {
    total++;
    if (e.Status === 'IMPORT_OK') ok++; else if (e.Status === 'IMPORT_ERR') err++; else if (e.Status === 'ERROR_RETRY') retry++;
  }
  return { total, ok, err, retry };
}
