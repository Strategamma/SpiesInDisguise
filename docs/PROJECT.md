# Project memory

## Product
`Spies in Disguise` is an installable two-player bluffing game for decadenceinc.com. It is inspired by the public “one face-up, one face-down; opponent chooses” mechanism, not an official Agent Avenue adaptation. Do not use Agent Avenue names, copy, artwork, or branding without a license.

## Architecture
- Static PWA in `public/`: semantic HTML, CSS, and dependency-free browser JavaScript.
- `.github/workflows/pages.yml` publishes `public/` to GitHub Pages on pushes to `main`; repository Pages source must be GitHub Actions.
- `public/local-game.js` powers offline Bot and privacy-gated pass-and-play modes; Wi-Fi mode continues to use the authoritative server.
- Authoritative multiplayer gateway in `server/`: Node.js + `ws`, also serves `public/` for local testing or a single-service deployment.
- The browser connects to `wss://spiesindisguise.onrender.com`; `public/config.js` can override it.
- Ephemeral rooms use six-character codes. Opt-in public lobbies expose only the connected waiting host’s codename and room code; private rooms stay undiscoverable. Reconnect tokens are local. No accounts or persistent personal data.
- Online rooms use a server-authoritative lobby: both players ready, host starts, then hands are dealt. Protocol `3` enables volatile cards; older rooms retain the core deck.

## Game rules
Two players begin six spaces apart on a 12-space clockwise loop. The 38-card core has six recurring contacts (six copies each) and two unique contacts. The default 42-card deck adds one Jammer, Cleaner, Mimic, and Slingshot; paired effects resolve simultaneously from the pre-move state. Before offering, each player may exchange a card face-down up to four times. The active player offers two different contacts, one open and one concealed; a same-name pair is legal only when every hand card matches. The opponent chooses one and the active player gets the other. Recruits apply signed stage movement. Gaining six spaces intercepts. Three Oracles wins; three Renegades loses. Resolve outcomes after both movements; the active player wins ties. Empty-deck play continues until the next player cannot offer two cards. Official advanced-market and team variants are not implemented.

## Conventions
- Server is the sole authority for hands, offers, turns, movement, and outcomes.
- Never send an opponent's hand or concealed offer card to a client.
- Server emits reveal before updated state; concealed identities never appear pre-choice.
- Touch targets are at least 44px; primary play fits narrow phones.
- Persistent Home/Play/Rules navigation is shared across screens; leaving an unfinished match requires confirmation.
- Audio starts after a user gesture; mute and reduced-motion preferences are honored.
- Board position is cumulative movement modulo 12; player two starts at index 6. Relative movement of ±6 triggers interception.
- Installed mobile PWA orientation is landscape-primary; browsers that cannot lock orientation receive an in-match rotate prompt.
- Live matches use one status/board/action/network layout: a two-column table from 900px and action-led flow below it.
- Cards prioritize current space, signed movement, and landing space; descriptions stay in tooltips, accessibility labels, and dossiers.
- Keep visible copy concise and game-native.

## Current state
Playable 1v1 PWA with training, bots, offline modes, public/private lobbies, reconnection, telemetry, and monitoring.
