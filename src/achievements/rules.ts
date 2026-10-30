import names from '../../electron/achievement-names.json';
import type { PlayerLearnerData, PlayerProfile, PlayerProfilesState } from '../profiles/types';

export type AchievementRule = Readonly<{
  apiName: string;
  qualifies: (learner: PlayerLearnerData) => boolean;
}>;

// The mechanism ships without a catalog. Fixture rules belong only in tests.
export const ACHIEVEMENT_RULES: readonly AchievementRule[] = [];
export const ACHIEVEMENT_NAMES: readonly string[] = names;

export const rosterAchievements = function(
  profiles: readonly PlayerProfile[], rules: readonly AchievementRule[] = ACHIEVEMENT_RULES,
): readonly string[] {
  return rules.filter(rule => profiles.some(profile => rule.qualifies(profile))).map(rule => rule.apiName);
};

export const savedRosterAchievements = function(
  state: PlayerProfilesState, role: 'paid' | 'demo' | null,
  rules: readonly AchievementRule[] = ACHIEVEMENT_RULES,
): readonly string[] {
  return role === 'paid' && state.persistence === 'persistent'
    ? rosterAchievements(state.profiles, rules) : [];
};
