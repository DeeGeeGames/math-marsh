import { isDemoArcadeComplete } from '../demoArcade';
import { practiceEquationMode } from '../practiceSession';
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
  if (isDemoArcadeComplete(ecs.tryGetResource('demoArcadeRun'))) {
    void ecs.setScreen('gameOver', {});
    return;
  }
  const practice = ecs.tryGetResource('practiceSession');
  const needsOperandTutorial = !practice || practiceEquationMode(practice, nextLevel).operandsRequired > 1;
  const tutorialKind = needsOperandTutorial
    ? mathTutorialForLevel(nextLevel, mathDifficulty, operandOnboardingCompletion, operandAndResultOnboardingCompletion)
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
};
