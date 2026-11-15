import { describe, expect, spyOn, test } from 'bun:test';
import { equationProblemValuesForCandidate, equationPromptKindForLevel } from '../math/equations';
import { PRACTICE_TOPICS, practiceFacts, practiceTargetId, practiceTopic } from '../math/practiceTopics';
import {
  createPracticeSession, currentPracticeFact, finishPracticeSession,
  summarizePracticeSession, practiceEquationCandidate, practiceEquationMode, practiceFactExample, recordPracticeAttempt,
  submittedPracticeFact, isPracticeSessionComplete, practiceSessionProgress, type PracticeSession,
} from './practiceSession';

const sessionFor = function(topicId = 'add-make-5'): PracticeSession {
  const session = createPracticeSession('learner', { topicId, related: false, pond: 'expert' });
  if (!session) throw new Error('Missing test session');
  return session;
};

describe('focused Practice sessions', () => {
  test('Make examples alternate useful unknowns and table examples retain their resolved equations', () => {
    const add = practiceTopic('add-make-5');
    const subtract = practiceTopic('subtract-make-5');
    const table = practiceTopic('multiply-table-2');
    if (!add || !subtract || !table) throw new Error('Missing topic');
    const addition = add.facts.find(fact => fact.left === 2 && fact.right === 3);
    const subtraction = subtract.facts.find(fact => fact.right === 2);
    const multiplication = table.facts.find(fact => fact.left === 2 && fact.right === 3);
    if (!addition || !subtraction || !multiplication) throw new Error('Missing example');
    expect(practiceFactExample({ ...add, id: 'renamed-topic' }, addition, 0)).toBe('_ + 3 = 5');
    expect(practiceFactExample(add, addition, 1)).toBe('2 + _ = 5');
    expect(practiceFactExample(subtract, subtraction, 0)).toBe('5 - _ = 3');
    expect(practiceFactExample(subtract, subtraction, 1)).toBe('5 - 2 = _');
    expect(practiceFactExample(table, multiplication, 0)).toBe('2 × 3 = 6');
  });

  test('rejects retired topic IDs and starts each replay with fresh counters and the same options', () => {
    expect(createPracticeSession('learner', { topicId: 'retired', related: false, pond: 'easy' })).toBeUndefined();
    const original = sessionFor();
    expect(recordPracticeAttempt(original, 'retired:fact', true)).toBe(original);
    expect(recordPracticeAttempt(original, 'retired:fact', false)).toBe(original);
    const partial = finishPracticeSession(recordPracticeAttempt(original, currentPracticeFact(original).id, true));
    const replay = createPracticeSession(partial.ownerId, partial.selection);
    expect(replay).toMatchObject({ solved: 0, attempts: [], outcome: 'active', selection: original.selection });
    expect(replay).not.toBe(original);
    expect(replay?.deck).not.toBe(original.deck);
  });

  test('all topic options and ponds preserve exact deck membership and prompt cycles at high levels', () => {
    for (const topic of PRACTICE_TOPICS) {
      for (const related of [false, true]) {
        for (const pond of ['easy', 'medium', 'expert'] as const) {
          const session = createPracticeSession('learner', { topicId: topic.id, related, pond });
          if (!session) throw new Error('Missing catalog session');
          expect(new Set(session.deck.map(fact => fact.id))).toEqual(new Set(practiceFacts(topic, related).map(fact => fact.id)));
          // Large range decks retain exhaustive membership checks above; sample
          // their session prompts, including both operations when related is on.
          const indices = topic.kind === 'range'
            ? [...new Set([
              ...Array.from({ length: Math.min(12, session.deck.length) }, (_, index) => index),
              session.deck.length - 1,
              session.deck.findIndex(fact => fact.operation !== topic.operation),
              session.deck.findIndex(fact => fact.operation === topic.operation && fact.result === topic.answerRange.min),
              session.deck.findIndex(fact => fact.operation === topic.operation && fact.result === topic.answerRange.max),
            ])].filter(index => index >= 0)
            : session.deck.map((_, index) => index);
          for (const index of indices) {
            const fact = session.deck[index];
            if (!fact) throw new Error('Missing sampled fact');
            const focused = { ...session, solved: index, currentIndex: index };
            for (const level of [1, 2, 3, 11, 12, 99]) {
              const mode = practiceEquationMode(focused, level, 4);
              const candidate = practiceEquationCandidate(focused);
              const prepared = { ...mode, target: candidate.target, promptValues: candidate.operandValues };
              const expectedKind = topic.kind === 'range' ? 'selectResult' : topic.kind === 'make'
                ? fact.operation === 'add'
                  ? index % 2 === 0 ? 'selectLeftOperand' : 'selectRightOperand'
                  : index % 2 === 0 ? 'selectRightOperand' : 'selectResult'
                : equationPromptKindForLevel(level, pond);
              expect(mode.promptKind).toBe(expectedKind);
              expect(mode.operation).toBe(fact.operation);
              expect(mode.clearedThisLevel).toBe(4);
              expect(candidate).toEqual({ operandValues: [fact.left, fact.right], target: fact.result });
              const board = equationProblemValuesForCandidate(prepared, candidate, 9);
              const values = mode.promptKind === 'selectLeftOperand' ? [fact.left]
                : mode.promptKind === 'selectRightOperand' ? [fact.right]
                : mode.promptKind === 'selectResult' ? [fact.result]
                : mode.promptKind === 'selectOperands' ? [fact.left, fact.right] : [fact.right, fact.result];
              const firstIndex = board.indexOf(values[0] ?? NaN);
              expect(firstIndex).toBeGreaterThanOrEqual(0);
              if (values.length === 2) expect(board.some((value, index) => index !== firstIndex && value === values[1])).toBe(true);
              expect(submittedPracticeFact(focused, prepared, values)?.id).toBe(fact.id);
            }
          }
        }
      }
    }
  });

  test('decoys use topic bounds so missing-operand prompts include distractors', () => {
    const session = sessionFor();
    const random = spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      const mode = practiceEquationMode(session, 1);
      const candidate = practiceEquationCandidate(session);
      random.mockReturnValue(candidate.operandValues[0] === 0 ? 0.9 : 0);
      const board = equationProblemValuesForCandidate(mode, candidate, 9);
      expect(board).toContain(candidate.operandValues[0]);
      expect(board.some(value => value !== candidate.operandValues[0])).toBe(true);
      expect(mode.operandRanges).toEqual({ left: { min: 0, max: 5 }, right: { min: 0, max: 5 } });
    } finally { random.mockRestore(); }
  });

  test('arithmetic alternatives outside the topic receive no credit', () => {
    const session = sessionFor();
    const mode = { ...practiceEquationMode(session, 2), promptKind: 'selectOperands' as const, operandsRequired: 2, target: 5 };
    expect(submittedPracticeFact(session, mode, [6, -1])).toBeUndefined();
    expect(submittedPracticeFact(session, mode, [2, 3])?.id).toBe('add:2:3');
    const wrong = { ...mode, promptKind: 'selectResult' as const, promptValues: [2, 3] };
    expect(submittedPracticeFact(session, wrong, [4])).toBeUndefined();
  });

  test('Practice decoys reach the topic bounds without exceeding them across prompt roles and related operations', () => {
    const cases = [
      { topicId: 'multiply-table-1', operation: 'multiply', level: 1, min: 1, max: 12 },
      { topicId: 'multiply-table-2', operation: 'multiply', level: 1, min: 1, max: 24 },
      { topicId: 'multiply-table-12', operation: 'multiply', level: 1, min: 1, max: 144 },
      { topicId: 'multiply-table-2', operation: 'multiply', level: 2, min: 1, max: 12 },
      { topicId: 'multiply-table-2', operation: 'multiply', level: 3, min: 1, max: 24 },
      { topicId: 'multiply-table-2', operation: 'divide', level: 1, min: 1, max: 12 },
      { topicId: 'divide-table-2', operation: 'divide', level: 1, min: 1, max: 12 },
      { topicId: 'divide-table-12', operation: 'divide', level: 1, min: 1, max: 12 },
      { topicId: 'divide-table-2', operation: 'divide', level: 2, min: 1, max: 24 },
      { topicId: 'divide-table-2', operation: 'divide', level: 3, min: 1, max: 12 },
      { topicId: 'divide-table-2', operation: 'multiply', level: 1, min: 1, max: 24 },
      { topicId: 'add-make-5', operation: 'add', level: 1, min: 0, max: 5 },
      { topicId: 'subtract-make-5', operation: 'subtract', level: 1, min: 0, max: 5 },
      { topicId: 'add-range-2-5', operation: 'add', level: 99, min: 2, max: 5 },
      { topicId: 'add-range-2-10', operation: 'add', level: 99, min: 2, max: 10 },
      { topicId: 'add-range-2-20', operation: 'add', level: 99, min: 2, max: 20 },
      { topicId: 'add-range-2-100', operation: 'add', level: 99, min: 2, max: 100 },
      { topicId: 'add-range-2-5', operation: 'subtract', level: 99, min: 1, max: 4 },
      { topicId: 'subtract-range-1-4', operation: 'subtract', level: 99, min: 1, max: 4 },
      { topicId: 'subtract-range-1-9', operation: 'subtract', level: 99, min: 1, max: 9 },
      { topicId: 'subtract-range-0-20', operation: 'subtract', level: 99, min: 0, max: 20 },
      { topicId: 'subtract-range-0-100', operation: 'subtract', level: 99, min: 0, max: 100 },
      { topicId: 'subtract-range-1-4', operation: 'add', level: 99, min: 2, max: 5 },
    ] as const;
    const random = spyOn(Math, 'random');
    try {
      for (const scenario of cases) {
        for (const related of [false, true]) {
          const session = createPracticeSession('learner', { topicId: scenario.topicId, related, pond: 'expert' });
          if (!session) throw new Error('Missing bounded session');
          const solved = session.deck.findIndex(fact => fact.operation === scenario.operation);
          if (solved < 0) continue;
          const focused = { ...session, solved, currentIndex: solved };
          const mode = practiceEquationMode(focused, scenario.level);
          const candidate = practiceEquationCandidate(focused);
          for (const [sample, boundary] of [[0, scenario.min], [0.999999, scenario.max]] as const) {
            random.mockReturnValue(sample);
            const board = equationProblemValuesForCandidate(mode, candidate, 40);
            expect(board.every(value => Number.isInteger(value) && value >= scenario.min && value <= scenario.max)).toBe(true);
            expect(board.filter(value => value === boundary).length).toBeGreaterThanOrEqual(38);
          }
        }
      }
    } finally { random.mockRestore(); }
  });

  test('the 2s table retains nonmultiples as decoys', () => {
    const session = sessionFor('multiply-table-2');
    const random = spyOn(Math, 'random').mockReturnValue(4 / 24);
    try {
      const board = equationProblemValuesForCandidate(practiceEquationMode(session, 1), practiceEquationCandidate(session), 9);
      expect(board).toContain(5);
      expect(board.filter(value => value === 5)).toHaveLength(8);
    } finally { random.mockRestore(); }
  });

  test('mistakes increase the requirement and move away from the target before retrying', () => {
    const original = sessionFor('multiply-table-7');
    const fact = currentPracticeFact(original);
    const retry = recordPracticeAttempt(original, fact.id, false);
    expect(retry.solved).toBe(0);
    expect(practiceTargetId(currentPracticeFact(retry))).not.toBe(practiceTargetId(fact));
    expect(retry.attempts).toEqual([{ factId: fact.id, correct: false }]);
    expect(original.attempts).toEqual([]);
    let session = retry;
    for (let correct = 0; correct < 2; correct++) session = recordPracticeAttempt(session, fact.id, true);
    expect(practiceSessionProgress(session).completed).toBe(0);
    session = recordPracticeAttempt(session, fact.id, true);
    expect(practiceSessionProgress(session)).toEqual({ completed: 1, total: 12 });
    expect(finishPracticeSession(session).outcome).toBe('partial');
    const partial = finishPracticeSession(retry);
    expect(recordPracticeAttempt(partial, fact.id, true)).toBe(partial);
  });

  test('all targets appear before repeats even after errors; shuffled forms share a cooldown', () => {
    let session = sessionFor('multiply-table-7');
    const seen = new Set<string>();
    for (let index = 0; index < session.targets.length; index++) {
      const fact = currentPracticeFact(session);
      const id = practiceTargetId(fact);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      session = recordPracticeAttempt(session, fact.id, index % 2 === 0);
      expect(practiceTargetId(currentPracticeFact(session))).not.toBe(id);
    }
    expect(seen.size).toBe(12);
  });

  test('every operation requires two correct answers per target and completes only when all meet the target', () => {
    for (const topicId of ['multiply-table-7', 'divide-table-7', 'add-make-5', 'subtract-make-5', 'add-range-2-5', 'subtract-range-1-4']) {
      let session = sessionFor(topicId);
      for (const target of session.targets) {
        const index = target.indices[0];
        const fact = index === undefined ? undefined : session.deck[index];
        if (!fact) throw new Error('Missing target equation');
        session = recordPracticeAttempt(session, fact.id, true);
      }
      expect(isPracticeSessionComplete(session)).toBe(false);
      expect(practiceSessionProgress(session).completed).toBe(0);
      for (const target of session.targets) {
        const index = target.indices[0];
        const fact = index === undefined ? undefined : session.deck[index];
        if (!fact) throw new Error('Missing target equation');
        session = recordPracticeAttempt(session, fact.id, true);
      }
      expect(isPracticeSessionComplete(session)).toBe(true);
      expect(finishPracticeSession(session).outcome).toBe('completed');
      expect(recordPracticeAttempt(session, currentPracticeFact(session).id, false)).toBe(session);
      const complete = finishPracticeSession(session);
      expect(finishPracticeSession(complete)).toBe(complete);
    }
  });

  test('weighted selection favours unfinished targets while retaining review questions and excluding the last target', () => {
    const initial = sessionFor('multiply-table-7');
    const last = currentPracticeFact(initial);
    const weak = initial.targets.find(target => target.id !== practiceTargetId(last));
    if (!weak) throw new Error('Missing unfinished target');
    const session = { ...initial, targets: initial.targets.map(target => ({
      ...target, correct: 2, incorrect: target.id === weak.id ? 5 : 0,
    })) };
    const random = spyOn(Math, 'random');
    let weakSelections = 0;
    let reviewSelections = 0;
    try {
      for (let sample = 0; sample < 100; sample++) {
        random.mockReturnValue((sample + 0.5) / 100);
        const next = recordPracticeAttempt(session, last.id, true);
        const nextId = practiceTargetId(currentPracticeFact(next));
        expect(nextId).not.toBe(practiceTargetId(last));
        if (nextId === weak.id) weakSelections++; else reviewSelections++;
      }
      expect(weakSelections).toBeGreaterThan(50);
      expect(reviewSelections).toBeGreaterThan(0);
    } finally { random.mockRestore(); }
  });

  test('a valid related alternative excludes both its target and the displayed target from the next question', () => {
    const initial = createPracticeSession('learner', { topicId: 'multiply-table-7', related: true, pond: 'expert' });
    if (!initial) throw new Error('Missing related session');
    const currentIndex = initial.deck.findIndex(fact => fact.id === 'divide:21:7');
    const alternative = initial.deck.find(fact => fact.id === 'divide:21:3');
    if (currentIndex < 0 || !alternative) throw new Error('Missing division alternatives');
    const session = { ...initial, currentIndex, targets: initial.targets.map(target => ({ ...target, correct: 1 })) };
    const random = spyOn(Math, 'random');
    try {
      for (let sample = 0; sample < 100; sample++) {
        random.mockReturnValue((sample + 0.5) / 100);
        const next = recordPracticeAttempt(session, alternative.id, true);
        const id = practiceTargetId(currentPracticeFact(next));
        expect(id).not.toBe('divide:21:7');
        expect(id).not.toBe('divide:21:3');
      }
    } finally { random.mockRestore(); }
  });

  test('a completed target can reopen after another mistake and filler questions prevent consecutive repeats at the end', () => {
    const initial = sessionFor('multiply-table-7');
    const last = currentPracticeFact(initial);
    const unfinished = initial.targets.find(target => target.id !== practiceTargetId(last));
    if (!unfinished) throw new Error('Missing unfinished target');
    const prepared = { ...initial, targets: initial.targets.map(target => ({
      ...target, correct: target.id === unfinished.id ? 1 : 2,
    })) };
    const reopened = recordPracticeAttempt(prepared, last.id, false);
    expect(practiceSessionProgress(reopened)).toEqual({ completed: 10, total: 12 });
    let session: PracticeSession = prepared;
    for (let attempt = 0; attempt < 1000 && !isPracticeSessionComplete(session); attempt++) {
      const current = currentPracticeFact(session);
      session = recordPracticeAttempt(session, current.id, true);
      if (!isPracticeSessionComplete(session)) expect(practiceTargetId(currentPracticeFact(session))).not.toBe(practiceTargetId(current));
    }
    expect(isPracticeSessionComplete(session)).toBe(true);
  });
});

test('session summaries retain wrong retries once per fact and keep completed and partial counters', function() {
  let session = sessionFor();
  const first = currentPracticeFact(session);
  session = recordPracticeAttempt(session, first.id, false);
  session = recordPracticeAttempt(session, first.id, false);
  session = recordPracticeAttempt(session, first.id, true);
  expect(summarizePracticeSession(finishPracticeSession(session))).toEqual({
    solved: 1, completed: 0, total: session.targets.length, attempts: 3, correct: 1, accuracy: 1 / 3, revisit: [first],
  });
  while (!isPracticeSessionComplete(session)) {
    session = recordPracticeAttempt(session, currentPracticeFact(session).id, true);
  }
  expect(summarizePracticeSession(finishPracticeSession(session))).toEqual({
    solved: session.solved, completed: session.targets.length, total: session.targets.length, attempts: session.solved + 2, correct: session.solved, accuracy: session.solved / (session.solved + 2), revisit: [first],
  });
  expect(summarizePracticeSession(finishPracticeSession(sessionFor()))).toEqual({
    solved: 0, completed: 0, total: 3, attempts: 0, correct: 0, accuracy: null, revisit: [],
  });
});

test('related facts in session revisit lists preserve catalog order and separate inverse identities', function() {
  const session = createPracticeSession('learner', { topicId: 'add-make-5', related: true, pond: 'easy' });
  const topic = practiceTopic('add-make-5');
  if (!session || !topic) throw new Error('Missing related session');
  const first = currentPracticeFact(session);
  const otherOperation = session.deck.find(function(fact): boolean { return fact.operation !== first.operation; });
  if (!otherOperation) throw new Error('Missing inverse fact');
  const retried = recordPracticeAttempt(recordPracticeAttempt(session, first.id, false), first.id, true);
  const partial = finishPracticeSession(recordPracticeAttempt(retried, otherOperation.id, false));
  expect(summarizePracticeSession(partial).revisit).toEqual(practiceFacts(topic, true)
    .filter(function(fact): boolean { return fact.id === first.id || fact.id === otherOperation.id; }));
});
