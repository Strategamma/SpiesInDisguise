import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';
import http from 'node:http';

// Exercise the actual gateway: unit rules tests cannot catch socket ownership bugs.
test('gateway preserves rooms, rejects stale actions, and completes a rematch', { timeout: 20000 }, async t => {
  const port = 31000 + Math.floor(Math.random() * 10000);
  const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), RECONNECT_GRACE_MS: '100' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => { server.stdout.on('data', chunk => { if (chunk.toString().includes('server_ready')) resolve(); }); server.once('exit', code => reject(new Error(`Server exited ${code}`))); });
  const invalid = await new Promise((resolve, reject) => http.get({ hostname: '127.0.0.1', port, path: '/%ZZ' }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject));
  assert.equal(invalid, 400);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  const clients = [];
  async function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`); clients.push(ws);
    const queue = []; ws.on('message', raw => queue.push(JSON.parse(raw)));
    await once(ws, 'open');
    return { ws, async send(action, type = 'state') {
      queue.length = 0; ws.send(JSON.stringify(action));
      const end = Date.now() + 2000;
      while (Date.now() < end) { const index = queue.findIndex(message => message.type === type); if (index >= 0) return queue.splice(index, 1)[0]; await new Promise(resolve => setTimeout(resolve, 5)); }
      throw new Error(`No ${type} for ${action.type}`);
    } };
  }
  t.after(() => clients.forEach(ws => ws.terminate()));
  const a = await client(), b = await client();
  const created = await a.send({ type: 'create', name: 'A', protocol: 3 }); const room = created.state.room;
  assert.equal((await a.send({type:"name",name:"Updated host"})).state.players[0].name,"Updated host");
  assert.match((await a.send({type:"name",name:" "},"error")).message,/codename/);
  assert.match((await a.send({ type: 'create' }, 'error')).message, /already/);
  await b.send({ type: 'join', room, name: 'B', protocol: 3 });
  const third = await client(); assert.match((await third.send({ type: 'join', room }, 'error')).message, /full/);
  assert.match((await a.send({ type: 'rematch' }, 'error')).message, /Finish/);
  await a.send({ type: 'ready', ready: true }); await b.send({ type: 'ready', ready: true });
  await a.send({ type: 'start' }); assert.match((await a.send({ type: 'start' }, 'error')).message, /already/);
  const replacement = await client(); const resumed = await replacement.send({ type: 'join', room, token: created.token, protocol: 3 });
  assert.equal(resumed.state.you, 0); assert.equal(a.ws.readyState === WebSocket.OPEN ? await new Promise(resolve => a.ws.once('close', code => resolve(code))) : 4001, 4001);
  let state = resumed.state;
  // Disconnected opponents cannot be bypassed by sending gameplay actions directly.
  b.ws.close(); await once(b.ws, 'close');
  assert.match((await replacement.send({ type: 'offer', openId: state.hand[0].id, hiddenId: state.hand[1].id }, 'error')).message, /reconnect/);
  const lost = await replacement.send({ type: 'rematch' }, 'error'); assert.match(lost.message, /Finish/);
  // Finish via fresh clients so this test also verifies explicit room exit cleanup.
  await replacement.send({ type: 'leave' }, 'left');
  assert.match((await third.send({ type: 'join', room }, 'error')).message, /not found/);
  const abandoned = await client(), keeper = await client();
  const disconnectedRoom = await abandoned.send({ type: 'create', protocol: 3 });
  await keeper.send({ type: 'join', room: disconnectedRoom.state.room, protocol: 3 });
  abandoned.ws.close(); await once(abandoned.ws, 'close');
  await third.send({ type: 'leave_room', room: disconnectedRoom.state.room, token: 'wrong' }, 'left');
  assert.equal((await keeper.send({ type: 'ready', ready: true })).state.players.length, 2);
  await third.send({ type: 'leave_room', room: disconnectedRoom.state.room, token: disconnectedRoom.token }, 'left');
  const retained = await keeper.send({ type: 'ready', ready: true });
  assert.equal(retained.state.players.length, 1); assert.equal(retained.state.isHost, true);
  const host = await client(), rival = await client();
  const c = await host.send({ type: 'create', protocol: 3 });
  let r = await rival.send({ type: 'join', room: c.state.room, protocol: 3 });
  await host.send({ type: 'ready', ready: true }); await rival.send({ type: 'ready', ready: true });
  state = (await host.send({ type: 'start' })).state;
  rival.ws.close(); await once(rival.ws, 'close');
  const rejoined = await client(); r = await rejoined.send({ type: 'join', room: c.state.room, token: r.token, protocol: 3 });
  assert.equal(r.state.you, 1); assert.equal(r.state.phase, 'offer');
  const pair = [host, rejoined]; const views = [state, r.state];
  for (let turn = 0; state.winner === null && turn < 50; turn++) {
    const active = state.turn, hand = views[active].hand;
    const first = hand[0], second = hand.find(card => card.kind !== first.kind) || hand[1];
    await pair[active].send({ type: 'offer', openId: first.id, hiddenId: second.id });
    const chosen = await pair[1 - active].send({ type: 'choose', choice: 'open' });
    state = chosen.state; views[1 - active] = state;
    // Use reconnect to obtain the authoritative private hand at each subsequent turn.
    if (state.winner === null) {
      const index = state.turn, token = index === 0 ? c.token : r.token;
      pair[index].ws.close(); await once(pair[index].ws, 'close');
      pair[index] = await client(); views[index] = (await pair[index].send({ type: 'join', room: c.state.room, token, protocol: 3 })).state;
    }
  }
  assert.notEqual(state.winner, null);
  await pair[0].send({ type: 'rematch' }); const rematch = await pair[1].send({ type: 'rematch' });
  assert.equal(rematch.state.phase, 'offer'); assert.equal(rematch.state.winner, null); assert.equal(rematch.state.players.length, 2);
  const h = await client(), g = await client(); const lobby = await h.send({ type: 'create', protocol: 3 });
  await g.send({ type: 'join', room: lobby.state.room, protocol: 3 }); await h.send({ type: 'leave' }, 'left');
  const promoted = await g.send({ type: 'ready', ready: true }); assert.equal(promoted.state.isHost, true); assert.equal(promoted.state.players.length, 1);
  const lostHost = await client(), survivor = await client();
  const migrate = await lostHost.send({ type: 'create', protocol: 3 });
  await survivor.send({ type: 'join', room: migrate.state.room, protocol: 3 });
  lostHost.ws.close(); await once(lostHost.ws, 'close');
  await new Promise(resolve => setTimeout(resolve, 150));
  const takeover = await survivor.send({ type: 'ready', ready: true });
  assert.equal(takeover.state.isHost, true); assert.equal(takeover.state.players.length, 1);
  const flood = await client(); await flood.send({type:"create",protocol:3});
  let limit; for(let request=0;request<12;request++) limit=await flood.send({type:"create",protocol:3},"error");
  assert.equal(limit.code,"rate_limited");
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/lan-addresses`)).json()).addresses instanceof Array, true);
});
