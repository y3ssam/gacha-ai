import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer, listenLocalServer } from '../server.mjs';

async function occupyPort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}
async function close(server) {
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

test('occupied default port falls back and serves the game with the new origin', async () => {
  const occupied = await occupyPort();
  const app = createAppServer();
  const busy = [];
  const initialPort = occupied.address().port;
  try {
    const port = await listenLocalServer(app, { port: initialPort, onPortBusy: value => busy.push(value) });
    assert.ok(port > initialPort);
    assert.ok(port < initialPort + 20);
    assert.equal(busy[0], initialPort);
    assert.equal(occupied.listening, true);
    const base = 'http://127.0.0.1:' + port;
    assert.equal((await fetch(base)).status, 200);
    const response = await fetch(base + '/api/game/text', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 403);
    assert.equal(app.listenerCount('error'), 0);
  } finally { await close(app); await close(occupied); }
});

test('explicit port and exhausted retries report a conflict without stopping the existing server', async () => {
  const occupied = await occupyPort();
  const app = createAppServer();
  const port = occupied.address().port;
  const originalListeningHandlers = app.listeners('listening');
  try {
    await assert.rejects(listenLocalServer(app, { port, allowFallback: false }), { code: 'EADDRINUSE' });
    await assert.rejects(listenLocalServer(app, { port, maxAttempts: 1 }), { code: 'EADDRINUSE' });
    assert.equal(occupied.listening, true);
    assert.equal(app.listening, false);
    assert.equal(app.listenerCount('error'), 0);
    assert.deepEqual(app.listeners('listening'), originalListeningHandlers);
  } finally { await close(app); await close(occupied); }
});
