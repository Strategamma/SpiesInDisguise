# Goal
Make the game UI clean, mobile-first, self-explanatory, and improve the visual/readability design of playable cards.

# Scope
Home onboarding, a dedicated How to Play section, gameplay hierarchy, card components, responsive styling, and accessibility states. Preserve game rules and networking.

# Approach
Use progressive disclosure on the home screen, concise three-step rules with win conditions, clearer turn prompts, and cards with distinct contact color, icon, effect, and numbered recruitment movement track.

# Risks
Dense card information on narrow screens, concealed-information leakage, and regressions in selection or pass-and-play flows.

# Verification
Run rules tests and syntax checks; exercise home, rules, bot setup, selection, offer, and responsive layouts with Playwright; inspect screenshots and console errors.
