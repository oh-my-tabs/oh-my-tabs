import process from 'node:process';
import WebSocket, { WebSocketServer } from 'ws';

const host = process.env.WS_HOST ?? '127.0.0.1';
const port = Number(process.env.WS_PORT ?? 8787);
const server = new WebSocketServer({ host, port });

function broadcast(message, isBinary, sender) {
  for (const client of server.clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message, { binary: isBinary });
    }
  }
}

server.on('listening', () => {
  console.log(`Harness listening on ws://${host}:${port}`);
});

server.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('message', (message, isBinary) => {
    console.log(message.toString());
    broadcast(message, isBinary, socket);
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });

  socket.on('error', console.error);
});

server.on('error', console.error);

function shutdown(signal) {
  console.log(`Harness stopping (${signal})`);

  for (const client of server.clients) {
    client.terminate();
  }

  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
