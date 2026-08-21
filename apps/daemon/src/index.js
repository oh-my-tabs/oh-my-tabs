import process from 'node:process';
import { resolveDaemonEndpoint } from '@oh-my-tabs/config';
import { Harness, createCountTabsTool, createListTabsTool } from '@oh-my-tabs/harness';
import { BrowserGateway, BrowserTransport } from './browser.js';
import { OllamaProvider } from './llm.js';
import { createDaemonServer } from './server.js';

const { host, port } = resolveDaemonEndpoint(process.env);
const transport = new BrowserTransport({ timeoutMs: Number(process.env.BROWSER_TIMEOUT_MS ?? 5_000) });
const browser = new BrowserGateway(transport);
const tools = [createCountTabsTool(browser), createListTabsTool(browser)];
const server = createDaemonServer({
  host,
  port,
  browserTransport: transport,
  harness: new Harness({
    llm: new OllamaProvider({
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL ?? 'llama3.1:latest',
    }),
    tools: new Map(tools.map((tool) => [tool.definition.function.name, tool])),
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
