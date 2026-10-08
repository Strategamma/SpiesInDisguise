# Spies in Disguise UI/UX

- The app home is shared by website visits and installed PWA launches.
- Lead with three large mode choices: Bot (recommended), In Person, and Wi-Fi. Each explains who plays and where before selection.
- Keep install access visible in the home header; use the native prompt when available and clear platform instructions otherwise.
- Mobile is action-first: mode cards stack, gameplay keeps the current decision and hand above secondary collections, and controls respect safe areas.
- Pass-and-play must protect hidden information with explicit handoff screens before a different player sees their decision.
- Bot and in-person modes work entirely offline; Wi-Fi remains server-authoritative.
- Visual direction: covert signal room—near-black navy, mint signal glow, amber intelligence markers, tight typography, and restrained scanning motion.
- Brand mark: a flat geometric question-mark card with one restrained violet card shadow; no decorative patterns, rings, gradients, or extra card details. Retain a safe navy field for maskable app icons.
- Every turn must clearly state whose device/player action is expected. Honor reduced-motion settings.
- Home onboarding uses a short briefing entry plus a visible three-step How to Play preview; the full briefing explains the offer/choose/recruit loop, all win conditions, and the contact dossier.
- Cards prioritize identity, plain-language behavior, and labeled 1st/2nd/3rd recruitment movement. Contact color is supportive rather than the only identifier; selection and revealed states use text labels.
- Mobile hands use a two-column grid so all four contacts remain scannable without horizontal discovery. The sticky action bar always states the current offer-building step.
- The pursuit board is a circular signal ring: agents start on opposite sides, advance along the highlighted 12-space arc, and converge on a clearly marked interception point. The center prioritizes remaining distance; a compact legend names both agents and their movement.
- Primary navigation is a persistent three-item dock: Home, Play, and Rules. Play jumps to mode selection or the current decision, active location is explicit, and leaving an unfinished match always requires confirmation.
- Launch uses a branded, tap-to-enter signal splash; that gesture safely enables optional synthesized game audio. A persistent header control stores the sound preference. Motion remains restrained and honors reduced-motion settings.
- Online rooms open into an explicit lobby with two agent slots, room sharing, connected/ready status, individual ready controls, and a host-only launch button. No cards are dealt before launch.
- Results use distinct mission-complete and mission-compromised treatments. Celebration effects never cover rematch or Home actions, and online rematch voting reports its waiting state.

# Card decision feedback
- Each visible contact card highlights the exact 1st, 2nd, or 3rd recruitment effect that its recipient would trigger next. Use the gold movement cell and mint `Next` label consistently.
- A concealed identity remains visually and structurally hidden until a choice is accepted. Then flip the concealed card and animate both cards toward their recipients before applying the new board state.
- Reveal timing should feel deliberate without delaying play; reduced-motion users receive an abbreviated, non-spatial transition.
