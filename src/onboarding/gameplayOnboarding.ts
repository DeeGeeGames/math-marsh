export type GameplayOnboardingCompletion = 'pending' | 'completed' | 'skipped';
export type GameplayOnboardingKind = 'basics' | 'operands';

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
    copy: 'Right answers clear lily pads. A wrong answer takes one life. You can try again.',
  },
  {
    id: 'enemyDanger',
    title: 'Stay away from animals',
    copy: 'Pond animals can take one life. Watch where they move and stay out of their way.',
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

export type GameplayOnboardingReturn =
  | { kind: 'newGame' }
  | { kind: 'level'; level: number }
  | { kind: 'nextTutorial' }
  | { kind: 'previousScreen' };

export type GameplayOnboardingPlayerSnapshot = {
  position: { x: number; y: number; rotation?: number };
  lives: number;
  gameOverPending?: boolean;
  health: { current: number; max: number };
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
  completion: GameplayOnboardingCompletion,
): boolean {
  return nextLevel === 2 && completion === 'pending';
}

export function tutorialSteps(
  kind: GameplayOnboardingKind,
): ReadonlyArray<{ id: string; title: string; copy: string }> {
  return kind === 'operands' ? OPERAND_TUTORIAL_STEPS : SCRIPTED_TUTORIAL_STEPS;
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
