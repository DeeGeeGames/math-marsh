import type { GameSystemRegistrar } from '../Engine';
import { playerQuery } from '../queries';

// While playing, the pause action pushes the paused screen. Resuming from
// pause is handled by the UI navigation system as a "cancel" on the paused
// UI screen so the same key/button drives back/cancel uniformly.
export function addPauseSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('pauseSystem')
    .inScreens(['playing'])
    .addSingleton('player', playerQuery)
    .withResources(['inputState'])
    .setProcess(({ ecs, queries, resources: { inputState } }) => {
      if (!queries.player || queries.player.components.player.gameOverPending) return;
      if (!inputState.actions.justActivated('pause')) return;
      void ecs.pushScreen('paused', {});
    });
}
