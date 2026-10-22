import { expect, test } from 'playwright/test';
import type {} from './fixtures/uiLifecycle';
import type {} from './fixtures/gameplayToasts';

declare global {
  interface Window {
    externalListenerCount: () => number;
    touchCounts: () => { downs: number; ups: number };
  }
}

test('UI owns import, repeated initialization, overlays, fullscreen subscriptions, and held touch cleanup', async ({ page }) => {
  await page.addInitScript(function() {
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const tracked = new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
    const external = function(target: EventTarget): boolean {
      return target === window || target === document || target instanceof MediaQueryList;
    };
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (!listener) return;
      if (external(this) && listener) {
        const events = tracked.get(this) ?? new Map<string, Set<EventListenerOrEventListenerObject>>();
        const listeners = events.get(type) ?? new Set<EventListenerOrEventListenerObject>();
        listeners.add(listener); events.set(type, listeners); tracked.set(this, events);
      }
      add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      if (!listener) return;
      if (listener) tracked.get(this)?.get(type)?.delete(listener);
      remove.call(this, type, listener, options);
    };
    Object.assign(window, { externalListenerCount: function() {
      return [...tracked.values()].reduce((sum, events) => sum + [...events.values()].reduce((count, listeners) => count + listeners.size, 0), 0);
    } });
  });
  await page.goto('/ui-lifecycle');
  await page.waitForFunction(() => 'uiLifecycleFixture' in window);
  const state = async function() {
    return page.evaluate(() => {
      const fixture = window.uiLifecycleFixture;
      return { imports: fixture.importedContainerCount, listeners: window.externalListenerCount(), fullscreen: fixture.fullscreenSubscriptions(), containers: document.querySelectorAll('#game-container').length };
    });
  };
  const initial = await state();
  expect(initial.imports).toBe(0);
  expect(initial.containers).toBe(0);
  await page.evaluate(() => { const f = window.uiLifecycleFixture; f.initialize(); f.showMenu(); f.showGameplay(); f.showPause(); f.showSettings(); });
  expect((await state()).containers).toBe(1);
  expect((await state()).fullscreen).toBe(3);
  await expect(page.locator('#gameplay-ui')).toHaveAttribute('inert', '');
  await expect(page.locator('#settings-screen')).toBeVisible();
  await page.evaluate(() => window.uiLifecycleFixture.cancelAndReplace());
  await expect(page.getByRole('button', { name: 'Scenes', exact: true })).toBeFocused();
  await page.evaluate(() => window.uiLifecycleFixture.dispose());
  expect(await state()).toEqual(initial);
  await page.evaluate(() => { const f = window.uiLifecycleFixture; f.initialize(); f.showMenu(); f.initialize(); f.staleDispose(); f.showGameplay(); });
  expect((await state()).containers).toBe(1);
  expect((await state()).fullscreen).toBe(1);
  await page.evaluate(() => {
    let downs = 0;
    let ups = 0;
    window.addEventListener('keydown', event => { if (event.key === 'ArrowUp') downs++; });
    window.addEventListener('keyup', event => { if (event.key === 'ArrowUp') ups++; });
    Object.assign(window, { touchCounts: () => ({ downs, ups }) });
    const button = document.getElementById('touch-up');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing touch button');
    button.setPointerCapture = () => {};
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, bubbles: true }));
  });
  await page.evaluate(() => window.uiLifecycleFixture.dispose());
  const released = await page.evaluate(() => window.touchCounts());
  expect(released).toEqual({ downs: 1, ups: 1 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.touchCounts())).toEqual(released);
  expect((await state()).fullscreen).toBe(0);
  expect((await state()).containers).toBe(0);
});

test('normal gameplay renderer rebinds the replacement canvas when resuming a paused run', async ({ page }) => {
  await page.goto('/gameplay-toasts');
  await page.getByText('A game by').waitFor();
  await page.keyboard.press('Space');
  await page.getByText('Built with').waitFor();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.toastTestEngine.getCurrentScreen() !== 'engineSplash');
  await page.evaluate(async () => { await window.toastTestEngine.setScreen('playing', { level: 1, isFreshGame: true }); });
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.locator('#pause-btn').click();
  await expect(page.locator('#pause-screen')).toBeVisible();
  await page.evaluate(() => window.replacePausedTestUI());
  await page.locator('#resume-btn').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.rendererTargetsTestCanvas())).toBe(true);
  await expect.poll(() => page.locator('#game-canvas').evaluate(function(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing context');
    return context.getImageData(0, 0, canvas.width, canvas.height).data.some(function(value, index) { return index % 4 === 3 && value > 0; });
  })).toBe(true);
});
