import type { GameEngine } from './Engine';

const GAMEPLAY_CLOCK_GROUPS = ['timers', 'tweens', 'coroutines'] as const;
const RUNNING_GAMEPLAY_CLOCK_SCREENS = ['playing', 'tutorial'] as const;
const PAUSED_GAMEPLAY_CLOCK_SCREENS = [
  'studioSplash',
  'engineSplash',
  'menu',
  'skitGallery',
  'modeSelect',
  'howToPlay',
  'tutorialOffer',
  'levelComplete',
  'skit',
  'paused',
  'controllerRecovery',
  'settings',
  'gameOver',
] as const;

export function pauseGameplayClocks(ecs: GameEngine): void {
  GAMEPLAY_CLOCK_GROUPS.forEach(group => ecs.disableSystemGroup(group));
}

function resumeGameplayClocks(ecs: GameEngine): void {
  GAMEPLAY_CLOCK_GROUPS.forEach(group => ecs.enableSystemGroup(group));
}

export function registerGameplayClockLifecycle(ecs: GameEngine): void {
  RUNNING_GAMEPLAY_CLOCK_SCREENS.forEach(screen => {
    ecs.onScreenEnter(screen, ({ ecs: world }) => resumeGameplayClocks(world));
    ecs.onScreenResume(screen, ({ ecs: world }) => resumeGameplayClocks(world));
  });

  PAUSED_GAMEPLAY_CLOCK_SCREENS.forEach(screen => {
    ecs.onScreenEnter(screen, ({ ecs: world }) => pauseGameplayClocks(world));
    ecs.onScreenResume(screen, ({ ecs: world }) => pauseGameplayClocks(world));
  });
}
