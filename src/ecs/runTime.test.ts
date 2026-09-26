import { describe, expect, test } from 'bun:test';
import { GAME_CONFIG } from '../config';
import {
  STARTING_TIME_SECONDS,
  timeAfterChange,
  timeAfterWrongAnswer,
  timeForCorrectAnswer,
} from './runTime';

describe('endurance run time', () => {
  test('awards one completed equation without a time bank cap', () => {
    expect(timeForCorrectAnswer(STARTING_TIME_SECONDS))
      .toBe(STARTING_TIME_SECONDS + GAME_CONFIG.GAMEPLAY.CORRECT_ANSWER_BONUS_SECONDS);
    expect(timeForCorrectAnswer(600)).toBe(600 + GAME_CONFIG.GAMEPLAY.CORRECT_ANSWER_BONUS_SECONDS);
  });

  test('penalties and clock ticks stop at zero', () => {
    expect(timeAfterWrongAnswer(5)).toBe(0);
    expect(timeAfterChange(0.1, -0.25)).toBe(0);
  });
});
