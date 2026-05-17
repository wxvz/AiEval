import 'dotenv/config';

const DEFAULT_PORT = 3000;

export const config = {
  port: Number(process.env['PORT'] ?? DEFAULT_PORT),
  mongoUri: process.env['MONGODB_URI'] ?? '',
  dbName: process.env['MONGODB_DB_NAME'] ?? 'aieval',
  evaluationsCollection: 'evaluations',
};

export function assertConfig(): void {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required. Set it in your .env file.');
  }
}
