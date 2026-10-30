import { expect, test } from 'bun:test';
import { createProfilePersistence, type ProfileStorage } from '../profiles/persistence';
import { ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY } from '../profiles/codec';
import type { PlayerProfilesState } from '../profiles/types';
import { parsePracticeProgress } from '../ecs/practiceProgress';

test('observer receives only saved supported persistent rosters after complete operations, including recovery', function() {
  const values = new Map<string, string>();
  const observed: PlayerProfilesState[] = [];
  let failKey = '';
  let mode: 'read-write' | 'read-only' = 'read-write';
  const storage: ProfileStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (key === failKey) throw new Error('Disk failure'); values.set(key, value); },
    getPersistenceMode: () => mode,
  };
  const persistence = createProfilePersistence(() => storage, state => { observed.push(state); });
  const fresh = persistence.load();
  observed.length = 0;
  failKey = ACTIVE_PLAYER_PROFILE_KEY;
  const partial = persistence.create(fresh, 'A', 'a').state;
  expect(partial.persistence).toBe('session-only');
  expect(observed).toEqual([]);
  failKey = '';
  const recovered = persistence.rename(partial, 'a', 'Saved').state;
  expect(observed.at(-1)?.profiles[0]?.name).toBe('Saved');
  observed.length = 0;
  failKey = PLAYER_PROFILES_KEY;
  persistence.rename(recovered, 'a', 'Unsaved');
  expect(observed).toEqual([]);
  failKey = '';
  const future = persistence.updateActive(recovered, profile => ({ ...profile,
    practiceProgress: parsePracticeProgress({ version: 42, future: true }),
  }));
  observed.length = 0;
  persistence.updateActive(future, profile => ({ ...profile, practiceProgress: {
    ...profile.practiceProgress, facts: { 'multiply:1:1': { attempts: 1, correct: 1 } },
  } }));
  expect(observed.at(-1)?.profiles[0]?.practiceProgress.facts).toEqual({});
  mode = 'read-only';
  observed.length = 0;
  persistence.load();
  persistence.rename(future, 'a', 'Temporary');
  expect(observed).toEqual([]);
  mode = 'read-write';
  values.set(PLAYER_PROFILES_KEY, JSON.stringify({ version: 99, profiles: [] }));
  persistence.load();
  expect(observed).toEqual([]);
});
