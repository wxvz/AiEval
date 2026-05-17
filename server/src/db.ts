import { Collection, Db, MongoClient } from 'mongodb';

import { config } from './config.js';
import type { Evaluation } from './types/evaluation.js';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDb(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);

  const collection = getEvaluationsCollection(db);
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ updatedAt: -1 });

  return db;
}

export function getEvaluationsCollection(database: Db): Collection<Evaluation> {
  return database.collection<Evaluation>(config.evaluationsCollection);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}
