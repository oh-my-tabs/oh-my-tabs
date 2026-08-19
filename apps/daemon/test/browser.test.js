import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';
import { BrowserTransport } from '../src/browser.js';

test('correlates a browser count response', async (t) => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const transport = new BrowserTransport();
  server.on('connection', (socket) => {
    transport.addClient(socket);
    socket.on('message', (data) => transport.handleMessage(JSON.parse(data)));
  });
  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  await new Promise((resolve) => client.once('open', resolve));
  t.after(() => client.close());
  client.once('message', (data) => {
    const request = JSON.parse(data);
    client.send(JSON.stringify({ type: 'active-window-tabs-counted', requestId: request.requestId, windowId: 4, count: 9 }));
  });
  assert.deepEqual(await transport.requestCount(), { windowId: 4, count: 9 });
});

test('times out rather than hanging', async () => {
  const transport = new BrowserTransport({ timeoutMs: 5 });
  const socket = { readyState: WebSocket.OPEN, send() {}, once() {} };
  transport.addClient(socket);
  await assert.rejects(transport.requestCount(), { code: 'browser_timeout' });
});

test('fails immediately when no extension is connected', async () => {
  const transport = new BrowserTransport();
  await assert.rejects(async () => transport.requestCount(), { code: 'extension_disconnected' });
});

test('maps an extension failure to active-window unavailable', async () => {
  const transport = new BrowserTransport();
  const socket = {
    readyState: WebSocket.OPEN,
    once() {},
    send(data) {
      const request = JSON.parse(data);
      queueMicrotask(() => transport.handleMessage({ type: 'active-window-tabs-failed', requestId: request.requestId }));
    },
  };
  transport.addClient(socket);
  await assert.rejects(transport.requestCount(), { code: 'active_window_unavailable' });
});

test('times out when the extension disconnects during a request', async () => {
  const transport = new BrowserTransport({ timeoutMs: 5 });
  let close;
  const socket = {
    readyState: WebSocket.OPEN,
    send() {},
    once(event, listener) {
      if (event === 'close') close = listener;
    },
  };
  transport.addClient(socket);

  const result = transport.requestCount();
  close();

  await assert.rejects(result, { code: 'browser_timeout' });
});
