import process from 'node:process';
import { Harness } from '@oh-my-tabs/harness';
import { BrowserGateway, BrowserTransport } from './browser.js';
import { OllamaProvider } from './llm.js';
import { createDaemonServer } from './server.js';

const host = process.env.WS_HOST ?? '127.0.0.1';
const port = Number(process.env.WS_PORT ?? 8787);
const transport = new BrowserTransport({ timeoutMs: Number(process.env.BROWSER_TIMEOUT_MS ?? 5_000) });
const server = createDaemonServer({
  host,
  port,
  browserTransport: transport,
  harness: new Harness({
    browser: new BrowserGateway(transport),
    llm: new OllamaProvider({
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL ?? 'llama3.1:latest',
    }),
  }),
});

server.on('listening', () => console.log(`Daemon listening on ws://${host}:${port}`));
server.on('error', (error) => console.error('Daemon failed:', error));

function shutdown() {
  for (const client of server.clients) client.terminate();
  server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
