import {
  createPlayerProfile as addPlayerProfileRecord,
  createPlayerProfileId,
  deletePlayerProfile as deletePlayerProfileRecord,
  renamePlayerProfile as renamePlayerProfileRecord,
  switchActivePlayerProfile,
  type PlayerProfilesError,
} from '../ecs/playerProfiles';
import type { ResourceActions, ScreenActions, ActionSound } from './actionDependencies';

// Preserve inference for the factory's public action signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createProfileActions = function(
  engine: ResourceActions & Pick<ScreenActions, 'getCurrentScreen' | 'pushScreen' | 'setScreen' | 'popScreen'>,
  { playSound, clearPlayerRun, focusRenamedProfile, createId = createPlayerProfileId }: {
    playSound: ActionSound;
    clearPlayerRun: () => void;
    focusRenamedProfile: (profileId: string) => void;
    createId?: () => string;
  },
) {
  function openPlayerRoster(): void {
    if (engine.getCurrentScreen() !== 'menu') return;
    playSound('uiSelect');
    void engine.pushScreen('playerRoster', {});
  }

  function openPlayerAdd(): void {
    if (engine.getCurrentScreen() !== 'playerRoster') return;
    playSound('uiSelect');
    void engine.pushScreen('playerAdd', {});
  }

  function openPlayerManagement(): void {
    if (engine.getCurrentScreen() !== 'playerRoster') return;
    playSound('uiSelect');
    void engine.pushScreen('playerManagement', {});
  }

  function openPlayerRename(profileId: string): void {
    if (engine.getCurrentScreen() !== 'playerManagement') return;
    playSound('uiSelect');
    void engine.pushScreen('playerRename', { profileId });
  }

  function openPlayerDelete(profileId: string): void {
    if (engine.getCurrentScreen() !== 'playerManagement') return;
    playSound('uiSelect');
    void engine.pushScreen('playerDelete', { profileId });
  }

  function createPlayer(name: string): PlayerProfilesError | undefined {
    const result = addPlayerProfileRecord(
      engine.getResource('playerProfiles'),
      name,
      createId(),
    );
    if (result.error) return result.error;
    engine.setResource('playerProfiles', result.state);
    clearPlayerRun();
    void engine.setScreen('menu', {});
    return undefined;
  }

  function switchPlayer(profileId: string): void {
    if (engine.getCurrentScreen() !== 'playerRoster') return;
    const profiles = engine.getResource('playerProfiles');
    if (profiles.activeProfileId === profileId) {
      void engine.setScreen('menu', {});
      return;
    }
    const result = switchActivePlayerProfile(profiles, profileId);
    if (result.error) return;
    engine.setResource('playerProfiles', result.state);
    clearPlayerRun();
    playSound('uiSelect');
    void engine.setScreen('menu', {});
  }

  function renamePlayer(profileId: string, name: string): PlayerProfilesError | undefined {
    const profiles = engine.getResource('playerProfiles');
    const result = renamePlayerProfileRecord(profiles, profileId, name);
    if (result.error) return result.error;
    engine.setResource('playerProfiles', result.state);
    void engine.popScreen().then(() => focusRenamedProfile(profileId));
    return undefined;
  }

  function deletePlayer(profileId: string): PlayerProfilesError | undefined {
    const profiles = engine.getResource('playerProfiles');
    const result = deletePlayerProfileRecord(profiles, profileId);
    if (result.state !== profiles) engine.setResource('playerProfiles', result.state);
    if (result.error) return result.error;
    clearPlayerRun();
    void engine.setScreen('menu', {});
    return undefined;
  }


  return { openPlayerRoster, openPlayerAdd, openPlayerManagement, openPlayerRename, openPlayerDelete, createPlayer, switchPlayer, renamePlayer, deletePlayer };
};
