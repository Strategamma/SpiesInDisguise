# Goal
Add clear, consistent navigation across home, setup, rules, and active game states.

# Scope
A persistent Home/Play/Rules navigation bar, meaningful active states, jump targets, and confirmation before abandoning an unfinished match.

# Approach
Render one shared bottom navigation from the app shell, route Play to the relevant section for the current screen, and use a native dialog to guard destructive Home navigation during active play.

# Risks
Fixed navigation covering mobile actions, duplicate rule controls, and accidentally discarding room or local-game state.

# Verification
Check navigation bindings and dialog actions, run rules and syntax tests, serve the UI, and attempt the required Playwright interaction flow while retaining the known macOS sandbox limitation.
