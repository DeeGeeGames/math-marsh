import { wireControllerPromptPreference } from '../controllerPromptPreference';
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
      <div class="settings-shell">
        <h2 class="pond-title text-gold">Settings</h2>

        <div class="settings-grid">
          <section class="settings-section" aria-labelledby="audio-settings-heading">
            <h3 id="audio-settings-heading">Audio</h3>
            <label class="settings-panel settings-toggle">
              <input type="checkbox" id="sound-effects" checked class="theme-checkbox">
              <span>Sound Effects</span>
              <span class="settings-toggle-value" aria-hidden="true"></span>
            </label>
            <label class="settings-panel settings-toggle">
              <input type="checkbox" id="background-music" checked class="theme-checkbox">
              <span>Background Music</span>
              <span class="settings-toggle-value" aria-hidden="true"></span>
            </label>
          </section>

          <section class="settings-panel settings-touch" aria-labelledby="touch-settings-heading">
            <h3 id="touch-settings-heading">Touch Controls</h3>
            <p>Use the on-screen gamepad, or tap lily pads to move and tap the fly to eat.</p>
            <p>Auto hides the gamepad when you tap a lily pad. Use the gamepad button at the top to turn it back on.</p>
            <div class="settings-touch-options" role="group" aria-label="Touch controls mode">
              <button type="button" class="touch-mode-btn" data-touch-mode="auto">Auto</button>
              <button type="button" class="touch-mode-btn" data-touch-mode="on">Always On</button>
              <button type="button" class="touch-mode-btn" data-touch-mode="off">Tap lily pads</button>
            </div>
          </section>
        </div>

        <div class="settings-panel controller-prompt-setting">
          <button type="button" data-controller-prompts aria-describedby="controller-prompts-help" class="utility-btn">Button prompts: Auto</button>
          <p id="controller-prompts-help">Press to change artwork. Auto uses device detection. Steam action labels take priority. Bottom button selects; right button goes back. Custom layouts may differ.</p>
        </div>
        <button id="back-to-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg}">
          ← Back to Menu
        </button>
        ${inputPromptsSlot()}
      </div>
    `,
    prompts: [
      { action: 'select', label: 'Select' },
      { action: 'back', label: 'Back' },
    ],
    promptPlacement: 'panel',
    wire: (root): void => {
      $(root, '#back-to-menu-btn').addEventListener('click', actions.returnToPreviousScreen);
      wireControllerPromptPreference(root);
      actions.wireAudioSettings(root);
      actions.wireTouchControlsSetting(root);
    },
    onCancel: actions.returnToPreviousScreen,
  };
}
