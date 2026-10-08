# Project memory

## Product
`Spies in Disguise` is a mobile-first, installable two-player bluffing card game for decadenceinc.com. It is an original game inspired by the public “one face-up, one face-down; opponent chooses” mechanism, not an official Agent Avenue adaptation. Do not use Agent Avenue names, copy, artwork, or branding without a license.

## Architecture
- Static PWA in `public/`: semantic HTML, CSS, and dependency-free browser JavaScript.
- `public/local-game.js` powers offline Bot and privacy-gated pass-and-play modes; Wi-Fi mode continues to use the authoritative server.
- Authoritative multiplayer gateway in `server/`: Node.js + `ws`, also serves `public/` for local testing or a single-service deployment.
- The browser connects through `window.SPIES_IN_DISGUISE_GATEWAY` in `public/config.js`; otherwise it derives `ws://`/`wss://` from the current host. The legacy `SHADOW_CIRCUIT_GATEWAY` override remains accepted.
- Rooms are ephemeral/in-memory, addressed by a six-character code. A private reconnect token is stored in local storage. No accounts or persistent personal data.

## Game rules
Two players begin 12 spaces apart. Each turn the active player offers two different contacts, one openly and one concealed. The opponent takes either card; the active player gets the other. Recruiting the 1st/2nd/3rd copy applies that contact's corresponding movement. The first side whose combined progress closes the 12-space gap wins. Three Oracles wins instantly; three Renegades loses instantly. Active player wins simultaneous outcomes. Hands refill to four.

## Conventions
- Server is the sole authority for hands, offers, turns, movement, and outcomes.
- Never send an opponent's hand or concealed offer card to a client.
- Touch targets are at least 44px; primary play flow fits a narrow phone viewport.
- Keep visible copy concise and game-native.

## Current state
Playable 1v1 PWA with a Decadence-style mode home, offline Bot, pass-and-play handoffs, online room links/reconnection, install guidance, offline shell caching, tested rules engines, and Render configuration.
