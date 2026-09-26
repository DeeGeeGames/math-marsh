import { definePlugin } from 'ecspresso';
import { createTimer, type TimerComponentTypes } from 'ecspresso/plugins/scripting/timers';
import type { GameTimer, TimerSlot } from './types';

/** A monotonic gameplay timeline, advanced and paused by the timer plugin. */
export function gameplayTimeMs(clock: Readonly<GameTimer>): number {
  return clock.elapsed * 1000;
}

export const gameplayClockPlugin = definePlugin('gameplay-clock')
  .withComponentTypes<TimerComponentTypes<TimerSlot>>()
  .withResourceTypes<{ gameplayClock: GameTimer }>()
  .install(world => {
    world.addResource('gameplayClock', createTimer<TimerSlot>(Number.POSITIVE_INFINITY));
    world.addSystem('initialize-gameplay-clock')
      .setOnInitialize(ecs => {
        ecs.spawn({ timers: { gameplayClock: ecs.getResource('gameplayClock') } }, { scope: null });
      });
  });
