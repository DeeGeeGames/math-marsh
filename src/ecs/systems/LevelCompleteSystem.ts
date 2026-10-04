import type { GameEngine, GameSystemRegistrar } from '../Engine';
import type { MathDifficulty } from '../types';
import { LEVEL_COMPLETE_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import {
  shouldStartOperandTutorial,
  shouldStartOperandAndResultTutorial,
  type GameplayOnboardingCompletion,
} from '../../onboarding/gameplayOnboarding';

function goToNextLevel(
  ecs: GameEngine,
  nextLevel: number,
  mathDifficulty: MathDifficulty,
  operandOnboardingCompletion: GameplayOnboardingCompletion,
  operandAndResultOnboardingCompletion: GameplayOnboardingCompletion,
): void {
  const tutorialKind = shouldStartOperandTutorial(nextLevel, mathDifficulty, operandOnboardingCompletion)
    ? 'operands'
    : shouldStartOperandAndResultTutorial(nextLevel, mathDifficulty, operandAndResultOnboardingCompletion)
      ? 'operandAndResult'
      : undefined;
  if (tutorialKind) {
    void ecs.setScreen('tutorial', {
      kind: tutorialKind,
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

export function addLevelCompleteSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('levelCompleteSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.LEVEL_COMPLETE)
    .inScreens(['levelComplete'])
    .runWhenEmpty()
    .withResources(['mathDifficulty', 'operandOnboardingCompletion', 'operandAndResultOnboardingCompletion'])
    .setProcess(({ ecs, resources: { mathDifficulty, operandOnboardingCompletion, operandAndResultOnboardingCompletion } }) => {
      const state = ecs.getScreenState('levelComplete');
      const elapsed = performance.now() - state.startedAt;
      if (elapsed < LEVEL_COMPLETE_DURATION_MS || state.transitionStarted) return;

      ecs.updateScreenState('levelComplete', { transitionStarted: true });
      goToNextLevel(ecs, state.nextLevel, mathDifficulty, operandOnboardingCompletion, operandAndResultOnboardingCompletion);
    });
}
