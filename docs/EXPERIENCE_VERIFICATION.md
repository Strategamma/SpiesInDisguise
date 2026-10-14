# Experience improvement verification

Implementation follow-up: 2026-10-15. All 43 audit IDs have a corresponding correction or design improvement; individual evidence and remaining acceptance gates are in `../plan.md`. The original game rules and dependency-free architecture remain intact. No deployment was performed.

## Automated verification

- 46 tests pass. JavaScript syntax checks and `git diff --check` pass. This static project has no separate bundler/typecheck step.
- 250 seeded full matches compare local and authoritative server state after every exchange: collections, movement, last-movement effects, recruit counts, hands, deck, swaps, turn, winner, reason and applied recaps. Each save round-trip is checked; rematches reset counts/recaps and alternate offline starters.
- Private-data access regressions reject bot reads of concealed contacts, rival hands or draw pile. Bot offer variation and optional exchanges stay legal.
- Gateway integration covers malformed paths without a crash, readiness/start authority, duplicate starts, full rooms, connection replacement, disconnection/rejoin, complete matches/rematches, authenticated delayed leave, wrong tokens, host-loss takeover, codename validation and room-create throttling.
- Client regressions cover terminal reconnect recovery, stale reveal cancellation, peer-update draft preservation, gateway switching, invitation routing, missing/ambiguous LAN interfaces, offer editing, reduced-motion scrolling and bounded home retries, and ignored stale room messages after exit/offline-mode changes.
- Offline saves reject corrupt/future schemas; worker activation preserves unrelated game caches.

## Browser playtests

Used separate clients at loopback and the host's reachable private IP on the same computer. This verifies actual WebSocket routing and separate origin-scoped seats, not a physical two-device Wi-Fi session.

- Played a bot match to victory and a pass-and-play match to results; rematched both. The bot opened the next mission; the second named local player opened the shared-device rematch.
- Reloaded bot and shared-device games. Resume restored progression; shared-device hands stayed hidden behind the named handoff.
- Created a local room, opened its invitation directly in a second client, marked ready, started, played to results, and rematched without changing the room/group.
- Reload/reconnection preserved the rival's partially built offer. Rules stayed open during a peer readiness update. A late entrant received a recovery screen.
- HTTP clipboard fallback exposed a selectable invitation and room code during a match. Distinct default names and accountless lobby renaming worked.
- Restarted the in-memory gateway: clients discarded the vanished room, showed a clear recovery message and could create a fresh room.
- Reveal remained open until Continue/Escape; Tab and Shift+Tab stayed inside the modal. Win celebration did not replay when mute caused a repaint. Applied Jammer/push summaries and decisive results were visible.
- Checked 320×568, 844×390 and desktop layouts. Narrow/short layouts had no horizontal overflow; measured visible buttons were at least 44px in both dimensions. Full labels wrap. Browser warning/error logs were empty during tested flows.
- Browser QA found and corrected retained screen scroll, crowded effect summaries, an unused landscape column and modal focus escaping to browser chrome.

## Release gates

The public Render health check timed out after both 15-second and 45-second checks; Internet deployment parity and full remote gameplay remain unverified. Physical phone touch/coarse-pointer layouts, safe areas, real two-device Wi-Fi, screen-reader output, audible/haptic hierarchy and human fun/balance still require device/player checks. Native sharing and installed-PWA update/offline behavior were not exercised.

Local gateway startup logged 10–11ms. This is a server startup measurement, not a phone frame-rate benchmark. No unsupported performance claim is made.
