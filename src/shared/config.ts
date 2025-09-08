// Centralized config loader pulling from environment (local.settings.json in dev)
export interface AppConfig {
  env: string;
  logLevel: string;
  tables: Record<string,string>;
  queues: Record<string,string>;
  webhooks: {
    cloud: Record<string,string>;
    onPrem: Record<string,string>;
    security: { hashCodes: boolean; persistFullUrl: boolean };
  };
  import: {
    defaultBatchSize: number;
    maxRetries: number;
    retryBackoffInitialMs: number;
    retryBackoffFactor: number;
    retryBackoffJitterMs: number;
  throttleMs?: number;
  };
  test: { testLimit?: number };
}


function collect(prefix: string): Record<string,string> {
  const out: Record<string,string> = {};
  for (const [k,v] of Object.entries(process.env)) {
    if (k.startsWith(prefix)) {
      out[k.substring(prefix.length).toLowerCase()] = v as string;
    }
  }
  return out;
}

export function loadConfig(): AppConfig {
  const tables = collect('TABLE_');
  const queues = collect('QUEUE_');
  const cloud = collect('WEBHOOK_CLOUD_');
  const onPrem = collect('WEBHOOK_ONPREM_');
  const security = {
    hashCodes: (process.env.WEBHOOK_SECURITY_HASH_CODES || 'false') === 'true',
    persistFullUrl: (process.env.WEBHOOK_SECURITY_PERSIST_FULL_URL || 'true') === 'true'
  };
  if (!tables.migration) {
    throw new Error('Configuration error: TABLE_MIGRATION not defined');
  }
  return {
    env: process.env.ENVIRONMENT || 'local',
    logLevel: process.env.LOG_LEVEL || 'info',
    tables,
    queues,
    webhooks: { cloud, onPrem, security },
    import: {
      defaultBatchSize: parseInt(process.env.IMPORT_DEFAULT_BATCH_SIZE || '50',10),
      maxRetries: parseInt(process.env.IMPORT_MAX_RETRIES || '5',10),
      retryBackoffInitialMs: parseInt(process.env.IMPORT_RETRY_BACKOFF_INITIAL_MS || '500',10),
      retryBackoffFactor: parseFloat(process.env.IMPORT_RETRY_BACKOFF_FACTOR || '2'),
  retryBackoffJitterMs: parseInt(process.env.IMPORT_RETRY_BACKOFF_JITTER_MS || '250',10),
  throttleMs: process.env.IMPORT_THROTTLE_MS ? parseInt(process.env.IMPORT_THROTTLE_MS,10) : undefined
    },
    test: {
      testLimit: process.env.TEST_LIMIT ? parseInt(process.env.TEST_LIMIT,10) : undefined
    }
  };
}
