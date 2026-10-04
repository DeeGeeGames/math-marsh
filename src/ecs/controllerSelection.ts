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
}

export const initialControllerSelection = function (): ControllerSelection {
  return { owner: null, waitingForNeutral: false, blockFrame: false };
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
    skip: { ...map.skip, gamepadButtons: gamepadButtonsOn(slot, 9) },
    pause: { ...map.pause, gamepadButtons: gamepadButtonsOn(slot, 9) },
  };
};

const STANDARD_BUTTONS = Array.from({ length: 17 }, (_, index) => index);

/** Ownership is slot + observed ID, never ID alone. Unobservable replacements
 * in the same slot with the same ID cannot be detected by ECSpresso 0.22. */
export const advanceControllerSelection = function (
  previous: Readonly<ControllerSelection>,
  gamepads: readonly GamepadState[],
): { selection: ControllerSelection; disconnected: boolean; rebind: boolean } {
  const previousPad = previous.owner ? gamepads[previous.owner.slot] : undefined;
  const disconnected = previous.owner !== null
    && (previousPad?.connected !== true || previousPad.id !== previous.owner.id);
  const retainedOwner = disconnected ? null : previous.owner;
  const claimSlot = retainedOwner === null
    ? gamepads.findIndex(pad => pad.connected && (pad.justPressed(0) || pad.justPressed(9)))
    : -1;
  const claimant = gamepads[claimSlot];
  const owner = claimSlot >= 0 && claimant
    ? { slot: claimSlot, id: claimant.id }
    : retainedOwner;
  const acquired = claimSlot >= 0;
  const ownerPad = owner ? gamepads[owner.slot] : undefined;
  const neutral = ownerPad !== undefined
    && !STANDARD_BUTTONS.some(button => ownerPad.isDown(button))
    && [0, 1].every(axis => Math.abs(ownerPad.axis(axis)) <= 0.5);
  const waitingForNeutral = owner !== null
    && (acquired || (previous.waitingForNeutral && !neutral));
  const selection = {
    owner,
    waitingForNeutral,
    blockFrame: disconnected || acquired || previous.waitingForNeutral,
  };
  return {
    selection,
    disconnected,
    rebind: disconnected || acquired || waitingForNeutral !== previous.waitingForNeutral,
  };
};

/** The action map changes on the next poll. Use ECSpresso's isolated keyboard
 * action state during handoff so stale pad edges cannot reach consumers. */
export const gameActions = function (
  input: InputState<GameAction>,
  selection: Readonly<ControllerSelection>,
): ActionState<GameAction> {
  if (!selection.blockFrame) return input.actions;
  const keyboard = input.player('keyboard');
  if (!keyboard) throw new Error('Keyboard input action map is missing');
  return keyboard.actions;
};
