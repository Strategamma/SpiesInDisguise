# Goal
Bring the two-player base game into mechanical parity with the referenced simple-mode rulebook while preserving original Spies in Disguise branding and assets.

# Scope
Audit setup, hand refill, offer restrictions, optional four-use card exchange, recruit/movement timing, end-step win/loss ties, deck exhaustion, rules UI, bot/local/online parity, tests, and cache. Advanced market cards and 3–4-player teams remain separate modes outside the current two-player scope.

# Approach
Use the publisher rulebook as the behavioral reference, map its generic mechanics onto original contacts, and keep server/local engines identical. Add a server-authoritative exchange action and expose only the counts needed by the UI. Resolve all movement and conditions at the End step.

# Risks
Exchange exploits outside the Play step, deck-empty off-by-one behavior, information leakage, local/server drift, stale clients sending unsupported actions, and copying protected names/art/copy instead of only interoperable mechanics.

# Verification
Test exchange legality/counts, hand refill, identical-card exception, signed simultaneous movement, all tie combinations, next-player deck exhaustion, server/local parity, syntax/server/cache, and attempt Playwright under the known sandbox limitation.
