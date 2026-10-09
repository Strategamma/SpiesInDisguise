Original prompt: Ok now let's work on the game UI. Add a how to play section. Make the UI clean, mobile first and easy to understand. Design the cards better

- Started UI audit. Preserve game logic, hidden-information behavior, existing brand mark, and navy/mint visual direction.
- Added visible home onboarding, a detailed three-step field briefing, explicit win/loss conditions, and a full contact dossier.
- Redesigned cards around contact identity, short effect copy, labeled 1st/2nd/3rd movement, clear selection/revealed states, and a simpler concealed card.
- Reworked the mobile hand into a two-column grid and clarified the two-step offer flow.
- Syntax and all five rules tests pass. Added concise `render_game_to_text` and time-step hooks for game-state QA.
- Screenshot runner could not launch Chromium because macOS denied its Mach rendezvous service inside the execution sandbox. No screenshot was produced; do not claim visual QA completed.
- TODO: visually check home, rules dialog, and bot hand at 320–430px when browser execution is available; verify there are no overflow or sticky-action issues.
- Replaced the linear track with a circular 24-node signal ring. The active half represents the same 12-space gap; agents converge at the top interception point when combined progress reaches 12.
- Updated rules and onboarding copy to describe the ring and interception objective. Game math remains unchanged.
- Verified all marker coordinates remain within the ring and all 13 combined-progress winning splits converge. The Playwright retry was again blocked before launch by macOS Mach service permissions, so circular-board screenshot inspection remains pending.
- Added a persistent Home/Play/Rules dock with screen-aware active state and scroll destinations. Active matches use a confirmation dialog before Home clears game or room state.
- Navigation binding checks, syntax, server response, and all rules tests pass. The Playwright navigation attempt was again blocked before page launch by macOS Mach service permissions; visual navigation QA remains pending.
- Started splash/gameplay/finale polish. Audio will use synthesized Web Audio cues behind a persistent mute control; no media dependency or autoplay is introduced.
- Added an authoritative online lobby: no pre-dealt hands, two ready flags, connected-player checks, host-only start, guest/host leave handling, and rematch vote status.
- Added a tap-to-enter splash, persisted sound toggle, synthesized cues, board/offer transitions, and distinct animated victory/defeat screens. Bumped the offline shell cache to v2.
- Added protocol-2 identification and legacy auto-start fallback so separate Pages/Render deployments cannot strand cached pre-lobby clients.
- Seven automated tests pass, including lobby authorization/readiness and legacy compatibility. Two-socket checks passed for ready/start, hand dealing, guest slot reopening, and host lobby closure. Playwright still cannot launch under the macOS Mach service restriction, so visual/audio browser QA remains pending.

## 2026-10-08 — Recruitment preview and reveal flow
- Added recipient-specific `Next` highlighting for the applicable 1st/2nd/3rd card effect.
- Added authoritative post-choice reveal events, concealed-card flip, card transfer animation, and reveal sound for online, bot, and pass-and-play games.
- Verified online privacy and ordering with two WebSocket clients: hidden identity absent before choice, reveal received before state, identities correct, and recruitment applied.
- Added a focused stage-calculation test. Playwright visual QA remains blocked by macOS sandbox Mach-port permission denial; manual device preview is still required.

## 2026-10-08 — Full interface refinement
- Audited the supplied desktop capture and all shared screen components. The main issues were oversized mode cards, detached affordances, badge/title competition, a visually heavy tutorial panel, low secondary-text contrast, and an over-dominant bottom dock.
- Compacted and normalized home modes, onboarding, navigation, setup forms, game panels, lobby, cards, dialogs, collections, reveal, and result states across 320px mobile through desktop layouts.
- Increased muted-text contrast, strengthened focus/hover/pressed feedback, protected sticky controls from the bottom dock, and bumped the offline cache to v4.
- Fixed inert waiting-state cards so they no longer send invalid choices, and synchronized the Rules navigation item with the dialog's visual and accessible state.
- Eight automated tests, syntax, CSS balance, local server, and static asset checks pass. Playwright remains blocked before launch by the macOS Mach-port sandbox restriction, so no automated screenshots were produced.

## 2026-10-08 — Responsive match table
- Replaced the disconnected board/action/sidebar composition with semantic status, board, play, and network regions.
- Wide screens now use a 310–330px overview rail beside a contained action surface; tablets use a balanced overview row; phones collapse to a compact single-column match flow with two-column cards and networks.
- Kept waiting, handoff, offer, reveal, and result states inside the same responsive structure. Bumped the offline cache to v5.
- Syntax, eight rules tests, CSS balance, and local server assets pass. The required Playwright retry was again blocked before launch by macOS Mach-port permission denial, so visual screenshot QA remains manual.

## 2026-10-08 — Twelve-space clockwise chase
- Changed server and local rules from combined movement to signed relative movement: both agents travel clockwise on 12 spaces, start six apart, and intercept after gaining six spaces on the rival.
- Rebuilt board geometry as 12 numbered nodes with shared clockwise movement, wrapped negative positions, relative-gap feedback, and position-aware legends.
- Declared landscape-primary for the installed PWA, request landscape after mobile game gestures where supported, added a portrait rotate prompt, and compacted short-landscape gameplay. Bumped the cache to v6.
- Added a portrait escape action for browsers that cannot rotate, while retaining the responsive portrait layout. Eleven automated tests, syntax, manifest parsing, CSS balance, and the local server pass; Playwright remains blocked by the macOS Mach-port sandbox restriction.

## 2026-10-09 — Base rules and board comprehension
- Audited the published two-player simple rules. Added the 38-card movement balance, two unique contacts, four face-down exchanges per player, correct simultaneous resolution/ties, and next-player deck exhaustion behavior to local and online engines. Advanced-market and 3–4-player team variants remain intentionally outside this two-player build.
- Added post-reveal board feedback showing each recipient, recruited contact, and signed movement; moved agents pulse on the loop. The board now labels direction, objective, and both start nodes.
- Public network chips show ownership counts, provide hover summaries, and open a tap/click dossier with the full movement curve and highlighted next effect. No private hand or concealed card data is exposed.
- Sixteen automated tests, syntax, CSS/manifest structure, diff hygiene, and local health/assets pass. Automated visual QA remains unavailable: Playwright has no browser binary and the browser UI blocks localhost by saved policy, so phone/tablet visual inspection is still manual.

## 2026-10-09 — Position-first card UI
- Replaced persistent card descriptions with an immediate route preview: recipient’s current board space, signed movement/direction, and projected landing space. Negative, zero, wraparound, and recipient-specific positions share tested projection logic.
- Kept identity, copy stage, special Oracle/Renegade stakes, and a compact movement curve visible. Full descriptions remain in accessible labels/tooltips and existing dossiers. Concealed cards now use shorter action copy.
- Bumped the offline cache to v8. Seventeen tests, syntax, CSS/manifest structure, diff hygiene, and local health pass. Chromium installed successfully for the required screenshot loop, but macOS denied its Mach rendezvous service, so no screenshot was produced and manual visual QA remains required.

## 2026-10-09 — Terminal card icons
- Replaced Oracle’s third-stage zero with a mint star/Win outcome and Renegade’s with a red cross/Lose outcome on playable cards, route previews, Rules, public dossiers, network summaries, and post-recruit board feedback. Movement math remains zero internally.
- Bumped the offline cache to v9. Eighteen automated tests pass, including direct outcome-display assertions. Playwright remains blocked at Chromium launch by the macOS Mach rendezvous permission, so screenshot inspection remains manual.

## 2026-10-09 — State-aware game motion
- Added staggered hand deals, paired offer entrances, next-effect focus, card lift/press feedback, turn sweeps, action-bar arrival, ready confirmation, recruited-network pops, dialog entrances, delayed movement chips, and terminal-outcome emphasis. Existing board travel, concealed flips, transfers, and results remain the strongest sequences.
- Motion cues derive from meaningful state transitions and are consumed after one render, preventing full entrances from replaying during ordinary card selection. Global reduced-motion handling remains intact.
- Bumped the offline cache to v10. Nineteen tests pass, including motion-cue selection/idle behavior; syntax, CSS structure, local health, and diff checks pass. Playwright remains blocked by the macOS Mach rendezvous permission, so motion screenshot inspection remains manual.

## 2026-10-09 — Production gateway monitoring
- Expanded `/health` with version, uptime/startup duration, capacity, active room/socket gauges, and aggregate connection/error/room counters. WebSocket server, socket, protocol, and room-capacity failures now emit structured JSON logs without player or room identifiers.
- Added an hourly/manual GitHub Actions monitor that measures HTTP cold-start latency, verifies a real protocol-2 WebSocket lobby, cleans up its room, and fails on health/protocol errors or latency above 30 seconds. `MONITOR_URL`, timeout, and threshold are configurable.
- Verified the monitor completes against a local gateway, removes its room, exposes safe counters, increments malformed-message errors, and records a forced room-capacity failure. Full tests and syntax checks remain required before completion.
