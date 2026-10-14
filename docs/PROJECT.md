# Project memory

## Product
`Spies in Disguise` is an installable two-player bluffing game for decadenceinc.com. It is inspired by the public “one face-up, one face-down; opponent chooses” mechanism, not an official Agent Avenue adaptation. Preserve original branding; no licensed Agent Avenue assets.

## Architecture
- Static PWA in `public/`: semantic HTML, CSS, and dependency-free browser JavaScript.
- `.github/workflows/pages.yml` publishes `public/` to GitHub Pages on pushes to `main`; repository Pages source must be GitHub Actions.
- `public/local-game.js` powers offline Bot and privacy-gated pass-and-play modes; Wi-Fi mode continues to use the authoritative server.
- Authoritative multiplayer gateway in `server/`: Node.js + `ws`, also serves `public/` for local testing or a single-service deployment.
- Internet uses `public/config.js` (Render). Same-Wi-Fi uses the locally hosted origin with `network=lan`; `/api/lan-addresses` lists host addresses. Both devices need the reachable local server; no browser discovery.
- Six-character ephemeral rooms; public lobbies expose only waiting hosts. Guest names are optional. Invitations join directly; endpoint-scoped local tokens restore seats.
- Online rooms use a server-authoritative lobby: both players ready, host starts, then hands are dealt. Protocol `3` enables volatile cards; older rooms retain the core deck.

## Game rules
Two players begin six spaces apart on a 12-space clockwise loop. The 38-card core has six recurring contacts (six copies each) and two unique contacts. The default 42-card deck adds one Jammer, Cleaner, Mimic, and Slingshot; paired effects resolve simultaneously from the pre-move state. Up to four face-down exchanges before offering. Offer two different contacts, open/concealed; duplicates only if the whole hand matches. The opponent chooses one and the active player gets the other. Recruits apply signed stage movement. Gaining six spaces intercepts. Three Oracles wins; three Renegades loses. Resolve outcomes after both movements; the active player wins ties. Empty-deck play continues until the next player cannot offer two cards. No market/team variants.

## Conventions
- Server is the sole authority for hands, offers, turns, movement, and outcomes.
- Never send an opponent's hand or concealed offer card to a client.
- Server emits reveal before updated state; concealed identities never appear pre-choice.
- Touch targets are at least 44px; primary play fits narrow phones.
- Compact sticky top navigation uses Home/Play/Rules, 44px targets, and an active underline; match exit requires confirmation.
- Audio starts after a user gesture; mute and reduced-motion preferences are honored.
- Board position is cumulative movement modulo 12; player two starts at index 6. Relative movement of ±6 triggers interception.
- Portrait and landscape both work without rotation prompts; home opens directly.
- Matches: two columns from 900px; action-led mobile flow.
- Cards show current/movement/landing spaces; details in dossiers and accessibility labels.

## Current state
Playable 1v1 PWA with bots, offline modes, lobbies, reconnects, and monitoring. Lobby host exit transfers ownership; explicit match exit closes the room. Replaced connections clear authority/reveals; gateway switches cancel requests; no mid-match rematch. All-disconnected rooms expire after 15 minutes. Internet deployment currently runs an older waiting-room protocol; deploy updated server for lobby/lifecycle parity.
