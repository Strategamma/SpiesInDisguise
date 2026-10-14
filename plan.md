# Goal
Make primary navigation lighter and give phone gameplay more room.
# Scope
Replace the floating bottom dock with a compact sticky top strip; preserve Home/Play/Rules and match-exit safeguards.
# Approach
Reuse the existing semantic buttons and handlers, add consistent small SVG icons and an underline active state, remove obsolete dock styling and bottom spacing.
# Risks
Sticky navigation obscuring scroll targets, stale active states after dialogs, and overlap with game actions.
# Verification
Phone portrait/landscape and desktop browser checks; navigation, Rules, and leave-confirmation interactions; existing tests and syntax checks.
