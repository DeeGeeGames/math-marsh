import type { EquationModeState, MathDifficulty } from './types';
import { createEquationModeState, equationSelectionText, evaluateEquationSelection, type EquationCandidate } from '../math/equations';
import { practiceFacts, practiceFactLabel, practiceTopic, type PracticeFact, type PracticeTopic } from '../math/practiceTopics';

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

const promptForPracticeFact = function(topicId: string, fact: PracticeFact, solved: number, mode: EquationModeState): EquationModeState {
  if (!topicId.startsWith('add-make-') && !topicId.startsWith('subtract-make-')) return mode;
  // Addition's fixed sum and subtraction's fixed minuend must stay visible.
  const promptKind = fact.operation === 'add'
    ? solved % 2 === 0 ? 'selectLeftOperand' : 'selectRightOperand'
    : solved % 2 === 0 ? 'selectRightOperand' : 'selectResult';
  return { ...mode, promptKind, operandsRequired: 1 };
};

export const practiceFactExample = function(topic: PracticeTopic, fact: PracticeFact, index: number): string {
  if (topic.operation === 'multiply' || topic.operation === 'divide') return practiceFactLabel(fact);
  const mode = promptForPracticeFact(topic.id, fact, index, createEquationModeState(1, 'easy', [fact.operation]));
  return equationSelectionText({ ...mode, target: fact.result, promptValues: [fact.left, fact.right] }, []);
};

export const practiceEquationMode = function(session: PracticeSession, level: number, clearedThisLevel = 0): EquationModeState {
  const fact = currentPracticeFact(session);
  const mode = promptForPracticeFact(session.selection.topicId, fact, session.solved,
    createEquationModeState(level, session.selection.pond, [fact.operation], clearedThisLevel));
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
  const left = mode.promptKind === 'selectLeftOperand' || mode.promptKind === 'selectOperands' ? values[0] : mode.promptValues[0];
  const right = mode.promptKind === 'selectRightOperand' ? values[0]
    : mode.promptKind === 'selectResult' || mode.promptKind === 'selectLeftOperand' ? mode.promptValues[1]
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
