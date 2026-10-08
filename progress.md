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
