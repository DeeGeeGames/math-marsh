import { describe, expect, test } from 'bun:test';
import {
  addPracticeAssessmentTime,
  createPracticeAssessment,
  practiceAssessmentForEvaluation,
  recordPracticeAssessmentAnswer,
  type PracticeAssessmentState,
} from './practiceAssessment';

describe('practice assessment samples', () => {
  test('accumulates active time and records each completed answer once', () => {
    const started = createPracticeAssessment();
    const timed = addPracticeAssessmentTime(started, 12.5);
    if (!timed) throw new Error('Expected a valid timed assessment');
    const wrong = recordPracticeAssessmentAnswer(timed, false);
    if (!wrong) throw new Error('Expected a valid incorrect answer');
    const correct = recordPracticeAssessmentAnswer(wrong, true, 10);

    expect(correct).toEqual({
      correctAnswers: 1,
      incorrectAnswers: 1,
      activeSeconds: 12.5,
      expectedSecondsTotal: 10,
    });
  });

  test('does not count another completed answer after six correct equations', () => {
    const completed = Array.from({ length: 6 }).reduce<PracticeAssessmentState>((assessment) => {
      const next = recordPracticeAssessmentAnswer(assessment, true, 10);
      if (!next) throw new Error('Expected a valid answer');
      return next;
    }, createPracticeAssessment());

    expect(recordPracticeAssessmentAnswer(completed, false)).toBe(completed);
    expect(completed.correctAnswers).toBe(6);
    expect(completed.incorrectAnswers).toBe(0);
  });

  test('uses the average configured budget for a mixed-format assessment', () => {
    const withFirstFormat = recordPracticeAssessmentAnswer(createPracticeAssessment(), true, 10);
    if (!withFirstFormat) throw new Error('Expected a valid first answer');
    const withSecondFormat = recordPracticeAssessmentAnswer(withFirstFormat, true, 20);
    if (!withSecondFormat) throw new Error('Expected a valid second answer');

    expect(practiceAssessmentForEvaluation(withSecondFormat)).toMatchObject({
      correctAnswers: 2,
      expectedSecondsPerCorrect: 15,
    });
  });

  test('marks invalid active time or a missing format budget as unavailable', () => {
    const invalidTime = addPracticeAssessmentTime(createPracticeAssessment(), Number.NaN);
    if (!invalidTime) throw new Error('Expected an assessment sample');
    const invalidBudget = recordPracticeAssessmentAnswer(invalidTime, true);
    if (!invalidBudget) throw new Error('Expected a recorded answer');

    expect(practiceAssessmentForEvaluation(invalidBudget)).toEqual({
      correctAnswers: 1,
      incorrectAnswers: 0,
    });
    expect(addPracticeAssessmentTime(createPracticeAssessment(), -1)?.activeSeconds).toBeNull();
  });
});
