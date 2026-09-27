import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './api/routes.js';
import { errorHandler, requestLogger } from './lib/middleware.js';

const staticDir = join(dirname(fileURLToPath(import.meta.url)), '../ui/dist');

const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const serveUi = !isServerlessRuntime && existsSync(staticDir);

export { serveUi, staticDir };

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  if (serveUi) {
    app.use(express.static(staticDir));
    app.get('*splat', (_req, res) => {
      res.sendFile(join(staticDir, 'index.html'));
    });
  }

  app.use((_req, res) => {
    if (!serveUi) {
      res.status(200).json({
        status: 'ui-not-served',
        hint: isServerlessRuntime
          ? 'Vercel serverless API function: the UI is served as static assets from the deployment output directory.'
          : 'Run npm run build, or start the dev server with npm run dev. The API is served from this endpoint.',
      });
      return;
    }
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  app.use(errorHandler);

  return app;
}
