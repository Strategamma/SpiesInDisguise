export function nextRecruitIndex(players, playerIndex, kind) {
  const recruited = Number(players?.[playerIndex]?.collection?.[kind] || 0);
  return Math.min(2, Math.max(0, recruited));
}

export const BOARD_SPACES = 12;
export const START_GAP = 6;

export function contactStageEffect(kind, index, movement) {
  if (index === 2 && kind === "oracle") return { icon: "★", label: "Victory", shortLabel: "Win", className: "victory" };
  if (index === 2 && kind === "renegade") return { icon: "✕", label: "Defeat", shortLabel: "Lose", className: "defeat" };
  const value = `${movement > 0 ? "+" : ""}${movement}`;
  return { icon: value, label: `${value} movement`, shortLabel: "", className: "movement" };
}

export function stateMotionCue(previous, next) {
  if (!previous || !next) return null;
  if (previous.winner === null && next.winner !== null) return "result";
  if (previous.phase !== next.phase) return next.phase === "choose" ? "offer" : next.phase === "offer" ? "deal" : "phase";
  if (previous.hand && next.hand && previous.hand.map(card => card.id).join() !== next.hand.map(card => card.id).join()) return "deal";
  if (previous.players?.some((player, index) => player.ready !== next.players?.[index]?.ready)) return "ready";
  return null;
}

export function boardPosition(playerIndex, progress) {
  const position = playerIndex * START_GAP + Number(progress || 0);
  return ((position % BOARD_SPACES) + BOARD_SPACES) % BOARD_SPACES;
}

export function projectedCardPosition(players, playerIndex, movement) {
  const progress = Number(players?.[playerIndex]?.progress || 0);
  return {
    current: boardPosition(playerIndex, progress) + 1,
    destination: boardPosition(playerIndex, progress + Number(movement || 0)) + 1
  };
}

export function interceptionGap(players) {
  const difference = Math.abs(Number(players?.[0]?.progress || 0) - Number(players?.[1]?.progress || 0));
  return Math.max(0, START_GAP - difference);
}

export function recruitMovementNotice(previous, next, reveal) {
  if (!previous?.players || !next?.players || !reveal || !Number.isInteger(reveal.chooser)) return [];
  const chooser = reveal.chooser;
  return [
    { playerIndex: chooser, kind: reveal.chosen.kind, delta: next.players[chooser].progress - previous.players[chooser].progress },
    { playerIndex: 1 - chooser, kind: reveal.other.kind, delta: next.players[1 - chooser].progress - previous.players[1 - chooser].progress }
  ];
}
