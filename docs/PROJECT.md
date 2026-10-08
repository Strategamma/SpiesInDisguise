# Project memory

## Product
`Spies in Disguise` is a mobile-first, installable two-player bluffing card game for decadenceinc.com. It is an original game inspired by the public “one face-up, one face-down; opponent chooses” mechanism, not an official Agent Avenue adaptation. Do not use Agent Avenue names, copy, artwork, or branding without a license.

## Architecture
- Static PWA in `public/`: semantic HTML, CSS, and dependency-free browser JavaScript.
- `.github/workflows/pages.yml` publishes `public/` to GitHub Pages on pushes to `main`; repository Pages source must be GitHub Actions.
- `public/local-game.js` powers offline Bot and privacy-gated pass-and-play modes; Wi-Fi mode continues to use the authoritative server.
- Authoritative multiplayer gateway in `server/`: Node.js + `ws`, also serves `public/` for local testing or a single-service deployment.
- The browser connects to the deployed gateway at `wss://spiesindisguise.onrender.com` through `window.SPIES_IN_DISGUISE_GATEWAY` in `public/config.js`. The legacy `SHADOW_CIRCUIT_GATEWAY` override remains accepted.
- Rooms are ephemeral/in-memory, addressed by a six-character code. A private reconnect token is stored in local storage. No accounts or persistent personal data.
- Online rooms begin in a server-authoritative lobby. Both connected players must mark ready; only the host can start, and hands are dealt at launch.
- Browser room messages use protocol `2`; the server auto-starts protocol-1 rooms to keep cached pre-lobby clients compatible during rollout.

## Game rules
Two players begin 12 spaces apart. Each turn the active player offers two different contacts, one openly and one concealed. The opponent takes either card; the active player gets the other. Recruiting the 1st/2nd/3rd copy applies that contact's corresponding movement. The first side whose combined progress closes the 12-space gap wins. Three Oracles wins instantly; three Renegades loses instantly. Active player wins simultaneous outcomes. Hands refill to four.

## Conventions
- Server is the sole authority for hands, offers, turns, movement, and outcomes.
- Never send an opponent's hand or concealed offer card to a client.
- After a valid choice, the server emits a reveal event before the updated state; concealed identities must never appear in pre-choice state.
- Touch targets are at least 44px; primary play flow fits a narrow phone viewport.
- Persistent Home/Play/Rules navigation is shared across screens; leaving an unfinished match requires confirmation.
- Launch audio is synthesized with Web Audio after a user gesture; the mute preference is stored locally and reduced-motion is honored.
- The 12-space pursuit is visualized as a circular signal ring; this is presentation only and does not alter movement or win calculations.
- Live matches use one semantic status/board/action/network layout: a two-column game table from 900px and an action-led single-column flow below it.
- Keep visible copy concise and game-native.

## Current state
Playable 1v1 PWA with animated splash, optional sound, authoritative online lobbies, polished results, persistent navigation, circular board, onboarding, redesigned cards, next-recruit movement previews, post-choice card reveals/transfers, offline Bot/pass-and-play, reconnection, installation, offline caching, tested rules, and a live Render gateway.
