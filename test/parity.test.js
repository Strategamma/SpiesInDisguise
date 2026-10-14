import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalGame, localOffer, localChoose, localSwap, chooseBotOffer, chooseBotSwap, localView } from '../public/local-game.js';
import { newRoom, newPlayer, addPlayer, setReady, startGame, submitOffer, chooseOffer, swapCard, restart } from '../server/game.js';
import { saveOfflineGame, loadOfflineGame } from '../public/session.js';
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
test('250 seeded complete matches preserve local/server rules, recaps, counts and save recovery', () => {
 for(let seed=1;seed<=250;seed++) {
  const random=rng(seed), local=createLocalGame('local','A',random,{opponentName:'B',starter:seed%2});
  const room=newRoom('ABC123',newPlayer('A',3)); addPlayer(room,newPlayer('B',3)); setReady(room,0,true);setReady(room,1,true);startGame(room,0);
  room.deck=structuredClone(local.deck); room.turn=local.turn;
  room.players.forEach((p,i)=>Object.assign(p,structuredClone(local.players[i])));
  let stored; const storage={setItem(k,v){stored=v},getItem(){return stored}};
  let exchanges=0;
  while(local.winner===null) {
   assert.ok(++exchanges<=30);
   const i=local.turn;
   if(local.deck.length && local.players[i].swapsRemaining && random()<.25) {
    const id=local.players[i].hand[0].id; localSwap(local,i,id);swapCard(room,i,id);
   }
   const hand=local.players[i].hand;
   const a=hand[0],b=hand.find(c=>c.id!==a.id && c.kind!==a.kind)||hand[1];
   localOffer(local,i,a.id,b.id);submitOffer(room,i,a.id,b.id);
   assert.equal(saveOfflineGame(local,1-i,storage),true);
   assert.equal(loadOfflineGame(storage).game.offer.hidden.id,b.id);
   const choice=random()<.5?'open':'hidden';localChoose(local,1-i,choice);chooseOffer(room,1-i,choice);
   for(const key of ['phase','winner','resultReason','turn','deck','lastExchange'])assert.deepEqual(local[key],room[key],`seed ${seed} ${key}`);
   room.players.forEach((p,j)=> { for(const key of ['progress','collection','lastMovement','recruits','hand','swapsRemaining']) assert.deepEqual(local.players[j][key],p[key]); });
   assert.equal(saveOfflineGame(local,1-i,storage),true);
   assert.deepEqual(loadOfflineGame(storage).game,local);
  }
  const oldMatch=room.matchId;restart(room);assert.notEqual(room.matchId,oldMatch);assert.equal(room.lastExchange,null);assert.ok(room.players.every(p=>p.recruits===0));
  const rematch=createLocalGame('local','A',random,{starter:1-local.starter});assert.equal(rematch.turn,1-local.starter);assert.equal(localView(rematch,rematch.turn).lastExchange,null);
 }
});
test('bot offers vary only among near-best legal pairs and optional swaps use own cards', () => {
 const game=createLocalGame('bot');game.turn=1;
 game.players[1].hand=['courier','ghost','handler','oracle'].map((kind,i)=>({kind,id:String(i)}));
 const first=chooseBotOffer(game,'rookie',()=>0),last=chooseBotOffer(game,'rookie',()=>.999);
 assert.notDeepEqual(first,last);
 const swap=chooseBotSwap(game,10,'mastermind',()=>0);assert.equal(swap,'2');
 assert.equal(chooseBotSwap(game,0,'mastermind',()=>0),null);
});
