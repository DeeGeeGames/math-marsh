import type { GameSystemRegistrar } from '../Engine';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { advanceInputPromptPresentation, detectInputPromptPlatform } from '../../ui/inputPrompts';
import { loadControllerPromptPreference } from '../../ui/controllerPromptPreference';
import { desktopInputProvider } from '../../platform/steamInput';
import { updateInputPromptPlatform } from '../../ui/UIManager';
import { unlockAudio } from '../../audio/audio';

const KEYBOARD_ACTION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' ', 'Enter', 'Escape', 'Tab'] as const;
const hasKeyboardActivity = (keyboard: {
  justPressed(key: string): boolean;
}): boolean =>
  KEYBOARD_ACTION_KEYS.some(key => keyboard.justPressed(key));

export function addInputPromptSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('inputPromptSystem')
    .setPriority(SYSTEM_PRIORITIES.INPUT_PROMPTS)
    .withResources(['inputState', 'inputPrompt', 'controllerSelection'])
    .setProcess(({ resources: { inputState, inputPrompt, controllerSelection } }) => {
      const keyboardActivity = hasKeyboardActivity(inputState.keyboard);
      const owner = controllerSelection.owner;
      const ownerPad = owner ? inputState.gamepads[owner.slot] : undefined;
      const nativeController = owner ? desktopInputProvider.getController(owner.id) : undefined;
      const nativeBindings = nativeController?.kind === 'steam' ? nativeController.prompts : undefined;
      const controllerActivity = Boolean(owner && ownerPad?.connected
        && controllerSelection.usedThisFrame);
      if (controllerActivity) unlockAudio();
      const presentation = advanceInputPromptPresentation(inputPrompt, {
        keyboard: keyboardActivity || inputState.pointer.justPressed(0),
        controller: controllerActivity,
        preference: loadControllerPromptPreference(),
        ownerId: owner?.id ?? null,
        platform: nativeBindings ? 'generic' : detectInputPromptPlatform(ownerPad?.id ?? ''),
        ...(nativeBindings ? { nativeBindings } : {}),
      });
      if (presentation) updateInputPromptPlatform(presentation.platform, presentation.nativeBindings);
    });
}
