# Goal
Make every interaction visually consistent, responsive, audible, and self-explanatory so a first-time player can complete a match without guessing.

# Scope
Audit home, setup, lobby, offer, choose, exchange, waiting, handoff, rules, dialogs, results, navigation, cards, and public-network controls. Preserve game rules and networking.

# Approach
Define one button system with clear primary/secondary/quiet/danger/selected states; route interaction sounds through shared delegation; add action-led prompts, numbered steps, state feedback, and meaningful motion while honoring reduced motion.

# Risks
Excess motion/noise, duplicate audio, rerendered listeners, unclear card ownership, mobile crowding, and changing behavior while restyling.

# Verification
Run syntax and unit tests, then Playwright through splash, home, bot setup, offer selection, exchange, choose, rules, dialogs, lobby controls, desktop/mobile, keyboard focus, reduced motion, and console errors; inspect screenshots.
