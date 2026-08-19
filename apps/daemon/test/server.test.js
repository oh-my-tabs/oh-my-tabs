import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { BrowserTransport } from '../src/browser.js';
import { createDaemonServer } from '../src/server.js';

async function startServer(
  t,
  harness = {
    async run() {
      throw new Error('Harness should not run.');
    },
  },
) {
  const server = createDaemonServer({ port: 0, browserTransport: new BrowserTransport(), harness });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());

  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  await new Promise((resolve) => client.once('open', resolve));
  t.after(() => client.close());
  return client;
}

test('returns a public error for malformed JSON', async (t) => {
  const client = await startServer(t);
  client.send('not-json');

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.deepEqual(response, {
    type: 'agent-error',
    error: {
      code: 'invalid_message',
      message: 'Received an invalid WebSocket message.',
    },
  });
});

test('rejects an invalid first message without invoking the harness', async (t) => {
  let invoked = false;
  const client = await startServer(t, {
    async run() {
      invoked = true;
    },
  });
  client.send(JSON.stringify({ type: 'unknown' }));

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.equal(invoked, false);
  assert.deepEqual(response, {
    type: 'agent-error',
    error: {
      code: 'invalid_handshake',
      message: 'The first message must identify a valid client role.',
    },
  });
});

test('rejects unsupported protocol versions', async (t) => {
  const client = await startServer(t);
  client.send(JSON.stringify({ type: 'hello', role: 'cli', protocolVersion: 2 }));

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.equal(response.error.code, 'unsupported_protocol_version');
});

test('rejects a repeated handshake', async (t) => {
  const client = await startServer(t);
  client.send(JSON.stringify({ type: 'hello', role: 'cli', protocolVersion: 1 }));
  client.send(JSON.stringify({ type: 'hello', role: 'extension', protocolVersion: 1, sessionId: 'session-1' }));

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.equal(response.error.code, 'repeated_handshake');
});

test('rejects extension messages that belong to the CLI role', async (t) => {
  const client = await startServer(t);
  client.send(JSON.stringify({ type: 'hello', role: 'extension', protocolVersion: 1, sessionId: 'session-1' }));
  client.send(JSON.stringify({ type: 'agent-request', requestId: 'request-1', message: 'count tabs' }));

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.equal(response.error.code, 'message_not_allowed');
});

test('rejects browser messages that belong to the extension role', async (t) => {
  const client = await startServer(t);
  client.send(JSON.stringify({ type: 'hello', role: 'cli', protocolVersion: 1 }));
  client.send(JSON.stringify({ type: 'active-window-tabs-counted', requestId: 'request-1', windowId: 1, count: 1 }));

  const response = await new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data)));
  });

  assert.equal(response.error.code, 'message_not_allowed');
});

test('keeps CLI requests working when an extension disconnects', async (t) => {
  const server = createDaemonServer({
    port: 0,
    browserTransport: new BrowserTransport(),
    harness: {
      async run() {
        return 'still connected';
      },
    },
  });
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `ws://127.0.0.1:${server.address().port}`;

  const extension = new WebSocket(url);
  await new Promise((resolve) => extension.once('open', resolve));
  extension.send(JSON.stringify({ type: 'hello', role: 'extension', protocolVersion: 1, sessionId: 'session-1' }));
  const extensionClosed = new Promise((resolve) => extension.once('close', resolve));
  extension.close();
  await extensionClosed;

  const cli = new WebSocket(url);
  await new Promise((resolve) => cli.once('open', resolve));
  t.after(() => cli.close());
  cli.send(JSON.stringify({ type: 'hello', role: 'cli', protocolVersion: 1 }));
  cli.send(JSON.stringify({ type: 'agent-request', requestId: 'request-1', message: 'hello' }));

  const response = await new Promise((resolve) => {
    cli.once('message', (data) => resolve(JSON.parse(data)));
  });
  assert.deepEqual(response, {
    type: 'agent-response',
    requestId: 'request-1',
    content: 'still connected',
  });
});
