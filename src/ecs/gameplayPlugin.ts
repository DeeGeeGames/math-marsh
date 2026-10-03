import { addAISystemToEngine } from './systems/AISystem';
import { addEnemySpawnSystemToEngine } from './systems/EnemySpawnSystem';
import { addProblemManagementSystemToEngine } from './systems/ProblemManagementSystem';
import { addGameplayTimeSystemToEngine } from './systems/GameplayTimeSystem';
import { addMovementSystemToEngine } from './systems/MovementSystem';
import { addShakeSystemToEngine } from './systems/AnimationSystem';
import { addPlayerSpriteSystemToEngine } from './systems/PlayerSpriteSystem';
import { addCollisionSystemToEngine } from './systems/CollisionSystem';
import type { GameSystemRegistrar } from './Engine';

/**
 * Register the systems that run during normal gameplay.
 */
export function registerGameplaySystems(
  systems: GameSystemRegistrar,
): void {
  addMovementSystemToEngine(systems);
  addShakeSystemToEngine(systems);
  addPlayerSpriteSystemToEngine(systems);
  addCollisionSystemToEngine(systems);
  addAISystemToEngine(systems);
  addEnemySpawnSystemToEngine(systems);
  addProblemManagementSystemToEngine(systems);
  addGameplayTimeSystemToEngine(systems);
}
