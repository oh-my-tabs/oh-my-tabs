import { WebSocketServer } from 'ws';
import { parseHandshake, parseMessage } from './protocol.js';
import { AppError, toPublicError } from './errors.js';

function sendError(socket, error, requestId) {
  socket.send(JSON.stringify({
    type: 'agent-error',
    ...(requestId === undefined ? {} : { requestId }),
    error: toPublicError(error),
  }));
}

export function createDaemonServer({ host = '127.0.0.1', port = 8787, harness, browserTransport }) {
  const server = new WebSocketServer({ host, port });

  server.on('connection', (socket) => {
    let role;

    socket.on('message', async (data) => {
      let message;
      try { message = parseMessage(data); } catch (error) {
        sendError(socket, error);
        return;
      }

      if (!role) {
        try {
          role = parseHandshake(message).role;
          if (role === 'extension') browserTransport.addClient(socket);
        } catch (error) {
          sendError(socket, error);
        }
        return;
      }

      if (message.type === 'hello') {
        sendError(socket, new AppError('repeated_handshake', 'The client role is already established.'));
        return;
      }

      if (role === 'extension') {
        if (browserTransport.handleMessage(message)) return;
        sendError(socket, new AppError('message_not_allowed', 'The extension cannot send this message type.'));
        return;
      }

      if (message.type !== 'agent-request') {
        sendError(
          socket,
          new AppError('message_not_allowed', 'The CLI cannot send this message type.'),
          message.requestId,
        );
        return;
      }

      try {
        const content = await harness.run(message.message);
        socket.send(JSON.stringify({ type: 'agent-response', requestId: message.requestId, content }));
      } catch (error) {
        sendError(socket, error, message.requestId);
      }
    });
  });

  return server;
}
