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
