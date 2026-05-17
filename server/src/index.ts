import cors from 'cors';
import express from 'express';

import { assertConfig, config } from './config.js';
import { closeDb, connectDb } from './db.js';
import { createEvaluationsRouter } from './routes/evaluations.js';

assertConfig();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start(): Promise<void> {
  await connectDb();

  app.use('/api/evaluations', createEvaluationsRouter());

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    },
  );

  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

start().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
