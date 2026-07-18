import { gameEngine, type GameEngine } from '../Engine';
import { LEVEL_COMPLETE_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import {
  shouldStartOperandTutorial,
  type GameplayOnboardingCompletion,
} from '../../onboarding/gameplayOnboarding';

function goToNextLevel(
  ecs: GameEngine,
  nextLevel: number,
  operandOnboardingCompletion: GameplayOnboardingCompletion,
): void {
  if (shouldStartOperandTutorial(nextLevel, operandOnboardingCompletion)) {
    void ecs.setScreen('tutorial', {
      kind: 'operands',
      isReplay: false,
      returnTo: { kind: 'level', level: nextLevel },
    });
    return;
  }
  void ecs.setScreen('playing', {
    level: nextLevel,
    isFreshGame: false,
  });
}

export function addLevelCompleteSystemToEngine(): void {
  gameEngine.addSystem('levelCompleteSystem')
    .setPriority(SYSTEM_PRIORITIES.LEVEL_COMPLETE)
    .inScreens(['levelComplete'])
    .runWhenEmpty()
    .withResources(['operandOnboardingCompletion'])
    .setProcess(({ ecs, resources: { operandOnboardingCompletion } }) => {
      const state = ecs.getScreenState('levelComplete');
      const elapsed = performance.now() - state.startedAt;
      if (elapsed < LEVEL_COMPLETE_DURATION_MS || state.transitionStarted) return;

      ecs.updateScreenState('levelComplete', { transitionStarted: true });
      goToNextLevel(ecs, state.nextLevel, operandOnboardingCompletion);
    });
}
