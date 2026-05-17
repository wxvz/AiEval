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
  await collection.createIndex({ updatedAt: -1 });

  return db;
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
