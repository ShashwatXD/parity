import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CORS_ORIGINS, HEADER_RUN_ID } from './constants.js';
import { migrate } from './db/database.js';
import './plugins/pluginSdk.js';
import { startJobWorker } from './runtime/jobs.js';
import { api } from './routes/api.js';

migrate();
startJobWorker();

const app = new Hono();
app.use(
  '*',
  cors({
    origin: [...CORS_ORIGINS],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: [HEADER_RUN_ID],
  }),
);
app.route('/api', api);

const port = Number(process.env.PORT ?? 5005);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Parity MCP Studio API on http://localhost:${info.port}`);
});
