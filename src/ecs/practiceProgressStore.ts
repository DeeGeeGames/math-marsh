import type { EquationOperation } from './types';
import { PRACTICE_FINAL_STEP } from './practiceSteps';

export const PRACTICE_PROGRESS_KEY = 'math-marsh-practice-progress';
export const PRACTICE_PROGRESS_VERSION = 1;

export type SavedPracticeTrack = Readonly<{
  currentStep: number;
  highestUnlockedStep: number;
}>;

export type SavedPracticeProgress = Readonly<Record<EquationOperation, SavedPracticeTrack>>;
export type PracticeProgressPersistence = 'persistent' | 'session-only';
export type PracticeProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type LoadedPracticeProgress = Readonly<{
  progress: SavedPracticeProgress;
  persistence: PracticeProgressPersistence;
}>;

const freshTrack = (): SavedPracticeTrack => ({ currentStep: 1, highestUnlockedStep: 1 });

export const initialSavedPracticeProgress = function(): SavedPracticeProgress {
  return {
    add: freshTrack(),
    subtract: freshTrack(),
    multiply: freshTrack(),
    divide: freshTrack(),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPracticeStep = (value: unknown): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 1
  && value <= PRACTICE_FINAL_STEP;

const savedTrackFromUnknown = (value: unknown): SavedPracticeTrack => {
  if (!isRecord(value)) return freshTrack();
  const { currentStep, highestUnlockedStep } = value;
  if (
    !isPracticeStep(currentStep)
    || !isPracticeStep(highestUnlockedStep)
    || currentStep > highestUnlockedStep
  ) return freshTrack();
  return { currentStep, highestUnlockedStep };
};

export const practiceProgressFromStoredValue = function(stored: string | null): SavedPracticeProgress {
  if (!stored) return initialSavedPracticeProgress();
  try {
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || value.version !== PRACTICE_PROGRESS_VERSION || !isRecord(value.tracks)) {
      return initialSavedPracticeProgress();
    }
    return {
      add: savedTrackFromUnknown(value.tracks.add),
      subtract: savedTrackFromUnknown(value.tracks.subtract),
      multiply: savedTrackFromUnknown(value.tracks.multiply),
      divide: savedTrackFromUnknown(value.tracks.divide),
    };
  } catch {
    return initialSavedPracticeProgress();
  }
};

const browserStorage = (): PracticeProgressStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const loadPracticeProgress = function(
  storage: PracticeProgressStorage | undefined = browserStorage(),
): LoadedPracticeProgress {
  if (!storage) {
    return { progress: initialSavedPracticeProgress(), persistence: 'session-only' };
  }
  try {
    return {
      progress: practiceProgressFromStoredValue(storage.getItem(PRACTICE_PROGRESS_KEY)),
      persistence: 'persistent',
    };
  } catch {
    return { progress: initialSavedPracticeProgress(), persistence: 'session-only' };
  }
};

export const savePracticeProgress = function(
  progress: SavedPracticeProgress,
  storage: PracticeProgressStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify({
      version: PRACTICE_PROGRESS_VERSION,
      tracks: progress,
    }));
    return true;
  } catch {
    return false;
  }
};
