import type { GameMode, MathDifficulty, SettingsReturnScreen } from '../ecs/types';

export const modeLabels: Record<GameMode, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  anything: 'Anything',
} as const;

export const difficultyLabels: Record<MathDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  expert: 'Expert',
} as const;

export const settingsBackLabels: Record<SettingsReturnScreen, string> = {
  menu: '← Back to Menu',
  modeSelect: '← Back to Mode Selection',
  howToPlay: '← Back to How to Play',
  playing: '← Back to Game',
  tutorial: '← Back to Tutorial',
  paused: '← Back to Game',
  gameOver: '← Back to Game Over',
} as const;

export const gameplayLevelLabel = (
  mode: GameMode,
  difficulty: MathDifficulty,
  level: number,
): string =>
  `${modeLabels[mode]} - ${difficultyLabels[difficulty]} - Level ${level}`;

export const isGameMode = (value: string | undefined): value is GameMode =>
  value !== undefined && value in modeLabels;

export const isMathDifficulty = (value: string | undefined): value is MathDifficulty =>
  value !== undefined && value in difficultyLabels;
