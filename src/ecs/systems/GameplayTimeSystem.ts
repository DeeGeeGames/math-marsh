import { gameEngine } from '../Engine';
import { playerQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';

export function addGameplayTimeSystemToEngine(): void {
  gameEngine.addSystem('gameplayTimeSystem')
    .setPriority(SYSTEM_PRIORITIES.GAMEPLAY_TIME)
    .addSingleton('player', playerQuery)
    .withResources(['gameplayTimeSeconds'])
    .setProcess(({ queries, dt, ecs, resources: { gameplayTimeSeconds } }) => {
      const player = queries.player;
      if (!player || player.components.player.gameOverPending) return;
      if (player.components.timers.freeze?.active === true) return;

      ecs.setResource('gameplayTimeSeconds', gameplayTimeSeconds + dt);
    });
}
