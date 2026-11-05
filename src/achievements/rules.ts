import { PRACTICE_TOPICS } from '../math/practiceTopics';
import { practiceTopicStatus } from '../ecs/practiceProgress';
import names from '../../electron/achievement-names.json';
import type { PlayerLearnerData, PlayerProfile, PlayerProfilesState } from '../profiles/types';

export type AchievementRule = Readonly<{
  apiName: string;
  qualifies: (learner: PlayerLearnerData) => boolean;
}>;

const operations = ['add', 'subtract', 'multiply', 'divide'] as const;
const scenes = ['snack-break', 'the-big-jump', 'the-web-guitar', 'the-big-plan'] as const;

export const ACHIEVEMENT_RULES: readonly AchievementRule[] = [
  { apiName: 'ACH_FIRST_STEP_UP', qualifies: function(profile) {
    return operations.some(operation => profile.mathProgress[operation].highestUnlockedStep >= 2);
  } },
  { apiName: 'ACH_EVERY_OPERATION', qualifies: function(profile) {
    return operations.every(operation => profile.mathProgress[operation].highestUnlockedStep >= 11);
  } },
  { apiName: 'ACH_WHOLE_SHOW', qualifies: function(profile) {
    return scenes.every(scene => profile.skitProgress.includes(scene));
  } },
  { apiName: 'ACH_TOPIC_PRACTICED', qualifies: function(profile) {
    return PRACTICE_TOPICS.some(topic => practiceTopicStatus(profile.practiceProgress, topic, false) === 'Practiced');
  } },
  { apiName: 'ACH_PRACTICE_COMPLETE', qualifies: function(profile) {
    return PRACTICE_TOPICS.every(topic => practiceTopicStatus(profile.practiceProgress, topic, false) === 'Practiced');
  } },
  { apiName: 'ACH_LESSONS_DONE', qualifies: function(profile) {
    return profile.onboarding.basics === 'completed' && profile.onboarding.operands === 'completed'
      && profile.onboarding.operandAndResult === 'completed';
  } },
];
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
