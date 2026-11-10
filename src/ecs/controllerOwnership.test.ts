import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createInputPlugin, type GamepadLike } from 'ecspresso/plugins/input/input';
import type { GameEngine } from './Engine';
import type { GameAction } from './types';
import { controllerInputPlayers, gameActions, initialControllerSelection, keyboardActionMap, uiActions } from './controllerSelection';
import { addControllerSelectionSystemToEngine } from './systems/ControllerSelectionSystem';
import { splashAdvancePressed } from './splashInput';
import type { RendererInputDiagnostic } from '../platform/desktop';

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
    actions: keyboardActionMap(),
    players: controllerInputPlayers(),
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
  test('diagnostics observe immediate input from the controller in use', async () => {
    const f = await fixture();
    const reports: RendererInputDiagnostic[] = [];
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { mathMarshDesktop: { input: {
      reportDiagnostics: function (diagnostic: RendererInputDiagnostic): void { reports.push(diagnostic); },
    } } } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      hasFocus: function (): boolean { return true; }, hidden: false,
    } });
    try {
      f.pads[0] = pad('Deck');
      f.world.update(30);
      expect(reports.at(-1)).toMatchObject({ ownerId: null, waitingForNeutral: false,
        pageFocused: true });
      expect(reports.at(-1)?.controllers[0]).toMatchObject({ slot: 0, connected: true, id: 'Deck', pressed: [] });
      f.pads[0] = pad('Deck', [0]);
      f.world.update(0);
      expect(reports.at(-1)).toMatchObject({ ownerId: 'Deck', ownerSlot: 0, waitingForNeutral: false,
        blockFrame: false });
      expect(reports.at(-1)?.controllers[0]?.pressed).toEqual([0]);
      expect(f.actions().justActivated('eat')).toBe(true);
      f.pads[0] = pad('Deck');
      f.world.update(0);
      expect(reports.at(-1)?.waitingForNeutral).toBe(false);
      f.pads[0] = pad('Deck', [0]);
      f.world.update(0);
      expect(reports.at(-1)?.activeActions).toContain('eat');
      expect(f.actions().justActivated('eat')).toBe(true);
    } finally {
      if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
      else Reflect.deleteProperty(globalThis, 'window');
      if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
      else Reflect.deleteProperty(globalThis, 'document');
      await f.world.dispose();
    }
  });

  test('stick drift is ignored; a slot 3 stick movement works immediately without an activation button', async () => {
    const f = await fixture();
    try {
      f.pads[3] = pad('Xbox', [], [0.2, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner).toBeNull();
      f.pads[3] = pad('Xbox', [], [1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(3);
      expect(f.actions().justActivated('right')).toBe(true);
      f.world.update(0);
      expect(f.actions().isActive('right')).toBe(true);
      expect(f.actions().justActivated('right')).toBe(false);
    } finally { await f.world.dispose(); }
  });

  test('latest controller button takes over immediately and an old held stick cannot steal back', async () => {
    const f = await fixture();
    try {
      f.pads[0] = pad('Deck', [], [1, 0]);
      f.world.update(0);
      f.pads[1] = pad('Xbox', [13]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      expect(f.actions().justActivated('down')).toBe(true);
      expect(f.actions().isActive('right')).toBe(false);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      f.pads[0] = pad('Deck', [], [-1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(0);
      expect(f.actions().justActivated('left')).toBe(true);
    } finally { await f.world.dispose(); }
  });

  test('all standard buttons can select a controller, even buttons without a gameplay binding', async () => {
    const f = await fixture();
    try {
      for (let button = 0; button < 17; button += 1) {
        f.pads[1] = pad('first');
        f.pads[2] = pad('second');
        f.world.update(0);
        const slot = button % 2 === 0 ? 1 : 2;
        f.pads[slot] = pad(slot === 1 ? 'first' : 'second', [button]);
        f.world.update(0);
        expect(f.world.getResource('controllerSelection').owner?.slot).toBe(slot);
      }
    } finally { await f.world.dispose(); }
  });

  test('simultaneous inputs keep the current owner, otherwise choose the lowest slot, including identical IDs', async () => {
    const f = await fixture();
    try {
      f.pads[1] = pad(undefined, [13]);
      f.pads[2] = pad(undefined, [0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      expect(f.actions().justActivated('down')).toBe(true);
      expect(f.actions().isActive('eat')).toBe(false);
      expect(splashAdvancePressed(f.world.getResource('inputState'), f.world.getResource('controllerSelection'))).toBe(true);
      f.pads[1] = pad();
      f.pads[2] = pad();
      f.world.update(0);
      f.pads[2] = pad(undefined, [0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(2);
      expect(f.actions().justActivated('eat')).toBe(true);
      f.pads[1] = pad(undefined, [15]);
      f.pads[2] = pad(undefined, [13]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(2);
      expect(f.actions().justActivated('down')).toBe(true);
      expect(f.actions().isActive('right')).toBe(false);
    } finally { await f.world.dispose(); }
  });

  test('stick threshold jitter and an unused right stick hold cannot repeatedly take control', async () => {
    const f = await fixture();
    try {
      f.pads[0] = pad('Deck', [], [0, 0, 1, 0]);
      f.world.update(0);
      f.pads[1] = pad('Xbox', [13]);
      f.world.update(0);
      for (const value of [0.8, 0.55, 0.65]) {
        f.pads[0] = pad('Deck', [], [0, 0, value, 0]);
        f.world.update(0);
        expect(f.world.getResource('controllerSelection').owner?.slot).toBe(1);
      }
      f.pads[0] = pad('Deck');
      f.world.update(0);
      f.pads[0] = pad('Deck', [], [0, 0, 1, 0]);
      f.world.update(0);
      expect(f.world.getResource('controllerSelection').owner?.slot).toBe(0);
    } finally { await f.world.dispose(); }
  });

  test('keyboard edges remain usable while controller controls are held', async () => {
    const f = await fixture();
    try {
      f.pads[1] = pad(undefined, [2]);
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

  test('text editing ignores keyboard action bindings before a controller is used, while Escape still works', async () => {
    const f = await fixture();
    try {
      f.key('keydown', 'Enter');
      f.key('keydown', 'ArrowDown');
      f.key('keydown', 'Escape');
      f.world.update(0);
      const actions = uiActions(f.world.getResource('inputState'), f.world.getResource('controllerSelection'), true);
      expect(actions.justActivated('eat')).toBe(false);
      expect(actions.isActive('down')).toBe(false);
      expect(actions.justActivated('back')).toBe(true);
      f.pads[1] = pad('Xbox', [13]);
      f.world.update(0);
      expect(uiActions(f.world.getResource('inputState'), f.world.getResource('controllerSelection'), true).justActivated('down')).toBe(true);
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

  test('same-slot different-ID replacement suppresses its first actions during disconnect recovery', async () => {
    const f = await fixture();
    try {
      f.pads[0] = pad('original', [0]);
      f.world.update(0);
      f.pads[0] = pad('original');
      f.world.update(0);
      f.pads[0] = pad('replacement', [0, 15]);
      f.world.update(0);
      expect(f.world.getResource('inputState').player('controller:0:standard:shared')?.actions.justActivated('eat')).toBe(true);
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
