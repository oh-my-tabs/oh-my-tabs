import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { AppError } from './errors.js';
import { parseBrowserResult } from './protocol.js';

export class BrowserTransport {
  #clients = new Set();
  #pending = new Map();

  constructor({ timeoutMs = 5_000 } = {}) {
    this.timeoutMs = timeoutMs;
  }

  addClient(socket) {
    this.#clients.add(socket);
    socket.once('close', () => this.#clients.delete(socket));
  }

  removeClient(socket) {
    this.#clients.delete(socket);
  }

  handleMessage(message) {
    if (message.type !== 'active-window-tabs-counted' && message.type !== 'active-window-tabs-failed') return false;
    const pending = this.#pending.get(message.requestId);
    if (!pending) return true;

    if (message.type === 'active-window-tabs-failed') {
      pending.reject(new AppError('active_window_unavailable', 'The active browser window is unavailable.'));
      return true;
    }

    try {
      pending.resolve(parseBrowserResult(message));
    } catch (error) {
      pending.reject(error);
    }
    return true;
  }

  requestCount() {
    const clients = [...this.#clients].filter((client) => client.readyState === WebSocket.OPEN);
    if (clients.length === 0) {
      throw new AppError('extension_disconnected', 'The browser extension is not connected.');
    }

    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new AppError('browser_timeout', 'The browser extension did not respond in time.'));
      }, this.timeoutMs);

      this.#pending.set(requestId, {
        resolve: (value) => { clearTimeout(timer); this.#pending.delete(requestId); resolve(value); },
        reject: (error) => { clearTimeout(timer); this.#pending.delete(requestId); reject(error); },
      });
      const payload = JSON.stringify({ type: 'count-active-window-tabs', requestId });
      for (const client of clients) client.send(payload);
    });
  }
}

export class BrowserGateway {
  constructor(transport) { this.transport = transport; }
  countTabsInActiveWindow() { return this.transport.requestCount(); }
}
