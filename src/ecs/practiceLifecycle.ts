import type { GameEngine } from './Engine';
import { activePlayerProfile } from '../profiles/rules';
import { recordPracticeEvidence } from './practiceProgress';
import { finishPracticeSession, recordPracticeAttempt, type PracticeAttempt } from './practiceSession';

export const submitPracticeAttempt = function(ecs: GameEngine, attempt: PracticeAttempt): void {
  const session = ecs.tryGetResource('practiceSession');
  const profiles = ecs.getResource('playerProfiles');
  const profile = activePlayerProfile(profiles);
  if (!session || session.outcome !== 'active' || profile?.id !== session.ownerId) return;
  const next = recordPracticeAttempt(session, attempt.factId, attempt.correct);
  if (next === session) return;
  ecs.setResource('practiceSession', next);
  ecs.setResource('playerProfiles', ecs.getResource('profilePersistence').updateActive(profiles, active => ({
    ...active,
    practiceProgress: recordPracticeEvidence(active.practiceProgress, attempt),
  })));
};

export const finishPractice = function(ecs: GameEngine): void {
  const session = ecs.tryGetResource('practiceSession');
  if (!session || session.outcome !== 'active') return;
  ecs.setResource('practiceSession', finishPracticeSession(session));
  void ecs.setScreen('practiceResults', {});
};
