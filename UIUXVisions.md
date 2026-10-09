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
- Cards prioritize identity and board consequence: current space, signed movement, and landing space. The compact 1st/2nd/3rd curve remains secondary; longer behavior copy lives in tooltips, accessibility labels, Rules, and network dossiers. Contact color is supportive rather than the only identifier; selection and revealed states use text labels.
- Terminal card effects never masquerade as zero movement: Oracle’s third stage uses a mint victory star/Win label, while Renegade’s uses a red defeat cross/Lose label across cards, dossiers, network previews, and resolution feedback.
- Mobile hands use a two-column grid so all four contacts remain scannable without horizontal discovery. The sticky action bar always states the current offer-building step.
- The pursuit board is one numbered 12-space clockwise loop. Agents start opposite each other, six spaces apart, and both move in the same direction. The center shows the remaining relative gap; the legend shows each board space and signed net movement.
- Primary navigation is a persistent three-item dock: Home, Play, and Rules. Play jumps to mode selection or the current decision, active location is explicit, and leaving an unfinished match always requires confirmation.
- Launch uses a branded, tap-to-enter signal splash; that gesture safely enables optional synthesized game audio. A persistent header control stores the sound preference. Motion remains restrained and honors reduced-motion settings.
- Larger motion is event-driven, not render-driven: stagger hands only when dealt/exchanged, slide offers only when sent, confirm lobby readiness, pop recruited network chips, and emphasize terminal outcomes. Ordinary selection stays immediate; animate transforms/opacity and honor reduced motion globally.
- Online rooms open into an explicit lobby with two agent slots, room sharing, connected/ready status, individual ready controls, and a host-only launch button. No cards are dealt before launch.
- Results use distinct mission-complete and mission-compromised treatments. Celebration effects never cover rematch or Home actions, and online rematch voting reports its waiting state.

# Card decision feedback
- Each visible contact card highlights the exact 1st, 2nd, or 3rd recruitment effect that its recipient would trigger next. Use the gold movement cell and mint `Next` label consistently.
- A concealed identity remains visually and structurally hidden until a choice is accepted. Then flip the concealed card and animate both cards toward their recipients before applying the new board state.
- Reveal timing should feel deliberate without delaying play; reduced-motion users receive an abbreviated, non-spatial transition.
- After the reveal completes, the board briefly pairs each recruited contact with its recipient and signed movement; both moved pieces pulse. This feedback must derive from the authoritative before/after state.
- Public network chips always show contact and count. Hover gives a concise preview; tap/click opens the full movement curve and highlights the next recruit effect. Never expose hand or concealed-offer data here.

# Interface density
- Mode cards are compact decision rows on every viewport: icon, title/context, then a clearly aligned affordance. Recommendations must never compete with the title.
- The persistent navigation uses a restrained tinted active state; primary game actions, not navigation chrome, carry the strongest filled treatment.
- Secondary information uses higher-contrast muted text, while panels rely on spacing and thin borders instead of oversized empty areas.

# Match layout
- Treat the live match as one game table, not unrelated stacked panels. Desktop uses a compact left rail for status, pursuit board, and networks beside the active decision surface.
- Below 900px the same semantic regions collapse without duplicated markup. Status and the compact board lead into the current decision; networks follow as secondary information.
- The action surface owns the turn heading, hand or offer, and confirmation control. Its width and card grid must remain stable from 320px phones through wide desktop windows.
- Mobile matches prefer landscape. Installed PWAs declare landscape-primary; supported browsers request an orientation lock after the player's start gesture, while unsupported portrait contexts show a focused rotate prompt.
- The board labels clockwise direction, the six-space objective, both starting nodes, current positions, and signed net movement without requiring the rules dialog.
