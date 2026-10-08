# Goal
Ship a production-ready launch-to-lobby-to-game flow with polished feedback and finales.

# Scope
Launch experience, authoritative online lobby/readiness/start flow, synthesized audio, persistent mute control, gameplay transitions, and final result presentation. Preserve game rules.

# Approach
Gate launch behind one user gesture; add server-owned lobby state with ready flags and host start validation; synthesize short Web Audio cues; detect state transitions; add restrained CSS motion; render distinct finales.

# Risks
Lobby reconnect/leave edge cases, unauthorized start attempts, browser audio restrictions, duplicate sounds during rerenders, excessive motion, and result effects obscuring mobile actions.

# Verification
Test lobby join/ready/start authorization and privacy, existing rules, sound gating, syntax/server health, result branches, and attempt Playwright while retaining the known macOS sandbox limitation.
