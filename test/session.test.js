import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalGame, localOffer, localChoose } from '../public/local-game.js';
import { saveOfflineGame, loadOfflineGame, clearOfflineGame } from '../public/session.js';
const storage = () => { const data = new Map(); return {getItem: key => data.get(key), setItem: (key,value) => data.set(key,value), removeItem: key => data.delete(key)}; };
test('offline saves restore offer/choice states and reject corrupted or future versions', () => {
 const store = storage(); const game = createLocalGame('local');
 assert.equal(saveOfflineGame(game,0,store),true); assert.deepEqual(loadOfflineGame(store).game,game);
 const [a,b] = game.players[0].hand; if(a.kind === b.kind) b.kind = a.kind === 'courier' ? 'ghost' : 'courier';
 localOffer(game,0,a.id,b.id); assert.equal(saveOfflineGame(game,1,store),true); assert.equal(loadOfflineGame(store).viewer,1);
 localChoose(game,1,'open'); assert.equal(saveOfflineGame(game,1,store),true);
 const save = loadOfflineGame(store); save.game.players[0].hand[0].kind = 'bad'; store.setItem('spies-offline-v1',JSON.stringify(save)); assert.equal(loadOfflineGame(store),null);
 store.setItem('spies-offline-v1','{"version":9}'); assert.equal(loadOfflineGame(store),null);
 clearOfflineGame(store); assert.equal(loadOfflineGame(store),null);
});
