import { describe, expect, test } from 'bun:test';
import { PRACTICE_TOPICS, practiceFacts, practiceTopic } from '../math/practiceTopics';
import {
  emptyPracticeProgress, parsePracticeProgress, practiceContinueSelection, practiceTopicEvidence, practiceTopicStatus,
  recordPracticeEvidence, recordPracticeCompletion, rememberPracticeSelection, serializePracticeProgress, type PracticeProgress,
} from './practiceProgress';
import { createPracticeSession, recordPracticeAttempt } from './practiceSession';

const topic = practiceTopic('add-make-5');
if (!topic) throw new Error('Missing Make 5 topic');

const selection = { topicId: topic.id, related: false, pond: 'easy' } as const;

const awardCompletedRun = function(progress: PracticeProgress, topicId: string, related = false): PracticeProgress {
  let session = createPracticeSession('learner', { topicId, related, pond: 'easy' });
  if (!session) throw new Error('Missing session');
  for (const target of session.targets) {
    const index = target.indices[0];
    const fact = index === undefined ? undefined : session.deck[index];
    if (!fact) throw new Error('Missing equation');
    session = recordPracticeAttempt({ ...session, currentIndex: index ?? 0 }, fact.id, true);
    session = recordPracticeAttempt({ ...session, currentIndex: index ?? 0 }, fact.id, true);
  }
  return recordPracticeCompletion(progress, session);
};

describe('Practice evidence', function() {
  test('distinguishes attempts, solved coverage, accuracy, and revisit facts', function() {
    const first = topic.facts[0];
    if (!first) throw new Error('Topic is empty');
    const empty = emptyPracticeProgress();
    expect(practiceTopicStatus(empty, topic)).toBe('New');
    const wrong = recordPracticeEvidence(empty, { factId: first.id, correct: false });
    const retried = recordPracticeEvidence(wrong, { factId: first.id, correct: true });
    expect(practiceTopicStatus(retried, topic)).toBe('Practicing');
    expect(practiceTopicEvidence(retried, topic)).toMatchObject({
      attempted: 1, solved: 1, attempts: 2, correct: 1, accuracy: 0.5, revisit: [first],
    });
    const complete = topic.facts.reduce((progress, fact) =>
      recordPracticeEvidence(progress, { factId: fact.id, correct: true }), retried);
    expect(practiceTopicStatus(complete, topic)).toBe('Practicing');
    expect(practiceTopicStatus(awardCompletedRun(complete, topic.id), topic)).toBe('Practiced');
    expect(practiceTopicStatus(complete, topic, true)).toBe('Practicing');
    expect(practiceTopicEvidence(empty, topic).accuracy).toBeNull();
    expect(empty.facts).toEqual({});
  });

  test('keeps reverse and inverse evidence separate while sharing identical facts across topics', function() {
    const progress = recordPracticeEvidence(emptyPracticeProgress(), { factId: 'add:2:3', correct: true });
    expect(progress.facts['add:2:3']).toEqual({ attempts: 1, correct: 1 });
    expect(progress.facts['add:3:2']).toBeUndefined();
    expect(progress.facts['subtract:5:2']).toBeUndefined();
    const inverse = practiceTopic('subtract-make-5');
    if (!inverse) throw new Error('Missing inverse topic');
    expect(practiceTopicEvidence(progress, inverse, true).attempted).toBe(1);
    expect(practiceFacts(topic, true).some(fact => fact.id === 'subtract:5:2')).toBe(true);
  });

  test('retains validated Continue selection without storing a running session', function() {
    const progress = rememberPracticeSelection(emptyPracticeProgress(), selection);
    expect(parsePracticeProgress(serializePracticeProgress(progress))).toEqual(progress);
    expect(progress.lastSelection).toEqual(selection);
  });

  test('range selections and new boundary facts survive reload alongside existing Make progress', function() {
    for (const topicId of ['add-range-2-100', 'subtract-range-0-100']) {
      const selected = { topicId, related: true, pond: 'expert' } as const;
      const facts = ['add:1:99', 'subtract:100:0', 'subtract:100:100', 'subtract:0:0', 'add:2:3'];
      const progress = facts.reduce(function(current, factId) {
        return recordPracticeEvidence(current, { factId, correct: true });
      }, rememberPracticeSelection(emptyPracticeProgress(), selected));
      expect(Object.keys(progress.facts)).toEqual(facts);
      expect(parsePracticeProgress(serializePracticeProgress(progress))).toEqual(progress);
      expect(practiceTopicEvidence(progress, topic).solved).toBe(1);
    }
  });

  test('Continue skips solved rings after reload and retains pond and related-fact options', function() {
    const first = practiceTopic('add-make-3');
    if (!first) throw new Error('Missing Make 3');
    const previous = { topicId: first.id, related: true, pond: 'expert' } as const;
    const progress = first.facts.reduce(function(current, fact) {
      return recordPracticeEvidence(current, { factId: fact.id, correct: true });
    }, rememberPracticeSelection(emptyPracticeProgress(), previous));
    const reloaded = parsePracticeProgress(serializePracticeProgress(awardCompletedRun(progress, first.id)));
    expect(practiceContinueSelection(reloaded)).toEqual({ ...previous, topicId: 'add-make-4' });
    expect(reloaded.lastSelection).toEqual(previous);
    expect(practiceTopicStatus(reloaded, first, true)).toBe('Practicing');
  });

  test('Continue selects the lowest incomplete topic in the last operation, including earlier gaps', function() {
    for (const operation of ['add', 'subtract', 'multiply', 'divide'] as const) {
      const topics = PRACTICE_TOPICS.filter(function(topic): boolean { return topic.operation === operation; });
      const first = topics[0];
      const second = topics[1];
      const later = topics[2];
      if (!first || !second || !later) throw new Error('Missing Practice topics');
      const previous = { topicId: later.id, related: false, pond: 'medium' } as const;
      const empty = rememberPracticeSelection(emptyPracticeProgress(), previous);
      const tried = first.facts.reduce(function(current, fact) {
        return recordPracticeEvidence(current, { factId: fact.id, correct: false });
      }, empty);
      expect(practiceContinueSelection(tried)).toEqual({ ...previous, topicId: first.id });
      const complete = [...first.facts, ...later.facts].reduce(function(current, fact) {
        return recordPracticeEvidence(current, { factId: fact.id, correct: true });
      }, tried);
      expect(practiceContinueSelection(awardCompletedRun(awardCompletedRun(complete, first.id), later.id))).toEqual({ ...previous, topicId: second.id });
    }
  });

  test('Continue ends at the operation boundary and stays absent without a valid last selection', function() {
    expect(practiceContinueSelection(emptyPracticeProgress())).toBeUndefined();
    expect(practiceContinueSelection({ ...emptyPracticeProgress(), lastSelection: { ...selection, topicId: 'retired' } })).toBeUndefined();
    const complete = PRACTICE_TOPICS.filter(function(topic): boolean { return topic.operation === 'add'; })
      .flatMap(function(topic) { return topic.facts; }).reduce(function(current, fact) {
        return recordPracticeEvidence(current, { factId: fact.id, correct: true });
      }, rememberPracticeSelection(emptyPracticeProgress(), selection));
    const awarded = { ...complete, completedTopics: PRACTICE_TOPICS.filter(topic => topic.operation === 'add').map(topic => topic.id) };
    expect(practiceContinueSelection(awarded)).toBeUndefined();
  });

  test('existing Make topic Continue selections retain their stable identities and options', function() {
    for (const operation of ['add', 'subtract']) {
      for (const target of [5, 10, 20]) {
        const lastSelection = { topicId: `${operation}-make-${target}`, related: true, pond: 'expert' } as const;
        const parsed = parsePracticeProgress({ version: 1, facts: {}, lastSelection });
        expect(parsed.lastSelection).toEqual(lastSelection);
        expect(parsePracticeProgress(serializePracticeProgress(parsed)).lastSelection).toEqual(lastSelection);
      }
    }
  });

  test('validates equation membership, counts, and Continue options from storage', function() {
    const parsed = parsePracticeProgress({ version: 1, facts: {
      'add:2:3': { attempts: 4, correct: 2 },
      'add:3:2': { attempts: 1, correct: 2 },
      'add:1:4': { attempts: 0, correct: 0 },
      'add:0:5': { attempts: 1.5, correct: 1 },
      'multiply:999:999': { attempts: 1, correct: 1 },
    }, lastSelection: { ...selection, pond: 'impossible' } });
    expect(parsed.facts).toEqual({ 'add:2:3': { attempts: 4, correct: 2 } });
    expect(parsed.lastSelection).toBeNull();
    expect(parsePracticeProgress(undefined)).toEqual(emptyPracticeProgress());
    expect(parsePracticeProgress({ version: 1, lastSelection: { ...selection, topicId: 'unknown' } }).lastSelection).toBeNull();
  });

  test('retains evidence from retired topics and clears their Continue selection', function() {
    const historicalFacts = {
      'add:0:0': { attempts: 2, correct: 1 },
      'add:0:1': { attempts: 1, correct: 0 },
      'add:1:0': { attempts: 2, correct: 2 },
      'add:0:2': { attempts: 3, correct: 2 },
      'add:1:1': { attempts: 1, correct: 1 },
      'add:2:0': { attempts: 1, correct: 0 },
      'subtract:0:0': { attempts: 2, correct: 1 },
      'subtract:1:0': { attempts: 1, correct: 0 },
      'subtract:1:1': { attempts: 2, correct: 2 },
      'subtract:2:0': { attempts: 3, correct: 2 },
      'subtract:2:1': { attempts: 1, correct: 1 },
      'subtract:2:2': { attempts: 1, correct: 0 },
      'add:2:3': { attempts: 4, correct: 3 },
    };
    for (const operation of ['add', 'subtract']) {
      for (const suffix of ['doubles', 'near-doubles', 'mixed-to-20']) {
        const parsed = parsePracticeProgress({ version: 1, facts: historicalFacts,
          lastSelection: { ...selection, topicId: `${operation}-${suffix}` },
        });
        expect(parsed.lastSelection).toBeNull();
        expect(parsed.facts).toEqual(historicalFacts);
        const updated = recordPracticeEvidence(rememberPracticeSelection(parsed, selection), { factId: 'add:2:3', correct: true });
        const reloaded = parsePracticeProgress(serializePracticeProgress(updated));
        expect(reloaded.facts).toEqual({ ...historicalFacts, 'add:2:3': { attempts: 5, correct: 4 } });
        expect(reloaded.lastSelection).toEqual(selection);
        expect(practiceTopicEvidence(reloaded, topic).attempted).toBe(1);
      }
    }
  });

  test('still validates counts and IDs when preserving legacy-only facts', function() {
    const parsed = parsePracticeProgress({ version: 1, facts: {
      'add:0:0': { attempts: 1, correct: 2 },
      'subtract:2:2': { attempts: -1, correct: 0 },
      'add:-1:1': { attempts: 1, correct: 1 },
      'subtract:0:1': { attempts: 1, correct: 1 },
      'add:0:101': { attempts: 1, correct: 1 },
    } });
    expect(parsed.facts).toEqual({});
  });

  test('preserves future data while keeping fresh evidence and Continue usable in memory', function() {
    const future = { version: 3, facts: { opaque: ['future-format'] }, mystery: true };
    const loaded = parsePracticeProgress(future);
    const session = rememberPracticeSelection(recordPracticeEvidence(loaded, { factId: 'add:2:3', correct: false }), selection);
    expect(session.canPersist).toBe(false);
    expect(session.facts['add:2:3']).toEqual({ attempts: 1, correct: 0 });
    expect(session.lastSelection).toEqual(selection);
    expect(serializePracticeProgress(session)).toEqual(future);
    expect(parsePracticeProgress(serializePracticeProgress(session)).facts).toEqual({});
  });
});

test('version 1 keeps history but clears old completion, while new completed runs survive reload', function() {
  const history = Object.fromEntries(topic.facts.map(fact => [fact.id, { attempts: 4, correct: 4 }]));
  const migrated = parsePracticeProgress({ version: 1, facts: history, lastSelection: selection, completedTopics: [topic.id] });
  expect(migrated.facts).toEqual(history);
  expect(migrated.completedTopics).toEqual([]);
  expect(practiceTopicStatus(migrated, topic)).toBe('Practicing');
  const initial = createPracticeSession('learner', selection);
  if (!initial) throw new Error('Missing session');
  expect(recordPracticeCompletion(migrated, initial)).toBe(migrated);
  const base = awardCompletedRun(migrated, topic.id);
  expect(practiceTopicStatus(base, topic)).toBe('Practiced');
  expect(practiceTopicStatus(base, topic, true)).toBe('Practicing');
  const related = awardCompletedRun(base, topic.id, true);
  const reloaded = parsePracticeProgress(serializePracticeProgress(related));
  expect(reloaded.facts).toEqual(history);
  expect(practiceTopicStatus(reloaded, topic, true)).toBe('Practiced');
  expect(reloaded.completedTopics).toEqual([topic.id, `${topic.id}:related`]);
  expect(parsePracticeProgress({ version: 2, facts: history, completedTopics: [null, 3, 'retired', topic.id, topic.id] }).completedTopics).toEqual([topic.id]);
});
