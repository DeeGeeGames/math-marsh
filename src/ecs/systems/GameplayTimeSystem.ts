import type { GameSystemRegistrar } from '../Engine';
import { playerCollisionQuery, timeAdjustmentQuery } from '../queries';
import { ANSWER_CONSUMPTION_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import { timeAfterChange } from '../runTime';
import { triggerGameOver } from '../runLifecycle';
import { gameplayTimeMs } from '../gameplayClock';

export function addGameplayTimeSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('gameplayTimeSystem')
    .setPriority(SYSTEM_PRIORITIES.GAMEPLAY_TIME)
    .addSingleton('player', { ...playerCollisionQuery, mutates: ['player', 'timers'] } as const)
    .addQuery('timeAdjustments', timeAdjustmentQuery)
    .withResources(['remainingTimeSeconds', 'gameplayClock', 'equationMode'])
    .setProcess(({ queries, dt, ecs, resources: { remainingTimeSeconds, gameplayClock, equationMode } }) => {
      const player = queries.player;
      if (!player || player.components.player.gameOverPending) return;
      const currentTime = gameplayTimeMs(gameplayClock);
      const arrived = queries.timeAdjustments.filter(({ components: { timeAdjustment } }) =>
        currentTime - timeAdjustment.startedAt >= ANSWER_CONSUMPTION_DURATION_MS
      );
      arrived.forEach(entity => ecs.commands.removeEntity(entity.id));
      const remaining = arrived.reduce(
        (seconds, entity) => timeAfterChange(seconds, entity.components.timeAdjustment.seconds),
        timeAfterChange(remainingTimeSeconds, -dt),
      );
      ecs.setResource('remainingTimeSeconds', remaining);
      const bonusInFlight = equationMode.feedback?.kind === 'correct'
        && currentTime - equationMode.feedback.startedAt < ANSWER_CONSUMPTION_DURATION_MS;
      if (remaining === 0 && !bonusInFlight) {
        const penaltyArrived = arrived.some(entity => entity.components.timeAdjustment.seconds < 0);
        triggerGameOver(ecs, player, penaltyArrived ? 'Game Over!' : 'Time ran out');
      }
    });
}
