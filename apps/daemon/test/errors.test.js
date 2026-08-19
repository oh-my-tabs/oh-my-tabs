import assert from 'node:assert/strict';
import test from 'node:test';
import { HarnessError } from '@oh-my-tabs/harness';
import { toPublicError } from '../src/errors.js';

test('preserves harness errors at the daemon boundary', () => {
  assert.deepEqual(
    toPublicError(new HarnessError('invalid_request', 'Enter a non-empty question.')),
    { code: 'invalid_request', message: 'Enter a non-empty question.' },
  );
});
