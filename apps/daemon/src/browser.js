import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { MESSAGE_TYPES, createCountActiveWindowTabs, createListActiveWindowTabs } from '@oh-my-tabs/protocol';
import { AppError } from './errors.js';

const BROWSER_RESPONSE_TYPES = new Set([
  MESSAGE_TYPES.activeWindowTabsCounted,
  MESSAGE_TYPES.activeWindowTabsFailed,
  MESSAGE_TYPES.activeWindowTabsListed,
  MESSAGE_TYPES.activeWindowTabsListFailed,
]);

export class BrowserTransport {
  #clients = new Map();
  #pending = new Map();

  constructor({ timeoutMs = 5_000 } = {}) {
    this.timeoutMs = timeoutMs;
  }

  addClient(socket, sessionId) {
    this.#clients.set(socket, sessionId);
    socket.once('close', () => this.removeClient(socket));
  }

  removeClient(socket) {
    this.#clients.delete(socket);
    for (const pending of this.#pending.values()) {
      if (pending.socket === socket) {
        pending.reject(new AppError('extension_disconnected', 'The selected browser extension disconnected.'));
      }
    }
  }

  handleMessage(socket, message) {
    if (!BROWSER_RESPONSE_TYPES.has(message.type)) return false;
    const pending = this.#pending.get(message.requestId);
    if (!pending) return true;
    if (pending.socket !== socket) return false;
    if (message.type !== pending.successType && message.type !== pending.failureType) return false;

    if (message.type === pending.failureType) {
      pending.reject(new AppError('active_window_unavailable', 'The active browser window is unavailable.'));
      return true;
    }

    try {
      pending.resolve(message);
    } catch (error) {
      pending.reject(error);
    }
    return true;
  }

  requestCount() {
    return this.#request(
      createCountActiveWindowTabs,
      MESSAGE_TYPES.activeWindowTabsCounted,
      MESSAGE_TYPES.activeWindowTabsFailed,
      (message) => ({ windowId: message.windowId, count: message.count }),
    );
  }

  requestList() {
    return this.#request(
      createListActiveWindowTabs,
      MESSAGE_TYPES.activeWindowTabsListed,
      MESSAGE_TYPES.activeWindowTabsListFailed,
      (message) => ({ windowId: message.windowId, tabs: message.tabs }),
    );
  }

  #request(createRequest, successType, failureType, mapResult) {
    const clients = [...this.#clients.keys()].filter((client) => client.readyState === WebSocket.OPEN);
    if (clients.length === 0) {
      throw new AppError('extension_disconnected', 'The browser extension is not connected.');
    }
    if (clients.length > 1) {
      const sessionIds = clients.map((client) => this.#clients.get(client)).join(', ');
      throw new AppError(
        'ambiguous_extension_session',
        `Multiple browser extension sessions are connected (${sessionIds}). Disconnect all but one.`,
      );
    }
    const socket = clients[0];

    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new AppError('browser_timeout', 'The browser extension did not respond in time.'));
      }, this.timeoutMs);

      this.#pending.set(requestId, {
        socket,
        successType,
        failureType,
        resolve: (message) => {
          clearTimeout(timer);
          this.#pending.delete(requestId);
          resolve(mapResult(message));
        },
        reject: (error) => {
          clearTimeout(timer);
          this.#pending.delete(requestId);
          reject(error);
        },
      });
      const payload = JSON.stringify(createRequest(requestId));
      socket.send(payload);
    });
  }
}

export class BrowserGateway {
  constructor(transport) {
    this.transport = transport;
  }
  countTabsInActiveWindow() {
    return this.transport.requestCount();
  }
  listTabsInActiveWindow() {
    return this.transport.requestList();
  }
}
