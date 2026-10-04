import { gameActions } from '../ecs/controllerSelection';
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
import { updateTutorialTouchGuidance } from './gameplayOnboardingUI';
import { isTouchPrimary } from '../ui/touchControls';

export function registerGameplayOnboardingSystem(
  systems: GameSystemRegistrar,
): void {
  let appliedSession: GameplayOnboardingSession | undefined;

  systems.addSystem('gameplayOnboardingSystem')
    .inGroup('gameplay')
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
    .withResources(['inputState', 'controllerSelection', 'gameplayOnboardingSession'])
    .setProcess(({ queries, ecs, resources }) => {
      const {
        inputState,
        controllerSelection,
        gameplayOnboardingSession,
      } = resources;
      if (!gameplayOnboardingSession.active) return;
      updateTutorialTouchGuidance(
        gameplayOnboardingSession,
        isTouchPrimary() || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0),
        inputState.gamepads.some(gamepad => gamepad.connected),
      );
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

      if (gameActions(inputState, controllerSelection).justActivated('back')) {
        previousGameplayOnboardingStep(ecs);
        return;
      }
      if (gameActions(inputState, controllerSelection).justActivated('skip')) {
        skipGameplayOnboarding(ecs);
        return;
      }
      if (gameActions(inputState, controllerSelection).justActivated('eat')) nextGameplayOnboardingStep(ecs);
    });
}
