import type { GameEngine } from './Engine';
import type { PlayerCollisionEntity } from './queries';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { startShake } from './systems/AnimationSystem';

export function startDamageReaction(
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  animation: { readonly INTENSITY: number; readonly DURATION: number },
): void {
  startShake(ecs, player.id, animation.INTENSITY, animation.DURATION);
  player.components.timers.damageFeedback = createTimer(animation.DURATION / 1000);
}

