import { PRACTICE_TOPICS, practiceFacts, practiceTopic, type PracticeFact, type PracticeTopic } from '../math/practiceTopics';
import type { PracticeAttempt, PracticeSelection } from './practiceSession';

export const PRACTICE_PROGRESS_VERSION = 1;

export type PracticeFactEvidence = Readonly<{ attempts: number; correct: number }>;
export type PracticeProgress = Readonly<{
  facts: Readonly<Record<string, PracticeFactEvidence>>;
  lastSelection: PracticeSelection | null;
  canPersist: boolean;
  preservedValue?: unknown;
}>;

export type PracticeTopicStatus = 'New' | 'Practicing' | 'Practiced';

// Earlier Doubles/Mixed topics included these facts, which no longer belong to
// an active topic. Keep their validated evidence recoverable through future saves.
const legacyFactIds = [
  'add:0:0',
  'add:0:1', 'add:1:0',
  'add:0:2', 'add:1:1', 'add:2:0',
  'subtract:0:0',
  'subtract:1:0', 'subtract:1:1',
  'subtract:2:0', 'subtract:2:1', 'subtract:2:2',
] as const;
const factIds = new Set([
  ...PRACTICE_TOPICS.flatMap(topic => practiceFacts(topic, true).map(fact => fact.id)),
  ...legacyFactIds,
]);
const isRecord = function(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const emptyPracticeProgress = function(): PracticeProgress {
  return { facts: {}, lastSelection: null, canPersist: true };
};

const selectionFromUnknown = function(value: unknown): PracticeSelection | null {
  if (!isRecord(value) || !practiceTopic(value.topicId) || typeof value.topicId !== 'string'
    || typeof value.related !== 'boolean'
    || (value.pond !== 'easy' && value.pond !== 'medium' && value.pond !== 'expert')) return null;
  return { topicId: value.topicId, related: value.related, pond: value.pond };
};

export const parsePracticeProgress = function(value: unknown): PracticeProgress {
  if (!isRecord(value)) return emptyPracticeProgress();
  if (typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version > PRACTICE_PROGRESS_VERSION) {
    return { ...emptyPracticeProgress(), canPersist: false, preservedValue: value };
  }
  if (value.version !== PRACTICE_PROGRESS_VERSION) return emptyPracticeProgress();
  const entries = isRecord(value.facts) ? Object.entries(value.facts) : [];
  const facts: Record<string, PracticeFactEvidence> = {};
  for (const [id, evidence] of entries) {
    if (!factIds.has(id) || !isRecord(evidence)
      || typeof evidence.attempts !== 'number' || !Number.isSafeInteger(evidence.attempts) || evidence.attempts < 1
      || typeof evidence.correct !== 'number' || !Number.isSafeInteger(evidence.correct)
      || evidence.correct < 0 || evidence.correct > evidence.attempts) continue;
    facts[id] = { attempts: evidence.attempts, correct: evidence.correct };
  }
  return { facts, lastSelection: selectionFromUnknown(value.lastSelection), canPersist: true };
};

/** Keep an unreadable future payload intact while allowing other profile fields to save. */
export const serializePracticeProgress = function(progress: PracticeProgress): unknown {
  if (!progress.canPersist) return progress.preservedValue;
  return { version: PRACTICE_PROGRESS_VERSION, facts: progress.facts, lastSelection: progress.lastSelection };
};

export const recordPracticeEvidence = function(progress: PracticeProgress, attempt: PracticeAttempt): PracticeProgress {
  if (!factIds.has(attempt.factId)) return progress;
  const previous = progress.facts[attempt.factId] ?? { attempts: 0, correct: 0 };
  if (previous.attempts >= Number.MAX_SAFE_INTEGER) return progress;
  return {
    ...progress,
    facts: {
      ...progress.facts,
      [attempt.factId]: { attempts: previous.attempts + 1, correct: previous.correct + Number(attempt.correct) },
    },
  };
};

export const rememberPracticeSelection = function(progress: PracticeProgress, selection: PracticeSelection): PracticeProgress {
  const validSelection = selectionFromUnknown(selection);
  return validSelection ? { ...progress, lastSelection: validSelection } : progress;
};

export type PracticeTopicEvidence = Readonly<{
  attempted: number;
  solved: number;
  total: number;
  attempts: number;
  correct: number;
  accuracy: number | null;
  revisit: readonly PracticeFact[];
}>;

export const practiceTopicEvidence = function(progress: PracticeProgress, topic: PracticeTopic, related = false): PracticeTopicEvidence {
  const facts = practiceFacts(topic, related);
  const attempts = facts.reduce((total, fact) => total + (progress.facts[fact.id]?.attempts ?? 0), 0);
  const correct = facts.reduce((total, fact) => total + (progress.facts[fact.id]?.correct ?? 0), 0);
  return {
    attempted: facts.filter(fact => (progress.facts[fact.id]?.attempts ?? 0) > 0).length,
    solved: facts.filter(fact => (progress.facts[fact.id]?.correct ?? 0) > 0).length,
    total: facts.length,
    attempts,
    correct,
    accuracy: attempts > 0 ? correct / attempts : null,
    revisit: facts.filter(fact => {
      const evidence = progress.facts[fact.id];
      return evidence !== undefined && evidence.attempts > evidence.correct;
    }),
  };
};

export const practiceTopicStatus = function(progress: PracticeProgress, topic: PracticeTopic, related = false): PracticeTopicStatus {
  const evidence = practiceTopicEvidence(progress, topic, related);
  if (evidence.attempted === 0) return 'New';
  return evidence.solved === evidence.total ? 'Practiced' : 'Practicing';
};
