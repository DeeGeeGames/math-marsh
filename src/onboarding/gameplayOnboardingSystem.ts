import type { GameSystemRegistrar } from '../ecs/Engine';
import {
  mathProblemWithRenderableQuery,
  playerCollisionQuery,
} from '../ecs/queries';
import { SYSTEM_PRIORITIES } from '../ecs/systemConfigs';
import {
  nextGameplayOnboardingStep,
  previousGameplayOnboardingStep,
  skipGameplayOnboarding,
} from './gameplayOnboardingFlow';
import { applyTutorialStep } from './gameplayOnboardingScene';
import type { GameplayOnboardingSession } from './gameplayOnboarding';

export function registerGameplayOnboardingSystem(
  systems: GameSystemRegistrar,
): void {
  let appliedSession: GameplayOnboardingSession | undefined;

  systems.addSystem('gameplayOnboardingSystem')
    .setPriority(SYSTEM_PRIORITIES.ONBOARDING)
    .addSingleton('player', {
      ...playerCollisionQuery,
      mutates: ['position', 'player', 'pathFollower'],
    } as const)
    .addQuery('mathProblems', {
      ...mathProblemWithRenderableQuery,
      mutates: ['mathProblem', 'renderable'],
    } as const)
    .addSingleton('enemy', {
      with: ['position', 'enemy', 'renderable', 'timers'],
      optional: ['enemySprite'],
      mutates: ['position', 'renderable', 'timers'],
    } as const)
    .withResources(['inputState', 'gameplayOnboardingSession'])
    .setProcess(({ queries, ecs, resources }) => {
      const {
        inputState,
        gameplayOnboardingSession,
      } = resources;
      if (!gameplayOnboardingSession.active) return;
      const player = queries.player;
      if (!player) return;

      if (appliedSession !== gameplayOnboardingSession) {
        appliedSession = gameplayOnboardingSession;
        applyTutorialStep(
          ecs,
          gameplayOnboardingSession,
          player,
          queries.mathProblems,
          queries.enemy,
        );
      }

      if (inputState.actions.justActivated('back')) {
        previousGameplayOnboardingStep(ecs);
        return;
      }
      if (inputState.actions.justActivated('skip')) {
        skipGameplayOnboarding(ecs);
        return;
      }
      if (inputState.actions.justActivated('eat')) nextGameplayOnboardingStep(ecs);
    });
}
