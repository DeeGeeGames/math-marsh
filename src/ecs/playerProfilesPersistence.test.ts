import { describe, expect, test } from 'bun:test';
import {
  ACTIVE_PLAYER_PROFILE_KEY,
  PLAYER_PROFILES_KEY,
  MAX_PLAYER_PROFILES,
  createPlayerProfile,
  deletePlayerProfile,
  initialPlayerLearnerData,
  loadPlayerProfiles,
  renamePlayerProfile,
  switchActivePlayerProfile,
  updateActivePlayerProfile,
  type ProfileStorage,
  type PlayerLearnerData,
} from './playerProfiles';
import { ONBOARDING_STORAGE_KEYS } from '../onboarding/gameplayOnboarding';
import { SKIT_PROGRESS_KEY } from './skitProgress';

type MemoryStorage = Readonly<{
  storage: ProfileStorage;
  values: Map<string, string>;
  reads: string[];
  writes: { key: string; value: string }[];
  failingReads: Set<string>;
  failingWrites: Set<string>;
}>;

const memoryStorage = function(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));
  const reads: string[] = [];
  const writes: { key: string; value: string }[] = [];
  const failingReads = new Set<string>();
  const failingWrites = new Set<string>();
  const storage: ProfileStorage = {
    getItem: function(key) {
      reads.push(key);
      if (failingReads.has(key)) throw new Error('Read unavailable');
      return values.get(key) ?? null;
    },
    setItem: function(key, value) {
      writes.push({ key, value });
      if (failingWrites.has(key)) throw new Error('Write unavailable');
      values.set(key, value);
    },
  };
  return { storage, values, reads, writes, failingReads, failingWrites };
};

const record = function(id: string, name: string): Readonly<{ id: string; name: string; learnerData: PlayerLearnerData }> {
  return { id, name, learnerData: initialPlayerLearnerData() };
};

const store = function(profiles: readonly unknown[]): string {
  return JSON.stringify({ version: 1, profiles });
};

const twoPlayers = function(): MemoryStorage {
  return memoryStorage({
    [PLAYER_PROFILES_KEY]: store([record('a', 'Ada'), record('b', 'Ben')]),
    [ACTIVE_PLAYER_PROFILE_KEY]: 'a',
  });
};

const writeKeys = function(writes: readonly { key: string }[]): string[] {
  return writes.map(function(write) { return write.key; });
};

describe('player profile persistence characterization', function() {
  test.each([
    ['malformed JSON', '{'],
    ['unsupported version', JSON.stringify({ version: 2, profiles: [] })],
    ['invalid outer shape', JSON.stringify({ version: 1, profiles: {} })],
    ['all invalid profiles', store([null, { id: 'invalid' }])],
  ])('%s blocks profile persistence', function(_label, raw) {
    const memory = memoryStorage({ [PLAYER_PROFILES_KEY]: raw });
    const state = loadPlayerProfiles(memory.storage);
    expect(state.profiles).toEqual([]);
    expect(state.activeProfileId).toBeNull();
    expect(state.canPersist).toBe(false);
    expect(state.persistence).toBe('session-only');
    expect(memory.writes).toEqual([]);
  });

  test('a partially valid store remains persistent and filters duplicate IDs and names in order', function() {
    const memory = memoryStorage({
      [PLAYER_PROFILES_KEY]: store([
        null,
        record('a', ' Ada '),
        record('a', 'Different'),
        record('b', 'ADA'),
        record('c', 'Ben'),
      ]),
      [ACTIVE_PLAYER_PROFILE_KEY]: 'a',
    });
    const state = loadPlayerProfiles(memory.storage);
    expect(state.profiles.map(function(profile) { return [profile.id, profile.name]; }))
      .toEqual([['a', 'Ada'], ['c', 'Ben']]);
    expect(state.canPersist).toBe(true);
    expect(state.persistence).toBe('persistent');
    expect(memory.writes).toEqual([]);
  });

  test('an empty valid store remains persistent', function() {
    const memory = memoryStorage({ [PLAYER_PROFILES_KEY]: store([]) });
    expect(loadPlayerProfiles(memory.storage)).toMatchObject({
      profiles: [], activeProfileId: null, canPersist: true, persistence: 'persistent',
    });
    expect(memory.writes).toEqual([]);
  });

  test.each(['missing', 'unknown', 'throwing read', 'failing fallback write'])('%s active ID falls back without downgrading loaded profiles', function(mode) {
    const memory = twoPlayers();
    if (mode === 'unknown') memory.values.set(ACTIVE_PLAYER_PROFILE_KEY, 'unknown');
    else memory.values.delete(ACTIVE_PLAYER_PROFILE_KEY);
    if (mode === 'throwing read') memory.failingReads.add(ACTIVE_PLAYER_PROFILE_KEY);
    if (mode === 'failing fallback write') memory.failingWrites.add(ACTIVE_PLAYER_PROFILE_KEY);
    const state = loadPlayerProfiles(memory.storage);
    expect(state.activeProfileId).toBe('a');
    expect(state.canPersist).toBe(true);
    expect(state.persistence).toBe('persistent');
    expect(memory.writes).toEqual([{ key: ACTIVE_PLAYER_PROFILE_KEY, value: 'a' }]);
  });

  test('an unreadable legacy member blocks profile writes while retaining readable fields', function() {
    const memory = memoryStorage({
      [ONBOARDING_STORAGE_KEYS.basics]: 'completed',
      [SKIT_PROGRESS_KEY]: JSON.stringify(['snack-break']),
    });
    memory.failingReads.add(ONBOARDING_STORAGE_KEYS.operands);
    const loaded = loadPlayerProfiles(memory.storage);
    expect(loaded.canPersist).toBe(false);
    expect(loaded.persistence).toBe('session-only');
    expect(loaded.initialLearnerData.onboarding.basics).toBe('completed');
    expect(loaded.initialLearnerData.skitProgress).toEqual(['snack-break']);
    const created = createPlayerProfile(loaded, 'Ada', 'a', memory.storage);
    expect(created.state.profiles[0]?.onboarding.basics).toBe('completed');
    expect(created.state.profiles[0]?.skitProgress).toEqual(['snack-break']);
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY]);
  });

  test('creation attempts the profile store before the active ID even when saving profiles fails', function() {
    const memory = memoryStorage();
    const state = loadPlayerProfiles(memory.storage);
    memory.failingWrites.add(PLAYER_PROFILES_KEY);
    const result = createPlayerProfile(state, 'Ada', 'a', memory.storage);
    expect(writeKeys(memory.writes)).toEqual([PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
    expect(memory.values.get(ACTIVE_PLAYER_PROFILE_KEY)).toBe('a');
    expect(result.error).toBeUndefined();
    expect(result.state.profiles[0]?.name).toBe('Ada');
    expect(result.state.activeProfileId).toBe('a');
    expect(result.state.persistence).toBe('session-only');
    expect(result.state.canPersist).toBe(true);
  });

  test('creation retains a saved profile and session activation when active ID saving fails', function() {
    const memory = memoryStorage();
    const state = loadPlayerProfiles(memory.storage);
    memory.failingWrites.add(ACTIVE_PLAYER_PROFILE_KEY);
    const result = createPlayerProfile(state, 'Ada', 'a', memory.storage);
    expect(writeKeys(memory.writes)).toEqual([PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
    expect(memory.values.has(PLAYER_PROFILES_KEY)).toBe(true);
    expect(memory.values.has(ACTIVE_PLAYER_PROFILE_KEY)).toBe(false);
    expect(result.state.activeProfileId).toBe('a');
    expect(result.state.persistence).toBe('session-only');
  });

  test('switch failure changes the session selection and later successful switches do not restore persistence', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    memory.failingWrites.add(ACTIVE_PLAYER_PROFILE_KEY);
    const failed = switchActivePlayerProfile(state, 'b', memory.storage);
    expect(failed.state.activeProfileId).toBe('b');
    expect(failed.state.persistence).toBe('session-only');
    expect(memory.values.get(ACTIVE_PLAYER_PROFILE_KEY)).toBe('a');
    memory.failingWrites.clear();
    const switched = switchActivePlayerProfile(failed.state, 'a', memory.storage);
    expect(switched.state.persistence).toBe('session-only');
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
  });

  test('rename write failure retains the session edit and original saved store', function() {
    const memory = twoPlayers();
    const originalStore = memory.values.get(PLAYER_PROFILES_KEY);
    const state = loadPlayerProfiles(memory.storage);
    memory.failingWrites.add(PLAYER_PROFILES_KEY);
    const result = renamePlayerProfile(state, 'a', 'New name', memory.storage);
    expect(result.error).toBeUndefined();
    expect(result.state.profiles[0]?.name).toBe('New name');
    expect(result.state.persistence).toBe('session-only');
    expect(memory.values.get(PLAYER_PROFILES_KEY)).toBe(originalStore);
    expect(writeKeys(memory.writes)).toEqual([PLAYER_PROFILES_KEY]);
  });

  test('no-op updates and updates with no active profile do not write', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    expect(updateActivePlayerProfile(state, function(profile) { return profile; }, memory.storage)).toBe(state);
    const missing = { ...state, activeProfileId: 'missing' };
    let called = false;
    expect(updateActivePlayerProfile(missing, function(profile) {
      called = true;
      return { ...profile, name: 'Changed' };
    }, memory.storage)).toBe(missing);
    expect(called).toBe(false);
    expect(memory.writes).toEqual([]);
  });

  test('canPersist false blocks profile writes while permitting active ID writes', function() {
    const memory = twoPlayers();
    const state = { ...loadPlayerProfiles(memory.storage), canPersist: false, persistence: 'session-only' as const };
    const renamed = renamePlayerProfile(state, 'a', 'New name', memory.storage).state;
    const updated = updateActivePlayerProfile(renamed, function(profile) {
      return { ...profile, name: 'Updated' };
    }, memory.storage);
    const created = createPlayerProfile(updated, 'Cara', 'c', memory.storage).state;
    switchActivePlayerProfile(created, 'b', memory.storage);
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
    expect(deletePlayerProfile(state, 'a', memory.storage)).toEqual({ state, error: 'profilesNotPersisted' });
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
  });

  test('active deletion replacement ID failure leaves state and store unchanged', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    const originalValues = [...memory.values];
    memory.failingWrites.add(ACTIVE_PLAYER_PROFILE_KEY);
    const result = deletePlayerProfile(state, 'a', memory.storage);
    expect(result.state).toBe(state);
    expect(result.error).toBe('activeProfileNotPersisted');
    expect([...memory.values]).toEqual(originalValues);
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY]);
  });

  test('active deletion profile write failure keeps both profiles and activates the replacement for the session', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    const originalStore = memory.values.get(PLAYER_PROFILES_KEY);
    memory.failingWrites.add(PLAYER_PROFILES_KEY);
    const result = deletePlayerProfile(state, 'a', memory.storage);
    expect(result.error).toBe('profilesNotPersisted');
    expect(result.state.profiles).toBe(state.profiles);
    expect(result.state.activeProfileId).toBe('b');
    expect(result.state.persistence).toBe('session-only');
    expect(memory.values.get(ACTIVE_PLAYER_PROFILE_KEY)).toBe('b');
    expect(memory.values.get(PLAYER_PROFILES_KEY)).toBe(originalStore);
    expect(writeKeys(memory.writes)).toEqual([ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY]);
  });

  test('inactive deletion profile write failure retains both profiles and the active selection', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    memory.failingWrites.add(PLAYER_PROFILES_KEY);
    const result = deletePlayerProfile(state, 'b', memory.storage);
    expect(result.error).toBe('profilesNotPersisted');
    expect(result.state.profiles).toBe(state.profiles);
    expect(result.state.activeProfileId).toBe('a');
    expect(result.state.persistence).toBe('session-only');
    expect(writeKeys(memory.writes)).toEqual([PLAYER_PROFILES_KEY]);
  });

  test('rejected names, missing IDs, capacity, and only-player deletion cause no writes', function() {
    const memory = twoPlayers();
    const state = loadPlayerProfiles(memory.storage);
    for (const [name, error] of [[' ', 'blank'], ['ADA', 'duplicate'], ['x'.repeat(21), 'tooLong']] as const) {
      expect(createPlayerProfile(state, name, 'c', memory.storage)).toEqual({ state, error });
      expect(renamePlayerProfile(state, 'b', name, memory.storage)).toEqual({ state, error });
    }
    expect(renamePlayerProfile(state, 'missing', 'Name', memory.storage)).toEqual({ state, error: 'notFound' });
    expect(switchActivePlayerProfile(state, 'missing', memory.storage)).toEqual({ state, error: 'notFound' });
    expect(deletePlayerProfile(state, 'missing', memory.storage)).toEqual({ state, error: 'notFound' });
    const single = { ...state, profiles: state.profiles.slice(0, 1) };
    expect(deletePlayerProfile(single, 'a', memory.storage)).toEqual({ state: single, error: 'onlyPlayer' });
    const fullMemory = memoryStorage({
      [PLAYER_PROFILES_KEY]: store(Array.from({ length: MAX_PLAYER_PROFILES }, function(_, index) {
        return record(`id-${index}`, `Player ${index}`);
      })),
      [ACTIVE_PLAYER_PROFILE_KEY]: 'id-0',
    });
    const full = loadPlayerProfiles(fullMemory.storage);
    expect(createPlayerProfile(full, 'Extra', 'extra', fullMemory.storage)).toEqual({ state: full, error: 'atCapacity' });
    expect(memory.writes).toEqual([]);
    expect(fullMemory.writes).toEqual([]);
  });
});
