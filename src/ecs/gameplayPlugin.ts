import { definePlugin, type ScreenDefinition, type ScreensConfig } from 'ecspresso';
import { addAISystemToEngine } from './systems/AISystem';
import { addEnemySpawnSystemToEngine } from './systems/EnemySpawnSystem';
import { addProblemManagementSystemToEngine } from './systems/ProblemManagementSystem';
import { addGameplayTimeSystemToEngine } from './systems/GameplayTimeSystem';
import { addUISystemToEngine } from './systems/UISystem';
import { registerFrogTongueInit } from './systems/FrogTongueSystem';
import { addMovementSystemToEngine } from './systems/MovementSystem';
import { addShakeSystemToEngine } from './systems/AnimationSystem';
import { addFrogSpriteAnimationSystemToEngine } from './systems/FrogSpriteSystem';
import { addPlayerSpriteSystemToEngine } from './systems/PlayerSpriteSystem';
import { addCollisionSystemToEngine } from './systems/CollisionSystem';
import type { PlayingScreenConfig } from './types';

type RequiresPlayingScreen = ScreensConfig<{
  playing: ScreenDefinition<PlayingScreenConfig>;
}>;

/**
 * Plugin bundling systems that run during normal gameplay.
 */
export const gameplayPlugin = definePlugin('gameplay')
  .requires<RequiresPlayingScreen>()
  .setSystemDefaults({ inScreens: ['playing'] })
  .install(() => {
    addMovementSystemToEngine();
    addShakeSystemToEngine();
    addPlayerSpriteSystemToEngine();
    addFrogSpriteAnimationSystemToEngine();
    addCollisionSystemToEngine();
    addAISystemToEngine();
    addEnemySpawnSystemToEngine();
    addProblemManagementSystemToEngine();
    addGameplayTimeSystemToEngine();
    addUISystemToEngine();
    registerFrogTongueInit();
  });
