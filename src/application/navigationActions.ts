import { activePlayerProfile } from '../ecs/playerProfiles';
import { playerQuery } from '../ecs/queries';
import { skitById, type SkitId } from '../ecs/skitSequence';
import type { GameEngine } from '../ecs/Engine';
import type { ResourceActions, ScreenActions, ActionSound } from './actionDependencies';

type NavigationDependencies = {
  playSound: ActionSound;
  finishPractice: () => void;
  startGameplayOnboarding: () => void;
  skipGameplayOnboarding: () => void;
  nextGameplayOnboardingStep: () => void;
  previousGameplayOnboardingStep: () => void;
};

// Preserve inference for the factory's public action signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createNavigationActions = function(
  engine: ResourceActions & ScreenActions & Pick<GameEngine, 'tryGetSingleton'>,
  { playSound, finishPractice, startGameplayOnboarding, skipGameplayOnboarding,
    nextGameplayOnboardingStep, previousGameplayOnboardingStep }: NavigationDependencies,
) {
  function startTutorial(): void {
    startGameplayOnboarding();
  }

  function skipTutorial(): void {
    skipGameplayOnboarding();
  }

  function nextTutorialStep(): void {
    nextGameplayOnboardingStep();
  }

  function previousTutorialStep(): void {
    previousGameplayOnboardingStep();
  }

  function returnToPreviousScreen(): void {
    playSound('uiBack');
    void engine.popScreen();
  }

  function goToMenu(): void {
    const practice = engine.getResource('practiceSession');
    if (practice?.outcome === 'active') {
      finishPractice();
      return;
    }
    engine.setResource('practiceSession', null);
    playSound('uiBack');
    engine.setResource('mathSession', null);
    engine.setResource('mathRoundSummary', null);
    void engine.setScreen('menu', {});
  }

  function openModeSelect(): void {
    playSound('uiSelect');
    void engine.setScreen('modeSelect', {});
  }

  function openHowToPlay(): void {
    playSound('uiSelect');
    void engine.setScreen('howToPlay', {});
  }

  function openSettings(): void {
    const returnTo = engine.getCurrentScreen();
    if (
      returnTo === null
      || returnTo === 'studioSplash'
      || returnTo === 'engineSplash'
      || returnTo === 'settings'
      || returnTo === 'controllerRecovery'
      || returnTo === 'levelComplete'
      || returnTo === 'skit'
      || returnTo === 'skitGallery'
      || returnTo === 'tutorialOffer'
      || returnTo === 'playerSetup'
      || returnTo === 'playerRoster'
      || returnTo === 'playerAdd'
      || returnTo === 'playerManagement'
      || returnTo === 'playerRename'
      || returnTo === 'playerDelete'
      || returnTo === 'practice'
      || returnTo === 'practiceResults'
    ) return;
    playSound('uiSelect');
    void engine.pushScreen('settings', { returnTo });
  }

  function pauseGame(): void {
    const player = engine.tryGetSingleton(playerQuery.with);
    if (!player || player.components.player.gameOverPending) return;
    playSound('uiSelect');
    void engine.pushScreen('paused', {});
  }

  function openSkitGallery(): void {
      playSound('uiSelect');
      void engine.setScreen('skitGallery', {});
  }
  function replaySkit(id: SkitId): void {
      const profile = activePlayerProfile(engine.getResource('playerProfiles'));
      if (engine.getCurrentScreen() !== 'skitGallery' || !profile?.skitProgress.includes(id)) return;
      playSound('uiSelect');
      void engine.setScreen('skit', { replay: true, skitId: id });
  }
  function skipSkit(): void {
      if (engine.getCurrentScreen() !== 'skit') return;
      engine.updateScreenState('skit', { elapsed: skitById(engine.getScreenState('skit').skitId).durationSeconds });
  }

  return { startTutorial, skipTutorial, nextTutorialStep, previousTutorialStep, returnToPreviousScreen, goToMenu, openModeSelect, openHowToPlay, openSettings, pauseGame, openSkitGallery, replaySkit, skipSkit };
};
