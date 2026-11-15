import { expect, test } from 'bun:test';
import { rosterAchievements } from './rules';
import { initialPlayerLearnerData } from '../profiles/rules';
import type { PlayerLearnerData, PlayerProfile } from '../profiles/types';
import { PRACTICE_TOPICS, practiceFacts, type PracticeFact } from '../math/practiceTopics';
import { practiceTopicStatus } from '../ecs/practiceProgress';

const profile = function(data: Partial<PlayerLearnerData> = {}, id = 'a'): PlayerProfile {
  return { ...initialPlayerLearnerData(), ...data, id, name: id };
};
const practice = function(facts: readonly PracticeFact[]) {
  return { ...initialPlayerLearnerData().practiceProgress,
    facts: Object.fromEntries(facts.map(fact => [fact.id, { attempts: 2, correct: 1 }])) };
};
const earns = function(name: string, profiles: readonly PlayerProfile[]): boolean {
  return rosterAchievements(profiles).includes(name);
};

test('First Step Up uses highest unlocked step, with no grant for fresh step 1', function() {
  const fresh = profile();
  expect(rosterAchievements([fresh, profile({}, 'b')])).toEqual([]);
  for (const operation of ['add', 'subtract', 'multiply', 'divide'] as const) {
    for (const step of [2, 11]) {
      expect(earns('ACH_FIRST_STEP_UP', [profile({ mathProgress: { ...fresh.mathProgress,
        [operation]: { currentStep: 1, highestUnlockedStep: step },
      } })])).toBe(true);
    }
  }
});

test('Every Operation requires all four highest unlocks at 11 on one profile', function() {
  const track = { currentStep: 1, highestUnlockedStep: 11 };
  const fresh = profile();
  const left = profile({ mathProgress: { ...fresh.mathProgress, add: track, subtract: track } });
  const right = profile({ mathProgress: { ...fresh.mathProgress, multiply: track, divide: track } }, 'b');
  expect(earns('ACH_EVERY_OPERATION', [left, right])).toBe(false);
  const complete = profile({ mathProgress: { add: track, subtract: track, multiply: track, divide: track } });
  expect(earns('ACH_EVERY_OPERATION', [fresh, complete])).toBe(true);
  for (const operation of ['add', 'subtract', 'multiply', 'divide'] as const) {
    expect(earns('ACH_EVERY_OPERATION', [profile({ mathProgress: { ...complete.mathProgress,
      [operation]: { currentStep: 10, highestUnlockedStep: 10 },
    } })])).toBe(false);
  }
});

test('The Whole Show requires the four saved scene IDs together regardless of how unlocked', function() {
  const scenes = ['snack-break', 'the-big-jump', 'the-web-guitar', 'the-big-plan'] as const;
  expect(earns('ACH_WHOLE_SHOW', [profile({ skitProgress: scenes })])).toBe(true);
  expect(earns('ACH_WHOLE_SHOW', [profile({ skitProgress: scenes.slice(0, 2) }), profile({ skitProgress: scenes.slice(2) }, 'b')])).toBe(false);
  for (const missing of scenes) expect(earns('ACH_WHOLE_SHOW', [profile({ skitProgress: scenes.filter(scene => scene !== missing) })])).toBe(false);
});

test('Topic Practiced counts own facts despite unsolved related facts and later misses', function() {
  for (const topic of PRACTICE_TOPICS) {
    const own = practice(practiceFacts(topic, false));
    expect(practiceTopicStatus(own, topic, false)).toBe('Practiced');
    expect(practiceTopicStatus(own, topic, true)).not.toBe('Practiced');
    expect(earns('ACH_TOPIC_PRACTICED', [profile({ practiceProgress: own })])).toBe(true);
  }
  const topic = PRACTICE_TOPICS.find(topic => topic.id === 'add-make-20');
  if (!topic) throw new Error('Missing current topic');
  const incomplete = practice(topic.facts.slice(1));
  expect(earns('ACH_TOPIC_PRACTICED', [profile({ practiceProgress: incomplete })])).toBe(false);
  expect(earns('ACH_TOPIC_PRACTICED', [profile({ practiceProgress: practice(topic.facts.slice(0, 10)) }),
    profile({ practiceProgress: practice(topic.facts.slice(10)) }, 'b')])).toBe(false);
  const relatedOnly = practice(practiceFacts(topic, true).filter(fact => !topic.facts.some(own => own.id === fact.id)));
  expect(practiceTopicStatus(relatedOnly, topic, false)).not.toBe('Practiced');
});

test('Practice Complete requires all 60 current topics on a single profile', function() {
  expect(PRACTICE_TOPICS).toHaveLength(60);
  const first = PRACTICE_TOPICS.slice(0, 59);
  const last = PRACTICE_TOPICS.slice(59);
  const a = profile({ practiceProgress: practice(first.flatMap(topic => topic.facts)) });
  const b = profile({ practiceProgress: practice(last.flatMap(topic => topic.facts)) }, 'b');
  expect(PRACTICE_TOPICS.filter(topic => practiceTopicStatus(a.practiceProgress, topic) === 'Practiced')).toHaveLength(59);
  expect(earns('ACH_PRACTICE_COMPLETE', [a])).toBe(false);
  expect(earns('ACH_PRACTICE_COMPLETE', [a, b])).toBe(false);
  expect(earns('ACH_PRACTICE_COMPLETE', [profile({ practiceProgress: practice(PRACTICE_TOPICS.flatMap(topic => topic.facts)) })])).toBe(true);
});

test('Lessons Done requires all three completed; skipped, pending and split completions fail', function() {
  const completed = { basics: 'completed', operands: 'completed', operandAndResult: 'completed' } as const;
  expect(earns('ACH_LESSONS_DONE', [profile({ onboarding: completed })])).toBe(true);
  for (const kind of ['basics', 'operands', 'operandAndResult'] as const) {
    for (const status of ['pending', 'skipped'] as const) {
      expect(earns('ACH_LESSONS_DONE', [profile({ onboarding: { ...completed, [kind]: status } })])).toBe(false);
    }
  }
  expect(earns('ACH_LESSONS_DONE', [profile({ onboarding: { ...completed, basics: 'pending' } }),
    profile({ onboarding: { ...completed, operands: 'skipped' } }, 'b')])).toBe(false);
});
