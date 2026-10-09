# Goal
Raise the game’s learning clarity and moment-to-moment excitement without changing its tested rules or hidden-information model.

# Scope
Add screenshot-led beginner help, bot skill/personality selection, live chase danger and decision guidance, a richer match recap, and matching sound/motion cues.

# Approach
Reuse the existing DOM/CSS UI and local bot engine. Ship lightweight offline SVG walkthrough screenshots, keep hints contextual, derive recap stats from authoritative public state, and preserve online protocol compatibility.

# Risks
Overloading the playfield, leaking concealed information, changing game balance, bot profiles becoming illegal or unpredictable, and PWA caches missing new help assets.

# Verification
Add targeted bot/UI tests, run the full test suite and syntax checks, verify all static/PWA assets locally, then attempt the required Playwright screenshot loop and report any environment limitation accurately.
