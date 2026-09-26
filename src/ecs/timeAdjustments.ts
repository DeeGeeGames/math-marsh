import type { GameEngine } from './Engine';
import type { Components } from './types';

export function queueTimeAdjustment(
  ecs: GameEngine,
  source: Components['position'],
  seconds: number,
  startedAt: number,
): void {
  ecs.commands.spawn({
    timeAdjustment: {
      startedAt,
      seconds,
      source: { x: source.x, y: source.y },
    },
  });
}
