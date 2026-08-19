import { AppError } from './errors.js';

export const PROTOCOL_VERSION = 1;

export function parseMessage(data) {
  try {
    const value = JSON.parse(data.toString());
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') throw new Error();
    return value;
  } catch {
    throw new AppError('invalid_message', 'Received an invalid WebSocket message.');
  }
}

export function parseBrowserResult(value) {
  if (
    value.type !== 'active-window-tabs-counted' ||
    typeof value.requestId !== 'string' ||
    !Number.isInteger(value.windowId) ||
    !Number.isInteger(value.count) ||
    value.count < 0
  ) {
    throw new AppError('invalid_browser_response', 'The extension returned an invalid tab count.');
  }
  return { windowId: value.windowId, count: value.count };
}

export function parseHandshake(value) {
  if (value.type !== 'hello' || (value.role !== 'cli' && value.role !== 'extension')) {
    throw new AppError('invalid_handshake', 'The first message must identify a valid client role.');
  }
  if (value.protocolVersion !== PROTOCOL_VERSION) {
    throw new AppError('unsupported_protocol_version', 'The client protocol version is not supported.');
  }
  return { role: value.role };
}
