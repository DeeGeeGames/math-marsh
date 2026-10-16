import { describe, expect, test } from 'bun:test';
import {
  ACTIVE_PLAYER_PROFILE_KEY,
  activePlayerProfile,
  createPlayerProfile,
  deletePlayerProfile,
  initialPlayerLearnerData,
  loadPlayerProfiles,
  MAX_PLAYER_PROFILES,
  nextDefaultPlayerName,
  operationProgressForProfile,
  PLAYER_PROFILES_KEY,
  renamePlayerProfile,
  switchActivePlayerProfile,
  updateActivePlayerProfile,
  validatePlayerName,
  type PlayerProfile,
  type PlayerLearnerData,
  type PlayerProfilesState,
  type ProfileStorage,
} from './playerProfiles';
import { SKIT_PROGRESS_KEY } from './skitProgress';
import { ONBOARDING_STORAGE_KEYS } from '../onboarding/gameplayOnboarding';
import { MATH_FINAL_STEP } from './mathSteps';
import {
  initialSavedMathProgress,
  MATH_PROGRESS_KEY,
  MATH_PROGRESS_VERSION,
} from './mathProgressStore';

const createMemoryStorage = function(initial: Readonly<Record<string, string>> = {}): Readonly<{
  storage: ProfileStorage;
  values: Map<string, string>;
  writes: string[];
}> {
  const values = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: ProfileStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
  };
  return { storage, values, writes };
};

const createProfileRecord = function(
  id: string,
  name: string,
  learnerData: PlayerLearnerData = initialPlayerLearnerData(),
): Readonly<{ id: string; name: string; learnerData: PlayerLearnerData }> {
  return { id, name, learnerData };
};

const addProfile = function(state: PlayerProfilesState, name: string, id: string): PlayerProfilesState {
  const result = createPlayerProfile(state, name, id, undefined);
  if (result.error) throw new Error(`Could not add test profile: ${result.error}`);
  return result.state;
};

describe('local player profiles', () => {
  test('shows a first-use profile state for an empty installation', () => {
    const state = loadPlayerProfiles(createMemoryStorage().storage);

    expect(state.profiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
    expect(nextDefaultPlayerName(state.profiles)).toBe('Player');
    expect(state.initialLearnerData).toEqual(initialPlayerLearnerData());
  });

  test('migrates valid legacy math, tutorials, and scene unlocks into the first named profile', () => {
    const legacyMath = JSON.stringify({
      version: MATH_PROGRESS_VERSION,
      tracks: {
        add: { currentStep: 7, highestUnlockedStep: 9 },
        subtract: { currentStep: 4, highestUnlockedStep: 6 },
        multiply: { currentStep: 3, highestUnlockedStep: 8 },
        divide: { currentStep: 2, highestUnlockedStep: 5 },
      },
    });
    const legacyScenes = JSON.stringify(['snack-break', 'the-big-jump']);
    const initial = {
      [MATH_PROGRESS_KEY]: legacyMath,
      [SKIT_PROGRESS_KEY]: legacyScenes,
      [ONBOARDING_STORAGE_KEYS.basics]: 'completed',
      [ONBOARDING_STORAGE_KEYS.operands]: 'skipped',
      [ONBOARDING_STORAGE_KEYS.operandAndResult]: 'pending',
    };
    const { storage, values } = createMemoryStorage(initial);
    const state = loadPlayerProfiles(storage);
    const result = createPlayerProfile(state, ' Maya ', 'profile-maya', storage);

    expect(result.error).toBeUndefined();
    expect(result.state.activeProfileId).toBe('profile-maya');
    expect(result.state.profiles[0]?.name).toBe('Maya');
    expect(result.state.profiles[0]?.mathProgress).toEqual({
      add: { currentStep: 7, highestUnlockedStep: 9 },
      subtract: { currentStep: 4, highestUnlockedStep: 6 },
      multiply: { currentStep: 3, highestUnlockedStep: 8 },
      divide: { currentStep: 2, highestUnlockedStep: 5 },
    });
    expect(result.state.profiles[0]?.onboarding).toEqual({
      basics: 'completed',
      operands: 'skipped',
      operandAndResult: 'pending',
    });
    expect(result.state.profiles[0]?.skitProgress).toEqual(['snack-break', 'the-big-jump']);
    expect(values.get(MATH_PROGRESS_KEY)).toBe(legacyMath);
    expect(values.get(SKIT_PROGRESS_KEY)).toBe(legacyScenes);
  });

  test('keeps valid legacy fields when other legacy values are partial or malformed', () => {
    const { storage } = createMemoryStorage({
      [MATH_PROGRESS_KEY]: JSON.stringify({
        version: MATH_PROGRESS_VERSION,
        tracks: {
          add: { currentStep: 5, highestUnlockedStep: 7 },
          subtract: { currentStep: 8, highestUnlockedStep: 3 },
        },
      }),
      [SKIT_PROGRESS_KEY]: JSON.stringify(['snack-break', 'not-a-scene']),
      [ONBOARDING_STORAGE_KEYS.basics]: 'completed',
      [ONBOARDING_STORAGE_KEYS.operands]: 'unexpected',
      [ONBOARDING_STORAGE_KEYS.operandAndResult]: '{bad json',
    });
    const loaded = loadPlayerProfiles(storage);
    const result = createPlayerProfile(loaded, 'Learner', 'profile-one', storage);
    const profile = result.state.profiles[0];

    expect(profile?.mathProgress.add).toEqual({ currentStep: 5, highestUnlockedStep: 7 });
    expect(profile?.mathProgress.subtract).toEqual({ currentStep: 1, highestUnlockedStep: 1 });
    expect(profile?.skitProgress).toEqual(['snack-break']);
    expect(profile?.onboarding).toEqual({
      basics: 'completed',
      operands: 'pending',
      operandAndResult: 'pending',
    });
  });

  test('leaves legacy values recoverable when the first profile write is interrupted', () => {
    const legacyMath = JSON.stringify({
      version: MATH_PROGRESS_VERSION,
      tracks: { add: { currentStep: 6, highestUnlockedStep: 8 } },
    });
    const initial = { [MATH_PROGRESS_KEY]: legacyMath };
    const { storage, values } = createMemoryStorage(initial);
    const interruptedStorage: ProfileStorage = {
      getItem: key => storage.getItem(key),
      setItem: (key, value) => {
        if (key === PLAYER_PROFILES_KEY) throw new Error('Simulated interrupted write');
        storage.setItem(key, value);
      },
    };
    const firstAttempt = createPlayerProfile(loadPlayerProfiles(interruptedStorage), 'Learner', 'profile-one', interruptedStorage);
    expect(firstAttempt.state.persistence).toBe('session-only');
    expect(firstAttempt.state.profiles[0]?.mathProgress.add).toEqual({ currentStep: 6, highestUnlockedStep: 8 });
    expect(values.get(PLAYER_PROFILES_KEY)).toBeUndefined();
    expect(values.get(MATH_PROGRESS_KEY)).toBe(legacyMath);
    const retry = loadPlayerProfiles(storage);
    const completed = createPlayerProfile(retry, 'Learner', 'profile-one', storage);

    expect(values.get(MATH_PROGRESS_KEY)).toBe(legacyMath);
    expect(completed.state.persistence).toBe('persistent');
    expect(completed.state.profiles[0]?.mathProgress.add).toEqual({ currentStep: 6, highestUnlockedStep: 8 });
  });

  test('falls back to the first valid profile and writes its ID when the saved ID is invalid', () => {
    const store = JSON.stringify({
      version: 1,
      profiles: [createProfileRecord('first', 'Maya'), createProfileRecord('second', 'Jordan')],
    });
    const { storage, values } = createMemoryStorage({
      [PLAYER_PROFILES_KEY]: store,
      [ACTIVE_PLAYER_PROFILE_KEY]: 'missing-profile',
    });
    const state = loadPlayerProfiles(storage);

    expect(state.activeProfileId).toBe('first');
    expect(values.get(ACTIVE_PLAYER_PROFILE_KEY)).toBe('first');
    expect(activePlayerProfile(state)?.name).toBe('Maya');
  });

  test('validates profiles independently and enforces the ten-player limit while loading and adding', () => {
    const records = [
      ...Array.from({ length: MAX_PLAYER_PROFILES + 1 }, (_, index) => createProfileRecord(`player-${index + 1}`, `Learner ${index + 1}`)),
      { id: 'broken', name: 'Broken', learnerData: null },
    ];
    const { storage } = createMemoryStorage({
      [PLAYER_PROFILES_KEY]: JSON.stringify({ version: 1, profiles: records }),
    });
    const state = loadPlayerProfiles(storage);
    const rejected = createPlayerProfile(state, 'Eleventh', 'player-11', storage);

    expect(state.profiles).toHaveLength(MAX_PLAYER_PROFILES);
    expect(state.profiles[0]?.name).toBe('Learner 1');
    expect(state.profiles[9]?.name).toBe('Learner 10');
    expect(rejected.error).toBe('atCapacity');
    expect(nextDefaultPlayerName(state.profiles)).toBe('Player');
  });

  test('trims names, rejects blank and case-insensitive duplicates, and picks unused defaults', () => {
    const first = createPlayerProfile(loadPlayerProfiles(undefined), ' Player ', 'one', undefined);
    if (first.error) throw new Error(`Unexpected profile error: ${first.error}`);
    const second = createPlayerProfile(first.state, 'Player 2', 'two', undefined);
    if (second.error) throw new Error(`Unexpected profile error: ${second.error}`);

    expect(first.state.profiles[0]?.name).toBe('Player');
    expect(validatePlayerName('   ', second.state.profiles).error).toBe('blank');
    expect(validatePlayerName('pLaYeR', second.state.profiles).error).toBe('duplicate');
    expect(validatePlayerName('A'.repeat(21), second.state.profiles).error).toBe('tooLong');
    expect(nextDefaultPlayerName(first.state.profiles)).toBe('Player 2');
    expect(nextDefaultPlayerName(second.state.profiles)).toBe('Player 3');
  });

  test('switching profiles keeps each learner state isolated, and rename preserves the full record and ID', () => {
    const first = addProfile(loadPlayerProfiles(undefined), 'Maya', 'profile-maya');
    const maya = activePlayerProfile(first);
    if (!maya) throw new Error('Expected Maya to be active');
    const tailoredMath = { ...initialSavedMathProgress(), add: { currentStep: 4, highestUnlockedStep: 7 } };
    const tailored = updateActivePlayerProfile(first, profile => ({
      ...profile,
      mathProgress: tailoredMath,
      onboarding: { ...profile.onboarding, basics: 'completed', operandAndResult: 'skipped' },
      skitProgress: ['snack-break'],
    }));
    const second = addProfile(tailored, 'Jordan', 'profile-jordan');
    const switched = switchActivePlayerProfile(second, 'profile-maya', undefined);
    const switchedProfile = activePlayerProfile(switched.state);
    if (!switchedProfile) throw new Error('Expected Maya after switching');
    const renamed = renamePlayerProfile(switched.state, 'profile-maya', 'Maya G.', undefined);
    const renamedProfile = renamed.state.profiles.find(profile => profile.id === 'profile-maya');

    expect(activePlayerProfile(second)?.mathProgress.add).toEqual({ currentStep: 1, highestUnlockedStep: 1 });
    expect(switchedProfile.mathProgress.add).toEqual({ currentStep: 4, highestUnlockedStep: 7 });
    expect(renamedProfile).toMatchObject({
      id: 'profile-maya',
      name: 'Maya G.',
      mathProgress: tailoredMath,
      onboarding: { basics: 'completed', operandAndResult: 'skipped', operands: 'pending' },
      skitProgress: ['snack-break'],
    });
  });

  test('deleting an active player persists a replacement ID before removing that record', () => {
    const data = initialPlayerLearnerData();
    const store = JSON.stringify({ version: 1, profiles: [createProfileRecord('first', 'Maya', data), createProfileRecord('second', 'Jordan', data)] });
    const { storage, writes } = createMemoryStorage({
      [PLAYER_PROFILES_KEY]: store,
      [ACTIVE_PLAYER_PROFILE_KEY]: 'first',
    });
    const result = deletePlayerProfile(loadPlayerProfiles(storage), 'first', storage);

    expect(result.error).toBeUndefined();
    expect(result.state.activeProfileId).toBe('second');
    expect(result.state.profiles.map(profile => profile.id)).toEqual(['second']);
    expect(writes.slice(-2)).toEqual([ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY]);
  });

  test('prevents deleting the final player', () => {
    const state = addProfile(loadPlayerProfiles(undefined), 'Only player', 'only');

    expect(deletePlayerProfile(state, 'only', undefined).error).toBe('onlyPlayer');
    expect(state.profiles).toHaveLength(1);
  });

  test('shows operation unlocks from highestUnlockedStep, independent of currentStep', () => {
    const profile: PlayerProfile = {
      id: 'profile-progress',
      name: 'Learner',
      mathProgress: {
        add: { currentStep: 2, highestUnlockedStep: 7 },
        subtract: { currentStep: 4, highestUnlockedStep: 4 },
        multiply: { currentStep: MATH_FINAL_STEP, highestUnlockedStep: MATH_FINAL_STEP },
        divide: { currentStep: 1, highestUnlockedStep: 3 },
      },
      onboarding: { basics: 'pending', operands: 'pending', operandAndResult: 'pending' },
      skitProgress: [],
    };

    expect(operationProgressForProfile(profile)).toEqual([
      { operation: 'add', highestUnlockedStep: 7 },
      { operation: 'subtract', highestUnlockedStep: 4 },
      { operation: 'multiply', highestUnlockedStep: MATH_FINAL_STEP },
      { operation: 'divide', highestUnlockedStep: 3 },
    ]);
  });
});
