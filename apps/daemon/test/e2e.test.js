import assert from 'node:assert/strict';
import test from 'node:test';
import { Harness, createListTabsTool } from '@oh-my-tabs/harness';
import WebSocket from 'ws';
import { BrowserGateway, BrowserTransport } from '../src/browser.js';
import { createDaemonServer } from '../src/server.js';

test('runs CLI request through model tool call and extension response', async (t) => {
  let turn = 0;
  const llm = {
    async chat(messages) {
      turn += 1;
      if (turn === 1)
        return {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'browser.tabs.list_active_window', arguments: {} } }],
        };
      assert.deepEqual(JSON.parse(messages.at(-1).content), {
        windowId: 42,
        tabs: [{ id: 11, title: 'Example', url: 'https://example.com', active: true, pinned: false }],
      });
      return { role: 'assistant', content: 'The Example tab is open in the active window.' };
    },
  };
  const transport = new BrowserTransport({ timeoutMs: 200 });
  const listTabs = createListTabsTool(new BrowserGateway(transport));
  const harness = new Harness({ llm, tools: new Map([[listTabs.definition.function.name, listTabs]]) });
  const server = createDaemonServer({ port: 0, browserTransport: transport, harness });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.address().port}`;

  const extension = new WebSocket(url);
  await new Promise((resolve) => extension.once('open', resolve));
  t.after(() => extension.close());
  extension.send(JSON.stringify({ type: 'hello', role: 'extension', protocolVersion: 1, sessionId: 'session-1' }));
  extension.on('message', (data) => {
    const request = JSON.parse(data);
    if (request.type === 'list-active-window-tabs')
      extension.send(
        JSON.stringify({
          type: 'active-window-tabs-listed',
          requestId: request.requestId,
          windowId: 42,
          tabs: [{ id: 11, title: 'Example', url: 'https://example.com', active: true, pinned: false }],
        }),
      );
  });

  const cli = new WebSocket(url);
  await new Promise((resolve) => cli.once('open', resolve));
  t.after(() => cli.close());
  const cliMessages = [];
  cli.on('message', (data) => cliMessages.push(JSON.parse(data)));
  cli.send(JSON.stringify({ type: 'hello', role: 'cli', protocolVersion: 1 }));
  cli.send(
    JSON.stringify({
      type: 'agent-request',
      requestId: 'cli-1',
      message: 'Which tabs are currently open in the active window?',
    }),
  );
  const response = await new Promise((resolve) => cli.once('message', (data) => resolve(JSON.parse(data))));
  assert.deepEqual(response, {
    type: 'agent-response',
    requestId: 'cli-1',
    content: 'The Example tab is open in the active window.',
  });
  assert.deepEqual(cliMessages, [response]);
});
