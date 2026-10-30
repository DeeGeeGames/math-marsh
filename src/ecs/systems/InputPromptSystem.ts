import type { GameSystemRegistrar } from '../Engine';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { InputPromptState } from '../../ui/inputPrompts';
import { advanceInputPromptPresentation, detectInputPromptPlatform } from '../../ui/inputPrompts';
import { desktopInputProvider } from '../../platform/steamInput';
import { showNavigationFocus, updateInputPromptPlatform } from '../../ui/UIManager';

const KEYBOARD_ACTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' ', 'Enter', 'Escape', 'Tab'] as const;
const GAMEPAD_BUTTONS = [0, 1, 9, 12, 13, 14, 15] as const;
const GAMEPAD_AXES = [0, 1] as const;
const ACTIVE_AXIS_THRESHOLD = 0.5;

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
  id: string | null;
  justPressed(button: number): boolean;
  axis(index: number): number;
}, inputPrompt: InputPromptState): boolean =>
  (gamepad.id?.startsWith('steam:') && gamepad.justPressed(8))
  || GAMEPAD_BUTTONS.some(button => gamepad.justPressed(button))
  || GAMEPAD_AXES.some(axis => {
    const promptAxisIndex = gamepadAxisIndex(gamepadIndex, axis);
    const isActive = isGamepadAxisActive(gamepad, axis);
    return isActive && inputPrompt.gamepadAxesActive[promptAxisIndex] !== true;
  });

const rememberGamepadAxes = (
  gamepads: ReadonlyArray<{
    axis(index: number): number;
  }>,
  inputPrompt: InputPromptState,
): void => {
  inputPrompt.gamepadAxesActive = gamepads.flatMap((gamepad) =>
    GAMEPAD_AXES.map(axis => isGamepadAxisActive(gamepad, axis)));
};

export function addInputPromptSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('inputPromptSystem')
    .setPriority(SYSTEM_PRIORITIES.INPUT_PROMPTS)
    .withResources(['inputState', 'inputPrompt', 'controllerSelection'])
    .setProcess(({ resources: { inputState, inputPrompt, controllerSelection } }) => {
      const keyboardActivity = hasKeyboardActivity(inputState.keyboard);
      if (keyboardActivity) showNavigationFocus();
      const owner = controllerSelection.owner;
      const ownerPad = owner ? inputState.gamepads[owner.slot] : undefined;
      const nativeController = owner ? desktopInputProvider.getController(owner.id) : undefined;
      const nativeBindings = nativeController?.kind === 'steam' ? nativeController.prompts : undefined;
      const controllerActivity = Boolean(owner && ownerPad?.connected
        && hasGamepadActivity(owner.slot, ownerPad, inputPrompt));
      rememberGamepadAxes(inputState.gamepads, inputPrompt);
      const presentation = advanceInputPromptPresentation(inputPrompt, {
        keyboard: keyboardActivity || inputState.pointer.justPressed(0),
        controller: controllerActivity,
        ownerId: owner?.id ?? null,
        platform: nativeBindings ? 'generic' : detectInputPromptPlatform(ownerPad?.id ?? ''),
        ...(nativeBindings ? { nativeBindings } : {}),
      });
      if (presentation) updateInputPromptPlatform(presentation.platform, presentation.nativeBindings);
    });
}
