import { AppError } from './errors.js';

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
