import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import { BrowserTransport } from '../src/browser.js';
import { createDaemonServer } from '../src/server.js';

async function startServer(t, harness = { async run() { throw new Error('Harness should not run.'); } }) {
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

test('ignores unknown message types without invoking the harness', async (t) => {
  let invoked = false;
  const client = await startServer(t, { async run() { invoked = true; } });
  let received = false;
  client.once('message', () => { received = true; });

  client.send(JSON.stringify({ type: 'unknown' }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(invoked, false);
  assert.equal(received, false);
});
