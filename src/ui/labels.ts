import type { EquationOperation, GameMode, MathDifficulty, SettingsReturnScreen } from '../ecs/types';

export const operationLabels: Record<EquationOperation, string> = {
  add: 'Addition',
  subtract: 'Subtraction',
  multiply: 'Multiplication',
  divide: 'Division',
} as const;

const operationSymbols: Record<EquationOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
} as const;

export const selectedOperationsLabel = (mode: GameMode): string =>
  mode.length === 1 ? operationLabels[mode[0]] : `Mixed (${mode.map(operation => operationSymbols[operation]).join(' ')})`;

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
  `${selectedOperationsLabel(mode)} - ${difficultyLabels[difficulty]} - Level ${level}`;

export const isEquationOperation = (value: string | undefined): value is EquationOperation =>
  value !== undefined && value in operationLabels;

export const isMathDifficulty = (value: string | undefined): value is MathDifficulty =>
  value !== undefined && value in difficultyLabels;
