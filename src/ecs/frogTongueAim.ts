type Point = Readonly<{ x: number; y: number }>;

/** Choose the cardinal direction closest to the player; ties aim horizontally. */
export const frogTongueDirection = function (frog: Point, player: Point): Point | undefined {
  const dx = player.x - frog.x;
  const dy = player.y - frog.y;
  if (dx === 0 && dy === 0) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
  return { x: 0, y: Math.sign(dy) };
};
