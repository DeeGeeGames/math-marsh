import { expect, test } from 'bun:test';
import { ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY } from './codec';
import { createProfilePersistence, type ProfileStorage } from './persistence';
import { activePlayerProfile } from './rules';

test('injected persistence resolves storage per action, retries failed writes, and never owns live state', function() {
  const values = new Map<string, string>();
  let rejectWrites = false;
  const storage: ProfileStorage = {
    getItem: function(key) { return values.get(key) ?? null; },
    setItem: function(key, value) {
      if (this !== storage) throw new Error('Lost adapter receiver');
      if (rejectWrites) throw new Error('Quota exceeded');
      values.set(key, value);
    },
  };
  let available: ProfileStorage | undefined = storage;
  const persistence = createProfilePersistence(() => available);
  const created = persistence.create(persistence.load(), 'Mira', 'mira').state;
  expect(created.persistence).toBe('persistent');
  rejectWrites = true;
  const session = persistence.rename(created, 'mira', 'Mira Two').state;
  expect(session.persistence).toBe('session-only');
  expect(session.canPersist).toBe(true);
  expect(activePlayerProfile(persistence.load())?.name).toBe('Mira');
  expect(activePlayerProfile(session)?.name).toBe('Mira Two');
  rejectWrites = false;
  const recovered = persistence.updateActive(session, profile => ({
    ...profile, onboarding: { ...profile.onboarding, basics: 'completed' },
  }));
  expect(recovered.persistence).toBe('persistent');
  expect(activePlayerProfile(persistence.load())).toEqual(activePlayerProfile(recovered));
  available = undefined;
  const switched = persistence.switchActive(recovered, 'mira').state;
  expect(switched.persistence).toBe('session-only');
  expect(switched.profiles).toBe(recovered.profiles);
  expect(values.get(ACTIVE_PLAYER_PROFILE_KEY)).toBe('mira');
  expect(values.get(PLAYER_PROFILES_KEY)).toContain('Mira Two');
});


test('temporary read-only edits cannot leak when a later adapter becomes writable', function() {
  const values = new Map<string, string>();
  let mode: 'read-write' | 'read-only' = 'read-write';
  let writes = 0;
  const storage: ProfileStorage = {
    getPersistenceMode: function() { return mode; },
    getItem: function(key) { return values.get(key) ?? null; },
    setItem: function(key, value) { writes += 1; values.set(key, value); },
  };
  const persistence = createProfilePersistence(() => storage);
  const saved = persistence.create(persistence.load(), 'Ada', 'a').state;
  mode = 'read-only';
  const temporary = persistence.rename(saved, 'a', 'Temporary').state;
  expect(temporary.persistence).toBe('read-only');
  mode = 'read-write';
  const updated = persistence.create(temporary, 'Ben', 'b').state;
  expect(updated.persistence).toBe('read-only');
  expect(updated.profiles).toHaveLength(2);
  expect(writes).toBe(2);
  expect(activePlayerProfile(persistence.load())?.name).toBe('Ada');
});
