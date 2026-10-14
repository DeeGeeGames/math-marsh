import { describe, expect, test } from 'bun:test';
import {
  evaluatePracticeProgressionRound,
  type PracticeAssessment,
  type PracticeProgress,
} from './practiceProgression';

const initialProgress: PracticeProgress = {
  currentStep: 1,
  highestUnlockedStep: 1,
  accelerationStreak: 0,
};

const qualifyingAssessment: PracticeAssessment = {
  correctAnswers: 6,
  incorrectAnswers: 0,
  activeSeconds: 48,
  expectedSecondsPerCorrect: 10,
};

describe('adaptive practice progression', () => {
  test('requires six correct equations and leaves the acceleration streak unchanged below that minimum', () => {
    const progress = { ...initialProgress, accelerationStreak: 2 };
    const result = evaluatePracticeProgressionRound(
      progress,
      { ...qualifyingAssessment, correctAnswers: 5 },
      11,
    );

    expect(result).toEqual({
      kind: 'insufficientSample',
      progress,
      unlockedSteps: [],
    });
  });

  test('advances one step at exactly 0.80 accuracy and resets acceleration', () => {
    const result = evaluatePracticeProgressionRound(
      { ...initialProgress, accelerationStreak: 2 },
      { ...qualifyingAssessment, correctAnswers: 8, incorrectAnswers: 2, activeSeconds: 100 },
      11,
    );

    expect(result).toMatchObject({
      kind: 'advanced',
      accelerated: false,
      accuracy: 0.8,
      advanceBy: 1,
      progress: { currentStep: 2, highestUnlockedStep: 2, accelerationStreak: 0 },
      unlockedSteps: [2],
    });
  });

  test('accelerates at exactly 0.90 accuracy and a time ratio of 0.80', () => {
    const result = evaluatePracticeProgressionRound(
      initialProgress,
      {
        correctAnswers: 9,
        incorrectAnswers: 1,
        activeSeconds: 72,
        expectedSecondsPerCorrect: 10,
      },
      11,
    );

    expect(result).toMatchObject({
      kind: 'advanced',
      accelerated: true,
      accuracy: 0.9,
      timeRatio: 0.8,
      advanceBy: 2,
      progress: { currentStep: 3, highestUnlockedStep: 3, accelerationStreak: 1 },
      unlockedSteps: [2, 3],
    });
  });

  test('advances 1 to 3 to 7 to 11 over three qualifying rounds', () => {
    const first = evaluatePracticeProgressionRound(initialProgress, qualifyingAssessment, 11);
    if (first.kind !== 'advanced') throw new Error('Expected the first assessment to advance');
    const second = evaluatePracticeProgressionRound(first.progress, qualifyingAssessment, 11);
    if (second.kind !== 'advanced') throw new Error('Expected the second assessment to advance');
    const third = evaluatePracticeProgressionRound(second.progress, qualifyingAssessment, 11);

    expect([first.progress.currentStep, second.progress.currentStep, third.kind === 'advanced' ? third.progress.currentStep : null])
      .toEqual([3, 7, 11]);
    expect(second.unlockedSteps).toEqual([4, 5, 6, 7]);
    expect(third.kind === 'advanced' ? third.unlockedSteps : []).toEqual([8, 9, 10, 11]);
  });

  test('resets acceleration after low accuracy or slower accurate play', () => {
    const lowAccuracy = evaluatePracticeProgressionRound(
      { ...initialProgress, accelerationStreak: 2 },
      { ...qualifyingAssessment, incorrectAnswers: 2 },
      11,
    );
    const slowAccurate = evaluatePracticeProgressionRound(
      { ...initialProgress, accelerationStreak: 2 },
      { ...qualifyingAssessment, activeSeconds: 75 },
      11,
    );

    expect(lowAccuracy).toMatchObject({
      kind: 'stayed',
      reason: 'lowAccuracy',
      progress: { currentStep: 1, highestUnlockedStep: 1, accelerationStreak: 0 },
    });
    expect(slowAccurate).toMatchObject({
      kind: 'advanced',
      accelerated: false,
      timeRatio: 1.25,
      advanceBy: 1,
      progress: { currentStep: 2, highestUnlockedStep: 2, accelerationStreak: 0 },
    });
  });

  test('never accelerates with missing, zero, or invalid timing', () => {
    const missingTime = evaluatePracticeProgressionRound(initialProgress, {
      correctAnswers: 6,
      incorrectAnswers: 0,
    }, 11);
    const zeroTime = evaluatePracticeProgressionRound(initialProgress, {
      ...qualifyingAssessment,
      activeSeconds: 0,
    }, 11);
    const invalidBudget = evaluatePracticeProgressionRound(initialProgress, {
      ...qualifyingAssessment,
      expectedSecondsPerCorrect: Number.NaN,
    }, 11);

    [missingTime, zeroTime, invalidBudget].forEach(result => {
      expect(result).toMatchObject({
        kind: 'advanced',
        accelerated: false,
        timeRatio: null,
        advanceBy: 1,
        progress: { currentStep: 2, highestUnlockedStep: 2, accelerationStreak: 0 },
      });
    });
  });

  test('clamps at the final step and preserves higher unlocks when revisiting an earlier step', () => {
    const finalStep = evaluatePracticeProgressionRound(
      { currentStep: 10, highestUnlockedStep: 10, accelerationStreak: 1 },
      qualifyingAssessment,
      11,
    );
    const revisit = evaluatePracticeProgressionRound(
      { currentStep: 4, highestUnlockedStep: 7, accelerationStreak: 0 },
      { ...qualifyingAssessment, activeSeconds: 75 },
      11,
    );

    expect(finalStep).toMatchObject({
      kind: 'advanced',
      advanceBy: 1,
      progress: { currentStep: 11, highestUnlockedStep: 11, accelerationStreak: 2 },
      unlockedSteps: [11],
    });
    expect(revisit).toMatchObject({
      kind: 'advanced',
      progress: { currentStep: 5, highestUnlockedStep: 7, accelerationStreak: 0 },
      unlockedSteps: [],
    });
  });

  test('handles zero-count and invalid count samples explicitly', () => {
    const empty = evaluatePracticeProgressionRound(initialProgress, {
      correctAnswers: 0,
      incorrectAnswers: 0,
      activeSeconds: 1,
      expectedSecondsPerCorrect: 10,
    }, 11);
    const negative = evaluatePracticeProgressionRound(initialProgress, {
      ...qualifyingAssessment,
      incorrectAnswers: -1,
    }, 11);

    expect(empty).toMatchObject({ kind: 'insufficientSample' });
    expect(negative).toEqual({ kind: 'invalid', reason: 'sample' });
  });
});
