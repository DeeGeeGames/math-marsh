import type { GameEngine } from './Engine';
import type { PlayerCollisionEntity } from './queries';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { ANIMATION_CONFIG } from '../config';
import { playSound } from '../audio/audio';
import { startDeathAnimation } from './systems/AnimationSystem';

export function triggerGameOver(ecs: GameEngine, player: PlayerCollisionEntity, reason: string): void {
  if (player.components.player.gameOverPending) return;
  console.log(reason);
  playSound('gameOver');
  player.components.player.gameOverPending = true;
  startDeathAnimation(ecs, player.id, player.components.position.rotation ?? 0);
  player.components.timers.deathDelay = createTimer(ANIMATION_CONFIG.DEATH.DURATION / 1000, {
    onComplete: () => { void ecs.setScreen('gameOver', {}); },
  });
}

