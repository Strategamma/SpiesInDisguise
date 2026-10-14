import { pendingLeaves, rememberLeave, forgetLeave, saveOfflineGame, loadOfflineGame, clearOfflineGame } from "./session.js";
import { chooseBotCard, chooseBotOffer, chooseBotSwap, createLocalGame, localChoose, localOffer, localSwap, localView } from "./local-game.js";
import { BOARD_SPACES, exchangeSummary, boardPosition, contactStageEffect, interceptionGap, nextRecruitIndex, projectedCardPosition, resolutionMovementNotice, stateMotionCue } from "./ui-logic.js";

const CONTACTS = {
  courier: { name: "Courier", symbol: "◈", moves: [1, 2, 3], note: "Reliable progress with every recruit." },
  analyst: { name: "Analyst", symbol: "⌁", moves: [-1, 6, -1], note: "A risky first recruit with a huge second payoff." },
  ghost: { name: "Ghost", symbol: "◌", moves: [0, 2, 6], note: "Quiet at first, decisive as the network grows." },
  handler: { name: "Handler", symbol: "⌘", moves: [-1, -1, -2], note: "Always pulls its recruiter backward." },
  oracle: { name: "Oracle", symbol: "◇", moves: [0, 0, 0], note: "Recruit three to win at the end of the turn." },
  renegade: { name: "Renegade", symbol: "✕", moves: [2, 3, 0], note: "Fast early—recruiting three makes you lose." },
  insider: { name: "Insider", symbol: "↑", moves: [4], note: "A unique contact that moves four spaces forward.", single: true },
  sleeper: { name: "Sleeper", symbol: "↓", moves: [-3], note: "A unique contact that moves three spaces backward.", single: true },
  jammer: { name: "Jammer", symbol: "ϟ", moves: [2], note: "Move two spaces forward and push your rival one space backward.", ability: "+2 · rival −1", single: true },
  cleaner: { name: "Cleaner", symbol: "✦", moves: [1], note: "Move one space forward, then remove one Renegade from your network.", ability: "+1 · clear Renegade", single: true },
  mimic: { name: "Mimic", symbol: "≈", moves: [0], note: "Repeat the movement of the last contact you recruited. Win and loss icons are not copied.", ability: "Repeat last move", dynamic: true, single: true },
  slingshot: { name: "Slingshot", symbol: "↯", moves: [0], note: "Move five spaces if you are behind; move two spaces backward if you are tied or ahead.", ability: "Behind +5 · ahead −2", dynamic: true, single: true }
};

function contactMovement(kind, playerIndex, recruitIndex = 0) {
  const contact = CONTACTS[kind];
  const player = state?.players?.[playerIndex];
  if (kind === "mimic") return Number(player?.lastMovement || 0);
  if (kind === "slingshot") return Number(player?.progress || 0) < Number(state?.players?.[1 - playerIndex]?.progress || 0) ? 5 : -2;
  return contact.moves[contact.single ? 0 : recruitIndex];
}

const BOT_PROFILES = {
  rookie: { name: "Rook", label: "Rookie", note: "Learns the cards and plays for its own movement." },
  balanced: { name: "Cipher", label: "Field Agent", note: "Balances progress with blocking your best recruits." },
  mastermind: { name: "Viper", label: "Mastermind", note: "Plans around both networks and punishes obvious offers." }
};

function stageEffectHtml(kind, index, movement) {
  const effect = contactStageEffect(kind, index, movement);
  return `<b class="effect-${effect.className}" aria-label="${effect.label}">${effect.icon}</b>${effect.shortLabel ? `<span class="outcome-label">${effect.shortLabel}</span>` : ""}`;
}

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const params = new URLSearchParams(location.search);
const savedName = localStorage.getItem("spies-name") || localStorage.getItem("shadow-name") || "";
let socket;
let state = null;
let connected = false;
let liveDuels = [];
let selected = [];
let faceUpId = null;
let swapMode = false;
let pendingRoom = params.get("room")?.toUpperCase() || "";
let playMode = pendingRoom ? "wifi" : null;
let localGame = null;
let localHandoff = false;
let installPrompt = null;
let homePanel = pendingRoom ? "wifi" : null;
let homeNavigation = "home";
let botTimer = null;
let splashVisible = false;
const savedNetwork = localStorage.getItem("spies-network");
let networkMode = (params.get("network") || savedNetwork) === "lan" ? "lan" : "internet";
let actionPending = false;
let connectionError = "";
let reconnectTimer;
let connectDeadline = null;
let reconnectAttempts = 0;
let queuedOnlineAction = null;
let lanAddresses = [];
let selectedLanAddress = localStorage.getItem("spies-lan-address") || "";
const localHost = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
if (localHost && !params.has("network") && !savedNetwork) networkMode = "lan";
let soundEnabled = localStorage.getItem("spies-sound") !== "off";
let audioContext = null;
let revealState = null;
let pendingRevealState = null;
let revealTimer = null;
let revealComplete = null;
let movementNotice = null;
let movementTimer = null;
let motionCue = null;
let celebratedResult = "";
let landscapePromptDismissed = true;
const savedBotProfile = localStorage.getItem("spies-bot-profile");
let botProfile = BOT_PROFILES[savedBotProfile] ? savedBotProfile : "rookie";

const SOUND_PATTERNS = {
  hover: [[560, .025, 0]],
  start: [[220, .08, 0], [330, .1, .08], [494, .16, .17]],
  tap: [[420, .055, 0]],
  select: [[330, .05, 0], [520, .07, .045]],
  offer: [[620, .07, 0], [440, .09, .07]],
  reveal: [[260, .06, 0], [520, .12, .08], [780, .11, .2]],
  turn: [[392, .06, 0], [587, .1, .07]],
  move: [[294, .07, 0], [440, .08, .06], [659, .11, .13]],
  win: [[392, .1, 0], [494, .1, .09], [587, .1, .18], [784, .24, .27]],
  lose: [[392, .1, 0], [330, .12, .09], [247, .24, .2]],
  danger: [[196, .08, 0], [196, .08, .12], [147, .18, .24]]
};

async function ensureAudio() {
  if (!soundEnabled) return null;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  audioContext ||= new Audio();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext;
}

async function playSound(name) {
  if (!soundEnabled) return;
  try {
    const audio = await ensureAudio();
    if (!audio) return;
    const now = audio.currentTime;
    (SOUND_PATTERNS[name] || SOUND_PATTERNS.tap).forEach(([frequency, duration, delay]) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = name === "lose" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + delay);
      gain.gain.setValueAtTime(.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(.045, now + delay + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + .02);
    });
  } catch { /* Audio is optional; gameplay must remain unaffected. */ }
}

function resetMatchFeedback() {
  clearTimeout(revealTimer); clearTimeout(movementTimer);
  revealTimer = null; movementTimer = null; revealState = null; pendingRevealState = null;
  revealComplete = null; movementNotice = null; celebratedResult = "";
}

function applyState(next) {
  const previous = state;
  if (previous && (previous.room !== next.room || (previous.matchId && next.matchId && previous.matchId !== next.matchId) || (previous.winner !== null && next.winner === null))) resetMatchFeedback();
  motionCue = stateMotionCue(previous, next);
  state = next;
  if (!previous || splashVisible) return;
  const movementChanged = previous.players?.some((player, index) => player.progress !== next.players?.[index]?.progress);
  const enteredDanger = previous.players?.length === 2 && next.players?.length === 2 && interceptionGap(previous.players) > 2 && interceptionGap(next.players) <= 2 && next.winner === null;
  if (previous.winner === null && next.winner !== null) playSound(playMode === "local" || next.winner === next.you ? "win" : "lose");
  else if (enteredDanger) { playSound("danger"); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.([45, 45, 80]); }
  else if (movementChanged) playSound("move");
  else if (previous.phase !== next.phase && next.phase === "offer") playSound("turn");
}

function startReveal(payload, onComplete = null) {
  clearTimeout(revealTimer);
  movementNotice = null;
  revealState = payload;
  pendingRevealState = null;
  revealComplete = onComplete;
  playSound("reveal");
  renderGame();
  // Players advance at their own reading pace.
}

function queueAfterReveal(next) {
  pendingRevealState = next;
  movementNotice = next.lastExchange || exchangeSummary(state, next, revealState);
  renderGame();
}

function finishReveal() {
  clearTimeout(revealTimer);
  revealTimer = null;
  const resolvedReveal = revealState;
  revealState = null;
  if (pendingRevealState) {
    const previous = state;
    const next = pendingRevealState;
    pendingRevealState = null;
    if (resolvedReveal && previous?.players && next.players) {
      movementNotice = next.lastExchange || exchangeSummary(previous, next, resolvedReveal);
    }
    applyState(next);
  }
  render();
  const complete = revealComplete; revealComplete = null; complete?.();
}

function gatewayUrl() {
  if (networkMode === "lan") return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  if (window.SPIES_IN_DISGUISE_GATEWAY || window.SHADOW_CIRCUIT_GATEWAY) return window.SPIES_IN_DISGUISE_GATEWAY || window.SHADOW_CIRCUIT_GATEWAY;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function send(type, payload = {}) {
  if (playMode && playMode !== "wifi") return localAction(type, payload);
  if (socket?.readyState !== WebSocket.OPEN) return showToast("Still connecting…");
  if (actionPending) return;
  actionPending = true;
  document.querySelectorAll("#create,#create-public,#join,#offer,#start-match,#toggle-ready,#again,[data-choice]").forEach(button => { button.disabled = true; });
  socket.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  clearTimeout(reconnectTimer); clearTimeout(connectDeadline);
  const oldSocket = socket; socket = null; oldSocket?.close();
  const currentSocket = socket = new WebSocket(gatewayUrl());
  socket.addEventListener("open", () => { if (socket !== currentSocket) return; clearTimeout(connectDeadline); reconnectAttempts = 0; connected = true; connectionError = ""; actionPending = false; pendingLeaves().filter(entry => entry.gateway === gatewayUrl()).forEach(entry => socket.send(JSON.stringify({ type: "leave_room", room: entry.room, token: entry.token }))); render(); if (queuedOnlineAction) { const queued = queuedOnlineAction; queuedOnlineAction = null; beginOnlineRoom(queued.isPublic, queued.room); } else resume(); });
  socket.addEventListener("close", event => { if (socket !== currentSocket) return; clearTimeout(connectDeadline); connected = false; actionPending = false;
    if (event.code === 4001) {
      clearTimeout(revealTimer); clearTimeout(movementTimer); revealTimer = null; movementTimer = null;
      revealState = null; pendingRevealState = null; revealComplete = null; movementNotice = null;
      state = null; connectionError = "This room is open on another device. Continue there, or reconnect here.";
    }
    if (playMode === "bot" || playMode === "local") return;
    reconnectAttempts += 1;
    if (event.code !== 4001) connectionError = "The game server is taking longer to respond. Retry, or play offline while it wakes up.";
    render();
    if (event.code !== 4001 && (state || reconnectAttempts <= 4)) reconnectTimer = setTimeout(connect, Math.min(20000, 1500 * 2 ** (reconnectAttempts - 1)));
  });
  connectDeadline = setTimeout(() => { if (socket === currentSocket && currentSocket.readyState !== WebSocket.OPEN) currentSocket.close(); }, 30000);
  socket.addEventListener("message", event => {
    if (socket !== currentSocket) return;
    const message = JSON.parse(event.data);
    if (message.type === "presence") {
      liveDuels = Array.isArray(message.duels) ? message.duels : [];
      const board = document.querySelector("#live-duel-board");
      if (board && !state) { board.outerHTML = liveDuelBoardHtml(); bindDuelBoard(); bindInteractionFeedback(); }
    } else if (message.type === "reveal") { if (playMode === "wifi") startReveal(message); }
    else if (message.type === "state") {
      if (playMode !== "wifi") return;
      actionPending = false; connectionError = ""; pendingRoom = message.state.room;
      playMode = "wifi";
      if (revealState) queueAfterReveal(message.state); else applyState(message.state);
      if (state.phase !== "offer" || state.turn !== state.you) { selected = []; faceUpId = null; swapMode = false; }
      else { selected = selected.filter(id => state.hand.some(card => card.id === id)); if (!selected.includes(faceUpId)) faceUpId = null; }
      localStorage.setItem(`spies-token-${networkMode}-${state.room}`, message.token);
      history.replaceState({}, "", `${location.pathname}?room=${state.room}&network=${networkMode}`);
      render();
    } else if (message.type === "left") { if (message.room) forgetLeave(message.room, gatewayUrl());
    } else if (message.type === "error") {
      if (playMode !== "wifi") return;
      actionPending = false; connectionError = message.message;
      const terminal = ["room_not_found", "room_expired", "seat_lost"].includes(message.code) || /room not found|room expired|match has already started|room is full/i.test(message.message);
      if (terminal) { resetMatchFeedback(); state = null; pendingRoom = ""; selected = []; faceUpId = null; swapMode = false; playMode = null; homePanel = "wifi"; history.replaceState({}, "", `${location.pathname}?network=${networkMode}`); }
      else if (!state) pendingRoom = "";
      render(); showToast(message.message);
    }
    else if (message.type === "room_closed") { if (playMode !== "wifi") return; clearTimeout(revealTimer); clearTimeout(movementTimer); revealState = null; pendingRevealState = null; revealComplete = null; movementNotice = null; state = null; playMode = null; homePanel = "wifi"; queuedOnlineAction = null; pendingRoom = ""; connectionError = message.message || "That room expired. Create a new room."; history.replaceState({}, "", `${location.pathname}?network=${networkMode}`); renderHome(); }
  });
}

function resume() {
  if (!pendingRoom || playMode !== "wifi") return;
  const token = localStorage.getItem(`spies-token-${networkMode}-${pendingRoom}`) || (networkMode === "internet" ? localStorage.getItem(`spies-token-${pendingRoom}`) || localStorage.getItem(`shadow-token-${pendingRoom}`) : null);
  send("join", { room: pendingRoom, token: token || undefined, name: localStorage.getItem("spies-name") || savedName || "", protocol: 3 });
}

function shell(content) {
  const inGame = Boolean(state);
  return `<div class="app-shell"><header class="topbar"><button class="brand brand-button" data-home aria-label="Return to home"><img class="brand-logo" src="./logo.svg" alt="Spies in Disguise"></button><div class="header-actions">${!state && !isInstalled() ? `<button class="install-button" data-install aria-label="Install Spies in Disguise"><span aria-hidden="true">⇩</span><b>Install</b></button>` : ""}<button class="sound-button" data-sound aria-label="${soundEnabled ? "Mute sounds" : "Turn sounds on"}" aria-pressed="${soundEnabled}"><span aria-hidden="true">${soundEnabled ? "♪" : "×"}</span></button></div></header><nav class="app-nav" aria-label="Primary navigation"><button class="nav-button ${inGame ? "" : "active"}" data-home ${inGame ? "" : 'aria-current="page"'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-7 8 7v10h-6v-6h-4v6H4z"/></svg><b>Home</b></button><button class="nav-button ${inGame ? "active" : ""}" data-play ${inGame ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="12" height="16" rx="2"/><path d="M5 17H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2"/></svg><b>Play</b></button><button class="nav-button" data-rules><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/></svg><b>Rules</b></button></nav><div class="app-content">${content}</div></div>${inGame && !landscapePromptDismissed ? `<div class="rotate-device" role="status"><span aria-hidden="true">↻</span><b>Rotate to landscape</b><small>The board is designed for a wider view.</small><button class="text-btn" data-dismiss-rotate>Continue in portrait</button></div>` : ""}${rulesDialog()}${contactDetailDialog()}<dialog id="invitation-dialog"><h2>Invite your friend</h2><p>Send this link to open this room. Both players must use the same server.</p><input readonly aria-label="Invitation link"><p>Room code: <b data-invitation-code></b></p><button class="primary" data-copy-invitation>Copy invitation</button><button class="secondary" data-close-invitation>Close</button></dialog>${installDialog()}${leaveDialog()}`;
}

function renderSplash() {
  paint(`<section class="splash"><div class="splash-grid" aria-hidden="true"></div><div class="splash-signal" aria-hidden="true"><span></span><span></span><span></span></div><div class="splash-brand"><img class="splash-icon" src="./icon.svg" alt=""><img class="splash-logo" src="./logo.svg" alt="Spies in Disguise"><p>A game of hidden identities and calculated risks.</p></div><div class="splash-action"><button class="primary" id="enter-game">Enter the circuit</button><span>${soundEnabled ? "Sound on · change anytime" : "Sound off · change anytime"}</span></div></section>`);
  document.querySelector("#enter-game")?.addEventListener("click", async () => {
    await ensureAudio();
    splashVisible = false;
    playSound("start");
    render();
  });
}

function leaveDialog() {
  return `<dialog id="leave-dialog" class="leave-dialog"><span class="leave-icon">⌂</span><h2>Leave this mission?</h2><p>Your current match will end and its progress will be lost.</p><div class="leave-actions"><button class="secondary" data-stay>Keep playing</button><button class="danger-button" data-confirm-home>Leave game</button></div></dialog>`;
}

function rulesDialog() {
  const dossier = Object.entries(CONTACTS).map(([kind, contact]) => `<div class="legend-item contact-${kind}"><div class="legend-symbol">${contact.symbol}</div><div><b>${contact.name}</b><span>${contact.note}</span>${contact.ability ? `<div class="mini-ability">${contact.ability}</div>` : `<div class="mini-moves">${contact.moves.map((movement, index) => `<span class="${contactStageEffect(kind, index, movement).className}"><small>${contact.single ? "Always" : `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"}`}</small>${stageEffectHtml(kind, index, movement)}</span>`).join("")}</div>`}</div></div>`).join("");
  return `<dialog id="rules" class="rules-dialog">
    <div class="dialog-head"><div><span class="eyebrow">Field briefing</span><h2>How to play</h2></div><button class="dialog-close" data-close-rules aria-label="Close rules">×</button></div>
    <p class="rules-intro">Bluff with two contacts, read your rival, and catch them on the loop.</p>
    <section class="visual-briefing" aria-label="Three-screen beginner walkthrough">
      <article><img src="./help-offer.svg" alt="A hand with Courier and Ghost selected, with Courier marked as the revealed card."><div><span>1</span><p><b>Build the bluff</b>Choose two contacts, then decide which one your rival is allowed to see.</p></div></article>
      <article><img src="./help-choose.svg" alt="A revealed Courier beside a concealed question-mark card, ready for the rival to choose."><div><span>2</span><p><b>Make the read</b>The chooser recruits one card. The player who offered recruits the other.</p></div></article>
      <article><img src="./help-chase.svg" alt="Two agents on a twelve-space clockwise ring with two spaces remaining before an interception."><div><span>3</span><p><b>Close the gap</b>Both agents move clockwise. Gain six relative spaces to catch your rival.</p></div></article>
    </section>
    <p class="rules-note"><b>Try a strategic bluff:</b> If your rival already owns one Analyst, revealing an Analyst offers them +6 movement. Concealing a Handler means you could be left with −1. Check both networks before sending: your rival may take the card you wanted.</p><div class="rule-steps">
      <article><span>1</span><div><b>Prepare your offer</b><p>Before offering, you may exchange contacts face down—up to four times per game while the deck has cards. Then play two different contacts: one revealed and one concealed. If every card in your hand matches, you may play a pair.</p></div></article>
      <article><span>2</span><div><b>Your rival chooses</b><p>They recruit one contact and you recruit the other. Both identities are then revealed.</p></div></article>
      <article><span>3</span><div><b>Move together</b><p>Apply each newly recruited contact’s 1st, 2nd, or 3rd effect, then move both agents. Negative movement goes counterclockwise; the 3rd effect also applies to every later copy.</p></div></article>
      <article><span>4</span><div><b>Resolve the end step</b><p>Only after both agents finish moving, check every win and loss condition. If outcomes tie, the player who made the offer wins.</p></div></article>
    </div>
    <div class="win-conditions"><div><span>◆</span><p><b>Catch your rival</b>Reach or pass them on the 12-space loop.</p></div><div><span>◇</span><p><b>Oracle shortcut</b>Recruit three Oracles to win.</p></div><div class="danger"><span>✕</span><p><b>Avoid exposure</b>A third Renegade makes you lose.</p></div></div>
    <p class="rules-note"><b>Deck:</b> The complete 38-card core is included under original Spies in Disguise identities, plus four one-copy volatile contacts: Jammer, Cleaner, Mimic, and Slingshot.</p>
    <p class="rules-note"><b>Empty deck:</b> Keep playing without drawing or exchanging. If the next player cannot offer two cards, whoever is closer to catching the rival wins; the offering player wins an exact tie.</p>
    <h3 class="dossier-title">Contact dossier</h3><div class="legend">${dossier}</div><button class="primary rules-done" data-close-rules>Start playing</button>
  </dialog>`;
}

function installDialog() {
  return `<dialog id="install-dialog"><span class="eyebrow">Take it with you</span><h2>Install Spies in Disguise</h2><p class="lede">Add the game to your home screen for a full-screen app experience and offline Bot or In Person play.</p><div class="install-steps"><b>iPhone or iPad</b><span>Open the Share menu in Safari, then choose “Add to Home Screen.”</span><b>Other browsers</b><span>Open the browser menu and choose “Install app” or “Add to Home screen.”</span></div><button class="secondary" data-close-install>Close</button></dialog>`;
}

function contactDetailDialog() {
  return `<dialog id="contact-detail" class="contact-detail"><div class="dialog-head"><div><span class="eyebrow">Public network</span><h2>Contact details</h2></div><button class="dialog-close" data-close-contact aria-label="Close contact details">×</button></div><div data-contact-content></div><button class="secondary" data-close-contact>Close</button></dialog>`;
}

function openContactDetail(button) {
  const ownerIndex = Number(button.dataset.ownerIndex);
  const kind = button.dataset.contactKind;
  const player = state?.players?.[ownerIndex];
  const contact = CONTACTS[kind];
  if (!player || !contact) return;
  const count = player.collection[kind] || 0;
  const nextIndex = contact.single ? 0 : Math.min(count, contact.moves.length - 1);
  const currentMovement = contactMovement(kind, ownerIndex, nextIndex);
  const stages = contact.ability ? `<span class="detail-move next"><small>Current effect</small>${stageEffectHtml(kind, 0, currentMovement)}<em>${contact.ability}</em></span>` : contact.moves.map((value, index) => `<span class="detail-move ${contactStageEffect(kind, index, value).className} ${index === nextIndex ? "next" : ""}"><small>${contact.single ? "Always" : `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"}`}</small>${stageEffectHtml(kind, index, value)}${index === nextIndex ? "<em>Next recruit</em>" : ""}</span>`).join("");
  const dialog = document.querySelector("#contact-detail");
  dialog.querySelector("[data-contact-content]").innerHTML = `<div class="contact-detail-title contact-${kind}"><span>${contact.symbol}</span><div><small>${escapeHtml(player.name)} owns ${count}</small><h3>${contact.name}</h3></div></div><p>${contact.note}</p><div class="detail-moves">${stages}</div><p class="detail-foot">${contact.ability ? "This one-copy contact resolves from the public game state shown above." : contact.single ? "This unique contact always uses the same effect." : count >= 3 ? "Further copies keep using the 3rd effect." : `The next copy uses the ${nextIndex + 1}${nextIndex === 0 ? "st" : nextIndex === 1 ? "nd" : "rd"} effect.`}</p>`;
  dialog.showModal();
}

function isInstalled() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

function preferLandscape() {
  if (!matchMedia("(pointer: coarse) and (max-width: 899px)").matches) return;
  // Both orientations remain playable; no forced rotation.
}

function scrollBehavior() { return matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"; }
let pendingUiRestore = null;
let renderedScope = "";
let renderedScreen = "";
function paint(html) {
  const scope = state ? `${state.room}:${state.matchId || ""}` : "home";
  const active = document.activeElement;
  const selector = active?.id ? `#${CSS.escape(active.id)}` : active?.dataset.card ? `[data-card="${CSS.escape(active.dataset.cardId)}"]` : active?.dataset.choice ? `[data-choice="${active.dataset.choice}"]` : active?.matches?.("[data-sound]") ? "[data-sound]" : null;
  const dialogs = [...document.querySelectorAll("dialog[open]")].filter(dialog => dialog.id !== "exchange-reveal" && (scope === renderedScope || ["rules", "install-dialog"].includes(dialog.id))).map(dialog => ({ id: dialog.id, scrollTop: dialog.scrollTop, content: dialog.querySelector("[data-contact-content]")?.innerHTML }));
  const screen = state ? `${state.phase}:${state.winner}:${localHandoff}` : `home:${homePanel}`;
  pendingUiRestore = { selector, dialogs, selection: active?.selectionStart, value: active?.matches?.("input:not([readonly])") ? active.value : null, nameOpen: document.querySelector("#codename-edit")?.open, sameScope: scope === renderedScope, screenChanged: screen !== renderedScreen };
  renderedScreen = screen;
  renderedScope = scope;
  app.innerHTML = html;
}
function restoreUi() {
  const snapshot = pendingUiRestore; pendingUiRestore = null;
  const reveal = document.querySelector("#exchange-reveal");
  if (reveal) { reveal.showModal(); reveal.addEventListener("cancel", event => { event.preventDefault(); if (pendingRevealState) finishReveal(); }); }
  for (const saved of snapshot?.dialogs || []) {
    const dialog = document.getElementById(saved.id); if (!dialog) continue;
    if (saved.content) dialog.querySelector("[data-contact-content]").innerHTML = saved.content;
    if (saved.id === "invitation-dialog") { dialog.querySelector("input").value = invitationUrl(); dialog.querySelector("[data-invitation-code]").textContent = state?.room || ""; }
    dialog.showModal(); dialog.scrollTop = saved.scrollTop;
  }
  if (snapshot?.sameScope && snapshot.nameOpen && document.querySelector("#codename-edit")) document.querySelector("#codename-edit").open = true;
  const focused = snapshot?.sameScope && snapshot.selector ? document.querySelector(snapshot.selector) : null;
  const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
  if (focused && !focused.disabled && (!modal || modal.contains(focused))) { if (snapshot.value !== null && focused.matches("input:not([readonly])")) focused.value = snapshot.value; focused.focus({ preventScroll: true }); if (typeof snapshot.selection === "number") focused.setSelectionRange?.(snapshot.selection, snapshot.selection); }
  else if (!modal) { const selectors = state ? ["#ready-player", "#again", "#toggle-ready", "[data-choice]", ".hand button", "#play-area h2"] : ["#local-first", "#start-bot", "#use-lan", "#create", "#resume-offline", ".mode-grid button"]; const next = selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(el => el.getClientRects().length && !el.disabled); if (next) { if (!next.matches("button,input,a")) next.tabIndex = -1; next.focus({ preventScroll: true }); if (state && snapshot?.screenChanged) document.querySelector("#play-area")?.scrollIntoView({ behavior: "instant", block: "start" }); } }
}
function bindCommon() {
  const rules = document.querySelector("#rules");
  const syncNavigation = () => {
    document.querySelectorAll(".nav-button").forEach(button => { button.removeAttribute("aria-current"); button.classList.remove("active"); });
    const active = document.querySelector(rules?.open ? ".nav-button[data-rules]" : state || homeNavigation === "play" ? ".nav-button[data-play]" : ".nav-button[data-home]");
    active?.setAttribute("aria-current", "page"); active?.classList.add("active");
  };
  document.querySelectorAll("[data-rules]").forEach(button => button.addEventListener("click", () => { rules.showModal(); syncNavigation(); }));
  document.querySelectorAll("[data-close-rules]").forEach(button => button.addEventListener("click", () => rules.close()));
  rules?.addEventListener("close", syncNavigation);
  document.querySelector("[data-install]")?.addEventListener("click", installApp);
  document.querySelector("[data-reconnect]")?.addEventListener("click", () => { clearTimeout(reconnectTimer); connect(); });
  document.querySelector("[data-sound]")?.addEventListener("click", toggleSound);
  document.querySelector("[data-close-install]")?.addEventListener("click", () => document.querySelector("#install-dialog").close());
  document.querySelectorAll("[data-home]").forEach(button => button.addEventListener("click", () => { homeNavigation = "home"; requestHome(); syncNavigation(); }));
  document.querySelector("[data-play]")?.addEventListener("click", () => { if (!state) homeNavigation = "play"; document.querySelector(state ? "#play-area" : "#play-modes")?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }); syncNavigation(); });
  document.querySelector("[data-stay]")?.addEventListener("click", () => document.querySelector("#leave-dialog").close());
  document.querySelector("[data-confirm-home]")?.addEventListener("click", returnHome);
  document.querySelector("[data-dismiss-rotate]")?.addEventListener("click", () => { landscapePromptDismissed = true; document.querySelector(".rotate-device")?.remove(); });
  document.querySelectorAll("[data-contact-kind]").forEach(button => button.addEventListener("click", () => openContactDetail(button)));
  document.querySelectorAll("[data-close-contact]").forEach(button => button.addEventListener("click", () => document.querySelector("#contact-detail")?.close()));
  document.querySelector("[data-close-invitation]")?.addEventListener("click", () => document.querySelector("#invitation-dialog").close());
  document.querySelector("[data-copy-invitation]")?.addEventListener("click", copyRoom);
  document.querySelector("#invitation-dialog input")?.addEventListener("click", event => event.target.select());
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),a[href],summary")].filter(el => el.getClientRects().length);
    if (!controls.length) return;
    const index = controls.indexOf(document.activeElement);
    if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus();
    }
  }));
  syncNavigation();
  bindInteractionFeedback();
  restoreUi();
}

function interactionSound(button) {
  if (button.matches("[data-sound]")) return null;
  if (button.matches("#offer")) return "offer";
  if (button.matches("#start-match,#start-bot,[data-mode='local'],[data-host-duel]")) return "start";
  if (button.matches("#ready-player")) return "turn";
  if (button.matches(".card,[data-choice],[data-bot-profile],#toggle-ready")) return "select";
  return "tap";
}

function bindInteractionFeedback(root = document) {
  root.querySelectorAll("button:not([data-feedback-bound])").forEach(button => {
    button.dataset.feedbackBound = "true";
    button.addEventListener("click", () => { const sound = interactionSound(button); if (sound) playSound(sound); });

  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("spies-sound", soundEnabled ? "on" : "off");
  if (soundEnabled) playSound("select");
  render();
}

function requestHome() {
  if (!state) return scrollTo({ top: 0, behavior: scrollBehavior() });
  if (state.winner !== null) return returnHome();
  document.querySelector("#leave-dialog")?.showModal();
}

async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    render();
  } else document.querySelector("#install-dialog")?.showModal();
}

function returnHome() {
  clearTimeout(botTimer); queuedOnlineAction = null; actionPending = false; connectionError = "";
  clearTimeout(revealTimer); clearTimeout(movementTimer); revealTimer = null; movementTimer = null; revealState = null; pendingRevealState = null; revealComplete = null; movementNotice = null;
  if (playMode === "wifi" && state?.room) {
    const token = localStorage.getItem(`spies-token-${networkMode}-${state.room}`);
    if (token) rememberLeave({ room: state.room, token, gateway: gatewayUrl() });
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
  }
  if (localGame) clearOfflineGame();
  playMode = null; localGame = null; state = null; localHandoff = false; pendingRoom = ""; homePanel = null;
  selected = []; faceUpId = null; swapMode = false;
  history.replaceState({}, "", `${location.pathname}?network=${networkMode}`);
  renderHome();
}

function liveDuelBoardHtml() {
  const rows = liveDuels.length
    ? liveDuels.map(duel => `<button class="duel-agent" data-duel-room="${escapeHtml(duel.room)}"><span class="duel-avatar" aria-hidden="true">${escapeHtml(duel.host.slice(0, 1).toUpperCase())}</span><span><b>${escapeHtml(duel.host)}</b><small>${networkMode === "lan" ? "Ready on this Wi-Fi" : "Ready online"}</small></span><em>Challenge <i aria-hidden="true">→</i></em></button>`).join("")
    : `<div class="duel-empty"><span aria-hidden="true">⌁</span><div><b>No open signals yet</b><small>Host the first duel and your codename will appear here.</small></div></div>`;
  return `<section class="live-duels" id="live-duel-board" aria-labelledby="live-duels-title"><div class="live-duels-head"><div><span class="live-label"><i></i>${connected ? "Network live" : "Connecting"}</span><h2 id="live-duels-title">Agents ready to duel</h2></div><button class="host-duel" data-host-duel ${connected ? "" : "disabled"}>Host open duel <span aria-hidden="true">＋</span></button></div><div class="duel-list">${rows}</div><div class="duel-foot"><span>${networkMode === "lan" ? "Local server only" : "Internet connection required"}</span><button class="text-btn" data-private-code>Use a private code →</button></div></section>`;
}

function beginOnlineRoom(isPublic, room = "") {
  if (networkMode === "lan" && !lanInvitationBase()) { homePanel = "lan"; renderHome(); showToast("Choose a reachable local address before opening a room."); return; }
  if (!connected) { queuedOnlineAction = { isPublic, room }; showToast("Connecting… your room will open shortly"); return; }
  const name = (document.querySelector("#name")?.value || localStorage.getItem("spies-name") || "").trim();
  localStorage.setItem("spies-name", name); landscapePromptDismissed = true; playMode = "wifi";
  if (room) { pendingRoom = room; send("join", { room, name, protocol: 3 }); }
  else send("create", { name, protocol: 3, public: isPublic });
}

function bindDuelBoard() {
  document.querySelectorAll("[data-host-duel]").forEach(button => button.addEventListener("click", () => beginOnlineRoom(true)));
  document.querySelectorAll("[data-duel-room]").forEach(button => button.addEventListener("click", () => beginOnlineRoom(false, button.dataset.duelRoom)));
  document.querySelectorAll("[data-private-code]").forEach(button => button.addEventListener("click", () => { homePanel = "wifi"; renderHome(); setTimeout(() => document.querySelector("#wifi-setup")?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" }), 0); }));
}

function renderHome(error = "") {
  state = null;
  const currentName = document.querySelector("#name")?.value ?? (localStorage.getItem("spies-name") || savedName);
  const currentRoom = document.querySelector("#room")?.value ?? pendingRoom;
  paint(shell(`<section class="home"><div class="home-hero"><div class="home-intro"><span class="eyebrow">Secure channel / Live network</span><h1><span class="outline">Hide your agent.</span><br><span class="accent">Read their move.</span></h1><p class="lede">One room. Two rivals. Offer a contact in plain sight, hide another, and turn every bluff into movement.</p><div class="hero-actions"><button class="hero-primary" data-mode="wifi">Play with a friend <span aria-hidden="true">→</span></button><button class="briefing-link" data-rules><span class="briefing-play" aria-hidden="true">?</span><span><b>New agent?</b><small>Learn it in 60 seconds</small></span></button></div></div><div class="hero-card" aria-hidden="true"><span class="hero-card-signal"></span><img src="./icon.svg" alt=""><b>CLASSIFIED</b><small>One face up<br>One face down</small></div></div>${liveDuelBoardHtml()}<div class="mode-heading" id="play-modes"><div><span class="eyebrow">Play your way</span><h2>Choose how to play</h2></div><span>About 10 minutes</span></div><div class="mode-grid"><button class="mode-card recommended" data-mode="bot"><span class="mode-icon" aria-hidden="true">⌁</span><span class="mode-copy"><span class="mode-badge">Best first game</span><b>Play vs Bot</b><small>Solo practice · works offline</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card" data-mode="local"><span class="mode-icon" aria-hidden="true">◇</span><span class="mode-copy"><b>Pass & Play</b><small>Two agents · one shared device</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card wifi-mode-card" data-mode="wifi"><span class="mode-icon" aria-hidden="true">◉</span><span class="mode-copy"><b>Play over Internet</b><small>Two devices · invite a friend</small></span><span class="mode-arrow" aria-hidden="true">›</span></button></div><div class="home-setup ${homePanel === "wifi" ? "show" : ""}" id="wifi-setup"><div class="setup-heading"><div><span class="eyebrow">${networkMode === "lan" ? "Same Wi-Fi" : "Internet"}</span><h2>${pendingRoom ? "Join your friend" : "Connect two devices"}</h2></div><button class="text-btn" id="close-setup">Close</button></div><div class="field"><label for="name">Your codename</label><input id="name" maxlength="18" autocomplete="nickname" placeholder="Guest agent (optional name)" value="${escapeHtml(currentName)}"></div><div class="wifi-actions"><div class="online-create-actions"><button class="primary" id="create-public" ${connected ? "" : "disabled"}>Host open duel</button><button class="secondary" id="create" ${connected ? "" : "disabled"}>Create private room</button></div><div class="wifi-divider"><span>or enter a room code</span></div><div class="join-row"><input id="room" aria-label="Room code" maxlength="6" inputmode="text" placeholder="K7M2QX" value="${escapeHtml(currentRoom)}"><button class="secondary" id="join" ${connected ? "" : "disabled"}>Join</button></div></div><div class="status-pill"><span class="dot ${connected ? "live" : ""}"></span>${connected ? "Duel network ready" : "Connecting to duel network…"}</div></div><section class="how-preview" aria-labelledby="how-title"><div class="section-heading"><div><span class="eyebrow">The mission</span><h2 id="how-title">How to play</h2></div><button class="text-btn" data-rules>View all rules <span aria-hidden="true">→</span></button></div><div class="preview-steps"><article><span>01</span><div><b>Offer two</b><p>Reveal one contact. Keep one secret.</p></div></article><article><span>02</span><div><b>Choose one</b><p>Your rival takes a card; you recruit the other.</p></div></article><article><span>03</span><div><b>Intercept</b><p>Gain six spaces on your rival or recruit 3 Oracles.</p></div></article></div></section><footer class="home-footer"><a href="https://decadenceinc.com">← More Decadence games</a><span>Private play · live rivals</span></footer></section>`));
  const modes = document.querySelector(".mode-grid"), modeHeading = document.querySelector("#play-modes"), duels = document.querySelector(".live-duels");
  if (duels && modes && modeHeading) { duels.before(modeHeading, modes); }
  document.querySelector(".mode-grid")?.insertAdjacentHTML("afterend", `<div class="home-setup ${homePanel === "bot" ? "show" : ""}" id="bot-setup"><div class="setup-heading"><div><span class="eyebrow">Solo circuit</span><h2>Choose your rival</h2></div><button class="text-btn" data-close-setup>Close</button></div><p class="setup-copy">Start with Rook to learn, then move up when you can read the bluff.</p><div class="bot-profiles">${Object.entries(BOT_PROFILES).map(([key, profile]) => `<button class="bot-profile ${botProfile === key ? "selected" : ""}" data-bot-profile="${key}" aria-pressed="${botProfile === key}"><span>${key === "rookie" ? "Ⅰ" : key === "balanced" ? "Ⅱ" : "Ⅲ"}</span><b>${profile.name}<small>${profile.label}</small></b><em>${profile.note}</em></button>`).join("")}</div><button class="primary" id="start-bot">Play ${BOT_PROFILES[botProfile].name}</button></div>`);
  if (error || connectionError) document.querySelector(".home")?.insertAdjacentHTML("afterbegin", `<div class="connection-notice" role="alert">${escapeHtml(error || connectionError)} Choose a mode below to play again.${!connected ? `<button class="secondary" data-reconnect>Reconnect here</button>` : ""}</div>`);
  document.querySelector(".mode-grid")?.insertAdjacentHTML("beforeend", `<button class="mode-card" data-mode="lan"><span class="mode-icon" aria-hidden="true">⌂</span><span class="mode-copy"><b>Same Wi-Fi</b><small>Two devices · local host required</small></span><span class="mode-arrow" aria-hidden="true">›</span></button>`);
  if (homePanel === "lan") document.querySelector("#wifi-setup")?.insertAdjacentHTML("beforebegin", `<section class="home-setup show"><span class="eyebrow">Same Wi-Fi</span><h2>Play on your local network</h2><p>Both devices must open the game from the same computer running its local server. Keep that computer awake and allow access on your Wi-Fi. Room codes work only on that server.</p>${localHost ? `<p>Share a local address with your friend, then create a room.</p>${lanAddresses.length ? lanAddresses.map(url => `<button class="secondary lan-address" data-lan-address="${escapeHtml(url)}" aria-pressed="${selectedLanAddress === url}">${selectedLanAddress === url ? "✓ " : ""}${escapeHtml(url)}</button>`).join("") : `<p>No reachable address was found. Connect the host computer to Wi-Fi, then reload.</p>`}<button class="primary" id="use-lan" ${lanInvitationBase() ? "" : "disabled"}>Create local room</button><button class="secondary" id="join-lan">Join by code</button>` : `<p>Ask your host for the local game address. This website cannot discover computers on your Wi-Fi.</p><button class="primary" id="use-internet">Use Internet instead</button>`}</section>`);
  document.querySelector("#use-lan")?.addEventListener("click", () => { switchNetwork("lan"); beginOnlineRoom(false); });
  document.querySelector("#join-lan")?.addEventListener("click", () => { switchNetwork("lan"); homePanel = "wifi"; renderHome(); });
  document.querySelector("#use-internet")?.addEventListener("click", () => { switchNetwork("internet"); homePanel = "wifi"; renderHome(); });
  if (homePanel === "local") document.querySelector(".mode-grid")?.insertAdjacentHTML("afterend", `<section class="home-setup show" id="local-setup"><h2>Two agents, one device</h2><p>Pass the device after each offer. Private hands stay hidden until the named player is ready.</p><label for="local-first">First agent</label><input id="local-first" maxlength="18" value="${escapeHtml(currentName)}" placeholder="Agent One"><label for="local-second">Second agent</label><input id="local-second" maxlength="18" value="${escapeHtml(localStorage.getItem("spies-partner") || "")}" placeholder="Agent Two"><button class="primary" id="start-local">Start shared mission</button><button class="text-btn" data-close-setup>Close</button></section>`);
  document.querySelector("#start-local")?.addEventListener("click", () => { localStorage.setItem("spies-name", document.querySelector("#local-first").value.trim() || "Agent One"); localStorage.setItem("spies-partner", document.querySelector("#local-second").value.trim() || "Agent Two"); startLocal("local"); });
  if (loadOfflineGame()) document.querySelector("#play-modes")?.insertAdjacentHTML("beforebegin", `<section class="panel"><h2>Your offline mission is saved</h2><button class="primary" id="resume-offline">Resume match</button></section>`);
  document.querySelector("#resume-offline")?.addEventListener("click", resumeOffline);
  bindCommon();
  bindDuelBoard();
  document.querySelectorAll("[data-lan-address]").forEach(button => button.addEventListener("click", () => { selectedLanAddress = button.dataset.lanAddress; localStorage.setItem("spies-lan-address", selectedLanAddress); renderHome(); }));
  const remember = () => { const name = document.querySelector("#name")?.value.trim() || ""; if (name) localStorage.setItem("spies-name", name); return name; };
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.mode === "lan") { homePanel = "lan"; renderHome(); return; }
    if (button.dataset.mode === "wifi") switchNetwork("internet");
    if (button.dataset.mode === "wifi" || button.dataset.mode === "bot") { homePanel = button.dataset.mode; renderHome(); setTimeout(() => document.querySelector(`#${homePanel}-setup`)?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" }), 0); }
    else { homePanel = "local"; renderHome(); }
  }));
  document.querySelectorAll("#close-setup,[data-close-setup]").forEach(button => button.addEventListener("click", () => { homePanel = null; renderHome(); }));
  document.querySelectorAll("[data-bot-profile]").forEach(button => button.addEventListener("click", () => { botProfile = button.dataset.botProfile; localStorage.setItem("spies-bot-profile", botProfile); renderHome(); }));
  document.querySelector("#start-bot")?.addEventListener("click", () => startLocal("bot"));
  document.querySelector("#create-public")?.addEventListener("click", () => { remember(); beginOnlineRoom(true); });
  document.querySelector("#create")?.addEventListener("click", () => { remember(); beginOnlineRoom(false); });
  document.querySelector("#join")?.addEventListener("click", () => { remember(); const room = document.querySelector("#room").value.trim().toUpperCase(); if (room.length !== 6) return showToast("Enter the six-character code"); beginOnlineRoom(false, room); });
}

function switchNetwork(mode) {
  if (networkMode === mode) return;
  queuedOnlineAction = null;
  networkMode = mode; localStorage.setItem("spies-network", mode); connected = false; actionPending = false; pendingRoom = ""; liveDuels = [];
  clearTimeout(reconnectTimer); const previous = socket; socket = null; previous?.close(); connect();
}

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

function startLocal(mode, starter = 0) {
  resetMatchFeedback();
  queuedOnlineAction = null; pendingRoom = "";
  clearTimeout(botTimer);
  landscapePromptDismissed = true;
  preferLandscape();
  selected = []; faceUpId = null; swapMode = false;
  playMode = mode;
  const name = localStorage.getItem("spies-name") || localStorage.getItem("shadow-name") || "Agent One";
  localGame = createLocalGame(mode, name, Math.random, { botName: `${BOT_PROFILES[botProfile].name} Bot`, opponentName: localStorage.getItem("spies-partner") || "Agent Two", starter });
  localGame.botProfile = botProfile;
  motionCue = "deal";
  localHandoff = mode === "local";
  state = localView(localGame, mode === "local" ? starter : 0);
  saveOfflineGame(localGame, state.you);
  history.replaceState({}, "", `${location.pathname}?network=${networkMode}`);
  render();
  if (mode === "bot" && starter === 1) scheduleBotOffer();
}

function resumeOffline() {
  const save = loadOfflineGame(); if (!save) return showToast("That saved match could not be restored. Start a new one.");
  resetMatchFeedback(); clearTimeout(botTimer); queuedOnlineAction = null;
  localGame = save.game; playMode = localGame.mode; selected = []; faceUpId = null; swapMode = false;
  if (localGame.botProfile && BOT_PROFILES[localGame.botProfile]) botProfile = localGame.botProfile;
  state = localView(localGame, save.viewer); movementNotice = state.lastExchange; localHandoff = playMode === "local" && state.winner === null;
  render(); if (playMode === "bot") botTimer = setTimeout(runBotRound, 650);
}

function localAction(type, payload = {}) {
  try {
    if (type === "offer") {
      localOffer(localGame, state.you, payload.openId, payload.hiddenId);
      selected = []; faceUpId = null;
      if (playMode === "local") { applyState(localView(localGame, 1 - state.you)); localHandoff = true; render(); }
      else { applyState(localView(localGame, 0)); render(); botTimer = setTimeout(runBotRound, 650); }
    } else if (type === "choose") {
      const offer = localGame.offer; const chooser = state.you;
      localChoose(localGame, state.you, payload.choice);
      const next = localView(localGame, state.you);
      startReveal({ type: "reveal", choice: payload.choice, chosen: offer[payload.choice], other: offer[payload.choice === "open" ? "hidden" : "open"], chooser });
      queueAfterReveal(next);
    } else if (type === "swap") {
      localSwap(localGame, state.you, payload.cardId);
      applyState(localView(localGame, state.you)); render();
    } else if (type === "rematch") startLocal(playMode, 1 - (localGame.starter || 0));
    if (localGame) saveOfflineGame(localGame, state.you);
  } catch (error) { showToast(error.message); }
}

function runBotRound() {
  if (playMode !== "bot" || !localGame || localGame.winner !== null) return;
  if (localGame.phase === "choose" && localGame.offer.by === 0) {
    const offer = localGame.offer; const choice = chooseBotCard(localGame, botProfile);
    localChoose(localGame, 1, choice);
    saveOfflineGame(localGame, 0);
    const next = localView(localGame, 0);
    startReveal({ type: "reveal", choice, chosen: offer[choice], other: offer[choice === "open" ? "hidden" : "open"], chooser: 1 }, scheduleBotOffer);
    queueAfterReveal(next);
    return;
  }
  scheduleBotOffer();
}

function scheduleBotOffer() {
  if (playMode === "bot" && localGame?.winner === null && localGame.phase === "offer" && localGame.turn === 1) {
    botTimer = setTimeout(() => {
      if (playMode !== "bot" || localGame?.winner !== null || localGame?.phase !== "offer" || localGame?.turn !== 1) return;
      const swap = chooseBotSwap(localGame, localGame.deck.length, botProfile);
      if (swap) localSwap(localGame, 1, swap);
      const offer = chooseBotOffer(localGame, botProfile);
      localOffer(localGame, 1, offer.openId, offer.hiddenId);
      saveOfflineGame(localGame, 0);
      applyState(localView(localGame, 0)); render();
    }, 650);
  }
}

function cardHtml(card, options = {}) {
  if (options.concealed) {
    const tag = options.static ? "div" : "button";
    const interaction = options.static ? "" : 'data-choice="hidden" aria-label="Choose concealed contact"';
    return `<${tag} class="card concealed${options.static ? " static-card" : ""}" ${interaction}><div class="card-back-mark">?</div><div class="card-name">Concealed</div><span class="concealed-hint">${options.static ? "Reveals after choice" : "Tap to recruit"}</span><span class="card-choice">${options.static ? "Hidden" : "Choose"}</span></${tag}>`;
  }
  const c = CONTACTS[card.kind];
  const selectedClass = selected.includes(card.id) ? " selected" : "";
  const isOpen = faceUpId === card.id;
  const playerIndex = options.playerIndex ?? state.you;
  const recruitIndex = nextRecruitIndex(state.players, playerIndex, card.kind);
  const movement = contactMovement(card.kind, playerIndex, recruitIndex);
  const stageEffect = contactStageEffect(card.kind, recruitIndex, movement);
  const { current: currentSpace, destination: destinationSpace } = projectedCardPosition(state.players, playerIndex, movement);
  const copyLabel = c.single ? "Unique" : `${recruitIndex + 1}${recruitIndex === 0 ? "st" : recruitIndex === 1 ? "nd" : "rd"}+ copy`;
  const stakes = card.kind === "oracle" ? "3rd wins" : card.kind === "renegade" ? "3rd loses" : "";
  const movementLabel = `${movement > 0 ? "+" : ""}${movement}`;
  const tag = options.static ? "div" : "button";
  const label = `${c.name}. ${copyLabel}. ${stageEffect.className === "movement" ? `From space ${currentSpace} to space ${destinationSpace}, ${movementLabel} movement.` : `${stageEffect.label} on recruit.`} ${c.note}`;
  const actionLabel = !options.static && !options.attr ? swapMode ? " Tap to exchange this contact." : selected.includes(card.id) ? selected.length === 2 && !isOpen ? " Tap again to reveal this card." : " Tap to remove it from your offer." : " Tap to add it to your offer." : "";
  const interaction = options.static ? `aria-label="${label}"` : `${options.attr || ""} data-card="${card.id}" aria-pressed="${selected.includes(card.id)}" aria-label="${label}${actionLabel}" title="${c.note}"`;
  const moveCurve = c.ability ? `<div class="card-ability"><span>Ability</span><b>${c.ability}</b></div>` : `<div class="card-moves ${c.single ? "single-move" : ""}" aria-label="${c.single ? "Fixed movement" : "Movement on first, second, and third recruit"}">${c.moves.map((n, i) => { const effect = contactStageEffect(card.kind, i, n); return `<span class="move ${effect.className} ${i === recruitIndex ? "next-move" : ""}" ${i === recruitIndex ? 'aria-current="step"' : ""}><small>${c.single ? "Always" : i + 1}</small>${stageEffectHtml(card.kind, i, n)}</span>`; }).join("")}</div>`;
  const selectionLabel = isOpen ? "Revealed" : selected.length === 2 && faceUpId ? "Concealed" : `Chosen ${selected.indexOf(card.id) + 1}/2`;
  return `<${tag} class="card position-card contact-${card.kind}${selectedClass}${isOpen ? " face-up" : ""}${options.static ? " static-card" : ""}" ${interaction}><div class="card-top"><span class="card-symbol">${c.symbol}</span><span class="contact-type">${isOpen ? "Revealed to rival" : copyLabel}</span></div><div class="card-identity"><div class="card-name">${c.name}</div>${stakes ? `<span class="card-stakes">${stakes}</span>` : ""}</div><div class="card-route ${stageEffect.className !== "movement" ? `terminal-${stageEffect.className}` : ""}" aria-hidden="true"><span class="route-space route-from"><small>Now</small><b>${currentSpace}</b></span><span class="route-move ${stageEffect.className !== "movement" ? stageEffect.className : movement < 0 ? "backward" : movement === 0 ? "still" : "forward"}">${stageEffect.className === "movement" ? `<b>${movementLabel}</b><small>${movement < 0 ? "←" : movement === 0 ? "•" : "→"}</small>` : `<b>${stageEffect.icon}</b><small>${stageEffect.shortLabel}</small>`}</span><span class="route-space route-to"><small>${stageEffect.className !== "movement" ? "Outcome" : movement === 0 ? "Stays" : "Lands"}</small><b>${stageEffect.className !== "movement" ? stageEffect.shortLabel.toUpperCase() : destinationSpace}</b></span></div>${moveCurve}${selected.includes(card.id) ? `<span class="selected-mark">${selectionLabel}</span>` : ""}</${tag}>`;
}

function revealCardHtml(card, wasHidden, recipient) {
  const contact = CONTACTS[card.kind];
  const applied = movementNotice?.find(item => item.playerIndex === recipient && item.kind === card.kind);
  const outcome = applied ? [applied.summary, ...(applied.notes || [])].join(" · ") : "Resolving exchange…";
  const front = `<div class="resolution-card contact-${card.kind}"><span>${contact.symbol}</span><div><b>${contact.name}</b><small>${outcome}</small></div></div>`;
  if (!wasHidden) return `<div class="resolution-card-wrap face-known">${front}</div>`;
  return `<div class="resolution-card-wrap was-hidden"><div class="resolution-card-flip"><div class="resolution-card-back"><span>?</span><small>Hidden contact</small></div><div class="resolution-card-front">${front}</div></div></div>`;
}

function revealOverlayHtml() {
  if (!revealState) return "";
  const chooser = revealState.chooser;
  const otherRecipient = 1 - chooser;
  const chooserName = chooser === state.you ? "You" : escapeHtml(state.players[chooser]?.name || "Rival");
  const otherName = otherRecipient === state.you ? "You" : escapeHtml(state.players[otherRecipient]?.name || "Rival");
  return `<dialog id="exchange-reveal" class="reveal-overlay" aria-labelledby="reveal-title"><section class="reveal-sheet"><div class="reveal-heading"><span class="eyebrow">Exchange resolved</span><h2 id="reveal-title">Here’s who took what</h2><p>Both contacts resolve for their new owner.</p></div><div class="reveal-stage"><div class="reveal-lane chosen"><span><b>${chooserName} chose</b><small>First pick</small></span>${revealCardHtml(revealState.chosen, revealState.choice === "hidden", chooser)}</div><div class="reveal-divider" aria-hidden="true"><i></i><b>AND</b><i></i></div><div class="reveal-lane other"><span><b>${otherName === "You" ? "You receive" : `${otherName} receives`}</b><small>Card left behind</small></span>${revealCardHtml(revealState.other, revealState.choice === "open", otherRecipient)}</div></div><button class="primary reveal-continue" id="continue-resolution" autofocus ${pendingRevealState ? "" : "disabled"}>${pendingRevealState ? "Show movement on board" : "Waiting for confirmation…"} <span aria-hidden="true">→</span></button>${!pendingRevealState && playMode === "wifi" ? `<p role="status">Waiting for the server to confirm this exchange. Reconnecting if needed.</p><button class="secondary" data-home>Leave room</button>` : ""}</section></dialog>`;
}

function playerBox(player, index) {
  const movement = `${player.progress > 0 ? "+" : ""}${player.progress}`;
  const meta = state.phase === "lobby" ? `${player.connected ? "Connected" : "Reconnecting"} · ${player.ready ? "Ready" : "Not ready"}` : `${playMode === "wifi" ? player.connected ? "online" : "reconnecting" : "offline play"} · ${movement} movement`;
  return `<div class="player ${index === state.you ? "you" : ""} ${player.ready ? "ready" : ""}"><div class="player-name">${index === 0 ? "A" : "B"} · ${escapeHtml(player.name)}${index === state.you ? " · you" : ""}</div><div class="player-meta">${meta}</div></div>`;
}

function lobbyHtml(activeMotion = null) {
  const me = state.players[state.you];
  const canStart = state.isHost && state.players.length === 2 && state.players.every(player => player.connected && player.ready);
  const slots = [0, 1].map(index => {
    const player = state.players[index];
    return player ? `<article class="lobby-agent ${player.ready ? "ready" : ""}"><span class="lobby-avatar">${index === 0 ? "A" : "B"}</span><div><b>${escapeHtml(player.name)}${index === 0 ? " · Host" : ""}</b><small>${player.connected ? player.ready ? "Ready for briefing" : "Not ready yet" : "Reconnecting…"}</small></div><span class="ready-light"></span></article>` : `<article class="lobby-agent empty"><span class="lobby-avatar">?</span><div><b>Open agent slot</b><small>Share the room code to invite a rival</small></div><span class="ready-light"></span></article>`;
  }).join("");
  const hostAction = state.isHost ? `<button class="primary launch-button" id="start-match" ${canStart ? "" : "disabled"}>${state.players.length < 2 ? "Waiting for rival" : canStart ? "Launch mission" : "Waiting for both agents"}</button>` : `<div class="lobby-wait"><span class="signal-mini"></span>${state.players.length < 2 ? "Waiting for another agent" : "The host will launch when both agents are ready"}</div>`;
  const joined = state.players.length === 2;
  const bothReady = joined && state.players.every(player => player.ready);
  return `<section class="lobby-panel ${activeMotion === "ready" ? "ready-change" : ""}"><div class="lobby-heading"><span class="eyebrow">Secure lobby</span><h2>Get both agents ready</h2><p>Invite your friend, mark yourself ready, then the host starts.</p></div><ol class="lobby-steps" aria-label="Lobby progress"><li class="done"><b>1</b><span>Room created</span></li><li class="${joined ? "done" : "current"}"><b>2</b><span>${joined ? "Rival joined" : "Invite rival"}</span></li><li class="${bothReady ? "done" : joined ? "current" : ""}"><b>3</b><span>${bothReady ? "Both ready" : "Ready up"}</span></li></ol><div class="lobby-code"><span>Room code</span><strong>${state.room}</strong><button class="icon-btn" id="share" aria-label="Share room invitation" title="Copy or share invitation">⧉</button></div><button class="${joined ? "secondary" : "primary"}" id="invite-friend">Invite friend</button><input class="invitation-link" aria-label="Invitation link — select to copy" readonly value="${escapeHtml(invitationUrl())}"><div class="lobby-agents">${slots}</div><details id="codename-edit"><summary>Change your codename</summary><label for="lobby-name">Your codename</label><input id="lobby-name" maxlength="18" value="${escapeHtml(me.name)}"><button class="secondary" id="save-name">Save name</button></details><button class="ready-button ${me.ready ? "is-ready" : ""}" id="toggle-ready" aria-pressed="${me.ready}"><span>${me.ready ? "✓" : "○"}</span><b>${me.ready ? "You are ready" : "Mark me ready"}</b><small>${me.ready ? "Tap to cancel" : "Required before launch"}</small></button>${hostAction}</section>`;
}

function offerStepsHtml() {
  const hasPair = selected.length === 2;
  return `<ol class="decision-steps" aria-label="Offer progress"><li class="${hasPair ? "done" : "current"}"><b>${hasPair ? "✓" : "1"}</b><span>Choose 2</span></li><li class="${faceUpId ? "done" : hasPair ? "current" : ""}"><b>${faceUpId ? "✓" : "2"}</b><span>Pick revealed</span></li><li class="${faceUpId ? "current" : ""}"><b>3</b><span>Send offer</span></li></ol>`;
}

function trackHtml() {
  const position = angle => ({ x: 50 + 42 * Math.cos(angle * Math.PI / 180), y: 50 + 42 * Math.sin(angle * Math.PI / 180) });
  const positions = state.players.map((player, index) => boardPosition(index, player.progress));
  const [a, b] = positions.map(index => position(-90 + index * (360 / BOARD_SPACES)));
  const gap = interceptionGap(state.players);
  const danger = gap <= 2;
  const leader = state.players[0].progress === state.players[1].progress ? "Even chase · either agent needs 6 relative spaces" : `${escapeHtml(state.players[state.players[0].progress > state.players[1].progress ? 0 : 1].name)} has the chase advantage`;
  const nodes = Array.from({ length: BOARD_SPACES }, (_, i) => { const point = position(-90 + i * (360 / BOARD_SPACES)); const home = i === 0 ? " start-a" : i === 6 ? " start-b" : ""; return `<i class="orbit-node route${home}" style="--x:${point.x}%;--y:${point.y}%"><small>${i + 1}</small>${home ? `<em>${i === 0 ? "A" : "B"}</em>` : ""}</i>`; }).join("");
  const moved = player => `${player.progress > 0 ? "+" : ""}${player.progress} moved`;
  const movement = movementNotice ? `<section class="movement-notice" role="status" aria-live="polite"><div class="resolution-title"><span>Last exchange</span><b>Who took what</b></div>${movementNotice.map(({ playerIndex, kind, delta, fromSpace, toSpace }) => { const index = Math.min(2, Math.max(0, Number(state.players[playerIndex].collection[kind] || 1) - 1)); const effect = contactStageEffect(kind, index, delta); const applied = movementNotice.find(item => item.playerIndex === playerIndex); const result = applied.summary ? [applied.summary, ...(applied.notes || [])].join(" · ") : (delta === 0 ? "Stayed in place" : `Moved ${delta > 0 ? "+" : ""}${delta} spaces`); return `<article class="movement-chip contact-${kind}"><i>${effect.className === "movement" ? CONTACTS[kind].symbol : effect.icon}</i><div><b>${escapeHtml(state.players[playerIndex].name)} took ${CONTACTS[kind].name}</b><small>${result}</small></div><em><small>Board</small>${fromSpace} <span>→</span> ${toSpace}</em></article>`; }).join("")}</section>` : "";
  const movedPlayers = new Set(movementNotice?.map(item => item.playerIndex) || []);
  return `<div class="orbit-wrap ${danger ? "danger-zone" : ""}" role="group" aria-label="Twelve-space clockwise pursuit board. ${escapeHtml(state.players[0].name)} at space ${positions[0] + 1}, movement ${state.players[0].progress}. ${escapeHtml(state.players[1].name)} at space ${positions[1] + 1}, movement ${state.players[1].progress}. ${gap} spaces left to interception."><div class="orbit-caption"><b>${danger ? "Danger zone" : "Clockwise chase"}</b><span>${danger ? `${gap} ${gap === 1 ? "space" : "spaces"} from interception` : "Gain 6 spaces on your rival"}</span></div><div class="orbit-board"><div class="orbit-ring"></div>${nodes}<div class="orbit-direction" aria-hidden="true">↻</div><div class="orbit-agent agent-a ${movedPlayers.has(0) ? "just-moved" : ""}" style="--x:${a.x}%;--y:${a.y}%"><span>A</span></div><div class="orbit-agent agent-b ${movedPlayers.has(1) ? "just-moved" : ""}" style="--x:${b.x}%;--y:${b.y}%"><span>B</span></div><div class="orbit-center"><strong>${gap}</strong><span>${"spaces left"}<br>to intercept</span></div></div><p class="chase-advantage">${leader}</p>${movement}<div class="orbit-legend"><span><i class="agent-dot a"></i><b>${escapeHtml(state.players[0].name)}</b><small>Space ${positions[0] + 1} · ${moved(state.players[0])}</small></span><span><i class="agent-dot b"></i><b>${escapeHtml(state.players[1].name)}</b><small>Space ${positions[1] + 1} · ${moved(state.players[1])}</small></span></div></div>`;
}

function collectionHtml(player, playerIndex) {
  const entries = Object.entries(player.collection).filter(([, count]) => count);
  return `<div class="collection"><h3>${escapeHtml(player.name)}'s network <small>Tap to inspect</small></h3><div class="chips">${entries.length ? entries.map(([kind, count]) => { const contact = CONTACTS[kind]; const nextIndex = contact.single ? 0 : Math.min(count, contact.moves.length - 1); const next = contactMovement(kind, playerIndex, nextIndex); const effect = contactStageEffect(kind, nextIndex, next); const summary = contact.ability ? `${contact.name}: ${contact.note}` : `${contact.name}: ${count} owned. Next recruit ${effect.className === "movement" ? effect.label : `means ${effect.label.toLowerCase()}`}.`; return `<button class="chip contact-chip contact-${kind}" data-contact-kind="${kind}" data-owner-index="${playerIndex}" data-summary="${summary}" title="${summary}" aria-label="${summary} View details">${contact.symbol} ${contact.name}<b>×${count}</b></button>`; }).join("") : `<span class="chip empty-chip">No contacts yet</span>`}</div></div>`;
}

function cardOutcomeText(card, playerIndex) {
  if (!card) return "an unknown outcome";
  const contact = CONTACTS[card.kind];
  const index = nextRecruitIndex(state.players, playerIndex, card.kind);
  const movement = contactMovement(card.kind, playerIndex, index);
  const effect = contactStageEffect(card.kind, index, movement);
  if (effect.className !== "movement") return effect.label.toLowerCase();
  return movement === 0 ? "no movement" : `${movement > 0 ? "+" : ""}${movement} ${Math.abs(movement) === 1 ? "space" : "spaces"}`;
}

function resultLesson() {
  const loser = state.players[1 - state.winner];
  if ((loser.collection.renegade || 0) >= 3) return "Next mission: with two Renegades, favor a safe revealed contact or exchange a Renegade before offering.";
  if ((state.players[state.winner].collection.oracle || 0) >= 3) return "Next mission: when a rival has two Oracles, keep the third out of your offer if possible.";
  return "Next mission: compare both networks before offering. Plan for the contact your rival leaves behind, too.";
}
function decisiveExchangeHtml() {
  if (!state.lastExchange?.length) return "";
  return `<section class="decisive-exchange"><h3>The final exchange</h3>${state.lastExchange.map(item => `<p><b>${escapeHtml(state.players[item.playerIndex].name)} · ${CONTACTS[item.kind].name}</b><br>${escapeHtml(item.summary)}${item.notes?.length ? `<br>${escapeHtml(item.notes.join(" · "))}` : ""}</p>`).join("")}</section>`;
}
function resultRecapHtml() {
  const countedRecruits = state.players.every(player => Number.isFinite(player.recruits));
  const totalContacts = state.players.reduce((sum, player) => sum + (countedRecruits ? player.recruits : Object.values(player.collection).reduce((count, value) => count + value, 0)), 0);
  const leader = state.players[state.winner];
  const top = Object.entries(leader.collection).sort((a, b) => b[1] - a[1])[0];
  const gap = interceptionGap(state.players);
  const profile = playMode === "bot" ? `<span><small>Rival level</small><b>${BOT_PROFILES[botProfile].label}</b></span>` : "";
  return `<div class="result-recap" aria-label="Match recap"><span><small>Final chase gap</small><b>${gap} ${gap === 1 ? "space" : "spaces"}</b></span><span><small>${countedRecruits ? "Contacts recruited" : "Contacts retained"}</small><b>${totalContacts}</b></span>${top ? `<span><small>Winning network</small><b>${CONTACTS[top[0]].symbol} ${CONTACTS[top[0]].name} ×${top[1]}</b></span>` : ""}${profile}</div>`;
}

function renderGame() {
  const focused = document.activeElement;
  const focusedCard = focused?.dataset?.card;
  const focusedId = focused?.id;

  const activeMotion = motionCue;
  motionCue = null;
  const active = state.turn === state.you;
  const choosing = state.phase === "choose" && !active;
  const waitingForRival = state.phase === "choose" && active;
  let playArea = "";
  if (playMode === "wifi" && state.phase === "lobby") {
    playArea = lobbyHtml(activeMotion);
  } else if (localHandoff && playMode === "local") {
    playArea = `<div class="panel handoff"><div class="handoff-icon">↻</div><span class="eyebrow">Pass the device</span><h2>${escapeHtml(state.players[state.you].name)}, you’re up.</h2><p class="lede">Make sure the other player has looked away before continuing.</p><button class="primary" id="ready-player">I’m ready</button></div>`;
  } else if (state.winner !== null) {
    const won = state.winner === state.you;
    const celebrate = playMode === "local" || won;
    const winner = state.players[state.winner];
    const resultTitle = playMode === "local" ? `${escapeHtml(state.players[state.winner].name)} wins.` : won ? "You found the signal." : `${escapeHtml(state.players[state.winner].name)} found you.`;
    const resultKey = state.matchId || `${state.room}:${state.winner}:${state.resultReason}`;
    const firstResult = celebratedResult !== resultKey; celebratedResult = resultKey;
    const particles = celebrate && firstResult ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${4 + (i * 37) % 92}%;--delay:${(i * -.12).toFixed(2)}s"></i>`).join("")}</div>` : "";
    const rematchLabel = playMode === "wifi" ? state.youRematch ? `Waiting for rival · ${state.rematchVotes}/2` : "Request rematch" : "Play again";
    playArea = `<div class="panel result ${firstResult ? "result-arrival" : ""} ${celebrate ? "victory" : "defeat"}">${particles}<div class="result-rings" aria-hidden="true"></div><div class="result-badge">${celebrate ? "◆" : "◇"}</div><span class="eyebrow">${celebrate ? "Mission complete" : "Mission compromised"}</span><h2>${resultTitle}</h2><p class="lede">${escapeHtml(state.resultReason)}</p><div class="result-actions"><button class="primary" id="again" ${state.youRematch ? "disabled" : ""}>${rematchLabel}</button><button class="secondary" data-home>Return home</button></div><div class="result-summary"><span><small>Winning agent</small><b>${escapeHtml(winner.name)}</b></span><span><small>Net movement</small><b>${winner.progress > 0 ? "+" : ""}${winner.progress}</b></span></div>${decisiveExchangeHtml()}${!celebrate ? `<p class="result-lesson">${resultLesson()}</p>` : ""}${resultRecapHtml()}</div>`;
  } else if (state.players.length < 2) {
    playArea = `<div class="panel waiting"><div class="signal"></div><h2>Waiting for a rival</h2><p class="lede">Share the room code or invitation link. The match begins as soon as they connect.</p><button class="primary" id="share">Share invitation</button></div>`;
  } else if (choosing) {
    playArea = `<div class="stage"><span class="turn-pill">Your decision</span><h2>Choose the contact you want</h2><p><b>Tap either card to recruit it.</b> Your rival automatically receives the card you leave behind.</p></div><div class="decision-intel"><span aria-hidden="true">◎</span><p><b>Known versus unknown</b>The revealed ${CONTACTS[state.offer.open.kind].name} gives you ${cardOutcomeText(state.offer.open, state.you)}. The concealed card could be better—or a trap. Check both networks for clues.</p></div><div class="choice-labels" aria-hidden="true"><span>Known outcome</span><span>Hidden risk</span></div><div class="offer ${activeMotion === "offer" ? "animate-offer" : ""}">${cardHtml(state.offer.open, { attr: 'data-choice="open"' })}${cardHtml(null, { concealed: true })}</div>`;
  } else if (waitingForRival) {
    playArea = `<div class="stage"><span class="turn-pill waiting-pill">Offer sent</span><h2>Your rival is choosing</h2><p>The concealed contact stays secret until they decide.</p></div><div class="offer ${activeMotion === "offer" ? "animate-offer" : ""}">${cardHtml(state.offer.open, { static: true, playerIndex: 1 - state.you })}${cardHtml(null, { concealed: true, static: true })}</div>`;
  } else if (active) {
    const swaps = state.swapsRemaining ?? 0;
    const canSwap = swaps > 0 && state.deckRemaining > 0 && selected.length === 0;
    const instruction = swapMode ? "Tap the one contact you want to replace. Your rival never sees the discarded card." : selected.length < 2 ? `Tap ${2 - selected.length} ${selected.length === 1 ? "more contact" : "contacts"} to build your offer.` : faceUpId ? "Review both outcomes, then send. You will receive whichever card your rival leaves behind." : "Tap either chosen card again to reveal it to your rival. The other stays concealed.";
    const hint = swapMode ? `Choose 1 card to exchange · ${swaps} remaining` : selected.length < 2 ? `Choose ${2 - selected.length} more` : faceUpId ? `${CONTACTS[state.hand.find(c => c.id === faceUpId).kind].name} revealed · other card concealed` : "Choose the card your rival will see";
    const shown = state.hand.find(card => card.id === faceUpId);
    const hidden = state.hand.find(card => selected.includes(card.id) && card.id !== faceUpId);
    const offerRead = shown && hidden ? `<div class="offer-read"><span aria-hidden="true">◉</span><p><b>Your rival sees ${CONTACTS[shown.kind].name}:</b> ${cardOutcomeText(shown, 1 - state.you)}. ${CONTACTS[hidden.kind].name} stays concealed—send only if you are happy receiving either card.</p></div>` : "";
    const offerButton = selected.length < 2 ? `Choose ${2 - selected.length} more` : !faceUpId ? "Choose revealed card" : "Send offer";
    playArea = `<div class="stage"><span class="turn-pill">${swapMode ? "Optional exchange" : "Your turn"}</span><h2>${swapMode ? "Replace one contact" : "Build your offer"}</h2><p>${instruction}</p></div>${swapMode ? "" : offerStepsHtml()}<div class="hand-label"><span>${swapMode ? "Choose a card to replace" : "Your private hand"}</span><span>${swapMode ? `${swaps} exchanges left` : `${selected.length} of 2 chosen`}</span></div><div class="hand ${swapMode ? "swap-mode" : ""} ${activeMotion === "deal" ? "animate-deal" : ""}">${state.hand.map(card => cardHtml(card)).join("")}</div>${offerRead}<div class="action-bar"><p class="selection-hint" aria-live="polite">${hint}</p><div class="action-buttons"><button class="secondary" id="swap-card" ${swapMode || canSwap ? "" : "disabled"}>${swapMode ? "← Cancel exchange" : `↻ Exchange a card · ${swaps}`}</button><button class="primary" id="offer" ${!swapMode && selected.length === 2 && faceUpId ? "" : "disabled"}>${offerButton} <span aria-hidden="true">→</span></button></div></div>`;
  } else {
    const privateHand = state.hand?.length ? `<section class="waiting-hand" aria-labelledby="waiting-hand-title"><div class="waiting-hand-head"><div><span class="eyebrow">Private intel</span><h3 id="waiting-hand-title">Your hand</h3></div><span>${state.hand.length} contacts</span></div><div class="waiting-hand-grid">${state.hand.map(card => cardHtml(card, { static: true })).join("")}</div></section>` : "";
    playArea = `<div class="panel waiting waiting-with-hand"><div class="waiting-message"><div class="signal"></div><h2>${escapeHtml(state.players[state.turn].name)} is preparing an offer</h2><p class="lede">Review your hand and their network while you wait. Your cards remain private.</p></div>${privateHand}</div>`;
  }

  const modeLabel = playMode === "bot" ? "Solo circuit" : playMode === "local" ? "In-person circuit" : "Private room";
  const roomTitle = playMode === "wifi" ? state.room : playMode === "bot" ? "VS BOT" : "PASS & PLAY";
  const matchStatus = `<section class="panel match-status"><div class="room-head"><div><span class="eyebrow">${modeLabel}</span><div class="room-code">${roomTitle}</div></div>${playMode === "wifi" ? `<button class="icon-btn" id="copy" aria-label="Copy invitation">⧉</button>` : ""}</div><div class="players">${state.players.map(playerBox).join("")}</div>${state.phase !== "lobby" ? `<p class="deck-status">${state.deckRemaining ? `${state.deckRemaining} contacts left in deck` : "Deck empty · no drawing or exchanges"}</p>` : ""}</section>`;
  if (state.phase === "lobby") {
    paint(shell(`${matchStatus}<div class="game-layout lobby-layout" id="play-area"><section>${playArea}</section></div>`) + revealOverlayHtml());
  } else {
    const board = state.players.length === 2 ? trackHtml() : "";
    const networks = state.players.length === 2 ? `<aside class="network-panel ${movementNotice ? "network-updated" : ""}" aria-label="Agent networks"><div class="collections">${state.players.map(collectionHtml).join("")}</div></aside>` : "";
    paint(shell(`<div class="match-layout ${state.winner !== null ? "is-result" : ""}">${matchStatus}<div class="board-panel">${board}</div><section class="play-column motion-${activeMotion || "steady"}" id="play-area"><div class="play-content">${playArea}</div></section>${networks}</div>`) + revealOverlayHtml());
  }
  if (playMode === "wifi" && (!connected || state.players.some(player => !player.connected))) {
    document.querySelector(".app-content")?.insertAdjacentHTML("afterbegin", `<div class="connection-notice" role="status">${connected ? `Your rival disconnected. ${state.phase === "lobby" ? "Rejoin within 30 seconds to keep the seat; otherwise the remaining agent takes over." : "Their seat is saved; ask them to reopen the invitation."}` : "Connection lost. Your seat is saved; retrying with longer pauses…"}<button class="text-btn" data-home>Leave room</button></div>`);
    document.querySelectorAll("#offer,#toggle-ready,#start-match,#again,[data-choice]").forEach(button => { button.disabled = true; });
  }
  bindCommon();
  document.querySelector("#continue-resolution")?.addEventListener("click", finishReveal);
  document.querySelector("#ready-player")?.addEventListener("click", () => { localHandoff = false; render(); });
  document.querySelector("#copy")?.addEventListener("click", copyRoom);
  document.querySelector("#invite-friend")?.addEventListener("click", shareRoom);
  document.querySelector(".invitation-link")?.addEventListener("click", event => event.target.select());
  document.querySelector("#share")?.addEventListener("click", shareRoom);
  document.querySelector("#again")?.addEventListener("click", () => send("rematch"));
  document.querySelector("#save-name")?.addEventListener("click", () => { const name = document.querySelector("#lobby-name").value.trim(); if (!name) return showToast("Enter a codename, or keep your current name."); localStorage.setItem("spies-name", name); send("name", { name }); });
  document.querySelector("#toggle-ready")?.addEventListener("click", () => send("ready", { ready: !state.players[state.you].ready }));
  document.querySelector("#start-match")?.addEventListener("click", () => send("start"));
  document.querySelectorAll(".hand .card").forEach(el => el.addEventListener("click", () => selectCard(el.dataset.card)));
  document.querySelector("#offer")?.addEventListener("click", () => send("offer", { openId: faceUpId, hiddenId: selected.find(id => id !== faceUpId) }));
  document.querySelector("#swap-card")?.addEventListener("click", () => { swapMode = !swapMode; selected = []; faceUpId = null; renderGame(); });
  document.querySelectorAll("[data-choice]").forEach(el => el.addEventListener("click", () => send("choose", { choice: el.dataset.choice })));
  const restored = focusedCard ? [...document.querySelectorAll(".hand .card")].find(card => card.dataset.card === focusedCard) : focusedId ? document.getElementById(focusedId) : null;
  restored?.focus({ preventScroll: true });
}

function selectCard(id) {
  const card = state.hand.find(item => item.id === id);
  if (!card) return;
  if (swapMode) { swapMode = false; playSound("select"); return send("swap", { cardId: id }); }
  if (selected.includes(id)) {
    if (selected.length === 2 && faceUpId !== id) faceUpId = id;
    else { selected = selected.filter(item => item !== id); if (faceUpId === id) faceUpId = null; }
  } else {
    const keep = selected.length === 2 ? faceUpId || selected[0] : selected[0];
    const other = state.hand.find(item => item.id === keep);
    if (other?.kind === card.kind && state.hand.some(item => item.kind !== card.kind)) return showToast("Choose two different contacts");
    selected = selected.length === 2 ? [keep, id] : [...selected, id];
    if (selected.length === 1) faceUpId = null;
  }
  renderGame();
}

function lanInvitationBase() {
  if (!/^(localhost$|127\.)/.test(location.hostname) && localHost) return location.origin;
  return lanAddresses.includes(selectedLanAddress) ? selectedLanAddress : lanAddresses.length === 1 ? lanAddresses[0] : "";
}
function invitationUrl() {
  const base = networkMode === "lan" ? lanInvitationBase() : localHost ? (window.SPIES_IN_DISGUISE_PUBLIC_URL || "") : location.href;
  if (!base || !state?.room) return "";
  const url = new URL(base);
  if (networkMode === "lan") url.pathname = location.pathname;
  url.search = new URLSearchParams({ room: state.room, network: networkMode }); url.hash = "";
  return url.href;
}
function showInvitation() {
  const dialog = document.querySelector("#invitation-dialog");
  dialog.querySelector("input").value = invitationUrl();
  dialog.querySelector("[data-invitation-code]").textContent = state?.room || "";
  if (!dialog.open) dialog.showModal();
}
async function copyRoom() {
  const url = invitationUrl();
  if (!url) return showToast("Choose a reachable host address first.");
  try { await navigator.clipboard.writeText(url); showToast("Invitation copied"); }
  catch { showInvitation(); }
}
async function shareRoom() {
  const url = invitationUrl();
  if (!url) return showToast("Choose a reachable host address first.");
  if (!navigator.share) return showInvitation();
  try { await navigator.share({ title: "Join my Spies in Disguise game", text: `Room ${state.room}`, url }); }
  catch (error) { if (error.name !== "AbortError") showInvitation(); }
}

function render() { splashVisible ? renderSplash() : state ? renderGame() : renderHome(); }
function nextActionText() {
  if (!state) return "Choose a game mode or join a live duel.";
  if (localHandoff && playMode === "local") return "Pass the device, then confirm the named player is ready.";
  if (state.winner !== null) return "Request a rematch or return home.";
  if (state.phase === "lobby") return state.players.length < 2 ? "Share the room code with a rival." : state.players[state.you].ready ? state.isHost && state.players.every(player => player.ready) ? "Launch the mission." : "Wait for the other agent to become ready." : "Mark yourself ready.";
  if (state.players.length < 2) return "Share the invitation with a rival.";
  if (state.phase === "choose") return state.turn === state.you ? "Wait while your rival chooses a contact." : "Choose the revealed or concealed contact to recruit.";
  if (state.turn !== state.you) return `Wait while ${state.players[state.turn].name} builds an offer.`;
  if (swapMode) return "Choose one contact to exchange, or cancel exchange.";
  if (selected.length < 2) return `Choose ${2 - selected.length} more contact${selected.length ? "" : "s"}.`;
  if (!faceUpId) return "Choose which selected contact your rival will see.";
  return "Review the offer, then send it.";
}
window.render_game_to_text = () => JSON.stringify(splashVisible ? { screen: "splash", soundEnabled, connected, nextAction: "Enter the circuit." } : state ? { screen: revealState ? "reveal" : state.phase === "lobby" ? "lobby" : state.winner !== null ? "result" : "game", mode: playMode, botProfile: playMode === "bot" ? botProfile : null, you: state.you, turn: state.turn, phase: state.phase, winner: state.winner, nextAction: nextActionText(), interceptionGap: state.players.length === 2 ? interceptionGap(state.players) : null, selected, revealed: faceUpId, exchangeMode: swapMode, exchangesRemaining: state.swapsRemaining, deckRemaining: state.deckRemaining, resolving: revealState ? { choice: revealState.choice, chosen: revealState.chosen.kind, other: revealState.other.kind, chooser: revealState.chooser } : null, movementNotice, hand: state.hand?.map(card => ({ id: card.id, kind: card.kind })), offer: state.offer ? { open: state.offer.open?.kind, concealed: true } : null, players: state.players.map(player => ({ name: player.name, progress: player.progress, lastMovement: player.lastMovement, collection: player.collection, connected: player.connected, ready: player.ready })) } : { screen: "home", panel: homePanel, selectedBotProfile: botProfile, connected, soundEnabled, nextAction: "Choose a game mode or join a live duel." });
window.advanceTime = () => {};
addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; render(); });
addEventListener("appinstalled", () => { installPrompt = null; render(); showToast("Spies in Disguise installed"); });
if (localHost) fetch("/api/lan-addresses").then(response => response.json()).then(data => { lanAddresses = (data.addresses || []).filter(url => { try { return new URL(url).protocol === "http:"; } catch { return false; } }); if (homePanel === "lan" || state?.phase === "lobby") render(); }).catch(() => {});
connect();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
