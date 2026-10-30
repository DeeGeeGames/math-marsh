import { expect, test } from 'bun:test';
import { ACHIEVEMENT_NAMES, ACHIEVEMENT_RULES, rosterAchievements, savedRosterAchievements } from './rules';
import type { PlayerLearnerData } from '../profiles/types';
import { initialPlayerLearnerData } from '../profiles/rules';

test('shipping mechanism has no rules or bridge names', function() {
  expect(ACHIEVEMENT_RULES).toEqual([]);
  expect(ACHIEVEMENT_NAMES).toEqual([]);
});

test('roster unions whole-profile matches, independently of identity or active profile', function() {
  const fresh = { ...initialPlayerLearnerData(), id: 'a', name: 'A' };
  const completed = { ...fresh, id: 'b', name: 'B', onboarding: { ...fresh.onboarding, basics: 'completed' as const } };
  const rules = [{ apiName: 'FIXTURE', qualifies: (profile: PlayerLearnerData) => profile.onboarding.basics === 'completed' }];
  expect(rosterAchievements([], rules)).toEqual([]);
  expect(rosterAchievements([fresh], rules)).toEqual([]);
  expect(rosterAchievements([fresh, completed], rules)).toEqual(['FIXTURE']);
});

test('paid persistent gate excludes all temporary and non-paid platforms', function() {
  const learner = initialPlayerLearnerData();
  const state = { profiles: [{ ...learner, id: 'a', name: 'A' }], activeProfileId: 'a',
    initialLearnerData: learner, persistence: 'persistent' as const, canPersist: true };
  const rules = [{ apiName: 'FIXTURE', qualifies: () => true }];
  for (const role of ['demo', null] as const) expect(savedRosterAchievements(state, role, rules)).toEqual([]);
  for (const persistence of ['session-only', 'read-only'] as const) {
    expect(savedRosterAchievements({ ...state, persistence }, 'paid', rules)).toEqual([]);
  }
  expect(savedRosterAchievements(state, 'paid', rules)).toEqual(['FIXTURE']);
});
