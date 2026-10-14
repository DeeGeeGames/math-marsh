import type { GameEngine } from '../Engine';
import type { MathDifficulty } from '../types';
import { mathTutorialForLevel } from '../mathMode';
import type { GameplayOnboardingCompletion } from '../../onboarding/gameplayOnboarding';

export const goToNextLevel = function(
  ecs: GameEngine,
  nextLevel: number,
  mathDifficulty: MathDifficulty,
  operandOnboardingCompletion: GameplayOnboardingCompletion,
  operandAndResultOnboardingCompletion: GameplayOnboardingCompletion,
): void {
  const tutorialKind = mathTutorialForLevel(nextLevel, mathDifficulty,
    operandOnboardingCompletion, operandAndResultOnboardingCompletion);
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
};
