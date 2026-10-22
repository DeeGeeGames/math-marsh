import type { EquationModeState, MathDifficulty } from './types';
import { createEquationModeState, evaluateEquationSelection, type EquationCandidate } from '../math/equations';
import { practiceFacts, practiceTopic, type PracticeFact } from '../math/practiceTopics';

export const PRACTICE_SESSION_LENGTH = 12;
export type PracticeSelection = Readonly<{ topicId: string; related: boolean; pond: MathDifficulty }>;
export type PracticeAttempt = Readonly<{ factId: string; correct: boolean }>;
export type PracticeSession = Readonly<{
  ownerId: string;
  selection: PracticeSelection;
  deck: readonly PracticeFact[];
  solved: number;
  attempts: readonly PracticeAttempt[];
  outcome: 'active' | 'completed' | 'partial';
}>;

export const createPracticeSession = function(ownerId: string, selection: PracticeSelection): PracticeSession | undefined {
  if ((selection.pond !== 'easy' && selection.pond !== 'medium' && selection.pond !== 'expert')
    || typeof selection.related !== 'boolean') return undefined;
  const topic = practiceTopic(selection.topicId);
  if (!topic) return undefined;
  // Shuffle a complete coverage deck; repeat only after every fact has appeared.
  const deck = [...practiceFacts(topic, selection.related)];
  for (let index = deck.length - 1; index > 0; index--) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    const current = deck[index];
    const other = deck[otherIndex];
    if (!current || !other) return undefined;
    deck[index] = other;
    deck[otherIndex] = current;
  }
  return deck.length === 0 ? undefined : { ownerId, selection, deck, solved: 0, attempts: [], outcome: 'active' };
};

export const currentPracticeFact = function(session: PracticeSession): PracticeFact {
  const fact = session.deck[session.solved % session.deck.length];
  if (!fact) throw new Error('Practice session has no valid fact');
  return fact;
};

export const practiceEquationMode = function(session: PracticeSession, level: number, clearedThisLevel = 0): EquationModeState {
  const fact = currentPracticeFact(session);
  const mode = createEquationModeState(level, session.selection.pond, [fact.operation], clearedThisLevel);
  const facts = session.deck.filter(candidate => candidate.operation === fact.operation);
  return {
    ...mode,
    operandRanges: {
      left: { min: Math.min(...facts.map(candidate => candidate.left)), max: Math.max(...facts.map(candidate => candidate.left)) },
      right: { min: Math.min(...facts.map(candidate => candidate.right)), max: Math.max(...facts.map(candidate => candidate.right)) },
    },
    promptValues: [fact.left, fact.right],
  };
};

export const practiceEquationCandidate = function(session: PracticeSession): EquationCandidate {
  const fact = currentPracticeFact(session);
  return { operandValues: [fact.left, fact.right], target: fact.result };
};

/** Identify the actual submitted fact; arithmetic equivalence alone cannot broaden a topic. */
export const submittedPracticeFact = function(session: PracticeSession, mode: EquationModeState, values: readonly number[]): PracticeFact | undefined {
  if (!evaluateEquationSelection(mode, values)) return undefined;
  const left = mode.promptKind === 'selectOperands' ? values[0] : mode.promptValues[0];
  const right = mode.promptKind === 'selectResult' ? mode.promptValues[1]
    : mode.promptKind === 'selectOperands' ? values[1] : values[0];
  const result = mode.promptKind === 'selectOperandAndResult' ? values[1] : mode.target;
  return session.deck.find(fact => fact.operation === mode.operation
    && fact.left === left && fact.right === right && fact.result === result);
};

export const recordPracticeAttempt = function(session: PracticeSession, factId: string, correct: boolean): PracticeSession {
  if (session.outcome !== 'active' || session.solved >= PRACTICE_SESSION_LENGTH
    || !session.deck.some(fact => fact.id === factId)) return session;
  return { ...session, solved: session.solved + Number(correct), attempts: [...session.attempts, { factId, correct }] };
};

export const finishPracticeSession = function(session: PracticeSession): PracticeSession {
  if (session.outcome !== 'active') return session;
  return { ...session, outcome: session.solved >= PRACTICE_SESSION_LENGTH ? 'completed' : 'partial' };
};
