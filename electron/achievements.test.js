import { expect, test } from 'bun:test';
import { createAchievementQueue } from './achievements.cjs';

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
