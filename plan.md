# Goal
Make card decisions self-explanatory and animate the authoritative reveal/recruit outcome in real time.

# Scope
Next-recruit movement highlighting, concealed-card flip, two-card transfer animation, online/local/bot outcome timing, and supporting sound. Preserve rules, lobby, privacy, and reconnection.

# Approach
Derive the relevant 1st/2nd/3rd movement from each recipient’s collection, emit a reveal event only after a valid choice resolves, hold the next state briefly while cards flip and travel, then apply the authoritative result.

# Risks
Leaking concealed identity before choice, applying queued state twice, timer races during reconnect/leave, and displaying the movement stage for the wrong recipient.

# Verification
Test hidden-card privacy before choice, reveal payload correctness after choice, recipient-specific stage calculation, queued transition timing, existing rules/lobby flows, syntax/server health, and attempt Playwright under the known sandbox limitation.
