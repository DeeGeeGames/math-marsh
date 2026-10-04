import type { GameSystemRegistrar } from '../Engine';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { InputPromptPlatform } from '../../ui/inputPrompts';
import { detectInputPromptPlatform } from '../../ui/inputPrompts';
import { updateInputPromptPlatform } from '../../ui/UIManager';

const KEYBOARD_ACTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' ', 'Enter', 'Escape', 'Tab'] as const;
const GAMEPAD_BUTTONS = [0, 1, 9, 12, 13, 14, 15] as const;
const GAMEPAD_AXES = [0, 1] as const;
const ACTIVE_AXIS_THRESHOLD = 0.5;

type InputPromptResource = {
  platform: InputPromptPlatform;
  gamepadAxesActive: boolean[];
};

const hasKeyboardActivity = (keyboard: {
  justPressed(key: string): boolean;
}): boolean =>
  KEYBOARD_ACTION_KEYS.some(key => keyboard.justPressed(key));

const gamepadAxisIndex = (gamepadIndex: number, axisIndex: number): number =>
  gamepadIndex * GAMEPAD_AXES.length + axisIndex;

const isGamepadAxisActive = (gamepad: {
  axis(index: number): number;
}, axisIndex: number): boolean =>
  Math.abs(gamepad.axis(axisIndex)) > ACTIVE_AXIS_THRESHOLD;

const hasGamepadActivity = (gamepadIndex: number, gamepad: {
  justPressed(button: number): boolean;
  axis(index: number): number;
}, inputPrompt: InputPromptResource): boolean =>
  GAMEPAD_BUTTONS.some(button => gamepad.justPressed(button))
  || GAMEPAD_AXES.some(axis => {
    const promptAxisIndex = gamepadAxisIndex(gamepadIndex, axis);
    const isActive = isGamepadAxisActive(gamepad, axis);
    return isActive && inputPrompt.gamepadAxesActive[promptAxisIndex] !== true;
  });

const rememberGamepadAxes = (
  gamepads: ReadonlyArray<{
    axis(index: number): number;
  }>,
  inputPrompt: InputPromptResource,
): void => {
  inputPrompt.gamepadAxesActive = gamepads.flatMap((gamepad) =>
    GAMEPAD_AXES.map(axis => isGamepadAxisActive(gamepad, axis)));
};

const updatePlatform = (
  inputPrompt: InputPromptResource,
  platform: InputPromptPlatform,
): void => {
  if (inputPrompt.platform === platform) return;
  inputPrompt.platform = platform;
  updateInputPromptPlatform(platform);
};

export function addInputPromptSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('inputPromptSystem')
    .setPriority(SYSTEM_PRIORITIES.INPUT_PROMPTS)
    .withResources(['inputState', 'inputPrompt', 'controllerSelection'])
    .setProcess(({ resources: { inputState, inputPrompt, controllerSelection } }) => {
      const keyboardActivity = hasKeyboardActivity(inputState.keyboard);
      const owner = controllerSelection.owner;
      const ownerPad = owner ? inputState.gamepads[owner.slot] : undefined;
      const gamepadPlatform = owner && ownerPad?.connected
        && hasGamepadActivity(owner.slot, ownerPad, inputPrompt)
        ? detectInputPromptPlatform(ownerPad.id ?? '')
        : undefined;
      rememberGamepadAxes(inputState.gamepads, inputPrompt);

      if (keyboardActivity || inputState.pointer.justPressed(0)) {
        return updatePlatform(inputPrompt, 'keyboard');
      }
      if (gamepadPlatform) updatePlatform(inputPrompt, gamepadPlatform);
    });
}
