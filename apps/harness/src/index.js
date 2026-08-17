import process from 'node:process';
import WebSocket, { WebSocketServer } from 'ws';

const host = process.env.WS_HOST ?? '127.0.0.1';
const port = Number(process.env.WS_PORT ?? 8787);
const server = new WebSocketServer({ host, port });
const debugEvent = JSON.stringify({
  type: 'debug',
  payload: { message: 'From harness' },
});

const debugInterval =
  process.env.OMT_DEBUG === 'true'
    ? setInterval(() => {
        for (const client of server.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(debugEvent);
          }
        }
      }, 3_000)
    : undefined;

server.on('listening', () => {
  console.log(`Harness listening on ws://${host}:${port}`);
});

server.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('message', (message) => {
    console.log(message.toString());
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });

  socket.on('error', console.error);
});

server.on('error', console.error);

server.on('close', () => clearInterval(debugInterval));

function shutdown(signal) {
  console.log(`Harness stopping (${signal})`);

  for (const client of server.clients) {
    client.terminate();
  }

  server.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
