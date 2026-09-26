import { describe, expect, test } from 'bun:test';
import {
  STARTING_TIME_SECONDS,
  timeAfterChange,
  timeAfterWrongAnswer,
  timeForCorrectAnswer,
} from './runTime';

describe('endurance run time', () => {
  test('awards time by difficulty without a time bank cap', () => {
    expect(timeForCorrectAnswer(STARTING_TIME_SECONDS, 'easy')).toBe(STARTING_TIME_SECONDS + 10);
    expect(timeForCorrectAnswer(STARTING_TIME_SECONDS, 'medium')).toBe(STARTING_TIME_SECONDS + 5);
    expect(timeForCorrectAnswer(600, 'expert')).toBe(603);
  });

  test('wrong answers cost time by difficulty and penalties stop at zero', () => {
    expect(timeAfterWrongAnswer(20, 'easy')).toBe(10);
    expect(timeAfterWrongAnswer(20, 'medium')).toBe(13);
    expect(timeAfterWrongAnswer(20, 'expert')).toBe(15);
    expect(timeAfterWrongAnswer(5, 'expert')).toBe(0);
    expect(timeAfterChange(0.1, -0.25)).toBe(0);
  });
});
