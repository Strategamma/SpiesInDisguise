# Goal
Polish every player-facing screen into a clearer, denser, mobile-first interface while preserving the established covert visual identity.

# Scope
Home hierarchy, mode selection, navigation, setup forms, lobby, board, cards, turn actions, rules/install/leave dialogs, reveal overlay, and result screens. Preserve game logic, privacy, and deployment behavior.

# Approach
Refine shared tokens and interaction states first, compact the home and navigation layout, then normalize all game panels and small-screen breakpoints. Use existing markup and architecture; change copy or structure only where it improves comprehension.

# Risks
Crowding 320px screens, sticky controls covering content, desktop rules becoming too sparse, and styling changes obscuring selected/revealed card states.

# Verification
Run syntax and rules tests, inspect layout selectors and focus states, verify cache/versioning, attempt Playwright at mobile and desktop sizes, and document any sandbox-blocked visual checks.
