import type { MathDifficulty } from '../ecs/types';
import { equationPromptKindForLevel } from '../math/equations';

export type GameplayOnboardingCompletion = 'pending' | 'completed' | 'skipped';
export type GameplayOnboardingKind = 'basics' | 'operands' | 'operandAndResult';

export const SCRIPTED_TUTORIAL_STEPS = [
  {
    id: 'move',
    title: 'Move across the pond',
    copy: 'The fly moves from one lily pad to the next.',
  },
  {
    id: 'identifyTarget',
    title: 'Find the number',
    copy: 'Look at the equation. Find a lily pad with a number you need.',
  },
  {
    id: 'eat',
    title: 'Eat the number',
    copy: 'The fly moves to that lily pad and eats the number.',
  },
  {
    id: 'feedback',
    title: 'See what happens',
    copy: 'Right answers add time. A wrong answer costs time, but you can try again.',
  },
  {
    id: 'enemyDanger',
    title: 'Stay away from animals',
    copy: 'Pond animals cost time when they hit you. Watch where they move.',
  },
] as const;

export const OPERAND_TUTORIAL_STEPS = [
  {
    id: 'emptySpots',
    title: 'Find two numbers',
    copy: 'This equation has two empty spots. You need two numbers to solve it.',
  },
  {
    id: 'firstNumber',
    title: 'Find the first number',
    copy: 'Find 3 on the pond. It goes in the first empty spot.',
  },
  {
    id: 'eatFirstNumber',
    title: 'Eat the first number',
    copy: 'The fly eats 3. One empty spot is now filled.',
  },
  {
    id: 'secondNumber',
    title: 'Find the next number',
    copy: 'Now find 5. It goes in the next empty spot.',
  },
  {
    id: 'finishEquation',
    title: 'Finish the equation',
    copy: 'The fly eats 5. The two numbers make 8, so the equation is done.',
  },
] as const;

export const OPERAND_AND_RESULT_TUTORIAL_STEPS = [
  {
    id: 'emptySpots',
    title: 'Choose a number and a result',
    copy: 'The first number is already filled in. Choose the missing number, then choose the result.',
  },
  {
    id: 'firstNumber',
    title: 'Find the missing number',
    copy: 'Find 5 on the pond. It goes after the plus sign: 3 + 5.',
  },
  {
    id: 'eatFirstNumber',
    title: 'Eat the missing number',
    copy: 'The fly eats 5. Now 3 + 5 is filled in, but the result is still empty.',
  },
  {
    id: 'secondNumber',
    title: 'Find the result',
    copy: '3 + 5 makes 8. Find 8 to fill the spot after the equals sign.',
  },
  {
    id: 'finishEquation',
    title: 'Finish the equation',
    copy: 'The fly eats 8 to finish 3 + 5 = 8. Always eat the missing number first, then the result.',
  },
] as const;

export type GameplayOnboardingReturn =
  | { kind: 'newGame' }
  | { kind: 'level'; level: number }
  | { kind: 'nextTutorial' }
  | { kind: 'previousScreen' };

export type GameplayOnboardingPlayerSnapshot = {
  position: { x: number; y: number; rotation?: number };
  remainingTimeSeconds: number;
  gameOverPending?: boolean;
  pathFollower: {
    anchorGridX: number;
    anchorGridY: number;
    breadcrumbs: Array<{ x: number; y: number }>;
    speed: number;
  };
};

export type GameplayOnboardingSession =
  | { active: false }
  | {
      active: true;
      kind: GameplayOnboardingKind;
      isReplay: boolean;
      stepIndex: number;
      returnTo: GameplayOnboardingReturn;
      playerSnapshot?: GameplayOnboardingPlayerSnapshot;
    };

const STORAGE_KEYS = {
  basics: 'math-marsh.gameplayOnboarding',
  operands: 'math-marsh.operandOnboarding',
  operandAndResult: 'math-marsh.operandAndResultOnboarding',
} as const satisfies Record<GameplayOnboardingKind, string>;

export function onboardingCompletionFromStoredValue(
  value: string | null,
): GameplayOnboardingCompletion {
  return value === 'completed' || value === 'skipped' ? value : 'pending';
}

export function loadOnboardingCompletion(
  kind: GameplayOnboardingKind,
): GameplayOnboardingCompletion {
  try {
    if (typeof localStorage === 'undefined') return 'pending';
    return onboardingCompletionFromStoredValue(localStorage.getItem(STORAGE_KEYS[kind]));
  } catch {
    return 'pending';
  }
}

export function saveOnboardingCompletion(
  kind: GameplayOnboardingKind,
  completion: Exclude<GameplayOnboardingCompletion, 'pending'>,
): void {
  try {
    localStorage.setItem(STORAGE_KEYS[kind], completion);
  } catch {
    // Storage can be unavailable in private browsing or locked-down shells.
    // The ECS resource still preserves the choice for the current session.
  }
}

export function skippedOnboardingCompletion(
  completion: GameplayOnboardingCompletion,
): GameplayOnboardingCompletion {
  return completion === 'pending' ? 'skipped' : completion;
}

export function completedOnboardingCompletion(
  completion: GameplayOnboardingCompletion,
): GameplayOnboardingCompletion {
  return completion === 'pending' ? 'completed' : completion;
}

export function shouldStartOperandTutorial(
  nextLevel: number,
  difficulty: MathDifficulty,
  completion: GameplayOnboardingCompletion,
): boolean {
  return nextLevel === 2 && completion === 'pending'
    && equationPromptKindForLevel(nextLevel, difficulty) === 'selectOperands';
}

export function shouldStartOperandAndResultTutorial(
  nextLevel: number,
  difficulty: MathDifficulty,
  completion: GameplayOnboardingCompletion,
): boolean {
  return nextLevel === 3 && completion === 'pending'
    && equationPromptKindForLevel(nextLevel, difficulty) === 'selectOperandAndResult';
}

const TUTORIAL_STEPS = {
  basics: SCRIPTED_TUTORIAL_STEPS,
  operands: OPERAND_TUTORIAL_STEPS,
  operandAndResult: OPERAND_AND_RESULT_TUTORIAL_STEPS,
} as const;

const TUTORIAL_HUD_LABELS = {
  basics: 'Tutorial',
  operands: 'Learn Level 2',
  operandAndResult: 'Learn Level 3',
} as const;

export function tutorialSteps(
  kind: GameplayOnboardingKind,
): ReadonlyArray<{ id: string; title: string; copy: string }> {
  return TUTORIAL_STEPS[kind];
}

export function tutorialHudLabel(session: GameplayOnboardingSession): string | undefined {
  if (!session.active) return undefined;
  return TUTORIAL_HUD_LABELS[session.kind];
}

export function tutorialStepIndex(kind: GameplayOnboardingKind, index: number): number {
  return Math.max(0, Math.min(tutorialSteps(kind).length - 1, index));
}

export function createGameplayOnboardingSession(
  kind: GameplayOnboardingKind,
  isReplay: boolean,
  returnTo: GameplayOnboardingReturn,
  playerSnapshot?: GameplayOnboardingPlayerSnapshot,
): GameplayOnboardingSession {
  return { active: true, kind, isReplay, stepIndex: 0, returnTo, playerSnapshot };
}
