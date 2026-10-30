import { expect, test } from 'bun:test';
import { createAchievementQueue } from './achievements.cjs';
import { SteamAchievementManager } from 'steamworks-ffi-node/dist/internal/SteamAchievementManager.js';
import { SteamStatsManager } from 'steamworks-ffi-node/dist/internal/SteamStatsManager.js';
import * as koffi from 'koffi';

const fixture = function() {
  const calls = [];
  let ready = true;
  let store = true;
  let unlocked = false;
  const session = { role: 'paid', appId: '4927380', steam: {
    getStatus: () => ({ steamId: '76561198000000000' }),
    stats: { requestUserStats: async () => ready },
    achievements: {
      getAchievementByName: async () => ready ? { unlocked } : null,
      unlockAchievement: async name => { calls.push(name); unlocked = true; return store; },
    },
  } };
  return { session, calls, ready: value => { ready = value; }, store: value => { store = value; }, unlocked: value => { unlocked = value; } };
};

test('registered queue serializes, retries readiness and failed stores despite in-memory unlock, then deduplicates', async function() {
  const f = fixture();
  const queue = createAchievementQueue(f.session, ['A', 'B']);
  queue.submit(['A', 'B']);
  f.ready(false);
  await queue.flush();
  expect(f.calls).toEqual([]);
  f.ready(true);
  f.store(false);
  await queue.flush();
  expect(f.calls).toEqual(['A']);
  f.store(true);
  // B was already unlocked on Steam; A is only set in memory after failed store.
  await Promise.all([queue.flush(), queue.flush()]);
  expect(f.calls).toEqual(['A', 'A']);
  queue.submit(['A', 'B']);
  await queue.flush();
  expect(f.calls).toEqual(['A', 'A']);
  queue.dispose();
});

test('bridge rejects the entire invalid request and no session/demo/wrong app can unlock', async function() {
  const f = fixture();
  for (const session of [null, { ...f.session, role: 'demo' }, { ...f.session, appId: '5493870' }]) {
    const queue = createAchievementQueue(session, ['A']);
    queue.submit(['A']);
    await queue.flush();
    queue.dispose();
  }
  const queue = createAchievementQueue(f.session, ['A']);
  for (const request of [null, 'A', ['X'], ['A', 'X'], [3]]) expect(() => queue.submit(request)).toThrow();
  await queue.flush();
  expect(f.calls).toEqual([]);
  queue.dispose();
  queue.submit(['A']);
  await queue.flush();
  expect(f.calls).toEqual([]);
});

test('manager exceptions and absent definitions remain retryable; concurrent flush does not overlap', async function() {
  const f = fixture();
  let attempts = 0;
  f.session.steam.achievements.getAchievementByName = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Stats unavailable');
    return attempts === 2 ? null : { unlocked: false };
  };
  const queue = createAchievementQueue(f.session, ['A']);
  queue.submit(['A']);
  await queue.flush();
  await queue.flush();
  expect(f.calls).toEqual([]);
  await Promise.all([queue.flush(), queue.flush()]);
  expect(f.calls).toEqual(['A']);
  queue.dispose();
});

// Exercise the installed managers, including their immediate StoreStats result
// and callback-driven reads, rather than modeling that result as server receipt.
const sdkFixture = function(definitions = ['A', 'B']) {
  const unlocked = new Set();
  const calls = [];
  const failed = new Set();
  const library = {
    SteamAPI_SteamUserStats: () => 1,
    SteamAPI_ISteamUserStats_RequestUserStats: () => 1n,
    SteamAPI_ISteamUserStats_GetNumAchievements: () => definitions.length,
    SteamAPI_ISteamUserStats_GetAchievementName: (_stats, index) => definitions[index],
    SteamAPI_ISteamUserStats_GetAchievementDisplayAttribute: () => '',
    SteamAPI_ISteamUserStats_GetAchievementAndUnlockTime: (_stats, name, value, time) => {
      koffi.encode(value, 'bool', unlocked.has(name));
      koffi.encode(time, 'uint32', 0);
      return true;
    },
    SteamAPI_ISteamUserStats_SetAchievement: (_stats, name) => {
      calls.push(name);
      if (failed.has(name)) return false;
      unlocked.add(name);
      return true;
    },
    SteamAPI_ISteamUserStats_StoreStats: () => true,
  };
  const core = { isInitialized: () => true, getUserStatsInterface: () => 1, runCallbacks: () => {} };
  return {
    unlocked, calls, failed,
    session: { role: 'paid', appId: '4927380', steam: {
      getStatus: () => ({ steamId: '76561198000000000' }),
      achievements: new SteamAchievementManager(library, core),
      stats: new SteamStatsManager(library, core),
    } },
  };
};

test('installed SDK managers allow later names through missing and failing definitions', async function() {
  for (const definitions of [['B'], ['A', 'B']]) {
    const f = sdkFixture(definitions);
    f.failed.add('A');
    const queue = createAchievementQueue(f.session, ['A', 'B']);
    try {
      queue.submit(['A', 'B']);
      await queue.flush();
      await queue.flush();
      expect(f.calls.filter(name => name === 'B')).toEqual(['B']);
      expect(f.unlocked.has('B')).toBe(true);
    } finally { queue.dispose(); }
  }
});

test('installed SDK immediate store acceptance retains reconciliation after a later rejection', async function() {
  const f = sdkFixture(['A']);
  const queue = createAchievementQueue(f.session, ['A']);
  try {
    queue.submit(['A']);
    await queue.flush();
    await queue.flush();
    expect(f.calls).toEqual(['A']);
    // Steam can replace local data after asynchronously rejecting StoreStats.
    f.unlocked.delete('A');
    await queue.flush();
    expect(f.calls).toEqual(['A', 'A']);
    queue.submit(['A']);
    await queue.flush();
    expect(f.calls).toEqual(['A', 'A']);
  } finally { queue.dispose(); }
});

test('a thrown stats request remains retryable without rejecting the timer flush', async function() {
  const f = fixture();
  const queue = createAchievementQueue(f.session, ['A']);
  const request = f.session.steam.stats.requestUserStats;
  f.session.steam.stats.requestUserStats = async () => { throw new Error('Disconnected'); };
  queue.submit(['A']);
  await queue.flush();
  expect(f.calls).toEqual([]);
  f.session.steam.stats.requestUserStats = request;
  await queue.flush();
  expect(f.calls).toEqual(['A']);
  queue.dispose();
});
