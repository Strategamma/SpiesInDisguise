# Goal
Unify the game with Decadence Inc.’s visual language and make live two-device duels immediately discoverable from the home screen.

# Scope
Restyle the shared shell/home surface, retain Bot/Pass & Play/private rooms, add opt-in public duel hosting and a compact live-agent board backed by the existing authoritative gateway.

# Approach
Use the site’s black grid, warm cream, red/orange accents, bold display type, outlined headline, and restrained glow. Extend the WebSocket protocol with public-lobby presence snapshots and direct join actions; never expose hands, tokens, or active matches.

# Risks
Stale presence, accidental exposure of private rooms, host disconnects, responsive crowding, and regressions in room-code/reconnect flows.

# Verification
Add protocol tests for public-lobby filtering, run the full test suite, then exercise home, host, join, private room, desktop, mobile, and reduced-motion states in a browser.
