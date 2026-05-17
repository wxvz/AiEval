import { Collection, Db, MongoClient } from 'mongodb';

import { config } from './config.js';
import type { EvaluationRecord } from './types/evaluation.js';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDb(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);

  const collection = getEvaluationsCollection();
  await dropLegacyIdIndex(collection);
  await collection.updateMany({ id: null }, { $unset: { id: '' } });
  await collection.createIndex({ updatedAt: -1 });

  return db;
}

/** Removes a stale unique index from when evaluations stored a separate `id` field. */
async function dropLegacyIdIndex(collection: Collection<EvaluationRecord>): Promise<void> {
  try {
    await collection.dropIndex('id_1');
  } catch (error) {
    const code = (error as { code?: number }).code;

    if (code !== 27) {
      throw error;
    }
  }
}

export function getEvaluationsCollection(): Collection<EvaluationRecord> {
  if (!db) {
    throw new Error('Database not connected');
  }

  return db.collection<EvaluationRecord>(config.evaluationsCollection);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}
