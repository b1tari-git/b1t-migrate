import { TableClient } from '@azure/data-tables';

export interface MigrationEntity extends Record<string, any> {
  partitionKey: string; // entity name e.g. 'users'
  rowKey: string; // source id
  Status: string; // NEW | IMPORT_OK | IMPORT_ERR | ERROR_RETRY
  Attempts: number;
  LastError?: string;
  TargetId?: string;
  ImportedAtUtc?: string;
  SourceOriginalTsUtc?: string;
  SourceUtcTs?: string;
  OriginalOffsetMin?: number;
  PayloadJson: string;
  PulledThrough: boolean;
}

export class UsersTable {
  constructor(private client: TableClient) {}

  static create(connectionString: string, tableName: string) {
    const client = TableClient.fromConnectionString(connectionString, tableName);
    return new UsersTable(client);
  }

  async ensure(): Promise<void> {
    await this.client.createTable({ onResponse: () => {} }).catch(() => {});
  }

  async upsertRaw(raw: any, partition: string = 'users'): Promise<void> {
    const entity: MigrationEntity = {
      partitionKey: partition,
      rowKey: raw.ID || raw.id,
      Status: 'NEW',
      Attempts: 0,
      PayloadJson: JSON.stringify(raw),
      PulledThrough: false
    };
    await this.client.upsertEntity(entity, 'Replace');
  }

  async listForImport(max: number, partition: string = 'users'): Promise<MigrationEntity[]> {
    const results: MigrationEntity[] = [];
    const filter = `(PartitionKey eq '${partition}') and (Status eq 'NEW' or Status eq 'ERROR_RETRY')`;
    const iter = this.client.listEntities<MigrationEntity>({ queryOptions: { filter } });
    for await (const e of iter) {
      results.push(e as MigrationEntity);
      if (results.length >= max) break;
    }
    return results;
  }

  async markImported(e: MigrationEntity, targetId: string) {
    e.Status = 'IMPORT_OK';
    e.TargetId = targetId;
    e.ImportedAtUtc = new Date().toISOString();
    await this.client.updateEntity(e, 'Replace');
  }

  async markError(e: MigrationEntity, err: Error, retryable: boolean) {
    e.Attempts = (e.Attempts || 0) + 1;
    if (!retryable || e.Attempts >= 3) {
      e.Status = 'IMPORT_ERR';
    } else {
      e.Status = 'ERROR_RETRY';
    }
    e.LastError = err.message.substring(0, 512);
    await this.client.updateEntity(e, 'Replace');
  }
}