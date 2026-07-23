import cors from 'cors';
import express from 'express';
import type { Server } from 'node:http';

import { cancelAllActiveAutomations } from './automation/run-registry.js';
import { assertConfig, config } from './config.js';
import { closeDb, connectDb } from './db.js';
import { LogEvents } from './logging/events.js';
import { logEvent } from './logging/logger.js';
import { requireApiToken } from './middleware/api-token.js';
import { requestLogger } from './middleware/request-logger.js';
import { createAutomationRouter } from './routes/automation.js';
import { createEvaluationsRouter } from './routes/evaluations.js';
import { createLearnChatRouter } from './routes/learn-chat.js';
import { createSettingsRouter } from './routes/settings.js';
import { createStatusRouter } from './routes/status.js';
import { createTemplatesRouter } from './routes/templates.js';
import { runStartupPreflight } from './startup/preflight.js';

assertConfig();

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
  console.warn('TRUST_PROXY is enabled: ensure this API sits behind a reverse proxy.');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    cancelAllActiveAutomations();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await closeDb();
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
    return;
  }

  process.exit(exitCode);
}

// Register early so SIGINT/SIGTERM during connect/preflight still closeDb.
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

async function start(): Promise<void> {
  await connectDb();
  await runStartupPreflight();

  app.use('/api/status', createStatusRouter());
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/learn-chat', requireApiToken);
  app.use('/api/learn-chat', createLearnChatRouter());
  app.use('/api/evaluation-templates', createTemplatesRouter());
  app.use('/api/evaluations', requireApiToken);
  app.use('/api/evaluations', createAutomationRouter());
  app.use('/api/evaluations', createEvaluationsRouter());

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const stack = error instanceof Error ? error.stack : undefined;
      logEvent('error', LogEvents.httpError, { message, stack });
      // Never echo internal Error.message to clients — it can leak provider/API details.
      res.status(500).json({ message: 'Internal server error' });
    },
  );

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
      }
      reject(error);
    };

    server = app.listen(config.port, () => {
      server?.off('error', onError);
      console.log(`API listening on http://localhost:${config.port}`);
      resolve();
    });

    server.on('error', onError);
  });
}

start().catch(async (error: unknown) => {
  console.error('Failed to start server:', error);
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await closeDb();
  } catch (closeError) {
    console.error('Failed to close database after startup error:', closeError);
  }
  process.exit(1);
});
