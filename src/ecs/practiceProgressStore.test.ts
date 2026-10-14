import { describe, expect, test } from 'bun:test';
import {
  initialSavedPracticeProgress,
  loadPracticeProgress,
  PRACTICE_PROGRESS_KEY,
  PRACTICE_PROGRESS_VERSION,
  practiceProgressFromStoredValue,
  savePracticeProgress,
  type PracticeProgressStorage,
} from './practiceProgressStore';

const createMemoryStorage = function(initialValue: string | null = null): PracticeProgressStorage {
  let stored = initialValue;
  return {
    getItem: function(): string | null { return stored; },
    setItem: function(key: string, value: string): void {
      if (key !== PRACTICE_PROGRESS_KEY) throw new Error('Unexpected storage key');
      stored = value;
    },
  };
};

describe('saved practice progression', () => {
  test('loads fresh independent tracks when progress is missing', () => {
    expect(practiceProgressFromStoredValue(null)).toEqual(initialSavedPracticeProgress());
  });

  test('saves and reloads current and highest step for each operation', () => {
    const storage = createMemoryStorage();
    const progress = {
      ...initialSavedPracticeProgress(),
      add: { currentStep: 7, highestUnlockedStep: 11 },
      divide: { currentStep: 3, highestUnlockedStep: 3 },
    };

    expect(savePracticeProgress(progress, storage)).toBe(true);
    expect(loadPracticeProgress(storage)).toEqual({ progress, persistence: 'persistent' });
    expect(loadPracticeProgress(storage).progress.subtract).toEqual({
      currentStep: 1,
      highestUnlockedStep: 1,
    });
  });

  test('resets malformed, out-of-range, and unsupported version data safely', () => {
    const malformed = JSON.stringify({
      version: PRACTICE_PROGRESS_VERSION,
      tracks: {
        add: { currentStep: 8, highestUnlockedStep: 11 },
        subtract: { currentStep: 7, highestUnlockedStep: 2 },
        multiply: { currentStep: 12, highestUnlockedStep: 12 },
      },
    });
    const unsupported = JSON.stringify({
      version: PRACTICE_PROGRESS_VERSION + 1,
      tracks: { add: { currentStep: 4, highestUnlockedStep: 8 } },
    });

    expect(practiceProgressFromStoredValue(malformed)).toEqual({
      ...initialSavedPracticeProgress(),
      add: { currentStep: 8, highestUnlockedStep: 11 },
    });
    expect(practiceProgressFromStoredValue('{')).toEqual(initialSavedPracticeProgress());
    expect(practiceProgressFromStoredValue(unsupported)).toEqual(initialSavedPracticeProgress());
  });

  test('reports session-only progress when storage is unavailable or throws', () => {
    const unavailable = loadPracticeProgress(undefined);
    const throwingStorage: PracticeProgressStorage = {
      getItem: () => { throw new Error('Storage unavailable'); },
      setItem: () => { throw new Error('Storage unavailable'); },
    };

    expect(unavailable.persistence).toBe('session-only');
    expect(savePracticeProgress(initialSavedPracticeProgress(), undefined)).toBe(false);
    expect(loadPracticeProgress(throwingStorage)).toEqual({
      progress: initialSavedPracticeProgress(),
      persistence: 'session-only',
    });
    expect(savePracticeProgress(initialSavedPracticeProgress(), throwingStorage)).toBe(false);
  });
});
