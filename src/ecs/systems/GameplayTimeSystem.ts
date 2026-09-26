import type { GameSystemRegistrar } from '../Engine';
import { playerCollisionQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { timeAfterChange } from '../runTime';
import { triggerGameOver } from '../runLifecycle';

export function addGameplayTimeSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('gameplayTimeSystem')
    .setPriority(SYSTEM_PRIORITIES.GAMEPLAY_TIME)
    .addSingleton('player', { ...playerCollisionQuery, mutates: ['player', 'timers'] } as const)
    .withResources(['remainingTimeSeconds'])
    .setProcess(({ queries, dt, ecs, resources: { remainingTimeSeconds } }) => {
      const player = queries.player;
      if (!player || player.components.player.gameOverPending) return;
      const remaining = timeAfterChange(remainingTimeSeconds, -dt);
      ecs.setResource('remainingTimeSeconds', remaining);
      if (remaining === 0) triggerGameOver(ecs, player, 'Time ran out');
    });
}
