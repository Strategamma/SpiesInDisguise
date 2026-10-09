export function availableDuels(rooms) {
  return [...rooms.values()]
    .filter(room => room.public === true && room.phase === "lobby" && room.players.length === 1 && room.players[0]?.connected)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)
    .map(room => ({ room: room.code, host: room.players[0].name }));
}
