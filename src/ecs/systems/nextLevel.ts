import type { GameEngine } from '../Engine';
import type { MathDifficulty } from '../types';
import { mathTutorialForMode } from '../mathMode';
import {
  shouldStartOperandTutorial,
  shouldStartOperandAndResultTutorial,
  type GameplayOnboardingCompletion,
} from '../../onboarding/gameplayOnboarding';

export const goToNextLevel = function(
  ecs: GameEngine,
  nextLevel: number,
  mathDifficulty: MathDifficulty,
  operandOnboardingCompletion: GameplayOnboardingCompletion,
  operandAndResultOnboardingCompletion: GameplayOnboardingCompletion,
): void {
  const mathSession = ecs.tryGetResource('mathSession');
  const tutorialKind = mathSession
    ? mathTutorialForMode(mathSession, ecs.getResource('gameMode'), operandOnboardingCompletion, operandAndResultOnboardingCompletion)
    : shouldStartOperandTutorial(nextLevel, mathDifficulty, operandOnboardingCompletion)
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
};
