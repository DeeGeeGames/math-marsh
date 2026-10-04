import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createInputPlugin, type GamepadLike } from 'ecspresso/plugins/input/input';
import type { GameEngine } from './Engine';
import type { GameAction } from './types';
import { controllerActionMap, gameActions, initialControllerSelection, keyboardActionMap } from './controllerSelection';
import { addControllerSelectionSystemToEngine } from './systems/ControllerSelectionSystem';
import { splashAdvancePressed } from './splashInput';

const pad = function (id = 'identical controller', buttons: readonly number[] = [], axes: readonly number[] = [0, 0]): GamepadLike {
  return {
    id, connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, button) => ({ pressed: buttons.includes(button), value: buttons.includes(button) ? 1 : 0 })),
  };
};

const fixture = async function () {
  const pads: Array<GamepadLike | null> = [null, null, null, null];
  const target = new EventTarget();
  const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
  world.installPlugin(createInputPlugin<GameAction>({
    actions: controllerActionMap(initialControllerSelection()),
    players: { keyboard: keyboardActionMap() },
    target, gamepad: { poll: () => pads },
  }));
  world.addResource('controllerSelection', initialControllerSelection());
  addControllerSelectionSystemToEngine(world);
  const ticks = { gameplay: 0, timers: 0, tweens: 0, coroutines: 0 };
  for (const group of ['gameplay', 'timers', 'tweens', 'coroutines'] as const) {
    world.addSystem(`probe-${group}`).inGroup(group).inPhase('preUpdate').setPriority(95)
      .setProcess(() => { ticks[group] += 1; });
  }
  await world.initialize();
  const actions = function () { return gameActions(world.getResource('inputState'), world.getResource('controllerSelection')); };
  const key = function (type: 'keydown' | 'keyup', value: string): void {
    const event = new Event(type);
    Object.defineProperty(event, 'key', { value });
    target.dispatchEvent(event);
  };
  return { world, pads, ticks, key, actions };
};

describe('active controller ownership', () => {
  test('idle connections and sticks cannot claim; A claims slot 3 without activating or skipping', async () => {
    const f = await fixture();
    try {
      f.pads[3] = pad('Xbox', [], [1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner).toBeNull();
      expect(f.actions().isActive('right')).toBe(false);
      f.pads[3] = pad('Xbox', [0, 15], [1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(3);
      expect(f.actions().justActivated('eat')).toBe(false);
      expect(splashAdvancePressed(f.world.getResource('inputState'), f.world.getResource('controllerSelection'))).toBe(false);
      f.world.update(0);
      expect(f.actions().isActive('eat')).toBe(false);
      f.pads[3] = pad('Xbox', [], [1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').waitingForNeutral).toBe(true);
      expect(f.actions().isActive('right')).toBe(false);
      f.pads[3] = pad('Xbox');
      f.world.update(0);
      f.pads[3] = pad('Xbox', [0], [1, 0]);
      f.world.update(0);
      expect(f.actions().justActivated('eat')).toBe(true);
      expect(f.actions().isActive('right')).toBe(true);
      expect(splashAdvancePressed(f.world.getResource('inputState'), f.world.getResource('controllerSelection'))).toBe(true);
    } finally { await f.world.dispose(); }
  });

  test('simultaneous claims choose the first slot and identical-ID non-owners cannot steal or act', async () => {
    const f = await fixture();
    try {
      f.pads[1] = pad(undefined, [9]);
      f.pads[2] = pad(undefined, [0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      f.pads[1] = pad();
      f.pads[2] = pad();
      f.world.update(0);
      f.pads[2] = pad(undefined, [0, 9, 15], [1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      expect(f.actions().isActive('eat')).toBe(false);
      expect(f.actions().isActive('pause')).toBe(false);
      expect(f.actions().isActive('right')).toBe(false);
    } finally { await f.world.dispose(); }
  });

  test('keyboard edges remain usable while acquisition controls are held', async () => {
    const f = await fixture();
    try {
      f.pads[1] = pad(undefined, [0]);
      f.key('keydown', 'Enter');
      f.world.update(0);
      expect(f.actions().justActivated('eat')).toBe(true);
      f.key('keyup', 'Enter');
      f.world.update(0);
      expect(f.actions().isActive('eat')).toBe(false);
      f.key('keydown', 'Escape');
      f.world.update(0);
      expect(f.actions().justActivated('pause')).toBe(true);
    } finally { await f.world.dispose(); }
  });

  test('disconnect freezes simulation immediately while replacement acquisition inputs stay suppressed', async () => {
    const f = await fixture();
    try {
      f.pads[1] = pad(undefined, [0]);
      f.world.update(0);
      f.pads[1] = pad();
      f.world.update(0);
      const active = spyOn(f.world, 'isScreenActive').mockImplementation(screen => screen === 'playing');
      const push = spyOn(f.world, 'pushScreen').mockResolvedValue();
      f.world.update(0.1);
      const before = { ...f.ticks };
      f.pads[1] = null;
      f.world.update(10);
      expect(f.ticks).toEqual(before);
      expect(push).toHaveBeenCalledWith('controllerRecovery', {});
      active.mockImplementation(screen => screen === 'playing' || screen === 'controllerRecovery');
      f.pads[2] = pad(undefined, [9, 0], [0, -1]);
      f.world.update(10);
      expect(f.actions().isActive('pause')).toBe(false);
      expect(f.actions().isActive('up')).toBe(false);
      expect(f.ticks).toEqual(before);
      f.pads[2] = pad();
      f.world.update(0);
      f.pads[1] = pad(undefined, [0]);
      f.pads[2] = pad(undefined, [0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(2);
      expect(f.actions().justActivated('eat')).toBe(true);
      active.mockRestore();
      push.mockRestore();
    } finally { await f.world.dispose(); }
  });

  test('same-slot different-ID replacement consumes stale actions evaluated before rebinding', async () => {
    const f = await fixture();
    try {
      f.pads[0] = pad('original', [0]);
      f.world.update(0);
      f.pads[0] = pad('original');
      f.world.update(0);
      f.pads[0] = pad('replacement', [0, 15]);
      f.world.update(0);
      expect(f.world.getResource('inputState').actions.justActivated('eat')).toBe(true);
      expect(f.actions().justActivated('eat')).toBe(false);
      expect(f.actions().isActive('right')).toBe(false);
      expect(f.world.getResource('controllerSelection').owner?.id).toBe('replacement');
      f.pads[0] = pad('replacement');
      f.world.update(0);
      f.pads[0] = pad('replacement', [15]);
      f.world.update(0);
      expect(f.actions().justActivated('right')).toBe(true);
    } finally { await f.world.dispose(); }
  });

  test('observed disconnect requires a new press after reconnect or moving slots', async () => {
    const f = await fixture();
    try {
      f.pads[0] = pad(undefined, [0]);
      f.world.update(0);
      f.pads[0] = pad();
      f.world.update(0);
      f.pads[0] = null;
      f.world.update(0);
      f.pads[3] = pad();
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner).toBeNull();
      f.pads[3] = pad(undefined, [9]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(3);
      expect(f.actions().justActivated('skip')).toBe(false);
    } finally { await f.world.dispose(); }
  });
});
