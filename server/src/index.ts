import cors from 'cors';
import express from 'express';

import { assertConfig, config } from './config.js';
import { closeDb, connectDb } from './db.js';
import { LogEvents } from './logging/events.js';
import { logEvent } from './logging/logger.js';
import { requestLogger } from './middleware/request-logger.js';
import { createAutomationRouter } from './routes/automation.js';
import { createEvaluationsRouter } from './routes/evaluations.js';
import { createLearnChatRouter } from './routes/learn-chat.js';
import { createSettingsRouter } from './routes/settings.js';
import { createStatusRouter } from './routes/status.js';
import { runStartupPreflight } from './startup/preflight.js';

assertConfig();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start(): Promise<void> {
  await connectDb();
  await runStartupPreflight();

  app.use('/api/status', createStatusRouter());
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/learn-chat', createLearnChatRouter());
  app.use('/api/evaluations', createAutomationRouter());
  app.use('/api/evaluations', createEvaluationsRouter());

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logEvent('error', LogEvents.httpError, { message: error.message, stack: error.stack });
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
