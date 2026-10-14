import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('PWA updates remove only this game cache and include offline recovery', async () => {
 const handlers={},deleted=[];const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 const current=source.match(/const CACHE = "([^"]+)"/)[1];
 vm.runInNewContext(source,{self:{addEventListener:(event,handler)=>handlers[event]=handler},caches:{keys:async()=>['bones-v2','spies-in-disguise-v20',current],delete:async key=>deleted.push(key)}});
 let pending;handlers.activate({waitUntil(p){pending=p}});await pending;
 assert.deepEqual(deleted,['spies-in-disguise-v20']);assert.match(source,/session\.js/);
});
