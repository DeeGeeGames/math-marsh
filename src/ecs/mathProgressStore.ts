import type { EquationOperation } from './types';
import { MATH_FINAL_STEP } from './mathSteps';

export const MATH_PROGRESS_KEY = 'math-marsh-practice-progress';
export const MATH_PROGRESS_VERSION = 1;

export type SavedMathTrack = Readonly<{
  currentStep: number;
  highestUnlockedStep: number;
}>;

export type SavedMathProgress = Readonly<Record<EquationOperation, SavedMathTrack>>;
export type MathProgressPersistence = 'persistent' | 'session-only';
export type MathProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type LoadedMathProgress = Readonly<{
  progress: SavedMathProgress;
  persistence: MathProgressPersistence;
}>;

const freshTrack = (): SavedMathTrack => ({ currentStep: 1, highestUnlockedStep: 1 });

export const initialSavedMathProgress = function(): SavedMathProgress {
  return {
    add: freshTrack(),
    subtract: freshTrack(),
    multiply: freshTrack(),
    divide: freshTrack(),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMathStep = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 1
  && value <= MATH_FINAL_STEP;

const savedTrackFromUnknown = (value: unknown): SavedMathTrack => {
  if (!isRecord(value)) return freshTrack();
  const { currentStep, highestUnlockedStep } = value;
  if (
    !isMathStep(currentStep)
    || !isMathStep(highestUnlockedStep)
    || currentStep > highestUnlockedStep
  ) return freshTrack();
  return { currentStep, highestUnlockedStep };
};

export const mathProgressFromStoredValue = function(stored: string | null): SavedMathProgress {
  if (!stored) return initialSavedMathProgress();
  try {
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || value.version !== MATH_PROGRESS_VERSION || !isRecord(value.tracks)) {
      return initialSavedMathProgress();
    }
    return {
      add: savedTrackFromUnknown(value.tracks.add),
      subtract: savedTrackFromUnknown(value.tracks.subtract),
      multiply: savedTrackFromUnknown(value.tracks.multiply),
      divide: savedTrackFromUnknown(value.tracks.divide),
    };
  } catch {
    return initialSavedMathProgress();
  }
};

const browserStorage = (): MathProgressStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const loadMathProgress = function(
  storage: MathProgressStorage | undefined = browserStorage(),
): LoadedMathProgress {
  if (!storage) {
    return { progress: initialSavedMathProgress(), persistence: 'session-only' };
  }
  try {
    const stored = storage.getItem(MATH_PROGRESS_KEY);
    // A readable store may still reject writes (for example, quota or policy).
    const progress = mathProgressFromStoredValue(stored);
    return {
      progress,
      persistence: (function(): MathProgressPersistence {
        try {
          storage.setItem(MATH_PROGRESS_KEY, stored ?? JSON.stringify({ version: MATH_PROGRESS_VERSION, tracks: progress }));
          return 'persistent' as const;
        } catch {
          return 'session-only' as const;
        }
      })(),
    };
  } catch {
    return { progress: initialSavedMathProgress(), persistence: 'session-only' };
  }
};

export const selectUnlockedMathStep = function(
  progress: SavedMathProgress,
  operation: EquationOperation,
  step: number,
): SavedMathProgress | undefined {
  if (!Number.isSafeInteger(step) || step < 1 || step > progress[operation].highestUnlockedStep) return undefined;
  return { ...progress, [operation]: { ...progress[operation], currentStep: step } };
};

export const saveMathProgress = function(
  progress: SavedMathProgress,
  storage: MathProgressStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(MATH_PROGRESS_KEY, JSON.stringify({
      version: MATH_PROGRESS_VERSION,
      tracks: progress,
    }));
    return true;
  } catch {
    return false;
  }
};
