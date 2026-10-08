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

export function interceptionGap(players) {
  const difference = Math.abs(Number(players?.[0]?.progress || 0) - Number(players?.[1]?.progress || 0));
  return Math.max(0, START_GAP - difference);
}
