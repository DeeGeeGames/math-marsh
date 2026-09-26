import { GAME_CONFIG } from '../config';
import type { MathDifficulty } from './types';

export const STARTING_TIME_SECONDS = GAME_CONFIG.GAMEPLAY.STARTING_TIME_SECONDS;

export const formatRemainingTime = (remainingSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const timeAfterChange = (remainingSeconds: number, changeSeconds: number): number =>
  Math.max(0, remainingSeconds + changeSeconds);

export const timeForCorrectAnswer = (remainingSeconds: number, mathDifficulty: MathDifficulty): number =>
  timeAfterChange(remainingSeconds, GAME_CONFIG.GAMEPLAY.CORRECT_ANSWER_BONUS_SECONDS[mathDifficulty]);

export const timeAfterWrongAnswer = (remainingSeconds: number, mathDifficulty: MathDifficulty): number =>
  timeAfterChange(remainingSeconds, -GAME_CONFIG.GAMEPLAY.WRONG_ANSWER_PENALTY_SECONDS[mathDifficulty]);
