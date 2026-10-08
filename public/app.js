import { chooseBotCard, chooseBotOffer, createLocalGame, localChoose, localOffer, localView } from "./local-game.js";
import { nextRecruitIndex } from "./ui-logic.js";

const CONTACTS = {
  courier: { name: "Courier", symbol: "◈", moves: [1, 2, 3], note: "Reliable progress with every recruit." },
  analyst: { name: "Analyst", symbol: "⌁", moves: [-1, 2, 5], note: "Starts slowly, then makes a breakthrough." },
  ghost: { name: "Ghost", symbol: "◌", moves: [2, -1, 4], note: "Fast, elusive, and hard to predict." },
  handler: { name: "Handler", symbol: "⌘", moves: [1, 3, 1], note: "Most effective on the second recruit." },
  oracle: { name: "Oracle", symbol: "◇", moves: [0, 1, 2], note: "Recruit three to win immediately." },
  renegade: { name: "Renegade", symbol: "✕", moves: [3, 4, -3], note: "Powerful bait—three makes you lose." }
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const params = new URLSearchParams(location.search);
const savedName = localStorage.getItem("spies-name") || localStorage.getItem("shadow-name") || "";
let socket;
let state = null;
let connected = false;
let selected = [];
let faceUpId = null;
let pendingRoom = params.get("room")?.toUpperCase() || "";
let playMode = pendingRoom ? "wifi" : null;
let localGame = null;
let localHandoff = false;
let installPrompt = null;
let homePanel = pendingRoom ? "wifi" : null;
let botTimer = null;
let splashVisible = true;
let soundEnabled = localStorage.getItem("spies-sound") !== "off";
let audioContext = null;
let revealState = null;
let pendingRevealState = null;
let revealTimer = null;
let revealComplete = null;
const REVEAL_DURATION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 350 : 1450;

const SOUND_PATTERNS = {
  start: [[220, .08, 0], [330, .1, .08], [494, .16, .17]],
  tap: [[420, .055, 0]],
  select: [[330, .05, 0], [520, .07, .045]],
  offer: [[620, .07, 0], [440, .09, .07]],
  reveal: [[260, .06, 0], [520, .12, .08], [780, .11, .2]],
  turn: [[392, .06, 0], [587, .1, .07]],
  move: [[294, .07, 0], [440, .08, .06], [659, .11, .13]],
  win: [[392, .1, 0], [494, .1, .09], [587, .1, .18], [784, .24, .27]],
  lose: [[392, .1, 0], [330, .12, .09], [247, .24, .2]]
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

function applyState(next) {
  const previous = state;
  state = next;
  if (!previous || splashVisible) return;
  const priorProgress = previous.players?.reduce((sum, player) => sum + player.progress, 0) || 0;
  const nextProgress = next.players?.reduce((sum, player) => sum + player.progress, 0) || 0;
  if (previous.winner === null && next.winner !== null) playSound(playMode === "local" || next.winner === next.you ? "win" : "lose");
  else if (priorProgress !== nextProgress) playSound("move");
  else if (previous.phase !== next.phase && next.phase === "offer") playSound("turn");
}

function startReveal(payload, onComplete = null) {
  clearTimeout(revealTimer);
  revealState = payload;
  pendingRevealState = null;
  revealComplete = onComplete;
  playSound("reveal");
  renderGame();
  revealTimer = setTimeout(finishReveal, REVEAL_DURATION);
}

function queueAfterReveal(next) {
  pendingRevealState = next;
}

function finishReveal() {
  clearTimeout(revealTimer);
  revealTimer = null;
  revealState = null;
  if (pendingRevealState) { const next = pendingRevealState; pendingRevealState = null; applyState(next); }
  render();
  const complete = revealComplete; revealComplete = null; complete?.();
}

function gatewayUrl() {
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
  socket.send(JSON.stringify({ type, ...payload }));
}

function connect() {
  socket = new WebSocket(gatewayUrl());
  socket.addEventListener("open", () => { connected = true; render(); resume(); });
  socket.addEventListener("close", () => { connected = false; render(); setTimeout(connect, 1800); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "reveal") startReveal(message);
    else if (message.type === "state") {
      playMode = "wifi";
      if (revealState) queueAfterReveal(message.state); else applyState(message.state);
      selected = [];
      faceUpId = null;
      localStorage.setItem(`spies-token-${state.room}`, message.token);
      history.replaceState({}, "", `${location.pathname}?room=${state.room}`);
      render();
    } else if (message.type === "error") showToast(message.message);
    else if (message.type === "room_closed") { clearTimeout(revealTimer); revealState = null; pendingRevealState = null; revealComplete = null; state = null; renderHome("That room expired."); }
  });
}

function resume() {
  if (!pendingRoom || playMode !== "wifi") return;
  const token = localStorage.getItem(`spies-token-${pendingRoom}`) || localStorage.getItem(`shadow-token-${pendingRoom}`);
  if (token) send("join", { room: pendingRoom, token, name: savedName || "Agent", protocol: 2 });
}

function shell(content) {
  const inGame = Boolean(state);
  return `<div class="app-shell"><header class="topbar"><button class="brand brand-button" data-home aria-label="Return to home"><img class="brand-logo" src="./logo.svg" alt="Spies in Disguise"></button><div class="header-actions">${!state && !isInstalled() ? `<button class="install-button" data-install aria-label="Install Spies in Disguise"><span aria-hidden="true">⇩</span><b>Install</b></button>` : ""}<button class="sound-button" data-sound aria-label="${soundEnabled ? "Mute sounds" : "Turn sounds on"}" aria-pressed="${soundEnabled}"><span aria-hidden="true">${soundEnabled ? "♪" : "×"}</span></button></div></header><div class="app-content">${content}</div><nav class="app-nav" aria-label="Primary navigation"><button class="nav-button ${inGame ? "" : "active"}" data-home ${inGame ? "" : 'aria-current="page"'}><span aria-hidden="true">⌂</span><b>Home</b></button><button class="nav-button ${inGame ? "active" : ""}" data-play ${inGame ? 'aria-current="page"' : ""}><span aria-hidden="true">◉</span><b>Play</b></button><button class="nav-button" data-rules><span aria-hidden="true">?</span><b>Rules</b></button></nav></div>${rulesDialog()}${installDialog()}${leaveDialog()}`;
}

function renderSplash() {
  app.innerHTML = `<section class="splash"><div class="splash-grid" aria-hidden="true"></div><div class="splash-signal" aria-hidden="true"><span></span><span></span><span></span></div><div class="splash-brand"><img class="splash-icon" src="./icon.svg" alt=""><img class="splash-logo" src="./logo.svg" alt="Spies in Disguise"><p>A game of hidden identities and calculated risks.</p></div><div class="splash-action"><button class="primary" id="enter-game">Enter the circuit</button><span>${soundEnabled ? "Sound on · change anytime" : "Sound off · change anytime"}</span></div></section>`;
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
  return `<dialog id="rules" class="rules-dialog"><div class="dialog-head"><div><span class="eyebrow">Field briefing</span><h2>How to play</h2></div><button class="dialog-close" data-close-rules aria-label="Close rules">×</button></div><p class="rules-intro">Bluff with two contacts, read your rival, and close the pursuit gap.</p><div class="rule-steps"><article><span>1</span><div><b>Send two signals</b><p>Choose two different contacts. Show one face-up and keep the other concealed.</p></div></article><article><span>2</span><div><b>Your rival chooses</b><p>They recruit the contact they take. You recruit the one they leave behind.</p></div></article><article><span>3</span><div><b>Move around the ring</b><p>Each recruitment moves differently. The gold “Next” step shows exactly which move will apply.</p></div></article></div><div class="win-conditions"><div><span>◆</span><p><b>Intercept your rival</b>Close the combined 12-space gap on the circular board.</p></div><div><span>◇</span><p><b>Oracle shortcut</b>Recruit three Oracles to win immediately.</p></div><div class="danger"><span>✕</span><p><b>Avoid exposure</b>A third Renegade makes you lose immediately.</p></div></div><h3 class="dossier-title">Contact dossier</h3><div class="legend">${Object.entries(CONTACTS).map(([kind, c]) => `<div class="legend-item contact-${kind}"><div class="legend-symbol">${c.symbol}</div><div><b>${c.name}</b><span>${c.note}</span><div class="mini-moves">${c.moves.map((n, i) => `<span><small>${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : "rd"}</small>${n > 0 ? "+" : ""}${n}</span>`).join("")}</div></div></div>`).join("")}</div><button class="primary rules-done" data-close-rules>Start playing</button></dialog>`;
}

function installDialog() {
  return `<dialog id="install-dialog"><span class="eyebrow">Take it with you</span><h2>Install Spies in Disguise</h2><p class="lede">Add the game to your home screen for a full-screen app experience and offline Bot or In Person play.</p><div class="install-steps"><b>iPhone or iPad</b><span>Open the Share menu in Safari, then choose “Add to Home Screen.”</span><b>Other browsers</b><span>Open the browser menu and choose “Install app” or “Add to Home screen.”</span></div><button class="secondary" data-close-install>Close</button></dialog>`;
}

function isInstalled() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

function bindCommon() {
  const rules = document.querySelector("#rules");
  const syncNavigation = () => {
    document.querySelectorAll(".nav-button").forEach(button => button.removeAttribute("aria-current"));
    document.querySelector(rules?.open ? ".nav-button[data-rules]" : state ? ".nav-button[data-play]" : ".nav-button[data-home]")?.setAttribute("aria-current", "page");
  };
  document.querySelectorAll("[data-rules]").forEach(button => button.addEventListener("click", () => { playSound("tap"); rules.showModal(); syncNavigation(); }));
  document.querySelectorAll("[data-close-rules]").forEach(button => button.addEventListener("click", () => rules.close()));
  rules?.addEventListener("close", syncNavigation);
  document.querySelector("[data-install]")?.addEventListener("click", installApp);
  document.querySelector("[data-sound]")?.addEventListener("click", toggleSound);
  document.querySelector("[data-close-install]")?.addEventListener("click", () => document.querySelector("#install-dialog").close());
  document.querySelectorAll("[data-home]").forEach(button => button.addEventListener("click", requestHome));
  document.querySelector("[data-play]")?.addEventListener("click", () => { playSound("tap"); document.querySelector(state ? "#play-area" : "#play-modes")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelector("[data-stay]")?.addEventListener("click", () => document.querySelector("#leave-dialog").close());
  document.querySelector("[data-confirm-home]")?.addEventListener("click", returnHome);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("spies-sound", soundEnabled ? "on" : "off");
  if (soundEnabled) playSound("select");
  render();
}

function requestHome() {
  if (!state) return scrollTo({ top: 0, behavior: "smooth" });
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
  clearTimeout(botTimer);
  clearTimeout(revealTimer); revealTimer = null; revealState = null; pendingRevealState = null; revealComplete = null;
  if (playMode === "wifi" && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
  playMode = null; localGame = null; state = null; localHandoff = false; pendingRoom = ""; homePanel = null;
  selected = []; faceUpId = null;
  history.replaceState({}, "", location.pathname);
  renderHome();
}

function renderHome(error = "") {
  state = null;
  app.innerHTML = shell(`<section class="home"><div class="home-intro"><span class="eyebrow">A two-player game of bluffing</span><h1>Hide your agent.<br><span class="accent">Read their move.</span></h1><p class="lede">Offer two contacts—one revealed, one concealed. Your rival chooses first, but every choice moves both of you.</p><button class="briefing-link" data-rules><span class="briefing-play" aria-hidden="true">?</span><span><b>New agent?</b><small>Learn the game in 60 seconds</small></span><span aria-hidden="true">›</span></button></div><div class="mode-heading" id="play-modes"><div><span class="eyebrow">Choose a mode</span><h2>Start a mission</h2></div><span>About 10 minutes</span></div><div class="mode-grid"><button class="mode-card recommended" data-mode="bot"><span class="mode-icon" aria-hidden="true">⌁</span><span class="mode-copy"><span class="mode-badge">Best first game</span><b>Play vs Bot</b><small>Solo practice · works offline</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card" data-mode="local"><span class="mode-icon" aria-hidden="true">◇</span><span class="mode-copy"><b>Pass & Play</b><small>2 players · one device</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card wifi-mode-card" data-mode="wifi"><span class="mode-icon" aria-hidden="true">◉</span><span class="mode-copy"><b>Private Room</b><small>2 players · two devices</small></span><span class="mode-arrow" aria-hidden="true">›</span></button></div><div class="home-setup ${homePanel === "wifi" ? "show" : ""}" id="wifi-setup"><div class="setup-heading"><div><span class="eyebrow">Private room</span><h2>Create or join</h2></div><button class="text-btn" id="close-setup">Close</button></div><div class="field"><label for="name">Your codename</label><input id="name" maxlength="18" autocomplete="nickname" placeholder="Nightjar" value="${escapeHtml(savedName)}"></div><div class="wifi-actions"><button class="primary" id="create" ${connected ? "" : "disabled"}>Create a room</button><div class="wifi-divider"><span>or enter a room code</span></div><div class="join-row"><input id="room" aria-label="Room code" maxlength="6" inputmode="text" placeholder="K7M2QX" value="${escapeHtml(pendingRoom)}"><button class="secondary" id="join" ${connected ? "" : "disabled"}>Join</button></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}<div class="status-pill"><span class="dot ${connected ? "live" : ""}"></span>${connected ? "Room service ready" : "Connecting to room service…"}</div></div><section class="how-preview" aria-labelledby="how-title"><div class="section-heading"><div><span class="eyebrow">The mission</span><h2 id="how-title">How to play</h2></div><button class="text-btn" data-rules>View all rules <span aria-hidden="true">→</span></button></div><div class="preview-steps"><article><span>01</span><div><b>Offer two</b><p>Reveal one contact. Keep one secret.</p></div></article><article><span>02</span><div><b>Choose one</b><p>Your rival takes a card; you recruit the other.</p></div></article><article><span>03</span><div><b>Intercept</b><p>Close the 12-space gap or recruit 3 Oracles.</p></div></article></div></section><footer class="home-footer"><span>Original game by Decadence</span><span>Made for quick, private play</span></footer></section>`);
  bindCommon();
  const remember = () => { const name = document.querySelector("#name")?.value.trim(); if (name) localStorage.setItem("spies-name", name); return name; };
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    playSound("tap");
    if (button.dataset.mode === "wifi") { homePanel = "wifi"; renderHome(); setTimeout(() => document.querySelector("#wifi-setup")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0); }
    else startLocal(button.dataset.mode);
  }));
  document.querySelector("#close-setup")?.addEventListener("click", () => { homePanel = null; renderHome(); });
  document.querySelector("#create")?.addEventListener("click", () => { const name = remember(); if (!name) return showToast("Choose a codename first"); playMode = "wifi"; send("create", { name, protocol: 2 }); });
  document.querySelector("#join")?.addEventListener("click", () => { const name = remember(); const room = document.querySelector("#room").value.trim().toUpperCase(); if (!name) return showToast("Choose a codename first"); if (room.length !== 6) return showToast("Enter the six-character code"); pendingRoom = room; playMode = "wifi"; send("join", { room, name, protocol: 2 }); });
}

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

function startLocal(mode) {
  clearTimeout(botTimer);
  selected = []; faceUpId = null;
  playMode = mode;
  const name = localStorage.getItem("spies-name") || localStorage.getItem("shadow-name") || "Player One";
  localGame = createLocalGame(mode, name);
  localHandoff = mode === "local";
  state = localView(localGame, 0);
  history.replaceState({}, "", location.pathname);
  render();
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
    } else if (type === "rematch") startLocal(playMode);
  } catch (error) { showToast(error.message); }
}

function runBotRound() {
  if (playMode !== "bot" || !localGame || localGame.winner !== null) return;
  if (localGame.phase === "choose" && localGame.offer.by === 0) {
    const offer = localGame.offer; const choice = chooseBotCard(localGame);
    localChoose(localGame, 1, choice);
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
      const offer = chooseBotOffer(localGame);
      localOffer(localGame, 1, offer.openId, offer.hiddenId);
      applyState(localView(localGame, 0)); render();
    }, 650);
  }
}

function cardHtml(card, options = {}) {
  if (options.concealed) {
    const tag = options.static ? "div" : "button";
    const interaction = options.static ? "" : 'data-choice="hidden" aria-label="Choose concealed contact"';
    return `<${tag} class="card concealed${options.static ? " static-card" : ""}" ${interaction}><div class="card-back-mark">?</div><div class="card-name">Unknown contact</div><div class="card-effect">${options.static ? "Identity hidden until the decision is made." : "Choose to reveal and recruit this agent."}</div><span class="card-choice">${options.static ? "Concealed" : "Choose concealed"}</span></${tag}>`;
  }
  const c = CONTACTS[card.kind];
  const selectedClass = selected.includes(card.id) ? " selected" : "";
  const isOpen = faceUpId === card.id;
  const playerIndex = options.playerIndex ?? state.you;
  const recruitIndex = nextRecruitIndex(state.players, playerIndex, card.kind);
  const tag = options.static ? "div" : "button";
  const interaction = options.static ? "" : `${options.attr || ""} data-card="${card.id}" aria-pressed="${selected.includes(card.id)}"`;
  return `<${tag} class="card contact-${card.kind}${selectedClass}${isOpen ? " face-up" : ""}${options.static ? " static-card" : ""}" ${interaction}><div class="card-top"><span class="card-symbol">${c.symbol}</span>${isOpen ? `<span class="open-badge">Revealed</span>` : `<span class="contact-type">Contact</span>`}</div><div class="card-name">${c.name}</div><div class="card-effect">${c.note}</div><div class="card-moves" aria-label="Movement on first, second, and third recruit">${c.moves.map((n, i) => `<span class="move ${i === recruitIndex ? "next-move" : ""}" ${i === recruitIndex ? 'aria-current="step"' : ""}><small>${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : "rd"}</small><b>${n > 0 ? "+" : ""}${n}</b>${i === recruitIndex ? "<em>Next</em>" : ""}</span>`).join("")}</div>${selected.includes(card.id) ? `<span class="selected-mark">${isOpen ? "Shown" : "Selected"}</span>` : ""}</${tag}>`;
}

function revealCardHtml(card, wasHidden, recipient) {
  const front = cardHtml(card, { static: true, playerIndex: recipient });
  if (!wasHidden) return `<div class="transfer-card face-known">${front}</div>`;
  return `<div class="flip-card"><div class="flip-card-inner"><div class="flip-card-face flip-card-back"><span>?</span><small>Concealed signal</small></div><div class="flip-card-face flip-card-front">${front}</div></div></div>`;
}

function revealOverlayHtml() {
  if (!revealState) return "";
  const chooser = revealState.chooser;
  const otherRecipient = 1 - chooser;
  const chooserLabel = chooser === state.you ? "You recruited" : `${escapeHtml(state.players[chooser]?.name || "Rival")} recruited`;
  const otherLabel = otherRecipient === state.you ? "You recruited" : `${escapeHtml(state.players[otherRecipient]?.name || "Rival")} recruited`;
  return `<div class="reveal-overlay" role="status" aria-live="assertive"><div class="reveal-heading"><span class="eyebrow">Signals resolved</span><h2>${revealState.choice === "hidden" ? "Identity revealed" : "Choice confirmed"}</h2></div><div class="reveal-stage"><div class="reveal-lane chosen"><span>${chooserLabel}</span>${revealCardHtml(revealState.chosen, revealState.choice === "hidden", chooser)}</div><div class="reveal-divider"><i></i><b>Recruit</b><i></i></div><div class="reveal-lane other"><span>${otherLabel}</span>${revealCardHtml(revealState.other, revealState.choice === "open", otherRecipient)}</div></div></div>`;
}

function playerBox(player, index) {
  const meta = state.phase === "lobby" ? `${player.connected ? "Connected" : "Reconnecting"} · ${player.ready ? "Ready" : "Not ready"}` : `${player.connected ? "online" : "reconnecting"} · ${player.progress} spaces`;
  return `<div class="player ${index === state.you ? "you" : ""} ${player.ready ? "ready" : ""}"><div class="player-name">${escapeHtml(player.name)}${index === state.you ? " · you" : ""}</div><div class="player-meta">${meta}</div></div>`;
}

function lobbyHtml() {
  const me = state.players[state.you];
  const canStart = state.isHost && state.players.length === 2 && state.players.every(player => player.connected && player.ready);
  const slots = [0, 1].map(index => {
    const player = state.players[index];
    return player ? `<article class="lobby-agent ${player.ready ? "ready" : ""}"><span class="lobby-avatar">${index === 0 ? "A" : "B"}</span><div><b>${escapeHtml(player.name)}${index === 0 ? " · Host" : ""}</b><small>${player.connected ? player.ready ? "Ready for briefing" : "Choosing loadout" : "Reconnecting…"}</small></div><span class="ready-light"></span></article>` : `<article class="lobby-agent empty"><span class="lobby-avatar">?</span><div><b>Open agent slot</b><small>Share the room code to invite a rival</small></div><span class="ready-light"></span></article>`;
  }).join("");
  const hostAction = state.isHost ? `<button class="primary launch-button" id="start-match" ${canStart ? "" : "disabled"}>${state.players.length < 2 ? "Waiting for rival" : canStart ? "Launch mission" : "Waiting for both agents"}</button>` : `<div class="lobby-wait"><span class="signal-mini"></span>${state.players.length < 2 ? "Waiting for another agent" : "The host will launch when both agents are ready"}</div>`;
  return `<section class="lobby-panel"><div class="lobby-heading"><span class="eyebrow">Secure lobby</span><h2>Assemble your team</h2><p>Both agents must be connected and ready before the host can launch.</p></div><div class="lobby-code"><span>Room code</span><strong>${state.room}</strong><button class="icon-btn" id="share" aria-label="Share room invitation">⧉</button></div><div class="lobby-agents">${slots}</div><button class="ready-button ${me.ready ? "is-ready" : ""}" id="toggle-ready"><span>${me.ready ? "✓" : "○"}</span>${me.ready ? "Ready—tap to cancel" : "Mark me ready"}</button>${hostAction}</section>`;
}

function trackHtml() {
  const position = angle => ({ x: 50 + 42 * Math.cos(angle * Math.PI / 180), y: 50 + 42 * Math.sin(angle * Math.PI / 180) });
  const a = position(180 + Math.min(12, state.players[0].progress) * 15);
  const b = position(360 - Math.min(12, state.players[1].progress) * 15);
  const gap = Math.max(0, 12 - state.players[0].progress - state.players[1].progress);
  const nodes = Array.from({ length: 24 }, (_, i) => { const point = position(i * 15); return `<i class="orbit-node ${i === 0 || i >= 12 ? "route" : ""}" style="--x:${point.x}%;--y:${point.y}%"></i>`; }).join("");
  return `<div class="orbit-wrap" role="img" aria-label="Circular pursuit board. ${gap} spaces remain before interception."><div class="orbit-board"><div class="orbit-ring"></div>${nodes}<div class="intercept-point" aria-hidden="true">◆</div><div class="orbit-agent agent-a" style="--x:${a.x}%;--y:${a.y}%"><span>A</span></div><div class="orbit-agent agent-b" style="--x:${b.x}%;--y:${b.y}%"><span>B</span></div><div class="orbit-center"><strong>${gap}</strong><span>spaces to<br>intercept</span></div></div><div class="orbit-legend"><span><i class="agent-dot a"></i><b>${escapeHtml(state.players[0].name)}</b><small>${state.players[0].progress} moved</small></span><span><i class="agent-dot b"></i><b>${escapeHtml(state.players[1].name)}</b><small>${state.players[1].progress} moved</small></span></div></div>`;
}

function collectionHtml(player) {
  const entries = Object.entries(player.collection).filter(([, count]) => count);
  return `<div class="collection"><h3>${escapeHtml(player.name)}'s network</h3><div class="chips">${entries.length ? entries.map(([kind, count]) => `<span class="chip">${CONTACTS[kind].symbol} ${CONTACTS[kind].name} ×${count}</span>`).join("") : `<span class="chip">No contacts yet</span>`}</div></div>`;
}

function renderGame() {
  const active = state.turn === state.you;
  const choosing = state.phase === "choose" && !active;
  const waitingForRival = state.phase === "choose" && active;
  let playArea = "";
  if (playMode === "wifi" && state.phase === "lobby") {
    playArea = lobbyHtml();
  } else if (localHandoff && playMode === "local") {
    playArea = `<div class="panel handoff"><div class="handoff-icon">↻</div><span class="eyebrow">Pass the device</span><h2>${escapeHtml(state.players[state.you].name)}, you’re up.</h2><p class="lede">Make sure the other player has looked away before continuing.</p><button class="primary" id="ready-player">I’m ready</button></div>`;
  } else if (state.winner !== null) {
    const won = state.winner === state.you;
    const celebrate = playMode === "local" || won;
    const winner = state.players[state.winner];
    const resultTitle = playMode === "local" ? `${escapeHtml(state.players[state.winner].name)} wins.` : won ? "You found the signal." : `${escapeHtml(state.players[state.winner].name)} found you.`;
    const particles = celebrate ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${4 + (i * 37) % 92}%;--delay:${(i * -.12).toFixed(2)}s"></i>`).join("")}</div>` : "";
    const rematchLabel = playMode === "wifi" ? state.youRematch ? `Waiting for rival · ${state.rematchVotes}/2` : "Request rematch" : "Play again";
    playArea = `<div class="panel result ${celebrate ? "victory" : "defeat"}">${particles}<div class="result-rings" aria-hidden="true"></div><div class="result-badge">${celebrate ? "◆" : "◇"}</div><span class="eyebrow">${celebrate ? "Mission complete" : "Mission compromised"}</span><h2>${resultTitle}</h2><p class="lede">${escapeHtml(state.resultReason)}</p><div class="result-summary"><span><small>Winning agent</small><b>${escapeHtml(winner.name)}</b></span><span><small>Distance moved</small><b>${winner.progress}</b></span></div><div class="result-actions"><button class="primary" id="again" ${state.youRematch ? "disabled" : ""}>${rematchLabel}</button><button class="secondary" data-home>Return home</button></div></div>`;
  } else if (state.players.length < 2) {
    playArea = `<div class="panel waiting"><div class="signal"></div><h2>Waiting for a rival</h2><p class="lede">Share the room code or invitation link. The match begins as soon as they connect.</p><button class="primary" id="share">Share invitation</button></div>`;
  } else if (choosing) {
    playArea = `<div class="stage"><span class="turn-pill">Your decision</span><h2>Which contact do you take?</h2><p>You recruit your choice. Your rival gets the other card.</p></div><div class="offer">${cardHtml(state.offer.open, { attr: 'data-choice="open"' })}${cardHtml(null, { concealed: true })}</div>`;
  } else if (waitingForRival) {
    playArea = `<div class="stage"><span class="turn-pill waiting-pill">Offer sent</span><h2>Your rival is choosing</h2><p>The concealed contact stays secret until they decide.</p></div><div class="offer">${cardHtml(state.offer.open, { static: true, playerIndex: 1 - state.you })}${cardHtml(null, { concealed: true, static: true })}</div>`;
  } else if (active) {
    playArea = `<div class="stage"><span class="turn-pill">Your turn</span><h2>Build your offer</h2><p>${selected.length < 2 ? "Choose two different contacts." : faceUpId ? "Ready—send one revealed and one concealed." : "Now tap either selected card to reveal it."}</p></div><div class="hand-label"><span>Your hand</span><span>${selected.length}/2 chosen</span></div><div class="hand">${state.hand.map(card => cardHtml(card)).join("")}</div><div class="action-bar"><p class="selection-hint">${selected.length < 2 ? "Step 1 · Choose two contacts" : faceUpId ? `Revealing ${CONTACTS[state.hand.find(c => c.id === faceUpId).kind].name}` : "Step 2 · Choose which card to reveal"}</p><button class="primary" id="offer" ${selected.length === 2 && faceUpId ? "" : "disabled"}>Send this offer</button></div>`;
  } else {
    playArea = `<div class="panel waiting"><div class="signal"></div><h2>${escapeHtml(state.players[state.turn].name)} is preparing an offer</h2><p class="lede">Watch their network. The card they need may be the one they show you.</p></div>`;
  }

  const modeLabel = playMode === "bot" ? "Solo circuit" : playMode === "local" ? "In-person circuit" : "Private room";
  app.innerHTML = shell(`<div class="panel room-head"><div><span class="eyebrow">${modeLabel}</span><div class="room-code">${playMode === "wifi" ? state.room : playMode === "bot" ? "VS BOT" : "PASS & PLAY"}</div></div>${playMode === "wifi" ? `<button class="icon-btn" id="copy" aria-label="Copy invitation">⧉</button>` : ""}</div><div class="players">${state.players.map(playerBox).join("")}</div>${state.players.length === 2 && state.phase !== "lobby" ? trackHtml() : ""}<div class="game-layout ${state.phase === "lobby" ? "lobby-layout" : ""}" id="play-area"><section>${playArea}</section>${state.phase === "lobby" ? "" : `<aside class="sidebar"><div class="collections">${state.players.map(collectionHtml).join("")}</div></aside>`}</div>`) + revealOverlayHtml();
  bindCommon();
  document.querySelector("#ready-player")?.addEventListener("click", () => { playSound("turn"); localHandoff = false; render(); });
  document.querySelector("#copy")?.addEventListener("click", shareRoom);
  document.querySelector("#share")?.addEventListener("click", shareRoom);
  document.querySelector("#again")?.addEventListener("click", () => { playSound("tap"); send("rematch"); });
  document.querySelector("#toggle-ready")?.addEventListener("click", () => { playSound("select"); send("ready", { ready: !state.players[state.you].ready }); });
  document.querySelector("#start-match")?.addEventListener("click", () => { playSound("start"); send("start"); });
  document.querySelectorAll(".hand .card").forEach(el => el.addEventListener("click", () => selectCard(el.dataset.card)));
  document.querySelector("#offer")?.addEventListener("click", () => { playSound("offer"); send("offer", { openId: faceUpId, hiddenId: selected.find(id => id !== faceUpId) }); });
  document.querySelectorAll("[data-choice]").forEach(el => el.addEventListener("click", () => { playSound("select"); send("choose", { choice: el.dataset.choice }); }));
}

function selectCard(id) {
  const card = state.hand.find(item => item.id === id);
  if (selected.includes(id)) {
    if (selected.length === 2) faceUpId = id;
    else { selected = selected.filter(item => item !== id); faceUpId = null; }
  } else {
    if (selected.length === 2) selected = [];
    const other = state.hand.find(item => item.id === selected[0]);
    if (other?.kind === card.kind && state.hand.some(item => item.kind !== card.kind)) return showToast("Choose two different contacts");
    selected.push(id);
    if (selected.length === 1) faceUpId = null;
  }
  playSound("select");
  renderGame();
}

async function shareRoom() {
  const url = `${location.origin}${location.pathname}?room=${state.room}`;
  try {
    if (navigator.share) await navigator.share({ title: "Join my Spies in Disguise game", text: `Room ${state.room}`, url });
    else { await navigator.clipboard.writeText(url); showToast("Invitation copied"); }
  } catch (error) { if (error.name !== "AbortError") showToast("Couldn’t share the link"); }
}

function render() { splashVisible ? renderSplash() : state ? renderGame() : renderHome(); }
window.render_game_to_text = () => JSON.stringify(splashVisible ? { screen: "splash", soundEnabled, connected } : state ? { screen: revealState ? "reveal" : state.phase === "lobby" ? "lobby" : state.winner !== null ? "result" : "game", mode: playMode, you: state.you, turn: state.turn, phase: state.phase, winner: state.winner, selected, revealed: faceUpId, resolving: revealState ? { choice: revealState.choice, chosen: revealState.chosen.kind, other: revealState.other.kind, chooser: revealState.chooser } : null, hand: state.hand?.map(card => ({ id: card.id, kind: card.kind })), offer: state.offer ? { open: state.offer.open?.kind, concealed: true } : null, players: state.players.map(player => ({ name: player.name, progress: player.progress, collection: player.collection, connected: player.connected, ready: player.ready })) } : { screen: "home", panel: homePanel, connected, soundEnabled });
window.advanceTime = () => {};
addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; render(); });
addEventListener("appinstalled", () => { installPrompt = null; render(); showToast("Spies in Disguise installed"); });
connect();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
