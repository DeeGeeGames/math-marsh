import { $ } from '../dom';
import type { ScreenSpec } from '../screenTypes';
import {
  BTN_CHROME,
  BTN_SIZE,
  inputPromptsSlot,
  OVERLAY_BASE,
  type ScreenSpecActions,
} from './shared';

export function createSettingsScreenSpec(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'settings-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `
      <div class="text-center max-w-sm md:max-w-lg landscape:max-w-4xl w-full px-4 md:px-8 py-4 sm:py-6 md:py-8 landscape:py-3">
        <h2 class="pond-title text-2xl sm:text-3xl md:text-4xl landscape:text-xl landscape:md:text-2xl font-bold mb-4 sm:mb-6 md:mb-8 landscape:mb-3 text-gold drop-shadow-lg">⚙️ Settings</h2>

        <div class="grid grid-cols-1 landscape:grid-cols-2 gap-3 md:gap-6 landscape:gap-3 text-left items-stretch">
          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">🔊 Audio</h3>
            <div class="space-y-2 md:space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="sound-effects" checked class="theme-checkbox w-5 h-5 rounded">
                <span class="text-sm md:text-base">Sound Effects</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="background-music" checked class="theme-checkbox w-5 h-5 rounded">
                <span class="text-sm md:text-base">Background Music</span>
              </label>
            </div>
          </div>

          <div class="settings-panel p-3 md:p-6 landscape:p-3 rounded-xl">
            <h3 class="text-base md:text-xl landscape:text-base font-semibold mb-2 md:mb-4 landscape:mb-2">📱 Touch Controls</h3>
            <p class="text-xs md:text-sm opacity-80 mb-2 landscape:hidden">Show on-screen D-pad and Eat button.</p>
            <div class="flex flex-col md:flex-row gap-2 md:gap-3">
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="auto">Auto</button>
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="on">Always On</button>
              <button class="touch-mode-btn flex-1 text-white border-none px-3 py-2 landscape:py-2 md:py-3 rounded-lg cursor-pointer transition-colors duration-200 btn-mobile" data-touch-mode="off">Always Off</button>
            </div>
          </div>
        </div>

        <button id="back-to-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg} mt-4 md:mt-8 landscape:mt-3 w-full md:w-auto">
          ← Back to Menu
        </button>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    promptPlacement: 'viewport',
    wire: (root): void => {
      $(root, '#back-to-menu-btn').addEventListener('click', actions.returnToPreviousScreen);
      actions.wireAudioSettings(root);
      actions.wireTouchControlsSetting(root);
    },
    onCancel: actions.returnToPreviousScreen,
  };
}
