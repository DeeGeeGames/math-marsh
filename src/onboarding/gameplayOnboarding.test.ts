import { describe, expect, test } from 'bun:test';
import {
  completedOnboardingCompletion,
  createGameplayOnboardingSession,
  onboardingCompletionFromStoredValue,
  skippedOnboardingCompletion,
  shouldStartOperandTutorial,
  shouldStartOperandAndResultTutorial,
  tutorialHudLabel,
  tutorialStepIndex,
  tutorialSteps,
} from './gameplayOnboarding';

describe('gameplay onboarding persistence', () => {
  test('accepts only persisted terminal states', () => {
    expect(onboardingCompletionFromStoredValue('completed')).toBe('completed');
    expect(onboardingCompletionFromStoredValue('skipped')).toBe('skipped');
    expect(onboardingCompletionFromStoredValue('pending')).toBe('pending');
    expect(onboardingCompletionFromStoredValue('unexpected')).toBe('pending');
    expect(onboardingCompletionFromStoredValue(null)).toBe('pending');
  });

  test('skipping a replay does not replace an existing terminal state', () => {
    expect(skippedOnboardingCompletion('pending')).toBe('skipped');
    expect(skippedOnboardingCompletion('completed')).toBe('completed');
    expect(skippedOnboardingCompletion('skipped')).toBe('skipped');
  });

  test('finishing a replay does not replace an existing terminal state', () => {
    expect(completedOnboardingCompletion('pending')).toBe('completed');
    expect(completedOnboardingCompletion('completed')).toBe('completed');
    expect(completedOnboardingCompletion('skipped')).toBe('skipped');
  });

  test('creates and bounds scripted tutorial progress', () => {
    expect(createGameplayOnboardingSession('basics', false, { kind: 'newGame' })).toEqual({
      active: true,
      kind: 'basics',
      isReplay: false,
      stepIndex: 0,
      returnTo: { kind: 'newGame' },
    });
    expect(tutorialStepIndex('basics', -1)).toBe(0);
    expect(tutorialStepIndex('basics', 2)).toBe(2);
    expect(tutorialStepIndex('basics', 99)).toBe(4);
    expect(tutorialStepIndex('operands', 99)).toBe(4);
    expect(tutorialSteps('operands').map(step => step.id)).toEqual([
      'emptySpots',
      'firstNumber',
      'eatFirstNumber',
      'secondNumber',
      'finishEquation',
    ]);
  });

  test('starts the operand lesson only on the first arrival at Level 2', () => {
    expect(shouldStartOperandTutorial(2, 'easy', 'pending')).toBe(false);
    expect(shouldStartOperandTutorial(2, 'medium', 'pending')).toBe(true);
    expect(shouldStartOperandTutorial(2, 'expert', 'pending')).toBe(true);
    expect(shouldStartOperandTutorial(2, 'medium', 'completed')).toBe(false);
    expect(shouldStartOperandTutorial(2, 'medium', 'skipped')).toBe(false);
    expect(shouldStartOperandTutorial(3, 'medium', 'pending')).toBe(false);
  });

  test('starts the mixed lesson only on the first arrival at Level 3', () => {
    expect(shouldStartOperandAndResultTutorial(3, 'easy', 'pending')).toBe(false);
    expect(shouldStartOperandAndResultTutorial(3, 'medium', 'pending')).toBe(false);
    expect(shouldStartOperandAndResultTutorial(3, 'expert', 'pending')).toBe(true);
    expect(shouldStartOperandAndResultTutorial(3, 'expert', 'completed')).toBe(false);
    expect(shouldStartOperandAndResultTutorial(3, 'expert', 'skipped')).toBe(false);
    expect(shouldStartOperandAndResultTutorial(2, 'expert', 'pending')).toBe(false);
    expect(shouldStartOperandAndResultTutorial(6, 'expert', 'pending')).toBe(false);
    expect(tutorialStepIndex('operandAndResult', 99)).toBe(4);
  });

  test('labels only active tutorial sessions for the gameplay HUD', () => {
    expect(tutorialHudLabel({ active: false })).toBeUndefined();
    expect(tutorialHudLabel(
      createGameplayOnboardingSession('basics', false, { kind: 'newGame' }),
    )).toBe('Tutorial');
    expect(tutorialHudLabel(
      createGameplayOnboardingSession('operands', false, { kind: 'level', level: 2 }),
    )).toBe('Learn Level 2');
    expect(tutorialHudLabel(
      createGameplayOnboardingSession('operandAndResult', false, { kind: 'level', level: 3 }),
    )).toBe('Learn Level 3');
  });
});
