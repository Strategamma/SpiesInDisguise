import { chooseBotCard, chooseBotOffer, createLocalGame, localChoose, localOffer, localSwap, localView } from "./local-game.js";
import { BOARD_SPACES, boardPosition, contactStageEffect, interceptionGap, nextRecruitIndex, projectedCardPosition, resolutionMovementNotice, stateMotionCue } from "./ui-logic.js";

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
let botTimer = null;
let splashVisible = true;
let soundEnabled = localStorage.getItem("spies-sound") !== "off";
let audioContext = null;
let revealState = null;
let pendingRevealState = null;
let revealTimer = null;
let revealComplete = null;
let movementNotice = null;
let movementTimer = null;
let motionCue = null;
let landscapePromptDismissed = false;
const savedBotProfile = localStorage.getItem("spies-bot-profile");
let botProfile = BOT_PROFILES[savedBotProfile] ? savedBotProfile : "balanced";
const REVEAL_DURATION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 4500 : 6500;

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

function applyState(next) {
  const previous = state;
  motionCue = stateMotionCue(previous, next);
  state = next;
  if (!previous || splashVisible) return;
  const movementChanged = previous.players?.some((player, index) => player.progress !== next.players?.[index]?.progress);
  const enteredDanger = previous.players?.length === 2 && next.players?.length === 2 && interceptionGap(previous.players) > 2 && interceptionGap(next.players) <= 2 && next.winner === null;
  if (previous.winner === null && next.winner !== null) playSound(playMode === "local" || next.winner === next.you ? "win" : "lose");
  else if (enteredDanger) { playSound("danger"); navigator.vibrate?.([45, 45, 80]); }
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
  revealTimer = setTimeout(finishReveal, REVEAL_DURATION);
}

function queueAfterReveal(next) {
  pendingRevealState = next;
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
      movementNotice = resolutionMovementNotice(previous, next, resolvedReveal);
    }
    applyState(next);
  }
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
    if (message.type === "presence") {
      liveDuels = Array.isArray(message.duels) ? message.duels : [];
      const board = document.querySelector("#live-duel-board");
      if (board && !state) { board.outerHTML = liveDuelBoardHtml(); bindDuelBoard(); bindInteractionFeedback(); }
    } else if (message.type === "reveal") startReveal(message);
    else if (message.type === "state") {
      playMode = "wifi";
      if (revealState) queueAfterReveal(message.state); else applyState(message.state);
      selected = [];
      faceUpId = null;
      swapMode = false;
      localStorage.setItem(`spies-token-${state.room}`, message.token);
      history.replaceState({}, "", `${location.pathname}?room=${state.room}`);
      render();
    } else if (message.type === "error") showToast(message.message);
    else if (message.type === "room_closed") { clearTimeout(revealTimer); clearTimeout(movementTimer); revealState = null; pendingRevealState = null; revealComplete = null; movementNotice = null; state = null; renderHome("That room expired."); }
  });
}

function resume() {
  if (!pendingRoom || playMode !== "wifi") return;
  const token = localStorage.getItem(`spies-token-${pendingRoom}`) || localStorage.getItem(`shadow-token-${pendingRoom}`);
  if (token) send("join", { room: pendingRoom, token, name: savedName || "Agent", protocol: 3 });
}

function shell(content) {
  const inGame = Boolean(state);
  return `<div class="app-shell"><header class="topbar"><button class="brand brand-button" data-home aria-label="Return to home"><img class="brand-logo" src="./logo.svg" alt="Spies in Disguise"></button><div class="header-actions">${!state && !isInstalled() ? `<button class="install-button" data-install aria-label="Install Spies in Disguise"><span aria-hidden="true">⇩</span><b>Install</b></button>` : ""}<button class="sound-button" data-sound aria-label="${soundEnabled ? "Mute sounds" : "Turn sounds on"}" aria-pressed="${soundEnabled}"><span aria-hidden="true">${soundEnabled ? "♪" : "×"}</span></button></div></header><div class="app-content">${content}</div><nav class="app-nav" aria-label="Primary navigation"><button class="nav-button ${inGame ? "" : "active"}" data-home ${inGame ? "" : 'aria-current="page"'}><span aria-hidden="true">⌂</span><b>Home</b></button><button class="nav-button ${inGame ? "active" : ""}" data-play ${inGame ? 'aria-current="page"' : ""}><span aria-hidden="true">◉</span><b>Play</b></button><button class="nav-button" data-rules><span aria-hidden="true">?</span><b>Rules</b></button></nav></div>${inGame && !landscapePromptDismissed ? `<div class="rotate-device" role="status"><span aria-hidden="true">↻</span><b>Rotate to landscape</b><small>The board is designed for a wider view.</small><button class="text-btn" data-dismiss-rotate>Continue in portrait</button></div>` : ""}${rulesDialog()}${contactDetailDialog()}${installDialog()}${leaveDialog()}`;
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
  const dossier = Object.entries(CONTACTS).map(([kind, contact]) => `<div class="legend-item contact-${kind}"><div class="legend-symbol">${contact.symbol}</div><div><b>${contact.name}</b><span>${contact.note}</span>${contact.ability ? `<div class="mini-ability">${contact.ability}</div>` : `<div class="mini-moves">${contact.moves.map((movement, index) => `<span class="${contactStageEffect(kind, index, movement).className}"><small>${contact.single ? "Always" : `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"}`}</small>${stageEffectHtml(kind, index, movement)}</span>`).join("")}</div>`}</div></div>`).join("");
  return `<dialog id="rules" class="rules-dialog">
    <div class="dialog-head"><div><span class="eyebrow">Field briefing</span><h2>How to play</h2></div><button class="dialog-close" data-close-rules aria-label="Close rules">×</button></div>
    <p class="rules-intro">Bluff with two contacts, read your rival, and catch them on the loop.</p>
    <section class="visual-briefing" aria-label="Three-screen beginner walkthrough">
      <article><img src="./help-offer.svg" alt="A hand with Courier and Ghost selected, with Courier marked as the revealed card."><div><span>1</span><p><b>Build the bluff</b>Choose two contacts, then decide which one your rival is allowed to see.</p></div></article>
      <article><img src="./help-choose.svg" alt="A revealed Courier beside a concealed question-mark card, ready for the rival to choose."><div><span>2</span><p><b>Make the read</b>The chooser recruits one card. The player who offered recruits the other.</p></div></article>
      <article><img src="./help-chase.svg" alt="Two agents on a twelve-space clockwise ring with two spaces remaining before an interception."><div><span>3</span><p><b>Close the gap</b>Both agents move clockwise. Gain six relative spaces to catch your rival.</p></div></article>
    </section>
    <div class="rule-steps">
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
  screen.orientation?.lock?.("landscape").catch(() => {});
}

function bindCommon() {
  const rules = document.querySelector("#rules");
  const syncNavigation = () => {
    document.querySelectorAll(".nav-button").forEach(button => button.removeAttribute("aria-current"));
    document.querySelector(rules?.open ? ".nav-button[data-rules]" : state ? ".nav-button[data-play]" : ".nav-button[data-home]")?.setAttribute("aria-current", "page");
  };
  document.querySelectorAll("[data-rules]").forEach(button => button.addEventListener("click", () => { rules.showModal(); syncNavigation(); }));
  document.querySelectorAll("[data-close-rules]").forEach(button => button.addEventListener("click", () => rules.close()));
  rules?.addEventListener("close", syncNavigation);
  document.querySelector("[data-install]")?.addEventListener("click", installApp);
  document.querySelector("[data-sound]")?.addEventListener("click", toggleSound);
  document.querySelector("[data-close-install]")?.addEventListener("click", () => document.querySelector("#install-dialog").close());
  document.querySelectorAll("[data-home]").forEach(button => button.addEventListener("click", requestHome));
  document.querySelector("[data-play]")?.addEventListener("click", () => document.querySelector(state ? "#play-area" : "#play-modes")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  document.querySelector("[data-stay]")?.addEventListener("click", () => document.querySelector("#leave-dialog").close());
  document.querySelector("[data-confirm-home]")?.addEventListener("click", returnHome);
  document.querySelector("[data-dismiss-rotate]")?.addEventListener("click", () => { landscapePromptDismissed = true; document.querySelector(".rotate-device")?.remove(); });
  document.querySelectorAll("[data-contact-kind]").forEach(button => button.addEventListener("click", () => openContactDetail(button)));
  document.querySelectorAll("[data-close-contact]").forEach(button => button.addEventListener("click", () => document.querySelector("#contact-detail")?.close()));
  bindInteractionFeedback();
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
    if (matchMedia("(hover:hover)").matches) button.addEventListener("mouseenter", () => { if (!button.disabled) playSound("hover"); });
  });
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
  clearTimeout(revealTimer); clearTimeout(movementTimer); revealTimer = null; movementTimer = null; revealState = null; pendingRevealState = null; revealComplete = null; movementNotice = null;
  if (playMode === "wifi" && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
  playMode = null; localGame = null; state = null; localHandoff = false; pendingRoom = ""; homePanel = null;
  selected = []; faceUpId = null; swapMode = false;
  history.replaceState({}, "", location.pathname);
  renderHome();
}

function liveDuelBoardHtml() {
  const rows = liveDuels.length
    ? liveDuels.map(duel => `<button class="duel-agent" data-duel-room="${escapeHtml(duel.room)}"><span class="duel-avatar" aria-hidden="true">${escapeHtml(duel.host.slice(0, 1).toUpperCase())}</span><span><b>${escapeHtml(duel.host)}</b><small>Ready to duel · LAN / online</small></span><em>Challenge <i aria-hidden="true">→</i></em></button>`).join("")
    : `<div class="duel-empty"><span aria-hidden="true">⌁</span><div><b>No open signals yet</b><small>Host the first duel and your codename will appear here.</small></div></div>`;
  return `<section class="live-duels" id="live-duel-board" aria-labelledby="live-duels-title"><div class="live-duels-head"><div><span class="live-label"><i></i>${connected ? "Network live" : "Connecting"}</span><h2 id="live-duels-title">Agents ready to duel</h2></div><button class="host-duel" data-host-duel ${connected ? "" : "disabled"}>Host open duel <span aria-hidden="true">＋</span></button></div><div class="duel-list">${rows}</div><div class="duel-foot"><span>Same room or across the web</span><button class="text-btn" data-mode="wifi">Use a private code →</button></div></section>`;
}

function beginOnlineRoom(isPublic, room = "") {
  const name = (document.querySelector("#name")?.value || localStorage.getItem("spies-name") || "").trim();
  if (!name) { pendingRoom = room; homePanel = "wifi"; renderHome(); setTimeout(() => document.querySelector("#name")?.focus(), 0); return; }
  localStorage.setItem("spies-name", name); landscapePromptDismissed = false; preferLandscape(); playMode = "wifi";
  if (room) { pendingRoom = room; send("join", { room, name, protocol: 3 }); }
  else send("create", { name, protocol: 3, public: isPublic });
}

function bindDuelBoard() {
  document.querySelectorAll("[data-host-duel]").forEach(button => button.addEventListener("click", () => beginOnlineRoom(true)));
  document.querySelectorAll("[data-duel-room]").forEach(button => button.addEventListener("click", () => beginOnlineRoom(false, button.dataset.duelRoom)));
  document.querySelector("#live-duel-board [data-mode='wifi']")?.addEventListener("click", () => { homePanel = "wifi"; renderHome(); setTimeout(() => document.querySelector("#wifi-setup")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0); });
}

function renderHome(error = "") {
  state = null;
  const currentName = localStorage.getItem("spies-name") || savedName;
  app.innerHTML = shell(`<section class="home"><div class="home-hero"><div class="home-intro"><span class="eyebrow">Secure channel / Live network</span><h1><span class="outline">Hide your agent.</span><br><span class="accent">Read their move.</span></h1><p class="lede">One room. Two rivals. Offer a contact in plain sight, hide another, and turn every bluff into movement.</p><div class="hero-actions"><button class="hero-primary" data-host-duel>Find a live duel <span aria-hidden="true">→</span></button><button class="briefing-link" data-rules><span class="briefing-play" aria-hidden="true">?</span><span><b>New agent?</b><small>Learn it in 60 seconds</small></span></button></div></div><div class="hero-card" aria-hidden="true"><span class="hero-card-signal"></span><img src="./icon.svg" alt=""><b>CLASSIFIED</b><small>One face up<br>One face down</small></div></div>${liveDuelBoardHtml()}<div class="mode-heading" id="play-modes"><div><span class="eyebrow">Play your way</span><h2>More game modes</h2></div><span>About 10 minutes</span></div><div class="mode-grid"><button class="mode-card recommended" data-mode="bot"><span class="mode-icon" aria-hidden="true">⌁</span><span class="mode-copy"><span class="mode-badge">Best first game</span><b>Play vs Bot</b><small>Solo practice · works offline</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card" data-mode="local"><span class="mode-icon" aria-hidden="true">◇</span><span class="mode-copy"><b>Pass & Play</b><small>Two agents · one shared device</small></span><span class="mode-arrow" aria-hidden="true">›</span></button><button class="mode-card wifi-mode-card" data-mode="wifi"><span class="mode-icon" aria-hidden="true">◉</span><span class="mode-copy"><b>Private Room</b><small>Two devices · share a code</small></span><span class="mode-arrow" aria-hidden="true">›</span></button></div><div class="home-setup ${homePanel === "wifi" ? "show" : ""}" id="wifi-setup"><div class="setup-heading"><div><span class="eyebrow">Local network / online</span><h2>Connect two devices</h2></div><button class="text-btn" id="close-setup">Close</button></div><div class="field"><label for="name">Your codename</label><input id="name" maxlength="18" autocomplete="nickname" placeholder="Nightjar" value="${escapeHtml(currentName)}"></div><div class="wifi-actions"><div class="online-create-actions"><button class="primary" id="create-public" ${connected ? "" : "disabled"}>Host open duel</button><button class="secondary" id="create" ${connected ? "" : "disabled"}>Create private room</button></div><div class="wifi-divider"><span>or enter a room code</span></div><div class="join-row"><input id="room" aria-label="Room code" maxlength="6" inputmode="text" placeholder="K7M2QX" value="${escapeHtml(pendingRoom)}"><button class="secondary" id="join" ${connected ? "" : "disabled"}>Join</button></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}<div class="status-pill"><span class="dot ${connected ? "live" : ""}"></span>${connected ? "Duel network ready" : "Connecting to duel network…"}</div></div><section class="how-preview" aria-labelledby="how-title"><div class="section-heading"><div><span class="eyebrow">The mission</span><h2 id="how-title">How to play</h2></div><button class="text-btn" data-rules>View all rules <span aria-hidden="true">→</span></button></div><div class="preview-steps"><article><span>01</span><div><b>Offer two</b><p>Reveal one contact. Keep one secret.</p></div></article><article><span>02</span><div><b>Choose one</b><p>Your rival takes a card; you recruit the other.</p></div></article><article><span>03</span><div><b>Intercept</b><p>Gain six spaces on your rival or recruit 3 Oracles.</p></div></article></div></section><footer class="home-footer"><span>Spies in Disguise</span><span>Private play · live rivals</span></footer></section>`);
  document.querySelector(".mode-grid")?.insertAdjacentHTML("afterend", `<div class="home-setup ${homePanel === "bot" ? "show" : ""}" id="bot-setup"><div class="setup-heading"><div><span class="eyebrow">Solo circuit</span><h2>Choose your rival</h2></div><button class="text-btn" data-close-setup>Close</button></div><p class="setup-copy">Start with Rook to learn, then move up when you can read the bluff.</p><div class="bot-profiles">${Object.entries(BOT_PROFILES).map(([key, profile]) => `<button class="bot-profile ${botProfile === key ? "selected" : ""}" data-bot-profile="${key}" aria-pressed="${botProfile === key}"><span>${key === "rookie" ? "Ⅰ" : key === "balanced" ? "Ⅱ" : "Ⅲ"}</span><b>${profile.name}<small>${profile.label}</small></b><em>${profile.note}</em></button>`).join("")}</div><button class="primary" id="start-bot">Play ${BOT_PROFILES[botProfile].name}</button></div>`);
  bindCommon();
  bindDuelBoard();
  const remember = () => { const name = document.querySelector("#name")?.value.trim(); if (name) localStorage.setItem("spies-name", name); return name; };
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    if (button.dataset.mode === "wifi" || button.dataset.mode === "bot") { homePanel = button.dataset.mode; renderHome(); setTimeout(() => document.querySelector(`#${homePanel}-setup`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0); }
    else startLocal(button.dataset.mode);
  }));
  document.querySelectorAll("#close-setup,[data-close-setup]").forEach(button => button.addEventListener("click", () => { homePanel = null; renderHome(); }));
  document.querySelectorAll("[data-bot-profile]").forEach(button => button.addEventListener("click", () => { botProfile = button.dataset.botProfile; localStorage.setItem("spies-bot-profile", botProfile); renderHome(); }));
  document.querySelector("#start-bot")?.addEventListener("click", () => startLocal("bot"));
  document.querySelector("#create-public")?.addEventListener("click", () => { if (!remember()) return showToast("Choose a codename first"); beginOnlineRoom(true); });
  document.querySelector("#create")?.addEventListener("click", () => { if (!remember()) return showToast("Choose a codename first"); beginOnlineRoom(false); });
  document.querySelector("#join")?.addEventListener("click", () => { if (!remember()) return showToast("Choose a codename first"); const room = document.querySelector("#room").value.trim().toUpperCase(); if (room.length !== 6) return showToast("Enter the six-character code"); beginOnlineRoom(false, room); });
}

function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

function startLocal(mode) {
  clearTimeout(botTimer);
  landscapePromptDismissed = false;
  preferLandscape();
  selected = []; faceUpId = null; swapMode = false;
  playMode = mode;
  const name = localStorage.getItem("spies-name") || localStorage.getItem("shadow-name") || "Player One";
  localGame = createLocalGame(mode, name, Math.random, { botName: `${BOT_PROFILES[botProfile].name} Bot` });
  motionCue = "deal";
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
    } else if (type === "swap") {
      localSwap(localGame, state.you, payload.cardId);
      applyState(localView(localGame, state.you)); render();
    } else if (type === "rematch") startLocal(playMode);
  } catch (error) { showToast(error.message); }
}

function runBotRound() {
  if (playMode !== "bot" || !localGame || localGame.winner !== null) return;
  if (localGame.phase === "choose" && localGame.offer.by === 0) {
    const offer = localGame.offer; const choice = chooseBotCard(localGame, botProfile);
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
      const offer = chooseBotOffer(localGame, botProfile);
      localOffer(localGame, 1, offer.openId, offer.hiddenId);
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
  const outcome = cardOutcomeText(card, recipient);
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
  return `<div class="reveal-overlay" role="status" aria-live="assertive"><section class="reveal-sheet"><div class="reveal-heading"><span class="eyebrow">Exchange resolved</span><h2>Here’s who took what</h2><p>Both contacts resolve for their new owner.</p></div><div class="reveal-stage"><div class="reveal-lane chosen"><span><b>${chooserName} chose</b><small>First pick</small></span>${revealCardHtml(revealState.chosen, revealState.choice === "hidden", chooser)}</div><div class="reveal-divider" aria-hidden="true"><i></i><b>AND</b><i></i></div><div class="reveal-lane other"><span><b>${otherName} receives</b><small>Card left behind</small></span>${revealCardHtml(revealState.other, revealState.choice === "open", otherRecipient)}</div></div><button class="primary reveal-continue" id="continue-resolution">Show movement on board <span aria-hidden="true">→</span></button></section></div>`;
}

function playerBox(player, index) {
  const movement = `${player.progress > 0 ? "+" : ""}${player.progress}`;
  const meta = state.phase === "lobby" ? `${player.connected ? "Connected" : "Reconnecting"} · ${player.ready ? "Ready" : "Not ready"}` : `${player.connected ? "online" : "reconnecting"} · ${movement} movement`;
  return `<div class="player ${index === state.you ? "you" : ""} ${player.ready ? "ready" : ""}"><div class="player-name">${escapeHtml(player.name)}${index === state.you ? " · you" : ""}</div><div class="player-meta">${meta}</div></div>`;
}

function lobbyHtml(activeMotion = null) {
  const me = state.players[state.you];
  const canStart = state.isHost && state.players.length === 2 && state.players.every(player => player.connected && player.ready);
  const slots = [0, 1].map(index => {
    const player = state.players[index];
    return player ? `<article class="lobby-agent ${player.ready ? "ready" : ""}"><span class="lobby-avatar">${index === 0 ? "A" : "B"}</span><div><b>${escapeHtml(player.name)}${index === 0 ? " · Host" : ""}</b><small>${player.connected ? player.ready ? "Ready for briefing" : "Choosing loadout" : "Reconnecting…"}</small></div><span class="ready-light"></span></article>` : `<article class="lobby-agent empty"><span class="lobby-avatar">?</span><div><b>Open agent slot</b><small>Share the room code to invite a rival</small></div><span class="ready-light"></span></article>`;
  }).join("");
  const hostAction = state.isHost ? `<button class="primary launch-button" id="start-match" ${canStart ? "" : "disabled"}>${state.players.length < 2 ? "Waiting for rival" : canStart ? "Launch mission" : "Waiting for both agents"}</button>` : `<div class="lobby-wait"><span class="signal-mini"></span>${state.players.length < 2 ? "Waiting for another agent" : "The host will launch when both agents are ready"}</div>`;
  const joined = state.players.length === 2;
  const bothReady = joined && state.players.every(player => player.ready);
  return `<section class="lobby-panel ${activeMotion === "ready" ? "ready-change" : ""}"><div class="lobby-heading"><span class="eyebrow">Secure lobby</span><h2>Get both agents ready</h2><p>Share the code, mark yourself ready, then the host launches the mission.</p></div><ol class="lobby-steps" aria-label="Lobby progress"><li class="done"><b>1</b><span>Room created</span></li><li class="${joined ? "done" : "current"}"><b>2</b><span>${joined ? "Rival joined" : "Invite rival"}</span></li><li class="${bothReady ? "done" : joined ? "current" : ""}"><b>3</b><span>${bothReady ? "Both ready" : "Ready up"}</span></li></ol><div class="lobby-code"><span>Room code</span><strong>${state.room}</strong><button class="icon-btn" id="share" aria-label="Share room invitation" title="Copy or share invitation">⧉</button></div><div class="lobby-agents">${slots}</div><button class="ready-button ${me.ready ? "is-ready" : ""}" id="toggle-ready" aria-pressed="${me.ready}"><span>${me.ready ? "✓" : "○"}</span><b>${me.ready ? "You are ready" : "Mark me ready"}</b><small>${me.ready ? "Tap to cancel" : "Required before launch"}</small></button>${hostAction}</section>`;
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
  const nodes = Array.from({ length: BOARD_SPACES }, (_, i) => { const point = position(-90 + i * (360 / BOARD_SPACES)); const home = i === 0 ? " start-a" : i === 6 ? " start-b" : ""; return `<i class="orbit-node route${home}" style="--x:${point.x}%;--y:${point.y}%"><small>${i + 1}</small>${home ? `<em>${i === 0 ? "A" : "B"}</em>` : ""}</i>`; }).join("");
  const moved = player => `${player.progress > 0 ? "+" : ""}${player.progress} moved`;
  const movement = movementNotice ? `<section class="movement-notice" role="status" aria-live="polite"><div class="resolution-title"><span>Last exchange</span><b>Who took what</b></div>${movementNotice.map(({ playerIndex, kind, delta, fromSpace, toSpace }) => { const index = Math.min(2, Math.max(0, Number(state.players[playerIndex].collection[kind] || 1) - 1)); const effect = contactStageEffect(kind, index, delta); const result = effect.className === "movement" ? delta === 0 ? "Stayed in place" : `Moved ${delta > 0 ? "+" : ""}${delta} ${Math.abs(delta) === 1 ? "space" : "spaces"}` : effect.label; return `<article class="movement-chip contact-${kind}"><i>${effect.className === "movement" ? CONTACTS[kind].symbol : effect.icon}</i><div><b>${escapeHtml(state.players[playerIndex].name)} took ${CONTACTS[kind].name}</b><small>${result}</small></div><em><small>Board</small>${fromSpace} <span>→</span> ${toSpace}</em></article>`; }).join("")}</section>` : "";
  const movedPlayers = new Set(movementNotice?.map(item => item.playerIndex) || []);
  return `<div class="orbit-wrap ${danger ? "danger-zone" : ""}" role="img" aria-label="Twelve-space clockwise pursuit board. Agents are ${gap} relative spaces from interception."><div class="orbit-caption"><b>${danger ? "Danger zone" : "Clockwise chase"}</b><span>${danger ? `${gap} ${gap === 1 ? "space" : "spaces"} from interception` : "Gain 6 spaces on your rival"}</span></div><div class="orbit-board"><div class="orbit-ring"></div>${nodes}<div class="orbit-direction" aria-hidden="true">↻</div><div class="orbit-agent agent-a ${movedPlayers.has(0) ? "just-moved" : ""}" style="--x:${a.x}%;--y:${a.y}%"><span>A</span></div><div class="orbit-agent agent-b ${movedPlayers.has(1) ? "just-moved" : ""}" style="--x:${b.x}%;--y:${b.y}%"><span>B</span></div><div class="orbit-center"><strong>${gap}</strong><span>${danger ? "spaces left" : "spaces gained"}<br>to intercept</span></div></div>${movement}<div class="orbit-legend"><span><i class="agent-dot a"></i><b>${escapeHtml(state.players[0].name)}</b><small>Space ${positions[0] + 1} · ${moved(state.players[0])}</small></span><span><i class="agent-dot b"></i><b>${escapeHtml(state.players[1].name)}</b><small>Space ${positions[1] + 1} · ${moved(state.players[1])}</small></span></div></div>`;
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

function resultRecapHtml() {
  const totalContacts = state.players.reduce((sum, player) => sum + Object.values(player.collection).reduce((count, value) => count + value, 0), 0);
  const leader = state.players[state.winner];
  const top = Object.entries(leader.collection).sort((a, b) => b[1] - a[1])[0];
  const gap = interceptionGap(state.players);
  const profile = playMode === "bot" ? `<span><small>Rival level</small><b>${BOT_PROFILES[botProfile].label}</b></span>` : "";
  return `<div class="result-recap" aria-label="Match recap"><span><small>Final chase gap</small><b>${gap} ${gap === 1 ? "space" : "spaces"}</b></span><span><small>Contacts recruited</small><b>${totalContacts}</b></span>${top ? `<span><small>Winning network</small><b>${CONTACTS[top[0]].symbol} ${CONTACTS[top[0]].name} ×${top[1]}</b></span>` : ""}${profile}</div>`;
}

function renderGame() {
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
    const particles = celebrate ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${4 + (i * 37) % 92}%;--delay:${(i * -.12).toFixed(2)}s"></i>`).join("")}</div>` : "";
    const rematchLabel = playMode === "wifi" ? state.youRematch ? `Waiting for rival · ${state.rematchVotes}/2` : "Request rematch" : "Play again";
    playArea = `<div class="panel result ${celebrate ? "victory" : "defeat"}">${particles}<div class="result-rings" aria-hidden="true"></div><div class="result-badge">${celebrate ? "◆" : "◇"}</div><span class="eyebrow">${celebrate ? "Mission complete" : "Mission compromised"}</span><h2>${resultTitle}</h2><p class="lede">${escapeHtml(state.resultReason)}</p><div class="result-summary"><span><small>Winning agent</small><b>${escapeHtml(winner.name)}</b></span><span><small>Net movement</small><b>${winner.progress > 0 ? "+" : ""}${winner.progress}</b></span></div>${resultRecapHtml()}<div class="result-actions"><button class="primary" id="again" ${state.youRematch ? "disabled" : ""}>${rematchLabel}</button><button class="secondary" data-home>Return home</button></div></div>`;
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
  const matchStatus = `<section class="panel match-status"><div class="room-head"><div><span class="eyebrow">${modeLabel}</span><div class="room-code">${roomTitle}</div></div>${playMode === "wifi" ? `<button class="icon-btn" id="copy" aria-label="Copy invitation">⧉</button>` : ""}</div><div class="players">${state.players.map(playerBox).join("")}</div></section>`;
  if (state.phase === "lobby") {
    app.innerHTML = shell(`${matchStatus}<div class="game-layout lobby-layout" id="play-area"><section>${playArea}</section></div>`) + revealOverlayHtml();
  } else {
    const board = state.players.length === 2 ? trackHtml() : "";
    const networks = state.players.length === 2 ? `<aside class="network-panel ${movementNotice ? "network-updated" : ""}" aria-label="Agent networks"><div class="collections">${state.players.map(collectionHtml).join("")}</div></aside>` : "";
    app.innerHTML = shell(`<div class="match-layout ${state.winner !== null ? "is-result" : ""}">${matchStatus}<div class="board-panel">${board}</div><section class="play-column motion-${activeMotion || "steady"}" id="play-area"><div class="play-content">${playArea}</div></section>${networks}</div>`) + revealOverlayHtml();
  }
  bindCommon();
  document.querySelector("#continue-resolution")?.addEventListener("click", finishReveal);
  document.querySelector("#ready-player")?.addEventListener("click", () => { localHandoff = false; render(); });
  document.querySelector("#copy")?.addEventListener("click", shareRoom);
  document.querySelector("#share")?.addEventListener("click", shareRoom);
  document.querySelector("#again")?.addEventListener("click", () => send("rematch"));
  document.querySelector("#toggle-ready")?.addEventListener("click", () => send("ready", { ready: !state.players[state.you].ready }));
  document.querySelector("#start-match")?.addEventListener("click", () => send("start"));
  document.querySelectorAll(".hand .card").forEach(el => el.addEventListener("click", () => selectCard(el.dataset.card)));
  document.querySelector("#offer")?.addEventListener("click", () => send("offer", { openId: faceUpId, hiddenId: selected.find(id => id !== faceUpId) }));
  document.querySelector("#swap-card")?.addEventListener("click", () => { swapMode = !swapMode; selected = []; faceUpId = null; renderGame(); });
  document.querySelectorAll("[data-choice]").forEach(el => el.addEventListener("click", () => send("choose", { choice: el.dataset.choice })));
}

function selectCard(id) {
  const card = state.hand.find(item => item.id === id);
  if (swapMode) { swapMode = false; playSound("select"); return send("swap", { cardId: id }); }
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
connect();
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
