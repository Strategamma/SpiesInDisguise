import { chooseBotCard, chooseBotOffer, createLocalGame, localChoose, localOffer, localView } from "./local-game.js";

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
    if (message.type === "state") {
      playMode = "wifi";
      state = message.state;
      selected = [];
      faceUpId = null;
      localStorage.setItem(`spies-token-${state.room}`, message.token);
      history.replaceState({}, "", `${location.pathname}?room=${state.room}`);
      render();
    } else if (message.type === "error") showToast(message.message);
    else if (message.type === "room_closed") { state = null; renderHome("That room expired."); }
  });
}

function resume() {
  if (!pendingRoom || playMode !== "wifi") return;
  const token = localStorage.getItem(`spies-token-${pendingRoom}`) || localStorage.getItem(`shadow-token-${pendingRoom}`);
  if (token) send("join", { room: pendingRoom, token, name: savedName || "Agent" });
}

function shell(content) {
  return `<div class="app-shell"><header class="topbar"><button class="brand brand-button" data-home aria-label="Return to mode selection"><img class="brand-logo" src="./logo.svg" alt="Spies in Disguise"></button><div class="header-actions">${!state && !isInstalled() ? `<button class="install-button" data-install aria-label="Install Spies in Disguise"><span>⇩</span><b>Install</b></button>` : ""}<button class="icon-btn" data-rules aria-label="How to play">?</button></div></header>${content}</div>${rulesDialog()}${installDialog()}`;
}

function rulesDialog() {
  return `<dialog id="rules" class="rules-dialog"><div class="dialog-head"><div><span class="eyebrow">Field briefing</span><h2>How to play</h2></div><button class="dialog-close" data-close-rules aria-label="Close rules">×</button></div><p class="rules-intro">Bluff with two contacts, read your rival, and close the pursuit gap.</p><div class="rule-steps"><article><span>1</span><div><b>Send two signals</b><p>Choose two different contacts. Show one face-up and keep the other concealed.</p></div></article><article><span>2</span><div><b>Your rival chooses</b><p>They recruit the contact they take. You recruit the one they leave behind.</p></div></article><article><span>3</span><div><b>Move on the track</b><p>A contact’s 1st, 2nd, and 3rd recruitment can move you by different amounts.</p></div></article></div><div class="win-conditions"><div><span>◆</span><p><b>Close the gap</b>Move a combined 12 spaces before your rival.</p></div><div><span>◇</span><p><b>Oracle shortcut</b>Recruit three Oracles to win immediately.</p></div><div class="danger"><span>✕</span><p><b>Avoid exposure</b>A third Renegade makes you lose immediately.</p></div></div><h3 class="dossier-title">Contact dossier</h3><div class="legend">${Object.entries(CONTACTS).map(([kind, c]) => `<div class="legend-item contact-${kind}"><div class="legend-symbol">${c.symbol}</div><div><b>${c.name}</b><span>${c.note}</span><div class="mini-moves">${c.moves.map((n, i) => `<span><small>${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : "rd"}</small>${n > 0 ? "+" : ""}${n}</span>`).join("")}</div></div></div>`).join("")}</div><button class="primary rules-done" data-close-rules>Start playing</button></dialog>`;
}

function installDialog() {
  return `<dialog id="install-dialog"><span class="eyebrow">Take it with you</span><h2>Install Spies in Disguise</h2><p class="lede">Add the game to your home screen for a full-screen app experience and offline Bot or In Person play.</p><div class="install-steps"><b>iPhone or iPad</b><span>Open the Share menu in Safari, then choose “Add to Home Screen.”</span><b>Other browsers</b><span>Open the browser menu and choose “Install app” or “Add to Home screen.”</span></div><button class="secondary" data-close-install>Close</button></dialog>`;
}

function isInstalled() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

function bindCommon() {
  document.querySelectorAll("[data-rules]").forEach(button => button.addEventListener("click", () => document.querySelector("#rules").showModal()));
  document.querySelectorAll("[data-close-rules]").forEach(button => button.addEventListener("click", () => document.querySelector("#rules").close()));
  document.querySelector("[data-install]")?.addEventListener("click", installApp);
  document.querySelector("[data-close-install]")?.addEventListener("click", () => document.querySelector("#install-dialog").close());
  document.querySelector("[data-home]")?.addEventListener("click", returnHome);
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
  if (playMode === "wifi" && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
  playMode = null; localGame = null; state = null; localHandoff = false; pendingRoom = ""; homePanel = null;
  selected = []; faceUpId = null;
  history.replaceState({}, "", location.pathname);
  renderHome();
}

function renderHome(error = "") {
  state = null;
  app.innerHTML = shell(`<section class="home"><div class="home-intro"><span class="eyebrow">A two-player game of bluffing</span><h1>Hide your agent.<br><span class="accent">Read their move.</span></h1><p class="lede">Offer two contacts—one revealed, one concealed. Your rival chooses first, but every choice moves both of you.</p><button class="briefing-link" data-rules><span class="briefing-play">?</span><span><b>New agent?</b><small>Learn the game in 60 seconds</small></span><span>›</span></button></div><div class="mode-heading"><div><span class="eyebrow">Choose a mode</span><h2>Start a mission</h2></div><span>2 players · 10 min</span></div><div class="mode-grid"><button class="mode-card recommended" data-mode="bot"><span class="mode-badge">Best first game</span><span class="mode-icon">⌁</span><span class="mode-copy"><b>Play a Bot</b><small>Learn solo · works offline</small></span><span class="mode-arrow">›</span></button><button class="mode-card" data-mode="local"><span class="mode-icon">◇</span><span class="mode-copy"><b>Pass & Play</b><small>Two players · one device</small></span><span class="mode-arrow">›</span></button><button class="mode-card wifi-mode-card" data-mode="wifi"><span class="mode-icon">◉</span><span class="mode-copy"><b>Private Room</b><small>Two devices · share a code</small></span><span class="mode-arrow">›</span></button></div><div class="home-setup ${homePanel === "wifi" ? "show" : ""}" id="wifi-setup"><div class="setup-heading"><div><span class="eyebrow">Private room</span><h2>Create or join</h2></div><button class="text-btn" id="close-setup">Close</button></div><div class="field"><label for="name">Your codename</label><input id="name" maxlength="18" autocomplete="nickname" placeholder="Nightjar" value="${escapeHtml(savedName)}"></div><div class="wifi-actions"><button class="primary" id="create" ${connected ? "" : "disabled"}>Create a room</button><div class="wifi-divider"><span>or enter a room code</span></div><div class="join-row"><input id="room" aria-label="Room code" maxlength="6" inputmode="text" placeholder="K7M2QX" value="${escapeHtml(pendingRoom)}"><button class="secondary" id="join" ${connected ? "" : "disabled"}>Join</button></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}<div class="status-pill"><span class="dot ${connected ? "live" : ""}"></span>${connected ? "Room service ready" : "Connecting to room service…"}</div></div><section class="how-preview" aria-labelledby="how-title"><div class="section-heading"><div><span class="eyebrow">The mission</span><h2 id="how-title">How to play</h2></div><button class="text-btn" data-rules>Full briefing →</button></div><div class="preview-steps"><article><span>01</span><b>Offer two</b><p>Reveal one contact. Keep one secret.</p></article><article><span>02</span><b>Choose one</b><p>Your rival takes a card; you get the other.</p></article><article><span>03</span><b>Close the gap</b><p>Move 12 spaces first—or recruit 3 Oracles.</p></article></div></section><footer class="home-footer"><span>Original game by Decadence</span><button class="text-btn" data-rules>Rules & contacts</button></footer></section>`);
  bindCommon();
  const remember = () => { const name = document.querySelector("#name")?.value.trim(); if (name) localStorage.setItem("spies-name", name); return name; };
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.mode === "wifi") { homePanel = "wifi"; renderHome(); setTimeout(() => document.querySelector("#wifi-setup")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0); }
    else startLocal(button.dataset.mode);
  }));
  document.querySelector("#close-setup")?.addEventListener("click", () => { homePanel = null; renderHome(); });
  document.querySelector("#create")?.addEventListener("click", () => { const name = remember(); if (!name) return showToast("Choose a codename first"); playMode = "wifi"; send("create", { name }); });
  document.querySelector("#join")?.addEventListener("click", () => { const name = remember(); const room = document.querySelector("#room").value.trim().toUpperCase(); if (!name) return showToast("Choose a codename first"); if (room.length !== 6) return showToast("Enter the six-character code"); pendingRoom = room; playMode = "wifi"; send("join", { room, name }); });
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
      if (playMode === "local") { state = localView(localGame, 1 - state.you); localHandoff = true; render(); }
      else { state = localView(localGame, 0); render(); botTimer = setTimeout(runBotRound, 650); }
    } else if (type === "choose") {
      localChoose(localGame, state.you, payload.choice);
      state = localView(localGame, state.you); render();
    } else if (type === "rematch") startLocal(playMode);
  } catch (error) { showToast(error.message); }
}

function runBotRound() {
  if (playMode !== "bot" || !localGame || localGame.winner !== null) return;
  if (localGame.phase === "choose" && localGame.offer.by === 0) {
    localChoose(localGame, 1, chooseBotCard(localGame));
    state = localView(localGame, 0); render();
  }
  if (localGame.winner === null && localGame.phase === "offer" && localGame.turn === 1) {
    botTimer = setTimeout(() => {
      const offer = chooseBotOffer(localGame);
      localOffer(localGame, 1, offer.openId, offer.hiddenId);
      state = localView(localGame, 0); render();
    }, 650);
  }
}

function cardHtml(card, options = {}) {
  if (options.concealed) return `<button class="card concealed" data-choice="hidden" aria-label="Choose concealed contact"><div class="card-back-mark">?</div><div class="card-name">Unknown contact</div><div class="card-effect">Choose to reveal and recruit this agent.</div><span class="card-choice">Choose concealed</span></button>`;
  const c = CONTACTS[card.kind];
  const selectedClass = selected.includes(card.id) ? " selected" : "";
  const isOpen = faceUpId === card.id;
  return `<button class="card contact-${card.kind}${selectedClass}${isOpen ? " face-up" : ""}" ${options.attr || ""} data-card="${card.id}" aria-pressed="${selected.includes(card.id)}"><div class="card-top"><span class="card-symbol">${c.symbol}</span>${isOpen ? `<span class="open-badge">Revealed</span>` : `<span class="contact-type">Contact</span>`}</div><div class="card-name">${c.name}</div><div class="card-effect">${c.note}</div><div class="card-moves" aria-label="Movement on first, second, and third recruit">${c.moves.map((n, i) => `<span class="move"><small>${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : "rd"}</small><b>${n > 0 ? "+" : ""}${n}</b></span>`).join("")}</div>${selected.includes(card.id) ? `<span class="selected-mark">${isOpen ? "Shown" : "Selected"}</span>` : ""}</button>`;
}

function playerBox(player, index) {
  return `<div class="player ${index === state.you ? "you" : ""}"><div class="player-name">${escapeHtml(player.name)}${index === state.you ? " · you" : ""}</div><div class="player-meta">${player.connected ? "online" : "reconnecting"} · ${player.progress} spaces</div></div>`;
}

function trackHtml() {
  const a = Math.min(92, state.players[0].progress / 12 * 92);
  const b = Math.max(0, 92 - state.players[1].progress / 12 * 92);
  const gap = Math.max(0, 12 - state.players[0].progress - state.players[1].progress);
  return `<div class="track-wrap"><div class="track-labels"><span>${escapeHtml(state.players[0].name)}</span><span>${escapeHtml(state.players[1].name)}</span></div><div class="track"><div class="runner a" style="left:${a}%">A</div><div class="runner b" style="left:${b}%">B</div></div><div class="gap">${gap} spaces remain</div></div>`;
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
  if (localHandoff && playMode === "local") {
    playArea = `<div class="panel handoff"><div class="handoff-icon">↻</div><span class="eyebrow">Pass the device</span><h2>${escapeHtml(state.players[state.you].name)}, you’re up.</h2><p class="lede">Make sure the other player has looked away before continuing.</p><button class="primary" id="ready-player">I’m ready</button></div>`;
  } else if (state.winner !== null) {
    const won = state.winner === state.you;
    const resultTitle = playMode === "local" ? `${escapeHtml(state.players[state.winner].name)} wins.` : won ? "You found the signal." : `${escapeHtml(state.players[state.winner].name)} found you.`;
    playArea = `<div class="panel result"><div class="result-badge">${won ? "◆" : "◇"}</div><span class="eyebrow">Cover blown</span><h2>${resultTitle}</h2><p class="lede">${escapeHtml(state.resultReason)}</p><button class="primary" id="again">Play again</button></div>`;
  } else if (state.players.length < 2) {
    playArea = `<div class="panel waiting"><div class="signal"></div><h2>Waiting for a rival</h2><p class="lede">Share the room code or invitation link. The match begins as soon as they connect.</p><button class="primary" id="share">Share invitation</button></div>`;
  } else if (choosing) {
    playArea = `<div class="stage"><span class="turn-pill">Your decision</span><h2>Which contact do you take?</h2><p>You recruit your choice. Your rival gets the other card.</p></div><div class="offer">${cardHtml(state.offer.open, { attr: 'data-choice="open"' })}${cardHtml(null, { concealed: true })}</div>`;
  } else if (waitingForRival) {
    playArea = `<div class="stage"><span class="turn-pill waiting-pill">Offer sent</span><h2>Your rival is choosing</h2><p>The concealed contact stays secret until they decide.</p></div><div class="offer">${cardHtml(state.offer.open)}${cardHtml(null, { concealed: true })}</div>`;
  } else if (active) {
    playArea = `<div class="stage"><span class="turn-pill">Your turn</span><h2>Build your offer</h2><p>${selected.length < 2 ? "Choose two different contacts." : faceUpId ? "Ready—send one revealed and one concealed." : "Now tap either selected card to reveal it."}</p></div><div class="hand-label"><span>Your hand</span><span>${selected.length}/2 chosen</span></div><div class="hand">${state.hand.map(card => cardHtml(card)).join("")}</div><div class="action-bar"><p class="selection-hint">${selected.length < 2 ? "Step 1 · Choose two contacts" : faceUpId ? `Revealing ${CONTACTS[state.hand.find(c => c.id === faceUpId).kind].name}` : "Step 2 · Choose which card to reveal"}</p><button class="primary" id="offer" ${selected.length === 2 && faceUpId ? "" : "disabled"}>Send this offer</button></div>`;
  } else {
    playArea = `<div class="panel waiting"><div class="signal"></div><h2>${escapeHtml(state.players[state.turn].name)} is preparing an offer</h2><p class="lede">Watch their network. The card they need may be the one they show you.</p></div>`;
  }

  const modeLabel = playMode === "bot" ? "Solo circuit" : playMode === "local" ? "In-person circuit" : "Private room";
  app.innerHTML = shell(`<div class="panel room-head"><div><span class="eyebrow">${modeLabel}</span><div class="room-code">${playMode === "wifi" ? state.room : playMode === "bot" ? "VS BOT" : "PASS & PLAY"}</div></div>${playMode === "wifi" ? `<button class="icon-btn" id="copy" aria-label="Copy invitation">⧉</button>` : ""}</div><div class="players">${state.players.map(playerBox).join("")}</div>${state.players.length === 2 ? trackHtml() : ""}<div class="game-layout"><section>${playArea}</section><aside class="sidebar"><div class="collections">${state.players.map(collectionHtml).join("")}</div></aside></div>`);
  bindCommon();
  document.querySelector("#ready-player")?.addEventListener("click", () => { localHandoff = false; render(); });
  document.querySelector("#copy")?.addEventListener("click", shareRoom);
  document.querySelector("#share")?.addEventListener("click", shareRoom);
  document.querySelector("#again")?.addEventListener("click", () => send("rematch"));
  document.querySelectorAll(".hand .card").forEach(el => el.addEventListener("click", () => selectCard(el.dataset.card)));
  document.querySelector("#offer")?.addEventListener("click", () => send("offer", { openId: faceUpId, hiddenId: selected.find(id => id !== faceUpId) }));
  document.querySelectorAll("[data-choice]").forEach(el => el.addEventListener("click", () => send("choose", { choice: el.dataset.choice })));
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
  renderGame();
}

async function shareRoom() {
  const url = `${location.origin}${location.pathname}?room=${state.room}`;
  try {
    if (navigator.share) await navigator.share({ title: "Join my Spies in Disguise game", text: `Room ${state.room}`, url });
    else { await navigator.clipboard.writeText(url); showToast("Invitation copied"); }
  } catch (error) { if (error.name !== "AbortError") showToast("Couldn’t share the link"); }
}

function render() { state ? renderGame() : renderHome(); }
window.render_game_to_text = () => JSON.stringify(state ? { screen: "game", mode: playMode, you: state.you, turn: state.turn, phase: state.phase, winner: state.winner, selected, revealed: faceUpId, hand: state.hand?.map(card => ({ id: card.id, kind: card.kind })), offer: state.offer ? { open: state.offer.open?.kind, concealed: true } : null, players: state.players.map(player => ({ name: player.name, progress: player.progress, collection: player.collection })) } : { screen: "home", panel: homePanel, connected });
window.advanceTime = () => {};
addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; render(); });
addEventListener("appinstalled", () => { installPrompt = null; render(); showToast("Spies in Disguise installed"); });
connect();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
