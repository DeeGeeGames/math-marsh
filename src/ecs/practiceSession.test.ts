import { describe, expect, spyOn, test } from 'bun:test';
import { equationProblemValuesForCandidate, equationPromptKindForLevel } from '../math/equations';
import { PRACTICE_TOPICS, practiceFacts } from '../math/practiceTopics';
import {
  createPracticeSession, currentPracticeFact, finishPracticeSession,
  practiceEquationCandidate, practiceEquationMode, recordPracticeAttempt,
  submittedPracticeFact, PRACTICE_SESSION_LENGTH, type PracticeSession,
} from './practiceSession';

const sessionFor = function(topicId = 'add-make-5'): PracticeSession {
  const session = createPracticeSession('learner', { topicId, related: false, pond: 'expert' });
  if (!session) throw new Error('Missing test session');
  return session;
};

describe('focused Practice sessions', () => {
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

  test('all topic options and ponds preserve exact catalog membership across prompt cycles and high levels', () => {
    for (const topic of PRACTICE_TOPICS) {
      for (const related of [false, true]) {
        for (const pond of ['easy', 'medium', 'expert'] as const) {
          const session = createPracticeSession('learner', { topicId: topic.id, related, pond });
          if (!session) throw new Error('Missing catalog session');
          expect(new Set(session.deck.map(fact => fact.id))).toEqual(new Set(practiceFacts(topic, related).map(fact => fact.id)));
          for (const [index, fact] of session.deck.entries()) {
            const focused = { ...session, solved: index };
            for (const level of [1, 2, 3, 11, 12, 99]) {
              const mode = practiceEquationMode(focused, level, 4);
              const candidate = practiceEquationCandidate(focused);
              const prepared = { ...mode, target: candidate.target, promptValues: candidate.operandValues };
              expect(mode.promptKind).toBe(equationPromptKindForLevel(level, pond));
              expect(mode.operation).toBe(fact.operation);
              expect(mode.clearedThisLevel).toBe(4);
              expect(candidate).toEqual({ operandValues: [fact.left, fact.right], target: fact.result });
              const board = equationProblemValuesForCandidate(prepared, candidate, 9);
              const values = mode.promptKind === 'selectResult' ? [fact.result]
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

  test('decoys use topic bounds so result prompts do not fill every pad with the answer', () => {
    const session = sessionFor();
    const random = spyOn(Math, 'random').mockReturnValue(0.9);
    try {
      const mode = practiceEquationMode(session, 1);
      const candidate = practiceEquationCandidate(session);
      const board = equationProblemValuesForCandidate(mode, candidate, 9);
      expect(board).toContain(5);
      expect(board.some(value => value !== 5)).toBe(true);
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

  test('wrong attempts retain the current equation and correct retries advance once toward a 12-solve budget', () => {
    const original = sessionFor();
    const fact = currentPracticeFact(original);
    const retry = recordPracticeAttempt(original, fact.id, false);
    expect(retry.solved).toBe(0);
    expect(currentPracticeFact(retry)).toBe(fact);
    expect(retry.attempts).toEqual([{ factId: fact.id, correct: false }]);
    expect(original.attempts).toEqual([]);
    let session = retry;
    for (let solved = 0; solved < PRACTICE_SESSION_LENGTH; solved++) {
      session = recordPracticeAttempt(session, currentPracticeFact(session).id, true);
      expect(session.solved).toBe(solved + 1);
    }
    expect(session.attempts).toHaveLength(13);
    expect(recordPracticeAttempt(session, fact.id, true)).toBe(session);
    const complete = finishPracticeSession(session);
    expect(complete.outcome).toBe('completed');
    expect(finishPracticeSession(complete)).toBe(complete);
    expect(recordPracticeAttempt(complete, fact.id, false)).toBe(complete);
    const partial = finishPracticeSession(retry);
    expect(partial).toMatchObject({ outcome: 'partial', solved: 0, attempts: retry.attempts });
    expect(finishPracticeSession(partial)).toBe(partial);
    expect(recordPracticeAttempt(partial, fact.id, true)).toBe(partial);
  });

  test('short topics repeat only after a full coverage deck', () => {
    let session = sessionFor();
    const first = currentPracticeFact(session);
    const seen = new Set<string>();
    for (let index = 0; index < session.deck.length; index++) {
      seen.add(currentPracticeFact(session).id);
      session = recordPracticeAttempt(session, currentPracticeFact(session).id, true);
    }
    expect(seen.size).toBe(session.deck.length);
    expect(currentPracticeFact(session)).toBe(first);
  });
});
