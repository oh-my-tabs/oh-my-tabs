import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { BrowserGateway, BrowserTransport } from '../src/browser.js';
import { Harness } from '../src/harness.js';
import { createDaemonServer } from '../src/server.js';

test('runs CLI request through model tool call and extension response', async (t) => {
  let turn = 0;
  const llm = { async chat(messages) {
    turn += 1;
    if (turn === 1) return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'browser.tabs.count_active_window', arguments: {} } }] };
    assert.deepEqual(JSON.parse(messages.at(-1).content), { windowId: 42, count: 12 });
    return { role: 'assistant', content: 'There are 12 tabs open in the active window.' };
  } };
  const transport = new BrowserTransport({ timeoutMs: 200 });
  const server = createDaemonServer({ port: 0, browserTransport: transport, harness: new Harness({ llm, browser: new BrowserGateway(transport) }) });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.address().port}`;

  const extension = new WebSocket(url);
  await new Promise((resolve) => extension.once('open', resolve));
  t.after(() => extension.close());
  extension.on('message', (data) => {
    const request = JSON.parse(data);
    if (request.type === 'count-active-window-tabs') extension.send(JSON.stringify({ type: 'active-window-tabs-counted', requestId: request.requestId, windowId: 42, count: 12 }));
  });

  const cli = new WebSocket(url);
  await new Promise((resolve) => cli.once('open', resolve));
  t.after(() => cli.close());
  const cliMessages = [];
  cli.on('message', (data) => cliMessages.push(JSON.parse(data)));
  cli.send(JSON.stringify({ type: 'agent-request', requestId: 'cli-1', message: 'How many tabs are currently open in the active window?' }));
  const response = await new Promise((resolve) => cli.once('message', (data) => resolve(JSON.parse(data))));
  assert.deepEqual(response, { type: 'agent-response', requestId: 'cli-1', content: 'There are 12 tabs open in the active window.' });
  assert.deepEqual(cliMessages, [response]);
});
