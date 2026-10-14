# Goal
Resolve all 43 audited issues while preserving rules, hidden information, multiplayer authority, and original branding.

# Scope
Game correctness; fair bots; results; hosting/reconnect/security; offline recovery; accessible input/dialogs; phone layout/onboarding; rewarding outcomes. Keep external device/deployment evidence separate from implementation.

# Approach
Work sequentially: reproduce → smallest correction → regression check → record evidence. Follow audit IDs; related fixes may share tested state helpers. Keep versioned local saves offline-only. Use safe lobby takeover after a grace period, structured terminal errors, endpoint-aware links, and focused UI announcements. No engine migration or new dependencies planned.

# Risks
Rules parity, stale async callbacks, revealing concealed identities, save corruption, host-seat migration, throttle false positives, modal focus, and responsive crowding. Never mark a device/service check verified from source alone.

# Verification
Baseline: 31 tests pass. Add defect-focused tests, server integration and local/server parity scenarios. Play full bot/pass-and-play/multiplayer flows with separate clients. Inspect 320px portrait, short landscape, desktop, keyboard and reduced motion where supported. Verify deployment/service separately; physical touch, audible feedback, assistive technology and human fun ratings require explicit evidence.

# Issue tracking
| ID | Issue | State / evidence |
|---|---|---|
| 1 | Bots know concealed cards | Verified: private-data getter regression; fair public estimates |
| 2 | Offline recaps show the next recruitment stage | Verified: immutable snapshots, applied-summary tests; browser reveal |
| 3 | Combined contact effects are incompletely explained | Verified: simultaneous-effects parity; Jammer browser recap |
| 4 | Last exchange survives rematches | Verified: match IDs/reset; offline and two-client rematches |
| 5 | Offer editing contradicts instructions | Verified: replacement/reveal/remove regression and browser editing |
| 6 | Recruit totals undercount after Cleaner | Verified: recruitment counters across 250 rule-parity matches |
| 7 | Chase gap uses the wrong label | Verified: spaces-left label in browser |
| 8 | Celebration restarts on unrelated renders | Verified: mute repaint produces no repeated confetti |
| 9 | Malformed URLs crash the gateway | Verified: malformed URL returns 400; gateway remains healthy |
| 10 | Expired-room reconnection retains stale match UI | Verified: terminal-error regression and server-restart browser recovery |
| 11 | Leaving while disconnected does not notify the room | Verified: authenticated pending-leave integration; invalid token cannot release a seat |
| 12 | Host migration covers explicit exit only | Verified: grace-period takeover integration; lobby guidance; physical loss pending |
| 13 | Peer updates erase an unfinished offer | Verified: peer-update regression and browser reconnection preserves draft |
| 14 | Connection failure has no bounded recovery | Verified: bounded-home-retry regression; deadline/backoff; offline alternative |
| 15 | Internet invitations created locally use an unreachable origin | Implemented/tested: public Internet URL; live gateway health timeout |
| 16 | LAN invitations may select the wrong interface | Verified in unit scenarios: ambiguous address requires selection; LAN host-IP browser path |
| 17 | Missing LAN addresses do not block unusable invitations | Verified in unit scenarios: no address produces no invitation/create action |
| 18 | Gateway choice is lost on local home reload | Verified: stored network choice and network query survive browser reload |
| 19 | Copy controls may open Share instead | Verified: Copy invokes clipboard separately from Share; HTTP fallback |
| 20 | In-match sharing fallback points to a missing field | Verified: in-match HTTP invitation dialog has usable link/code |
| 21 | Public gateway has no action throttling | Verified: per-connection action/create limits; room-create throttle integration |
| 22 | PWA activation deletes unrelated caches | Verified: worker activation preserves other games caches |
| 23 | Offline matches cannot resume after reload | Verified: versioned save validation, 250 round trips, bot/local browser reloads |
| 24 | Live updates dismiss open dialogs | Verified: Rules stays open during peer readiness update; modal restoration |
| 25 | Reveal overlay is not keyboard-modal | Verified: native modal, Tab/Shift+Tab containment, Escape advancement |
| 26 | New screens lack a reliable initial focus | Verified: named handoff, decision and result focus in browser |
| 27 | Reduced-motion scrolling remains animated | Verified in unit/source: reduced-motion scroll behavior and animation guards |
| 28 | Short-landscape controls fall below 44px | Verified: visible buttons >=44px at 320x568 and 844x390; physical touch pending |
| 29 | Board accessibility description omits key detail | Verified: browser board description includes names, positions and progress |
| 30 | Whole-screen live announcements may be excessive | Implemented: focused status updates; whole-main live region removed; screen reader pending |
| 31 | Phone decisions sit below the board | Verified: decision-first 320px grid; phase changes scroll to play |
| 32 | Card names and secondary text lose readability | Verified: wrapping identities/effects, two-column phone hands; physical readability pending |
| 33 | Reveal reading time is forced | Verified: reveal stays until manual Continue or Escape; interrupted reveal offers exit |
| 34 | Mode selection is buried on phones | Verified: modes precede public lobbies; compact hero; Play navigation |
| 35 | Default player identification is ambiguous | Verified: A/B labels, distinct defaults, editable lobby/local names |
| 36 | Deck depletion is not visible during play | Verified: deck count and empty-deck guidance; parity covers exhaustion |
| 37 | Chase advantage is not explicit | Verified: named chase-advantage cue in browser |
| 38 | Onboarding teaches taps more than strategy | Verified: worked Analyst/Handler strategy example in Rules |
| 39 | Bot personalities are too deterministic | Verified: near-best legal bot variety and optional own-hand exchanges |
| 40 | Victory underplays the decisive action | Verified: complete solo/local/network wins show decisive exchange and immediate rematch |
| 41 | Defeat lacks a useful next-attempt lesson | Verified: two-client defeat shows learning cue and rematch |
| 42 | Offline rematches always give Player One the opening turn | Verified: bot opens second mission; local rematch opens with Agent Two |
| 43 | Routine hover tones may compete with important feedback | Implemented: deliberate-action audio only; hover tones removed; listening pending |

External gates: deployed frontend/gateway parity; physical phones/Wi-Fi; screen reader; audible/haptic feedback; human playtest.

Code pass complete. Final local suite: 46 tests, including 250 complete rule-parity/save-recovery matches. Verification detail: docs/EXPERIENCE_VERIFICATION.md. No publish/deployment was performed.
