# Goal
Restructure the live match screen into a cohesive, responsive game table that feels intentional on phones and desktop browsers.

# Scope
Match status, player identities, circular board, decision area, hand/offers, network collections, sticky action controls, waiting/handoff/results, and responsive breakpoints. Preserve game logic, privacy, lobby behavior, and navigation.

# Approach
Introduce a semantic match layout with dedicated status, board, action, and network regions. Use a two-column desktop table with a compact overview rail, then collapse to a single action-first mobile flow without duplicating state or markup.

# Risks
Changing visual order without changing turn behavior, cards becoming too narrow at intermediate widths, sticky controls colliding with navigation, and secondary networks distracting from the current decision.

# Verification
Run syntax and rules tests, inspect all turn-state markup, check 320px/tablet/desktop CSS grids and overflow, verify local server/assets and cache version, attempt Playwright, and document any sandbox-blocked visual checks.
