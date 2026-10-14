# Project memory

## Product
Spies in Disguise is an accountless, installable two-player bluffing game for decadenceinc.com. Preserve its original contact identities, mint/violet spy theme and parent-collection link; it is not an official Agent Avenue adaptation.

## Architecture
Dependency-free semantic DOM/CSS/JavaScript PWA in `public/`. `public/local-game.js` owns offline bot/pass-and-play rules; `server/game.js` owns online rules; Node + `ws` gateway also serves static assets. `public/ui-logic.js` derives public display summaries. No render loop or engine framework.

GitHub Actions publishes `public/` to Pages on main; Render is configured in `public/config.js`. `SPIES_IN_DISGUISE_PUBLIC_URL` defines Internet invitation frontend when hosted locally. Same-Wi-Fi uses the local host origin and `/api/lan-addresses`; both devices need the reachable server. Browsers do not discover local servers. Multiple interfaces require explicit selection, with no loopback invitation fallback.

## Rules
42 cards: 38-card core plus one each Jammer, Cleaner, Mimic and Slingshot. Protocol 3 enables volatile contacts; older clients keep the core deck. Offer two different contacts, one visible/one concealed, unless the whole hand matches. Chooser recruits one, offerer the other. Simultaneous effects use pre-move state. Cleaner removes only its recipient’s Renegade. A 12-space loop begins six spaces apart; six relative movement intercepts. Three Oracles win, three Renegades lose, active offerer wins ties. Four optional exchanges; empty-deck play continues until next player cannot offer two cards.

## Lifecycle and privacy
Server-authoritative ready lobby; host starts only when both connected/ready. Six-character ephemeral rooms; endpoint-scoped tokens restore seats. Lobby host loss transfers after 30-second grace when a survivor remains. Explicit match exit closes the room; all-disconnected rooms expire after 15 minutes. Rooms remain in memory; server restart requires new rooms. Authenticated queued leave intents release disconnected seats on reconnect. Per-connection action/create limits supplement payload/room limits.

Never expose rival hands or concealed identity pre-choice. Bots use only their hand and public estimates. Views copy mutable data. Match IDs reset feedback; public applied exchange summaries include pushes, removals and resolved outcome. Recruitment counts survive Cleaner removal.

## Experience conventions
44px minimum controls; decision-first phone layout; compact top Home/Play/Rules navigation. Native modal dialogs preserve focus and open state on updates. Reveals advance manually; celebration fires once per match. Respect reduced motion and mute; no hover audio. Editable guest names, A/B seat labels, privacy-gated shared-device handoff. Versioned/validated offline saves resume explicitly; offline rematches alternate opener. Offline saves never authorize online seats.

## Verification boundary
Local tests and browser multiplayer pass; live Render health timed out. Deployment parity, physical Wi-Fi/phones, audible feedback, assistive technology and human fun/balance remain release gates.
