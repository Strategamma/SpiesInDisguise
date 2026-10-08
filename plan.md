# Goal
Change the pursuit board to a 12-space clockwise chase with a six-space starting gap, and prefer landscape orientation during mobile matches.

# Scope
Authoritative and local win math, signed movement, board geometry/copy, rules/onboarding, mobile landscape PWA preference, rotate guidance, responsive landscape styling, tests, and offline cache.

# Approach
Track each agent's cumulative signed movement. Place them at indices 0 and 6 on one 12-node clockwise loop; both add movement in the same direction. Intercept when either agent gains six relative spaces. Request landscape after a game-start gesture, declare it in the manifest, and show rotate guidance when a mobile browser cannot lock orientation.

# Risks
Server/local rule drift, negative movement being incorrectly clamped, stale clients visualizing the old board, orientation locking being unsupported outside installed/fullscreen contexts, and short landscape viewports crowding controls.

# Verification
Test clockwise positions, initial gap, both interception directions, negative movement, Oracle/Renegade outcomes, server/local parity, manifest validity, syntax/build/server assets, landscape CSS, and attempt Playwright under the known sandbox limitation.
