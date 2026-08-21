import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MESSAGE_TYPES,
  ProtocolValidationError,
  createActiveWindowTabsCounted,
  createActiveWindowTabsFailed,
  createActiveWindowTabsListed,
  createActiveWindowTabsListFailed,
  createAgentError,
  createAgentRequest,
  createAgentResponse,
  createCountActiveWindowTabs,
  createHelloMessage,
  createListActiveWindowTabs,
  parseClientToDaemonMessage,
  parseDaemonToCliMessage,
  parseDaemonToExtensionMessage,
  parseJsonMessage,
} from '../dist/index.js';

test('creates versioned handshakes', () => {
  assert.deepEqual(createHelloMessage('cli'), {
    type: MESSAGE_TYPES.hello,
    role: 'cli',
    protocolVersion: 1,
  });
  assert.deepEqual(createHelloMessage('extension', 'session-1'), {
    type: MESSAGE_TYPES.hello,
    role: 'extension',
    protocolVersion: 1,
    sessionId: 'session-1',
  });
  assert.throws(
    () => parseClientToDaemonMessage({ type: 'hello', role: 'extension', protocolVersion: 1 }),
    ProtocolValidationError,
  );
});

test('parses messages in each protocol direction', () => {
  assert.deepEqual(parseClientToDaemonMessage(createAgentRequest('1', 'hello')), createAgentRequest('1', 'hello'));
  assert.deepEqual(
    parseClientToDaemonMessage(createActiveWindowTabsCounted('2', 7, 3)),
    createActiveWindowTabsCounted('2', 7, 3),
  );
  assert.deepEqual(parseClientToDaemonMessage(createActiveWindowTabsFailed('3')), createActiveWindowTabsFailed('3'));
  const tabs = [{ id: 101, title: 'GitHub', url: 'https://github.com', active: true, pinned: false }];
  assert.deepEqual(
    parseClientToDaemonMessage(createActiveWindowTabsListed('4', 7, tabs)),
    createActiveWindowTabsListed('4', 7, tabs),
  );
  assert.deepEqual(
    parseClientToDaemonMessage(createActiveWindowTabsListFailed('5')),
    createActiveWindowTabsListFailed('5'),
  );
  assert.deepEqual(parseDaemonToCliMessage(createAgentResponse('1', 'done')), createAgentResponse('1', 'done'));
  assert.deepEqual(
    parseDaemonToCliMessage(createAgentError({ code: 'failed', message: 'Failed.' }, '1')),
    createAgentError({ code: 'failed', message: 'Failed.' }, '1'),
  );
  assert.deepEqual(parseDaemonToExtensionMessage(createCountActiveWindowTabs('1')), createCountActiveWindowTabs('1'));
  assert.deepEqual(parseDaemonToExtensionMessage(createListActiveWindowTabs('2')), createListActiveWindowTabs('2'));
});

test('rejects malformed JSON and payloads', () => {
  assert.throws(() => parseJsonMessage('not-json'), ProtocolValidationError);
  assert.throws(
    () => parseClientToDaemonMessage({ type: 'hello', role: 'cli', protocolVersion: 2 }),
    ProtocolValidationError,
  );
  assert.throws(() => parseDaemonToCliMessage({ type: 'agent-response', requestId: '1' }), ProtocolValidationError);
  assert.throws(() => parseDaemonToExtensionMessage({ type: 'unknown' }), ProtocolValidationError);
  assert.throws(() => parseDaemonToExtensionMessage({ type: 'clear-tabs' }), ProtocolValidationError);
});

test('rejects invalid browser results', () => {
  assert.throws(
    () =>
      parseClientToDaemonMessage({
        type: 'active-window-tabs-counted',
        requestId: '1',
        windowId: 1,
        count: -1,
      }),
    ProtocolValidationError,
  );
  assert.throws(
    () =>
      parseClientToDaemonMessage({
        type: 'active-window-tabs-listed',
        requestId: '2',
        windowId: 1,
        tabs: [{ id: 1, title: 'Tab', url: 'https://example.com', active: 'yes', pinned: false }],
      }),
    ProtocolValidationError,
  );
});
