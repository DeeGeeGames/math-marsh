import { describe, expect, test } from 'bun:test';
import {
  STARTING_TIME_SECONDS,
  correctAnswerBonusSeconds,
  timeAfterChange,
  timeAfterWrongAnswer,
  timeForCorrectAnswer,
} from './runTime';

describe('endurance run time', () => {
  test('awards time by difficulty without a time bank cap', () => {
    expect(timeForCorrectAnswer(STARTING_TIME_SECONDS, 'easy')).toBe(STARTING_TIME_SECONDS + 10);
    expect(timeForCorrectAnswer(STARTING_TIME_SECONDS, 'medium')).toBe(STARTING_TIME_SECONDS + 10);
    expect(timeForCorrectAnswer(600, 'expert')).toBe(610);
  });

  test('wrong answers cost time by difficulty and penalties stop at zero', () => {
    expect(timeAfterWrongAnswer(20, 'easy')).toBe(10);
    expect(timeAfterWrongAnswer(20, 'medium')).toBe(13);
    expect(timeAfterWrongAnswer(20, 'expert')).toBe(15);
    expect(timeAfterWrongAnswer(5, 'expert')).toBe(0);
    expect(timeAfterChange(0.1, -0.25)).toBe(0);
  });

  test('each difficulty adds its own bonus for every level beyond the first', () => {
    expect([1, 2, 3].map(level => correctAnswerBonusSeconds('easy', level))).toEqual([10, 11, 12]);
    expect([1, 2, 3].map(level => correctAnswerBonusSeconds('medium', level))).toEqual([10, 12, 14]);
    expect([1, 2, 3].map(level => correctAnswerBonusSeconds('expert', level))).toEqual([10, 13, 16]);
    expect(timeForCorrectAnswer(600, 'expert', 11)).toBe(640);
  });
});
