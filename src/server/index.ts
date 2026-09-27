import { createApp, serveUi } from './app.js';
import { config } from './lib/config.js';

const app = createApp();

app.listen(config.port, () => {
  const uiMode = serveUi ? 'serving built UI' : 'UI not built yet (run npm run build)';
  console.log(`Customer Support Copilot API listening on http://localhost:${config.port} (${uiMode})`);
  console.log(`Health: http://localhost:${config.port}/api/health`);
});
