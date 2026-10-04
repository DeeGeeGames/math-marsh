import type { ControllerSelection } from './controllerSelection';
import type { InputState, KeyCode } from 'ecspresso/plugins/input/input';

const LETTER_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'] as const;
const UPPERCASE_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;
const OTHER_KEYS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ' ', 'Enter', 'Escape', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
  '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '{', '}', '|', ':', '"', '<', '>', '?', '~',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
] as const satisfies readonly KeyCode[];

const SPLASH_KEYS = [...LETTER_KEYS, ...UPPERCASE_KEYS, ...OTHER_KEYS];
const STANDARD_GAMEPAD_BUTTONS = Array.from({ length: 17 }, (_, index) => index);

export function splashAdvancePressed(input: Pick<InputState, 'keyboard' | 'pointer' | 'gamepads'>, selection: Readonly<ControllerSelection>): boolean {
  const ownerSlot = selection.owner?.slot;
  return SPLASH_KEYS.some(key => input.keyboard.justPressed(key))
    || [0, 1, 2].some(button => input.pointer.justPressed(button))
    || (!selection.blockFrame && ownerSlot !== undefined
      && STANDARD_GAMEPAD_BUTTONS.some(button => input.gamepads[ownerSlot]?.justPressed(button)));
}
