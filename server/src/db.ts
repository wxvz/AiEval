import { Collection, Db, MongoClient } from 'mongodb';

import { config } from './config.js';
import type { EvaluationRecord } from './types/evaluation.js';
import type { EvaluationTemplateRecord } from './types/evaluation-template.js';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectDb(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);

  await getEvaluationsCollection().createIndex({ updatedAt: -1 });
  await getTemplatesCollection().createIndex({ updatedAt: -1 });

  return db;
}

export function getEvaluationsCollection(): Collection<EvaluationRecord> {
  if (!db) {
    throw new Error('Database not connected');
  }

  return db.collection<EvaluationRecord>(config.evaluationsCollection);
}

export function getTemplatesCollection(): Collection<EvaluationTemplateRecord> {
  if (!db) {
    throw new Error('Database not connected');
  }

  return db.collection<EvaluationTemplateRecord>(config.templatesCollection);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}

export type MongoProbeStatus =
  | { ok: true; dbName: string }
  | { ok: false; dbName: string; reason: string };

export async function probeMongo(): Promise<MongoProbeStatus> {
  const dbName = config.dbName;

  if (!db) {
    return { ok: false, dbName, reason: 'not connected' };
  }

  try {
    await db.admin().command({ ping: 1 });
    return { ok: true, dbName };
  } catch (error) {
    return {
      ok: false,
      dbName,
      reason: error instanceof Error ? error.message : 'ping failed',
    };
  }
}
