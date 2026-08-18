import { WebSocketServer } from 'ws';
import { parseMessage } from './protocol.js';
import { toPublicError } from './errors.js';

export function createDaemonServer({ host = '127.0.0.1', port = 8787, harness, browserTransport }) {
  const server = new WebSocketServer({ host, port });

  server.on('connection', (socket) => {
    browserTransport.addClient(socket);
    socket.on('message', async (data) => {
      let message;
      try { message = parseMessage(data); } catch (error) {
        socket.send(JSON.stringify({ type: 'agent-error', error: toPublicError(error) }));
        return;
      }

      if (browserTransport.handleMessage(message)) return;
      if (message.type !== 'agent-request') return;
      browserTransport.removeClient(socket);

      try {
        const content = await harness.run(message.message);
        socket.send(JSON.stringify({ type: 'agent-response', requestId: message.requestId, content }));
      } catch (error) {
        socket.send(JSON.stringify({ type: 'agent-error', requestId: message.requestId, error: toPublicError(error) }));
      }
    });
  });

  return server;
}
