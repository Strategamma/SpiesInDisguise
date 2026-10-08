export function nextRecruitIndex(players, playerIndex, kind) {
  const recruited = Number(players?.[playerIndex]?.collection?.[kind] || 0);
  return Math.min(2, Math.max(0, recruited));
}
