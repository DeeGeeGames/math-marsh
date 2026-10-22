import { playSound } from '../audio/audio';
import type { GameEngine } from '../ecs/Engine';
import type { TutorialScreenConfig } from '../ecs/types';
import { mathTutorialForLevel } from '../ecs/mathMode';
import { goToNextLevel } from '../ecs/systems/nextLevel';
import { activePlayerProfile } from '../profiles/rules';
import {
  completedOnboardingCompletion,
  skippedOnboardingCompletion,
  tutorialStepIndex,
  tutorialSteps,
  type GameplayOnboardingCompletion,
  type GameplayOnboardingKind,
  type GameplayOnboardingSession,
} from './gameplayOnboarding';

const ONBOARDING_COMPLETION_TRANSITIONS = {
  completed: completedOnboardingCompletion,
  skipped: skippedOnboardingCompletion,
} as const;

function recordOnboardingCompletion(
  engine: GameEngine,
  kind: GameplayOnboardingKind,
  requested: Exclude<GameplayOnboardingCompletion, 'pending'>,
): void {
  const profiles = engine.getResource('playerProfiles');
  const profile = activePlayerProfile(profiles);
  if (!profile) return;
  const current = profile.onboarding[kind];
  const next = ONBOARDING_COMPLETION_TRANSITIONS[requested](current);
  if (next === current) return;
  engine.setResource('playerProfiles', engine.getResource('profilePersistence').updateActive(profiles, active => ({
    ...active,
    onboarding: { ...active.onboarding, [kind]: next },
  })));
}

export function startNormalGame(engine: GameEngine): void {
  const profile = activePlayerProfile(engine.getResource('playerProfiles'));
  if (!profile) return;
  const kind = mathTutorialForLevel(engine.getResource('startingLevel'), engine.getResource('mathDifficulty'),
    profile.onboarding.operands, profile.onboarding.operandAndResult);
  if (kind) {
    void engine.setScreen('tutorial', { kind, isReplay: false, returnTo: { kind: 'newGame' } });
    return;
  }
  void engine.setScreen('playing', {
    level: engine.getResource('startingLevel'),
    isFreshGame: true,
  });
}

export function startGameplayOnboarding(engine: GameEngine): void {
  const isFirstRun = engine.getCurrentScreen() === 'tutorialOffer';
  const profile = activePlayerProfile(engine.getResource('playerProfiles'));
  if (!profile) return;
  const config: TutorialScreenConfig = {
    kind: 'basics',
    isReplay: profile.onboarding.basics !== 'pending',
    returnTo: isFirstRun
      ? { kind: 'newGame' }
      : { kind: 'nextTutorial' },
  };
  playSound('uiSelect');
  if (isFirstRun) {
    void engine.setScreen('tutorial', config);
    return;
  }
  void engine.pushScreen('tutorial', config);
}

async function continueToNextTutorial(
  engine: GameEngine,
  kind: GameplayOnboardingKind,
): Promise<void> {
  await engine.popScreen();
  await engine.pushScreen('tutorial', {
    kind: kind === 'basics' ? 'operands' : 'operandAndResult',
    isReplay: true,
    returnTo: kind === 'basics' ? { kind: 'nextTutorial' } : { kind: 'previousScreen' },
  });
}

function restoreActivePlayer(
  engine: GameEngine,
  session: Extract<GameplayOnboardingSession, { active: true }>,
): void {
  const player = engine.tryGetSingleton(['player', 'position', 'pathFollower'] as const);
  const snapshot = session.playerSnapshot;
  if (!player || !snapshot) throw new Error('Level tutorial cannot restore the active player');

  Object.assign(player.components.position, snapshot.position);
  player.components.player.gameOverPending = snapshot.gameOverPending;
  engine.setResource('remainingTimeSeconds', snapshot.remainingTimeSeconds);
  Object.assign(player.components.pathFollower, snapshot.pathFollower, {
    breadcrumbs: snapshot.pathFollower.breadcrumbs.map(point => ({ ...point })),
  });
  (['tween', 'spriteAnimation', 'shake'] as const).forEach(component => {
    if (engine.hasComponent(player.id, component)) engine.commands.removeComponent(player.id, component);
  });
}

function continueAfterTutorial(
  engine: GameEngine,
  session: Extract<GameplayOnboardingSession, { active: true }>,
): void {
  if (session.returnTo.kind === 'nextTutorial') {
    void continueToNextTutorial(engine, session.kind);
    return;
  }
  if (session.returnTo.kind === 'previousScreen') {
    void engine.popScreen();
    return;
  }
  if (session.returnTo.kind === 'newGame') {
    startNormalGame(engine);
    return;
  }

  const profile = activePlayerProfile(engine.getResource('playerProfiles'));
  if (!profile) return;
  restoreActivePlayer(engine, session);
  goToNextLevel(engine, session.returnTo.level, engine.getResource('mathDifficulty'),
    profile.onboarding.operands, profile.onboarding.operandAndResult);
}

export function skipGameplayOnboarding(engine: GameEngine): void {
  const session = engine.getResource('gameplayOnboardingSession');
  const kind = session.active ? session.kind : 'basics';
  playSound('uiSelect');
  recordOnboardingCompletion(engine, kind, 'skipped');
  if (!session.active) {
    startNormalGame(engine);
    return;
  }
  if (session.returnTo.kind === 'nextTutorial') {
    void engine.popScreen();
    return;
  }
  continueAfterTutorial(engine, session);
}

function completeTutorial(engine: GameEngine): void {
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  playSound('uiSelect');
  recordOnboardingCompletion(engine, session.kind, 'completed');
  continueAfterTutorial(engine, session);
}

function setGameplayOnboardingStep(engine: GameEngine, stepIndex: number): void {
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  engine.setResource('gameplayOnboardingSession', {
    ...session,
    stepIndex: tutorialStepIndex(session.kind, stepIndex),
  });
}

export function nextGameplayOnboardingStep(engine: GameEngine): void {
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  if (session.stepIndex >= tutorialSteps(session.kind).length - 1) {
    completeTutorial(engine);
    return;
  }
  playSound('uiSelect');
  setGameplayOnboardingStep(engine, session.stepIndex + 1);
}

export function previousGameplayOnboardingStep(engine: GameEngine): void {
  const session = engine.getResource('gameplayOnboardingSession');
  if (!session.active) return;
  if (session.stepIndex === 0) {
    skipGameplayOnboarding(engine);
    return;
  }
  playSound('uiBack');
  setGameplayOnboardingStep(engine, session.stepIndex - 1);
}
