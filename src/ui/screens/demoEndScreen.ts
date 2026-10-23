import splashImage from '../../assets/marketing/math-marsh-splash.jpg';
import type { ScreenSpec } from '../screenTypes';
import { BTN_CHROME, OVERLAY_BASE, inputPromptsSlot, type ScreenSpecActions } from './shared';

export const createDemoEndScreenSpec = function(actions: ScreenSpecActions): ScreenSpec {
  return {
    id: 'demo-end-screen',
    className: `${OVERLAY_BASE} app-background`,
    html: `<div class="demo-end-layout"><section class="demo-end-panel" aria-labelledby="demo-end-title">
      <img class="demo-end-art" src="${splashImage}" alt="Math Marsh: a frog, lizard, spider, and fly on a sunny pond">
      <div class="demo-end-content">
        <p class="demo-end-eyebrow">Demo complete</p>
        <h1 id="demo-end-title">There’s more beyond this pond</h1>
        <p class="demo-end-lead">You’ve completed all five rounds of the Arcade demo.</p>
        <p>Keep hopping in the full version of Math Marsh.</p>
        <p class="demo-end-feature">Continue Arcade beyond round five</p>
        <div class="demo-end-actions">
          <button type="button" class="btn-success ${BTN_CHROME}" data-demo-store>View full game</button>
          <button type="button" class="btn-secondary ${BTN_CHROME}" data-demo-replay>Play again</button>
          <button type="button" class="btn-secondary ${BTN_CHROME}" data-demo-menu>Main menu</button>
        </div>
        <p>Replay the demo as often as you like.</p>
        <p data-demo-store-status role="status"></p>
      </div>
    </section>${inputPromptsSlot()}</div>`,
    prompts: [{ action: 'select', label: 'Select' }, { action: 'back', label: 'Main menu' }],
    promptPlacement: 'panel',
    initialFocusSelector: '[data-demo-store]',
    wire: function(root): void {
      root.querySelector('[data-demo-replay]')?.addEventListener('click', actions.replayGame);
      root.querySelector('[data-demo-menu]')?.addEventListener('click', actions.goToMenu);
      root.querySelector('[data-demo-store]')?.addEventListener('click', function(): void {
        const status = root.querySelector('[data-demo-store-status]');
        if (status) status.textContent = '';
        void actions.openFullGame().catch(function(): void {
          if (status) status.textContent = 'Could not open Steam. Find Math Marsh in the Steam store.';
        });
      });
    },
    onShow: function(root): void {
      const status = root.querySelector('[data-demo-store-status]');
      if (status) status.textContent = '';
    },
    onCancel: actions.goToMenu,
  };
};
