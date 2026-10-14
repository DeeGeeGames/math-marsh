import { describe, expect, test } from 'bun:test';
import {
  initialSavedMathProgress,
  loadMathProgress,
  MATH_PROGRESS_KEY,
  MATH_PROGRESS_VERSION,
  mathProgressFromStoredValue,
  saveMathProgress,
  selectUnlockedMathStep,
  type MathProgressStorage,
} from './mathProgressStore';

const createMemoryStorage = function(initialValue: string | null = null): MathProgressStorage {
  let stored = initialValue;
  return {
    getItem: function(): string | null { return stored; },
    setItem: function(key: string, value: string): void {
      if (key !== MATH_PROGRESS_KEY) throw new Error('Unexpected storage key');
      stored = value;
    },
  };
};

describe('saved math progression', () => {
  test('loads fresh independent tracks when progress is missing', () => {
    expect(mathProgressFromStoredValue(null)).toEqual(initialSavedMathProgress());
  });

  test('saves and reloads current and highest step for each operation', () => {
    const storage = createMemoryStorage();
    const progress = {
      ...initialSavedMathProgress(),
      add: { currentStep: 7, highestUnlockedStep: 11 },
      divide: { currentStep: 3, highestUnlockedStep: 3 },
    };

    expect(saveMathProgress(progress, storage)).toBe(true);
    expect(loadMathProgress(storage)).toEqual({ progress, persistence: 'persistent' });
    expect(loadMathProgress(storage).progress.subtract).toEqual({
      currentStep: 1,
      highestUnlockedStep: 1,
    });
  });

  test('resets malformed, out-of-range, and unsupported version data safely', () => {
    const malformed = JSON.stringify({
      version: MATH_PROGRESS_VERSION,
      tracks: {
        add: { currentStep: 8, highestUnlockedStep: 11 },
        subtract: { currentStep: 7, highestUnlockedStep: 2 },
        multiply: { currentStep: 12, highestUnlockedStep: 12 },
      },
    });
    const unsupported = JSON.stringify({
      version: MATH_PROGRESS_VERSION + 1,
      tracks: { add: { currentStep: 4, highestUnlockedStep: 8 } },
    });

    expect(mathProgressFromStoredValue(malformed)).toEqual({
      ...initialSavedMathProgress(),
      add: { currentStep: 8, highestUnlockedStep: 11 },
    });
    expect(mathProgressFromStoredValue('{')).toEqual(initialSavedMathProgress());
    expect(mathProgressFromStoredValue(unsupported)).toEqual(initialSavedMathProgress());
  });

  test('keeps the original practice storage key and version so existing saves survive', () => {
    const oldSave = JSON.stringify({ version: 1, tracks: {
      add: { currentStep: 3, highestUnlockedStep: 7 },
      subtract: { currentStep: 2, highestUnlockedStep: 2 },
      multiply: { currentStep: 7, highestUnlockedStep: 11 },
      divide: { currentStep: 1, highestUnlockedStep: 1 },
    } });
    const storage = createMemoryStorage(oldSave);
    expect(MATH_PROGRESS_KEY).toBe('math-marsh-practice-progress');
    expect(loadMathProgress(storage).progress.multiply).toEqual({ currentStep: 7, highestUnlockedStep: 11 });
    expect(storage.getItem(MATH_PROGRESS_KEY)).toBe(oldSave);
  });

  test('revisits an unlocked step without losing rewards or changing other operations', () => {
    const progress = {
      ...initialSavedMathProgress(),
      add: { currentStep: 7, highestUnlockedStep: 11 },
    };
    const revisited = selectUnlockedMathStep(progress, 'add', 3);
    expect(revisited?.add).toEqual({ currentStep: 3, highestUnlockedStep: 11 });
    expect(revisited?.multiply).toEqual(progress.multiply);
    expect(progress.add.currentStep).toBe(7);
    expect(selectUnlockedMathStep(progress, 'multiply', 2)).toBeUndefined();
    expect(selectUnlockedMathStep(progress, 'add', 0)).toBeUndefined();
    expect(selectUnlockedMathStep(progress, 'add', 1.5)).toBeUndefined();
  });

  test('loads existing progress but immediately reports readable, unwritable storage as session-only', () => {
    const progress = { ...initialSavedMathProgress(), add: { currentStep: 3, highestUnlockedStep: 7 } };
    const storage: MathProgressStorage = {
      getItem: function() { return JSON.stringify({ version: 1, tracks: progress }); },
      setItem: function() { throw new Error('Quota exceeded'); },
    };
    expect(loadMathProgress(storage)).toEqual({ progress, persistence: 'session-only' });
  });

  test('does not replace malformed or future-version raw saves during a write capability check', () => {
    for (const raw of ['{', JSON.stringify({ version: 2, future: true })]) {
      const storage = createMemoryStorage(raw);
      expect(loadMathProgress(storage).persistence).toBe('persistent');
      expect(storage.getItem(MATH_PROGRESS_KEY)).toBe(raw);
    }
  });

  test('reports session-only progress when storage is unavailable or throws', () => {
    const unavailable = loadMathProgress(undefined);
    const throwingStorage: MathProgressStorage = {
      getItem: () => { throw new Error('Storage unavailable'); },
      setItem: () => { throw new Error('Storage unavailable'); },
    };

    expect(unavailable.persistence).toBe('session-only');
    expect(saveMathProgress(initialSavedMathProgress(), undefined)).toBe(false);
    expect(loadMathProgress(throwingStorage)).toEqual({
      progress: initialSavedMathProgress(),
      persistence: 'session-only',
    });
    expect(saveMathProgress(initialSavedMathProgress(), throwingStorage)).toBe(false);
  });
});
