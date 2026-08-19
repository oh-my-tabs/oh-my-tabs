import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDaemonEndpoint } from '../dist/index.js';

test('uses the default local daemon endpoint', () => {
  assert.deepEqual(resolveDaemonEndpoint(), {
    host: '127.0.0.1',
    port: 8787,
    url: 'ws://127.0.0.1:8787',
  });
});

test('applies host and port overrides consistently', () => {
  assert.deepEqual(
    resolveDaemonEndpoint({
      OH_MY_TABS_DAEMON_HOST: 'localhost',
      OH_MY_TABS_DAEMON_PORT: '9000',
    }),
    {
      host: 'localhost',
      port: 9000,
      url: 'ws://localhost:9000',
    },
  );
});

test('rejects invalid ports', () => {
  assert.throws(() => resolveDaemonEndpoint({ OH_MY_TABS_DAEMON_PORT: 'invalid' }));
});
