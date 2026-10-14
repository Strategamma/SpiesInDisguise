import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
// Run the production handlers with controllable sockets/timers, without a DOM dependency.
function clientHarness() {
  const timers = new Map();
  let timerId = 0;
  const codeButton = { addEventListener(type, handler) { this[type] = handler; } };
  class Socket {
    static OPEN = 1;
    constructor() { this.listeners = {}; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    close() { this.listeners.close?.({ code: 1000 }); }
  }
  const context = vm.createContext({
    WebSocket: Socket, timers, codeButton,
    setTimeout(handler) { const id = ++timerId; timers.set(id, handler); return id; },
    clearTimeout(id) { timers.delete(id); },
    document: {
      querySelector() { return null; },
      querySelectorAll(selector) { return selector === "[data-private-code]" ? [codeButton] : []; }
    },
    gatewayUrl() { return "ws://local"; }, pendingLeaves() { return []; },
    render() {}, renderHome() {}, resume() {}, beginOnlineRoom() {},
    bindInteractionFeedback() {}, escapeHtml(value) { return value; },
    applyState(next) { context.state = next; },
    resetMatchFeedback() { context.pendingRevealState = null; context.revealState = null; },
    history: { replaceState() {} }, location: { pathname: "/" }, selected: [], faceUpId: null, swapMode: false, playMode: "wifi",
    showToast() {},
    localStorage: { setItem() {} }, connectDeadline: null, reconnectAttempts: 0,
    networkMode: "lan", connected: false, actionPending: false, queuedOnlineAction: null,
    pendingRoom: "", liveDuels: [], reconnectTimer: null, socket: null, state: null,
    homePanel: null, connectionError: "", revealState: null, pendingRevealState: null,
    revealComplete: null, revealTimer: null, movementNotice: null, movementTimer: null
  });
  for (const name of ["connect", "switchNetwork", "bindDuelBoard", "liveDuelBoardHtml", "finishReveal"]) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1);
    const remainder = source.slice(start);
    const end = remainder.slice(1).search(/\n(?:async )?function /);
    vm.runInContext(end < 0 ? remainder : remainder.slice(0, end + 1), context);
  }
  return context;
}

test("LAN private-code action preserves the gateway before and after presence refresh", () => {
  const client = clientHarness();
  const markup = client.liveDuelBoardHtml();
  assert.match(markup, /data-private-code/);
  assert.doesNotMatch(markup, /data-mode="wifi"/);
  for (let refresh = 0; refresh < 2; refresh++) {
    client.bindDuelBoard(); client.codeButton.click();
    assert.equal(client.networkMode, "lan");
    assert.equal(client.homePanel, "wifi");
  }
});

test("switching gateways cancels a queued room request before the new socket opens", () => {
  const client = clientHarness();
  let dispatched = 0;
  client.beginOnlineRoom = () => dispatched++;
  client.queuedOnlineAction = { isPublic: false, room: "" };
  client.switchNetwork("internet");
  client.socket.listeners.open();
  assert.equal(client.networkMode, "internet");
  assert.equal(client.queuedOnlineAction, null);
  assert.equal(dispatched, 0);
});

test("replacement during a reveal cannot restore the previous match or completion callback", () => {
  const client = clientHarness();
  client.connect();
  client.state = { room: "OLD" };
  client.revealState = { chooser: 0 };
  client.pendingRevealState = { room: "OLD", phase: "offer", players: [] };
  let completed = 0;
  client.revealComplete = () => completed++;
  client.revealTimer = client.setTimeout(client.finishReveal);
  client.movementTimer = client.setTimeout(() => {});
  client.socket.listeners.close({ code: 4001 });
  assert.equal(client.timers.size, 0);
  assert.equal(client.revealState, null);
  assert.equal(client.pendingRevealState, null);
  assert.equal(client.revealComplete, null);
  // Even an already-dispatched timer callback must not resurrect the room.
  client.finishReveal();
  assert.equal(client.state, null);
  assert.equal(completed, 0);
  assert.match(client.connectionError, /another device/);
});

test("ordinary disconnect keeps the reveal and schedules reconnection", () => {
  const client = clientHarness();
  client.connect();
  const pending = { room: "KEEP", phase: "offer", players: [] };
  client.state = { room: "KEEP" };
  client.pendingRevealState = pending;
  client.revealTimer = client.setTimeout(client.finishReveal);
  client.socket.listeners.close({ code: 1006 });
  assert.equal(client.timers.size, 2);
  client.finishReveal();
  assert.equal(client.state, pending);
});


test("an expired reconnect discards the stale match and opens room recovery", () => {
  const client = clientHarness(); client.connect();
  client.state = { room: "EXPIRE", phase: "offer" }; client.pendingRoom = "EXPIRE";
  client.pendingRevealState = { room: "EXPIRE" };
  client.socket.listeners.message({ data: JSON.stringify({ type: "error", code: "room_expired", message: "Room expired." }) });
  assert.equal(client.state, null); assert.equal(client.pendingRoom, "");
  assert.equal(client.pendingRevealState, null); assert.equal(client.homePanel, "wifi");
});

function uiHarness(names, values = {}) {
  const context=vm.createContext({URL,URLSearchParams,location:{hostname:'127.0.0.1',origin:'http://127.0.0.1:3199',pathname:'/',href:'http://127.0.0.1:3199/'},localHost:true,lanAddresses:[],selectedLanAddress:'',networkMode:'lan',window:{SPIES_IN_DISGUISE_PUBLIC_URL:'https://spiesindisguise.onrender.com/'},state:{room:'ABC123'},selected:[],faceUpId:null,swapMode:false,document:{querySelector(){return null}},renderGame(){},playSound(){},showToast(){},matchMedia(){return {matches:true}},...values});
  for(const name of names){const start=source.indexOf(`function ${name}(`),remainder=source.slice(start);const end=remainder.slice(1).search(/\n(?:async )?function /);vm.runInContext(end<0?remainder:remainder.slice(0,end+1),context);}
  return context;
}
test('Internet invitations use the public frontend while ambiguous/missing LAN interfaces cannot produce links',()=>{
 const client=uiHarness(['lanInvitationBase','invitationUrl']);assert.equal(client.invitationUrl(),'');
 client.lanAddresses=['http://10.0.0.4:3199/','http://192.168.1.2:3199/'];assert.equal(client.invitationUrl(),'');
 client.selectedLanAddress=client.lanAddresses[1];assert.equal(client.invitationUrl(),'http://192.168.1.2:3199/?room=ABC123&network=lan');
 client.selectedLanAddress='http://old-host/';assert.equal(client.invitationUrl(),'');
 client.lanAddresses=['http://10.0.0.4:3199/'];assert.match(client.invitationUrl(),/10\.0\.0\.4/);
 client.networkMode='internet';assert.equal(client.invitationUrl(),'https://spiesindisguise.onrender.com/?room=ABC123&network=internet');
});
test('offer editing preserves the revealed contact when replacing a concealed contact',()=>{
 const client=uiHarness(['selectCard'],{state:{hand:[{id:'a',kind:'oracle'},{id:'b',kind:'ghost'},{id:'c',kind:'courier'}]}});
 client.selectCard('a');client.selectCard('b');client.selectCard('a');assert.equal(client.faceUpId,'a');
 client.selectCard('c');assert.deepEqual(Array.from(client.selected),['a','c']);assert.equal(client.faceUpId,'a');
 client.selectCard('c');assert.equal(client.faceUpId,'c');client.selectCard('c');assert.deepEqual(Array.from(client.selected),['a']);assert.equal(client.faceUpId,null);
});
test('reduced motion disables programmatic smooth scrolling',()=>{
 const client=uiHarness(['scrollBehavior']);assert.equal(client.scrollBehavior(),'instant');client.matchMedia=()=>({matches:false});assert.equal(client.scrollBehavior(),'smooth');
});
test('peer updates retain a legal draft while invalid cards are removed',()=>{
 const client=clientHarness();client.localStorage={setItem(){},getItem(){return ''}};
 client.state={room:'ABC123',phase:'offer',turn:0,you:0,hand:[{id:'a'},{id:'b'}]};client.selected=['a','b'];client.faceUpId='a';client.connect();
 client.socket.listeners.message({data:JSON.stringify({type:'state',state:client.state,token:'t'})});assert.deepEqual(Array.from(client.selected),['a','b']);assert.equal(client.faceUpId,'a');
 const next={...client.state,hand:[{id:'b'}]};client.socket.listeners.message({data:JSON.stringify({type:'state',state:next,token:'t'})});assert.deepEqual(Array.from(client.selected),['b']);assert.equal(client.faceUpId,null);
});

test('home connection retries stop after four failures; active seats keep recovery available',()=>{
 const client=clientHarness();client.state=null;
 for(let attempt=0;attempt<5;attempt++){client.connect();client.socket.listeners.close({code:1006});}
 assert.equal(client.reconnectAttempts,5);assert.equal(client.timers.size,0);
 client.state={room:'ABC123'};client.connect();client.socket.listeners.close({code:1006});assert.equal(client.timers.size,1);
});


test('late room messages cannot resurrect a match after exit or replace offline play',()=>{
 const client=clientHarness();client.connect();
 for(const mode of [null,'bot','local']) {
  client.playMode=mode;client.state=mode?{room:'LOCAL'}:null;
  client.socket.listeners.message({data:JSON.stringify({type:'state',state:{room:'OLD'},token:'t'})});
  assert.equal(client.state?.room,mode?'LOCAL':undefined);
  client.socket.listeners.message({data:JSON.stringify({type:'room_closed',message:'old room closed'})});
  assert.equal(client.state?.room,mode?'LOCAL':undefined);
 }
});
