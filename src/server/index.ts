import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './api/routes.js';
import { config } from './lib/config.js';
import { errorHandler, requestLogger } from './lib/middleware.js';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, '../ui/dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);

app.use('/api', apiRouter);

if (existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*splat', (_req, res) => {
    res.sendFile(join(staticDir, 'index.html'));
  });
}

app.use((_req, res) => {
  if (!existsSync(staticDir)) {
    res.status(200).json({
      status: 'ui-not-built',
      hint: `Run npm run build, or start the dev server with npm run dev. Serving API on port ${config.port}.`,
    });
    return;
  }
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
});

app.use(errorHandler);

app.listen(config.port, () => {
  const uiMode = existsSync(staticDir) ? `serving built UI at http://localhost:${config.port}` : `UI not built yet (run npm run build)`;
  console.log(`Customer Support Copilot API listening on http://localhost:${config.port} (${uiMode})`);
  console.log(`Health: http://localhost:${config.port}/api/health`);
});