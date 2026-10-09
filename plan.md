# Goal
Add polished, purposeful animation across the match without slowing decisions or obscuring game state.

# Scope
Animate card dealing/offers, selection feedback, turn transitions, board resolution, lobby readiness, public-network updates, dialogs, and terminal outcomes without changing gameplay.

# Approach
Use transient motion cues tied to actual state changes so full card/panel entrances do not replay on every selection render. Prefer transforms and opacity, retain existing reveal/result sequences, and provide a complete reduced-motion fallback.

# Risks
Replaying entrance motion on every click, excessive continuous movement, layout-shifting properties, timer leakage, mobile performance, and reduced-motion gaps.

# Verification
Test cue selection and expiry, rules/syntax/CSS checks, serve assets, attempt the browser screenshot loop, and record any visual-QA blocker.
