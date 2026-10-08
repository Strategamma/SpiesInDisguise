# Goal
Bring the two-player base game into mechanical parity with the referenced simple mode and make every recruit, collection, and board movement self-explanatory.

# Scope
Audit setup, 38-card balance, hand refill, offer restrictions, four-use exchange, recruit/end timing, ties, deck exhaustion, movement feedback, inspectable collections, board guidance, bot/local/online parity, tests, and cache. Advanced market cards and 3–4-player teams remain separate modes outside the current scope.

# Approach
Map the published balance onto original contacts and keep server/local engines identical. Add a server-authoritative exchange action. Reuse the post-choice reveal to associate each recruited contact with its movement delta, annotate the board briefly, and expose public collections as inspectable controls.

# Risks
Exchange exploits, deck-empty off-by-one behavior, movement feedback using the wrong recipient or stale state, collection popovers leaking hand data, timer races, server/local drift, and copying protected expression instead of only mechanics.

# Verification
Test deck inventory and movement curves, exchanges, refill, identical-card exception, simultaneous movement, ties, exhaustion, feedback recipient/delta mapping, collection counts, server/local parity, syntax/server/cache, and attempt Playwright.
