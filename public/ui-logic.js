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

export function resolutionMovementNotice(previous, next, reveal) {
  return recruitMovementNotice(previous, next, reveal).map(item => ({
    ...item,
    fromSpace: boardPosition(item.playerIndex, previous.players[item.playerIndex].progress) + 1,
    toSpace: boardPosition(item.playerIndex, next.players[item.playerIndex].progress) + 1
  }));
}

export function exchangeSummary(previous, next, reveal) {
  return resolutionMovementNotice(previous, next, reveal).map(item => {
    const before = previous.players[item.playerIndex];
    const after = next.players[item.playerIndex];
    const count = Number(after.collection[item.kind] || 0);
    const notes = [];
    if (item.kind === "jammer") notes.push("Rival pushed back 1 space");
    if (item.kind === "cleaner" && before.collection.renegade > (after.collection.renegade || 0)) notes.push("Removed 1 Renegade");
    if (item.delta !== after.lastMovement && Number.isFinite(after.lastMovement)) notes.push(`Contact ${after.lastMovement > 0 ? "+" : ""}${after.lastMovement}; rival push ${item.delta - after.lastMovement}`);
    if (item.kind === "oracle") notes.push(`${count} of 3 Oracles`);
    if (item.kind === "renegade") notes.push(`${count} of 3 Renegades`);
    const movement = item.delta === 0 ? "Stayed in place" : `Moved ${item.delta > 0 ? "+" : ""}${item.delta} ${Math.abs(item.delta) === 1 ? "space" : "spaces"}`;
    const outcome = next.winner !== null && next.winner !== undefined ? next.winner === item.playerIndex ? "victory" : "defeat" : "";
    return { ...item, notes, outcome, summary: `${movement}${outcome ? outcome === "victory" ? " · Mission won" : " · Mission lost" : ""}` };
  });
}
