import { createPracticeSession, type PracticeSelection } from '../ecs/practiceSession';
import { rememberPracticeSelection } from '../ecs/practiceProgress';
import { selectedStartingLevel } from '../ecs/levelSelectionCheat';
import type { EquationOperation, GameMode, MathDifficulty } from '../ecs/types';
import { createMathSession } from '../ecs/mathMode';
import { selectUnlockedMathStep } from '../ecs/mathProgressStore';
import { activePlayerProfile, updateActivePlayerProfile } from '../ecs/playerProfiles';
import type { ResourceActions, ScreenActions, ActionSound } from './actionDependencies';

// Preserve inference for the factory's public action signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createRunActions = function(
  engine: ResourceActions & Pick<ScreenActions, 'setScreen'>,
  { playSound, startNormalGame }: { playSound: ActionSound; startNormalGame: () => void },
) {
  const startGame = function(mode: GameMode, difficulty: MathDifficulty, level = 1): void {
    const profile = activePlayerProfile(engine.getResource('playerProfiles'));
    if (!profile) return;
    playSound('uiSelect');
    engine.setResource('practiceSession', null);
    engine.setResource('startingLevel', selectedStartingLevel(level));
    engine.setResource('mathDifficulty', difficulty);
    engine.setResource('gameMode', mode);
    engine.setResource('mathSession', createMathSession(profile.mathProgress));
    engine.setResource('mathRoundSummary', null);
    if (profile.onboarding.basics === 'pending') {
      void engine.setScreen('tutorialOffer', {});
      return;
    }
    startNormalGame();
  };

  const selectMathStep = function(operation: EquationOperation, step: number): void {
    const profiles = engine.getResource('playerProfiles');
    const profile = activePlayerProfile(profiles);
    if (!profile) return;
    const progress = selectUnlockedMathStep(profile.mathProgress, operation, step);
    if (!progress) return;
    engine.setResource('playerProfiles', updateActivePlayerProfile(profiles, active => ({
      ...active,
      mathProgress: progress,
    })));
  };

  function clearPlayerRun(): void {
    engine.setResource('practiceSession', null);
    engine.setResource('mathSession', null);
    engine.setResource('mathRoundSummary', null);
    engine.setResource('mathRoundCompletedThisBoard', false);
  }

  function replayGame(): void {
    startGame(engine.getResource('gameMode'), engine.getResource('mathDifficulty'));
  }

  const startPractice = function(selection: PracticeSelection): void {
    const profiles = engine.getResource('playerProfiles');
    const profile = activePlayerProfile(profiles);
    if (!profile || (selection.pond !== 'easy' && selection.pond !== 'medium' && selection.pond !== 'expert')
      || typeof selection.related !== 'boolean') return;
    const session = createPracticeSession(profile.id, selection);
    if (!session) return;
    playSound('uiSelect');
    engine.setResource('practiceSession', session);
    engine.setResource('mathSession', null);
    engine.setResource('mathRoundSummary', null);
    engine.setResource('startingLevel', 1);
    engine.setResource('mathDifficulty', selection.pond);
    const fact = session.deck[0];
    if (!fact) return;
    engine.setResource('gameMode', [fact.operation]);
    engine.setResource('playerProfiles', updateActivePlayerProfile(profiles, active => ({
      ...active, practiceProgress: rememberPracticeSelection(active.practiceProgress, selection),
    })));
    if (profile.onboarding.basics === 'pending') {
      void engine.setScreen('tutorialOffer', {});
      return;
    }
    startNormalGame();
  };

  const openPractice = function(): void {
    clearPlayerRun();
    playSound('uiSelect');
    void engine.setScreen('practice', {});
  };


  return { startGame, selectMathStep, clearPlayerRun, replayGame, startPractice, openPractice };
};
