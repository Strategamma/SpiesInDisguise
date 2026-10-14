# Spies in Disguise — full experience audit

Original audit: 2026-10-14. Implementation follow-up: 2026-10-15; every item is tracked in `../plan.md`, with evidence in `EXPERIENCE_VERIFICATION.md`. Scope: current local source, recent independent playtest, gateway/PWA review. This is an issue inventory, not a claim that every possible defect has been discovered. Conditional risks and design opportunities are explicitly distinguished from reproduced defects. Previously fixed navigation/connection findings are excluded.

## Gameplay and result correctness

1. **[P1 · Confirmed] Bots know concealed cards.** Every difficulty evaluates game.offer.hidden when choosing, eliminating genuine solo bluffing. **Required outcome:** Restrict bot decisions to public information and plausible uncertainty. **Evidence:** public/local-game.js: chooseBotCard.

2. **[P1 · Confirmed/live] Offline recaps show the next recruitment stage.** A second Oracle was labelled victory and a first Ghost +2; localView collections mutate before recap calculation. **Required outcome:** Use immutable before/after snapshots and report the applied outcome. **Evidence:** public/local-game.js: localView; public/app.js: localAction, cardOutcomeText.

3. **[P2 · Confirmed] Combined contact effects are incompletely explained.** Recap text gives isolated movement but omits Jammer's rival push and Cleaner's removal. **Required outcome:** Summarize the complete resolved pair, not isolated predictions. **Evidence:** public/app.js: revealCardHtml, cardOutcomeText; both recruitPair implementations.

4. **[P2 · Confirmed/live] Last exchange survives rematches.** A new match with empty networks and zero movement still shows the previous exchange; online rematch state also does not clear the client recap. **Required outcome:** Reset all per-match feedback on a new match. **Evidence:** public/app.js: startLocal, state handler, movementNotice.

5. **[P2 · Confirmed] Offer editing contradicts instructions.** With two cards selected, tapping the revealed card does not remove it as its label promises; a third card clears both selections. **Required outcome:** Make replace, reveal, and remove behavior explicit and consistent. **Evidence:** public/app.js: selectCard, cardHtml.

6. **[P2 · Confirmed] Recruit totals undercount after Cleaner.** Contacts recruited is calculated from the surviving collection, excluding contacts removed by Cleaner. **Required outcome:** Track total recruitment events or label the statistic as contacts retained. **Evidence:** public/app.js: resultRecapHtml.

7. **[P2 · Confirmed] Chase gap uses the wrong label.** The board says spaces gained while displaying spaces still required to intercept. **Required outcome:** Use accurate remaining-distance wording. **Evidence:** public/app.js: trackHtml.

8. **[P3 · Confirmed] Celebration restarts on unrelated renders.** Result particles are rebuilt on sound changes or rematch-vote updates, restarting a supposedly brief celebration. **Required outcome:** Trigger celebration once per result. **Evidence:** public/app.js: renderGame, toggleSound.

## Connection, hosting, and offline reliability

9. **[P1 · Reproduced] Malformed URLs crash the gateway.** Requesting /%ZZ caused an uncaught URIError and server exit code 1. **Required outcome:** Reject malformed request paths inside error handling. **Evidence:** server/index.js: HTTP path decoding.

10. **[P1 · Confirmed] Expired-room reconnection retains stale match UI.** Join errors clear pendingRoom only when state is null; reconnecting to a deleted room with existing state keeps the old board and unusable room controls. **Required outcome:** Recognize terminal room errors and offer a fresh room. **Evidence:** public/app.js: connect error handler, resume.

11. **[P2 · Confirmed] Leaving while disconnected does not notify the room.** returnHome clears the local room reference without retaining a leave intent when the socket is closed; the rival keeps a disconnected reserved seat. **Required outcome:** Deliver a pending leave on reconnection or expire departed seats gracefully. **Evidence:** public/app.js: returnHome.

12. **[P2 · Confirmed] Host migration covers explicit exit only.** A disconnected lobby host retains host authority indefinitely while a connected guest cannot launch or take over. **Required outcome:** Define a grace period and safe takeover/recovery policy. **Evidence:** server/index.js: close and leave handlers.

13. **[P2 · Confirmed] Peer updates erase an unfinished offer.** Every state message clears selections, including reconnect/presence-related room updates that do not invalidate the hand. **Required outcome:** Preserve valid draft selections unless the relevant hand/phase changes. **Evidence:** public/app.js: state handler.

14. **[P2 · Confirmed] Connection failure has no bounded recovery.** Initial failure can leave Connecting and disabled buttons indefinitely; retries run every 1.8 seconds, including during offline play. **Required outcome:** Explain cold-start/failure states, offer recovery, and use appropriate backoff. **Evidence:** public/app.js: connect, initial startup.

15. **[P2 · Confirmed] Internet invitations created locally use an unreachable origin.** Internet rooms hosted from localhost/private-IP frontend generate invitations to that same origin, which remote friends cannot open. **Required outcome:** Use the public frontend origin for Internet invitations. **Evidence:** public/app.js: invitationUrl.

16. **[P2 · Conditional] LAN invitations may select the wrong interface.** The first private IPv4 address may belong to a VPN or other interface rather than the friends' Wi-Fi. **Required outcome:** Let the host identify a reachable address instead of silently assuming the first. **Evidence:** server/index.js: /api/lan-addresses; public/app.js: invitationUrl.

17. **[P2 · Conditional] Missing LAN addresses do not block unusable invitations.** If discovery fails or returns no address, localhost can still create a room and produce a loopback invitation. **Required outcome:** Explain the missing prerequisite and avoid presenting localhost as shareable. **Evidence:** public/app.js: LAN fetch, LAN setup, invitationUrl.

18. **[P3 · Confirmed] Gateway choice is lost on local home reload.** Returning home removes network from the URL; a reload on a local origin silently defaults to LAN after Internet was selected. **Required outcome:** Preserve the selected gateway while outside a room. **Evidence:** public/app.js: returnHome, networkMode initialization.

19. **[P3 · Confirmed] Copy controls may open Share instead.** Controls labelled Copy invitation call navigator.share when available. **Required outcome:** Separate Copy and Share semantics or use an honest shared label. **Evidence:** public/app.js: shell, match status, shareRoom.

20. **[P2 · Confirmed] In-match sharing fallback points to a missing field.** A sharing failure asks the player to select the invitation link, but the selectable field exists only in the lobby. **Required outcome:** Keep a usable invitation fallback available during play. **Evidence:** public/app.js: shareRoom, lobbyHtml, renderGame.

21. **[P2 · Source-confirmed risk] Public gateway has no action throttling.** Room creation/code guesses and repeated actions can drive capacity use and broadcasts; maxPayload and maxRooms do not rate-limit callers. **Required outcome:** Add proportionate request and room-creation limits. **Evidence:** server/index.js: connection/message handlers.

22. **[P2 · Conditional] PWA activation deletes unrelated caches.** Activation deletes every cache on the origin except this game's current cache, affecting other games when hosted on the same origin. **Required outcome:** Delete only this game's cache namespace. **Evidence:** public/sw.js: activate.

23. **[P2 · Confirmed limitation] Offline matches cannot resume after reload.** Bot/pass-and-play state is memory-only; reload or OS eviction loses the game. **Required outcome:** Provide a safe local recovery snapshot or explicitly warn about this limitation. **Evidence:** public/app.js: localGame; public/local-game.js.

## Input and accessibility

24. **[P2 · Confirmed] Live updates dismiss open dialogs.** Full app replacement destroys Rules, contact details, installation, and exit dialogs, interrupting reading and focus. **Required outcome:** Preserve dialog state across unrelated updates. **Evidence:** public/app.js: renderGame, renderHome, shell.

25. **[P2 · Source-confirmed] Reveal overlay is not keyboard-modal.** The status div does not move/trap focus or make covered controls inert. **Required outcome:** Use accessible modal behavior or a non-blocking inline recap. **Evidence:** public/app.js: revealOverlayHtml.

26. **[P2 · Source-confirmed] New screens lack a reliable initial focus.** Only surviving prior card/id focus is restored; disappearing controls can leave keyboard focus at the document. **Required outcome:** Choose a sensible focus target for handoff, choice, and results. **Evidence:** public/app.js: renderGame focus restoration.

27. **[P2 · Confirmed] Reduced-motion scrolling remains animated.** Home/Play and setup scrolling explicitly request smooth behavior regardless of reduced-motion preference. **Required outcome:** Honor the preference in JavaScript scroll behavior. **Evidence:** public/app.js: requestHome, bindCommon, setup scroll handlers.

28. **[P2 · CSS-confirmed] Short-landscape controls fall below 44px.** Specific landscape rules retain a 38px sound-control height and 42px primary action height; actual physical-device behavior needs verification. **Required outcome:** Keep all essential controls at least 44px. **Evidence:** public/styles.css: short-landscape match rules.

29. **[P2 · Source-confirmed gap] Board accessibility description omits key detail.** The image label gives a shared gap but omits player identities, positions, and advantage shown visually. **Required outcome:** Provide an equivalent concise textual board summary. **Evidence:** public/app.js: trackHtml.

30. **[P3 · Accessibility risk] Whole-screen live announcements may be excessive.** The entire main element is aria-live while frequent updates replace its contents; screen-reader behavior has not been measured. **Required outcome:** Use focused status announcements and verify the screen-reader journey. **Evidence:** public/index.html; public/app.js: renders.

## Observed usability and learning gaps

31. **[P2 · Live-observed] Phone decisions sit below the board.** At 390x844 the status, board, and recap push the hand below the useful first view while action controls can remain visible. **Required outcome:** Prioritize the current decision and make secondary board detail compact. **Evidence:** Current match layout and independent playtest.

32. **[P2 · Live/CSS-observed] Card names and secondary text lose readability.** Contact names truncate, including Renegade; stage, board, and recap text become very small, especially in short layouts. **Required outcome:** Protect contact identity and simplify small-screen information density. **Evidence:** public/styles.css; portrait/desktop screenshots.

33. **[P2 · Live-observed] Reveal reading time is forced.** Recaps auto-advance after 6.5 seconds, shortened to 4.5 for reduced motion, even while a beginner may be reading. **Required outcome:** Offer deliberate beginner pacing and an accurate retained recap. **Evidence:** public/app.js: REVEAL_DURATION, startReveal.

34. **[P2 · Live-observed] Mode selection is buried on phones.** The hero and public-duel section precede the main mode choices, adding scrolling before solo/local play. **Required outcome:** Bring meaningful play choices into the first useful screen. **Evidence:** public/app.js: renderHome; phone screenshots.

35. **[P3 · Live-observed] Default player identification is ambiguous.** Both online players appear as Guest agent, while pass-and-play's second name is fixed. **Required outcome:** Use distinct defaults and optional names for both players. **Evidence:** public/app.js: beginOnlineRoom; public/local-game.js: createLocalGame.

36. **[P2 · Source-confirmed gap] Deck depletion is not visible during play.** deckRemaining affects exchanges/endings but is not shown in the normal match UI; disabled exchange controls do not explain deck exhaustion. **Required outcome:** Show the transition to no drawing and explain unavailable exchanges. **Evidence:** public/app.js: active decision, nextActionText.

37. **[P3 · Observed/design] Chase advantage is not explicit.** The shared absolute gap does not directly say which rival is ahead or close to winning. **Required outcome:** Add a plain advantage/pursuer cue beyond colors. **Evidence:** public/ui-logic.js: interceptionGap; public/app.js: trackHtml.

## Design improvements, not demonstrated failures

38. **[P2 · Design] Onboarding teaches taps more than strategy.** A worked example of reveal-versus-conceal and opponent collection value is missing. **Required outcome:** Add a short strategic example without expanding the rules wall. **Evidence:** Rules and contextual instructions.

39. **[P2 · Design/source] Bot personalities are too deterministic.** After fairness is fixed, current fixed scoring/tie behavior and absence of exchanges still limit variety. **Required outcome:** Use plausible varied choices and difficulty-appropriate exchanges. **Evidence:** public/local-game.js: bot helpers; public/app.js: bot scheduling.

40. **[P3 · Live/design] Victory underplays the decisive action.** Generic headline/statistics do not spotlight the recruit or bluff that won; net movement 0 was prominent in an Oracle victory. **Required outcome:** Make the decisive contact/outcome the focal reward. **Evidence:** Independent Oracle victory; result presentation.

41. **[P3 · Design/source] Defeat lacks a useful next-attempt lesson.** The result reason and rematch work but do not offer a concise situation-specific learning cue. **Required outcome:** Give one useful optional takeaway without blame. **Evidence:** public/app.js: result branch.

42. **[P3 · Design/source] Offline rematches always give Player One the opening turn.** createLocalGame always initializes turn 0. **Required outcome:** Consider alternating the opening agent for friend play. **Evidence:** public/local-game.js: createLocalGame; public/app.js: startLocal.

43. **[P3 · Audio design candidate] Routine hover tones may compete with important feedback.** Every enabled desktop button has hover audio; listening tests have not established whether that is distracting. **Required outcome:** Audition the hierarchy before tuning it; do not claim an audible defect yet. **Evidence:** public/app.js: bindInteractionFeedback.

## Deployment constraints and remaining verification

- Current Internet health check timed out after 15 seconds. The last successful earlier check returned the legacy waiting-room flow; deployment/protocol parity is not established by this audit. A timeout alone does not prove a permanent outage.
- LAN uses unencrypted HTTP/WebSocket and an ephemeral in-memory server. Untrusted-network privacy and survival across gateway restart are limitations; the browser cannot discover/start a host automatically.
- Physical phones: touch accuracy, safe areas, keyboard opening, short landscape, text scaling, and frame stability remain to be verified.
- Full screen-reader and keyboard-only journeys, including dynamic updates and modal transitions, remain unverified.
- Reduced-motion behavior and audible/haptic feedback need direct testing.
- A complete human multiplayer match/rematch with disconnect during offer, choice, reveal, and results; host loss; room expiry; refresh; and server restart needs coverage.
- Bot/pass-and-play offline reload/install/update behavior and PWA cache coexistence need browser tests.
- All win/loss/tie/empty-deck paths and volatile-contact combinations need full end-to-end presentation checks, not just rule tests.
- Fun, difficulty balance, match length, and reward satisfaction need human playtests; agent ratings are a proxy.
- All 31 existing automated tests passed in this audit. Additional direct checks reproduced secret-dependent bot choices, mutation of old local views, and the malformed-URL server crash. Passing tests do not cover the complete issue inventory.

No game implementation was changed during this audit.


## Rules clarification
Cleaner removes a Renegade from its own recipient. It cannot remove the other recipient’s third Renegade in that exchange; no rule change was made for that originally misstated interaction. Recaps report actual removals and the resolved winner.
