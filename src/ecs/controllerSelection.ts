import { isSteamControllerId } from '../platform/steamInput';
import {
  gamepadAxisOn,
  gamepadButtonsOn,
  type ActionMap,
  type ActionState,
  type GamepadState,
  type InputState,
} from 'ecspresso/plugins/input/input';
import type { GameAction } from './types';

export interface ControllerSelection {
  owner: { slot: number; id: string | null } | null;
  waitingForNeutral: boolean;
  blockFrame: boolean;
  usedThisFrame: boolean;
  activity: readonly { id: string | null; axes: readonly number[] }[];
}

export const initialControllerSelection = function (): ControllerSelection {
  return { owner: null, waitingForNeutral: false, blockFrame: false, usedThisFrame: false, activity: [] };
};

export const keyboardActionMap = function (): ActionMap<GameAction> {
  return {
    up: { keys: ['ArrowUp', 'w', 'W'] },
    down: { keys: ['ArrowDown', 's', 'S'] },
    left: { keys: ['ArrowLeft', 'a', 'A'] },
    right: { keys: ['ArrowRight', 'd', 'D'] },
    eat: { keys: [' ', 'Enter'] },
    back: { keys: ['Escape'] },
    skip: { keys: ['Tab'] },
    pause: { keys: ['Escape'] },
  };
};

export const controllerActionMap = function (
  selection: Readonly<ControllerSelection>,
): ActionMap<GameAction> {
  const map = keyboardActionMap();
  if (!selection.owner || selection.waitingForNeutral) return map;
  const slot = selection.owner.slot;
  return {
    up: { ...map.up, gamepadButtons: gamepadButtonsOn(slot, 12), gamepadAxes: [gamepadAxisOn(slot, 1, -1)] },
    down: { ...map.down, gamepadButtons: gamepadButtonsOn(slot, 13), gamepadAxes: [gamepadAxisOn(slot, 1, 1)] },
    left: { ...map.left, gamepadButtons: gamepadButtonsOn(slot, 14), gamepadAxes: [gamepadAxisOn(slot, 0, -1)] },
    right: { ...map.right, gamepadButtons: gamepadButtonsOn(slot, 15), gamepadAxes: [gamepadAxisOn(slot, 0, 1)] },
    eat: { ...map.eat, gamepadButtons: gamepadButtonsOn(slot, 0) },
    back: { ...map.back, gamepadButtons: gamepadButtonsOn(slot, 1) },
    skip: { ...map.skip, gamepadButtons: gamepadButtonsOn(slot, isSteamControllerId(selection.owner.id) ? 8 : 9) },
    pause: { ...map.pause, gamepadButtons: gamepadButtonsOn(slot, 9) },
  };
};

export const controllerOnlyActionMap = function (
  selection: Readonly<ControllerSelection>,
): ActionMap<GameAction> {
  const configured = controllerActionMap(selection);
  const withoutKeyboard = (action: GameAction): ActionMap<GameAction>[GameAction] => {
    const { gamepadButtons, gamepadAxes } = configured[action];
    return {
      ...(gamepadButtons ? { gamepadButtons } : {}),
      ...(gamepadAxes ? { gamepadAxes } : {}),
    };
  };
  return {
    up: withoutKeyboard('up'),
    down: withoutKeyboard('down'),
    left: withoutKeyboard('left'),
    right: withoutKeyboard('right'),
    eat: withoutKeyboard('eat'),
    back: withoutKeyboard('back'),
    skip: withoutKeyboard('skip'),
    pause: withoutKeyboard('pause'),
  };
};

const STANDARD_CONTROLLER_BUTTONS = Array.from({ length: 17 }, (_, index) => index);
const STICK_AXES = [0, 1, 2, 3] as const;

const controllerPlayerId = function (slot: number, native: boolean, controllerOnly: boolean): string {
  return `controller:${slot}:${native ? 'steam' : 'standard'}:${controllerOnly ? 'only' : 'shared'}`;
};

/** Evaluate each slot before ownership selection, so the first input from a new
 * controller works in the same frame without deferred action-map rebinding. */
export const controllerInputPlayers = function (): Record<string, ActionMap<GameAction>> {
  const players: Record<string, ActionMap<GameAction>> = {
    keyboard: keyboardActionMap(),
    'controller:none': controllerOnlyActionMap(initialControllerSelection()),
  };
  for (const slot of [0, 1, 2, 3]) {
    for (const native of [false, true]) {
      const selection = { ...initialControllerSelection(), owner: { slot, id: native ? 'steam:' : '' } };
      players[controllerPlayerId(slot, native, false)] = controllerActionMap(selection);
      players[controllerPlayerId(slot, native, true)] = controllerOnlyActionMap(selection);
    }
  }
  return players;
};

/** Ownership is slot + observed ID, never model ID alone. Held inputs do not
 * count as new use; sticks must cross the action threshold or change direction. */
export const advanceControllerSelection = function (
  previous: Readonly<ControllerSelection>,
  gamepads: readonly GamepadState[],
): { selection: ControllerSelection; disconnected: boolean } {
  const previousPad = previous.owner ? gamepads[previous.owner.slot] : undefined;
  const disconnected = previous.owner !== null
    && (previousPad?.connected !== true || previousPad.id !== previous.owner.id);
  const retainedOwner = disconnected ? null : previous.owner;
  const activity = gamepads.map((pad, slot) => {
    const last = previous.activity[slot];
    return {
      id: pad.id,
      axes: STICK_AXES.map(axis => {
        if (!pad.connected) return 0;
        const value = pad.axis(axis);
        if (Math.abs(value) > 0.5) return Math.sign(value);
        // Hysteresis prevents threshold jitter from repeatedly taking control.
        return Math.abs(value) > 0.35 && last?.id === pad.id ? last.axes[axis] ?? 0 : 0;
      }),
    };
  });
  const used = gamepads.flatMap((pad, slot) => {
    if (!pad.connected) return [];
    const last = previous.activity[slot];
    const axes = activity[slot]?.axes ?? [];
    const moved = axes.some((direction, axis) => direction !== 0
      && (last?.id !== pad.id || direction !== last.axes[axis]));
    return STANDARD_CONTROLLER_BUTTONS.some(button => pad.justPressed(button)) || moved ? [slot] : [];
  });
  // There is no ordering within one poll. Keep the owner on ties, otherwise use
  // the lowest slot. A later poll from any other controller takes precedence.
  const slot = retainedOwner && used.includes(retainedOwner.slot) ? retainedOwner.slot : used[0];
  const claimant = slot !== undefined ? gamepads[slot] : undefined;
  const owner = slot !== undefined && claimant ? { slot, id: claimant.id } : retainedOwner;
  const ownerPad = owner ? gamepads[owner.slot] : undefined;
  const neutral = ownerPad !== undefined
    && !STANDARD_CONTROLLER_BUTTONS.some(button => ownerPad.isDown(button))
    && STICK_AXES.every(axis => Math.abs(ownerPad.axis(axis)) <= 0.35);
  // Only a disconnect requires release and deliberate continuation. Ordinary
  // controller switches keep the first action and never pause the game.
  const waitingForNeutral = (disconnected || previous.waitingForNeutral) && !neutral;
  return {
    selection: {
      owner, activity, waitingForNeutral, usedThisFrame: slot !== undefined,
      blockFrame: disconnected || waitingForNeutral || previous.waitingForNeutral,
    },
    disconnected,
  };
};

const selectedActions = function (
  input: InputState<GameAction>,
  selection: Readonly<ControllerSelection>,
  controllerOnly: boolean,
): ActionState<GameAction> {
  const owner = selection.owner;
  const id = owner && !selection.blockFrame
    ? controllerPlayerId(owner.slot, isSteamControllerId(owner.id), controllerOnly)
    : controllerOnly ? 'controller:none' : 'keyboard';
  const player = input.player(id);
  if (!player) throw new Error(`Input action map is missing: ${id}`);
  return player.actions;
};

export const gameActions = function (
  input: InputState<GameAction>,
  selection: Readonly<ControllerSelection>,
): ActionState<GameAction> {
  return selectedActions(input, selection, false);
};

export const uiActions = function (
  input: InputState<GameAction>,
  selection: Readonly<ControllerSelection>,
  editingText: boolean,
): ActionState<GameAction> {
  if (!editingText) return gameActions(input, selection);
  const controller = selectedActions(input, selection, true);
  const keyboard = input.player('keyboard');
  if (!keyboard) throw new Error('Keyboard input action map is missing');
  const keyboardBackAction = (action: GameAction): boolean => action === 'back' || action === 'pause';
  return {
    isActive: action => (!selection.blockFrame && controller.isActive(action))
      || (keyboardBackAction(action) && keyboard.actions.isActive(action)),
    justActivated: action => (!selection.blockFrame && controller.justActivated(action))
      || (keyboardBackAction(action) && keyboard.actions.justActivated(action)),
    justDeactivated: action => (!selection.blockFrame && controller.justDeactivated(action))
      || (keyboardBackAction(action) && keyboard.actions.justDeactivated(action)),
  };
};
