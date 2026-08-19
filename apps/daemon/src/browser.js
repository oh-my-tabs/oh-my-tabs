import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { MESSAGE_TYPES, createCountActiveWindowTabs } from '@oh-my-tabs/protocol';
import { AppError } from './errors.js';

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
    if (message.type !== MESSAGE_TYPES.activeWindowTabsCounted && message.type !== MESSAGE_TYPES.activeWindowTabsFailed)
      return false;
    const pending = this.#pending.get(message.requestId);
    if (!pending) return true;
    if (pending.socket !== socket) return false;

    if (message.type === MESSAGE_TYPES.activeWindowTabsFailed) {
      pending.reject(new AppError('active_window_unavailable', 'The active browser window is unavailable.'));
      return true;
    }

    try {
      pending.resolve({ windowId: message.windowId, count: message.count });
    } catch (error) {
      pending.reject(error);
    }
    return true;
  }

  requestCount() {
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
        resolve: (value) => {
          clearTimeout(timer);
          this.#pending.delete(requestId);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          this.#pending.delete(requestId);
          reject(error);
        },
      });
      const payload = JSON.stringify(createCountActiveWindowTabs(requestId));
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
}
