import { UsersTable } from './tableClient.js';
import { loadConfig } from './config.js';

/**
 * Returns the ensured migration table instance (single source of table creation logic).
 * Avoid duplicating connection + ensure logic across functions.
 */
// Generic cache to avoid recreating clients per invocation
const _tableCache: Record<string, UsersTable> = {};

function resolveTableName(kind: string): string {
  const cfg = loadConfig();
  const t = cfg.tables;
  switch (kind) {
    case 'customFields': return t.customfields || t.migration; // fallback
    case 'users': return t.usersdata || t.migration;
  case 'users_idmap': return t.usersidmapdata || t.migration;
    case 'tasks': return t.tasksdata || t.migration;
    case 'groups': return t.groupsdata || t.migration;
    case 'feed': return t.feeddata || t.migration;
    case 'chats': return t.chatsdata || t.migration;
    case 'workflows': return t.workflowsdata || t.migration;
    case 'crm_companies': return t.crmcompanydata || t.migration;
    case 'crm_contacts': return t.crmcontactdata || t.migration;
    case 'crm_deals': return t.crmdealsdata || t.migration;
    case 'crm_spitems': return t.crmspitemsdata || t.migration;
    default: return t.migration;
  }
}

export async function getTable(kind: string) {
  const conn = process.env.AzureWebJobsStorage!;
  const name = resolveTableName(kind);
  if (!_tableCache[name]) {
    const table = UsersTable.create(conn, name);
    await table.ensure();
    _tableCache[name] = table;
  }
  return _tableCache[name];
}

// Backward compatibility: original migration table
export async function getMigrationTable() { return getTable('migration'); }
