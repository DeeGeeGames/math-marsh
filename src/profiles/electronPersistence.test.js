import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProfileStorage } from '../../electron/profile-storage.cjs';
import { createProfileStorageBridge } from '../../electron/profile-storage-bridge.cjs';
import { createProfilePersistence } from './persistence';
import { ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY, serializedProfileStore } from './codec';
import { initialPlayerLearnerData } from './rules';

const fixture = function(run) {
  const root = mkdtempSync(join(tmpdir(), 'math-marsh-profile-integration-'));
  const file = join(root, 'math-marsh', 'steam-saves', '76561198000000001', 'progress.json');
  const records = ['a', 'b'].map(id => ({ id, name: id.toUpperCase(), ...initialPlayerLearnerData() }));
  const values = {
    [PLAYER_PROFILES_KEY]: serializedProfileStore(records),
    [ACTIVE_PLAYER_PROFILE_KEY]: 'a',
  };
  const seed = function(owner, overrides = {}) {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify({ version: 1, saveOwner: owner, values: { ...values, ...overrides } }));
  };
  const connect = function(role, io = fs) {
    const native = createProfileStorage({ appData: root, userData: join(root, role), steamId: '76561198000000001', role, io });
    const writes = [];
    const bridge = createProfileStorageBridge(function(operation, ...args) {
      try {
        if (operation === 'status') return { ok: true, value: native.status() };
        if (operation === 'get') return { ok: true, value: native.getItem(args[0]) };
        if (operation === 'set') { writes.push(args[0]); native.setItem(args[0], args[1]); }
        else if (operation === 'migrate') native.migrate(args[0]);
        return { ok: true };
      } catch { return { ok: false }; }
    }, function() { throw new Error('Existing saves must not read localStorage'); });
    return { persistence: createProfilePersistence(() => bridge), writes };
  };
  try { run({ file, seed, connect, values }); } finally { rmSync(root, { recursive: true, force: true }); }
};

describe('application persistence through the Electron adapter', function() {
  test('read-only load repair and all session profile operations leave paid bytes intact', function() {
    fixture(function({ file, seed, connect }) {
      seed('paid', { [ACTIVE_PLAYER_PROFILE_KEY]: 'missing-player' });
      const original = readFileSync(file, 'utf8');
      const { persistence, writes } = connect('demo');
      const loaded = persistence.load();
      expect(loaded.activeProfileId).toBe('a');
      expect(loaded.persistence).toBe('read-only');
      expect(loaded.canPersist).toBe(false);
      const created = persistence.create(loaded, 'C', 'c');
      expect(created.error).toBeUndefined();
      const renamed = persistence.rename(created.state, 'c', 'Changed');
      expect(renamed.state.profiles.find(profile => profile.id === 'c')?.name).toBe('Changed');
      const switched = persistence.switchActive(renamed.state, 'b');
      expect(switched.state.activeProfileId).toBe('b');
      const updated = persistence.updateActive(switched.state, profile => ({ ...profile, onboarding: { ...profile.onboarding, basics: 'completed' } }));
      expect(updated.profiles.find(profile => profile.id === 'b')?.onboarding.basics).toBe('completed');
      const deleted = persistence.delete(updated, 'b');
      expect(deleted.error).toBeUndefined();
      expect(deleted.state.profiles.map(profile => profile.id)).toEqual(['a', 'c']);
      expect(deleted.state.persistence).toBe('read-only');
      expect(writes).toEqual([]);
      expect(readFileSync(file, 'utf8')).toBe(original);
    });
  });

  test.each(['create', 'switchActive', 'delete'])('rechecks handoff ownership before %s without attempting native writes', function(operation) {
    fixture(function({ file, seed, connect }) {
      seed('demo');
      const { persistence, writes } = connect('demo');
      const loaded = persistence.load();
      expect(loaded.persistence).toBe('persistent');
      seed('paid');
      const original = readFileSync(file, 'utf8');
      const result = operation === 'create' ? persistence.create(loaded, 'C', 'c')
        : operation === 'switchActive' ? persistence.switchActive(loaded, 'b') : persistence.delete(loaded, 'a');
      expect(result.error).toBeUndefined();
      expect(result.state.persistence).toBe('read-only');
      expect(writes).toEqual([]);
      expect(readFileSync(file, 'utf8')).toBe(original);
    });
  });

  test('paid create, switch, and active deletion preserve write ordering', function() {
    fixture(function({ seed, connect }) {
      seed('paid');
      const { persistence, writes } = connect('paid');
      const created = persistence.create(persistence.load(), 'C', 'c');
      expect(writes.splice(0)).toEqual([PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY]);
      const switched = persistence.switchActive(created.state, 'b');
      expect(writes.splice(0)).toEqual([ACTIVE_PLAYER_PROFILE_KEY]);
      const deleted = persistence.delete(switched.state, 'b');
      expect(writes).toEqual([ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY]);
      expect(deleted.error).toBeUndefined();
      expect(persistence.load().profiles.map(profile => profile.id)).toEqual(['a', 'c']);
    });
  });

  test('paid import and later rename preserve an unknown Practice payload', function() {
    fixture(function({ file, seed, connect, values }) {
      const profiles = JSON.parse(values[PLAYER_PROFILES_KEY]);
      const future = { version: 42, futureEvidence: { additions: [2, 4, 8] } };
      profiles.profiles[0].learnerData.practiceProgress = future;
      seed('demo', { [PLAYER_PROFILES_KEY]: JSON.stringify(profiles) });
      const { persistence } = connect('paid');
      const loaded = persistence.load();
      expect(JSON.parse(readFileSync(file, 'utf8')).saveOwner).toBe('paid');
      const renamed = persistence.rename(loaded, 'a', 'Ada');
      expect(renamed.error).toBeUndefined();
      expect(renamed.state.persistence).toBe('persistent');
      const saved = JSON.parse(JSON.parse(readFileSync(file, 'utf8')).values[PLAYER_PROFILES_KEY]);
      expect(saved.profiles[0].learnerData.practiceProgress).toEqual(future);
    });
  });

  test('paid deletion retains roster and replacement selection after the second write fails', function() {
    fixture(function({ seed, connect }) {
      seed('paid');
      let renameCount = 0;
      const io = { ...fs, renameSync: function(...args) {
        renameCount += 1;
        // Migration ownership initialization is the first atomic write.
        if (renameCount === 3) throw new Error('Disk failure');
        return fs.renameSync(...args);
      } };
      const { persistence, writes } = connect('paid', io);
      const deleted = persistence.delete(persistence.load(), 'a');
      expect(writes).toEqual([ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY]);
      expect(deleted.error).toBe('profilesNotPersisted');
      expect(deleted.state.persistence).toBe('session-only');
      expect(deleted.state.activeProfileId).toBe('b');
      expect(deleted.state.profiles.map(profile => profile.id)).toEqual(['a', 'b']);
      expect(persistence.load().activeProfileId).toBe('b');
      expect(persistence.load().profiles).toHaveLength(2);
    });
  });
});
