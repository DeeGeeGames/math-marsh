import type { GameEngine } from './Engine';
import type { Components } from './types';

export function queueTimeAdjustment(
  ecs: GameEngine,
  source: Components['position'],
  seconds: number,
  startedAt: number,
): void {
  const player = ecs.getSingleton(['player']);
  // Run-owned feedback survives level exits and cascades away with the player.
  ecs.commands.spawnChild(player.id, {
    timeAdjustment: {
      startedAt,
      seconds,
      source: { x: source.x, y: source.y },
    },
  }, { scope: null });
}
