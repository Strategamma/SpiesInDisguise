export function nextRecruitIndex(players, playerIndex, kind) {
  const recruited = Number(players?.[playerIndex]?.collection?.[kind] || 0);
  return Math.min(2, Math.max(0, recruited));
}

export const BOARD_SPACES = 12;
export const START_GAP = 6;

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
