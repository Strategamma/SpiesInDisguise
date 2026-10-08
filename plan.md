# Goal
Replace the linear pursuit track with a playful circular board without changing game rules.

# Scope
The gameplay board, agent markers, progress legend, and related explanatory copy. Preserve movement math, win conditions, cards, and networking.

# Approach
Place 24 signal nodes around a ring, highlight the 12-space pursuit arc, start agents opposite each other, and calculate their marker coordinates so combined progress converges at an interception point.

# Risks
Marker overlap near interception, cramped labels on narrow phones, and a visual that no longer matches the underlying 12-space calculation.

# Verification
Check coordinate boundaries and convergence math, run rules and syntax tests, serve the UI, and attempt the required Playwright screenshot flow while retaining the known macOS sandbox limitation.
