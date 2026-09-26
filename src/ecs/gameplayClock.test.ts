import { describe, expect, test } from 'bun:test';
import ECSpresso from 'ecspresso';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { gameplayClockPlugin, gameplayTimeMs } from './gameplayClock';
import type { TimerSlot } from './types';
import { EQUATION_FEEDBACK_DURATION_MS } from './systemConfigs';

describe('gameplay timeline', () => {
  test('feedback retains its remaining duration across suspended gameplay and screen changes', async () => {
    const world = ECSpresso.create()
      .withPlugin(createTimerPlugin<TimerSlot>())
      .withPlugin(gameplayClockPlugin)
      .withScreens(screens => screens
        .add('playing', { initialState: () => ({}) })
        .add('paused', { initialState: () => ({}) }))
      .build();
    await world.initialize();
    await world.setScreen('playing', {});
    const clock = world.getResource('gameplayClock');
    const startedAt = gameplayTimeMs(clock);
    world.update(0.2);
    await world.pushScreen('paused', {});
    world.disableSystemGroup('timers');
    world.update(30);
    expect(gameplayTimeMs(clock) - startedAt).toBeCloseTo(200);
    await world.popScreen();
    world.enableSystemGroup('timers');
    world.update(0.1);
    expect(gameplayTimeMs(clock) - startedAt).toBeCloseTo(300);
    expect(gameplayTimeMs(clock) - startedAt).toBeLessThan(EQUATION_FEEDBACK_DURATION_MS.correct);
    world.update(1);
    expect(gameplayTimeMs(clock) - startedAt).toBeGreaterThan(EQUATION_FEEDBACK_DURATION_MS.correct);
    await world.setScreen('playing', {});
    world.update(0.1);
    expect(gameplayTimeMs(clock)).toBeCloseTo(1400);
    await world.dispose();
  });
});
