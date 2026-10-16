import { expect, test, type Page } from 'playwright/test';

const pressActionKey = async function(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key, { delay: 200 });
};

const setGamepadButton = async function(page: Page, button: number, pressed: boolean): Promise<void> {
  await page.evaluate(({ button, pressed }) => {
    window.postMessage({ type: 'math-marsh-focus-gamepad', button, pressed }, '*');
  }, { button, pressed });
  await page.waitForTimeout(200);
};

const setGamepadAxis = async function(page: Page, axis: number, value: number): Promise<void> {
  await page.evaluate(({ axis, value }) => {
    window.postMessage({ type: 'math-marsh-focus-gamepad', axis, value }, '*');
  }, { axis, value });
  await page.waitForTimeout(200);
};

type FocusStyle = Readonly<{
  focusVisible: boolean;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  boxShadow: string;
}>;

const focusStyle = async function(page: Page, selector: string): Promise<FocusStyle> {
  return page.locator(selector).evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Focused control is not an HTMLElement');
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });
};

test('mouse and touch opened Settings keep rendered focus visible during controller navigation', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const axes = [0, 0, 0, 0];
    const gamepad = {
      id: 'Math Marsh controller focus fixture',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes,
      buttons,
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [gamepad, null, null, null] });
    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data !== 'object' || data === null || !('type' in data) || data.type !== 'math-marsh-focus-gamepad') return;
      if ('button' in data && 'pressed' in data && typeof data.button === 'number'
        && Number.isInteger(data.button) && data.button >= 0 && data.button < buttons.length
        && typeof data.pressed === 'boolean') {
        const button = buttons[data.button];
        if (button) {
          button.pressed = data.pressed;
          button.value = data.pressed ? 1 : 0;
        }
      }
      if ('axis' in data && 'value' in data && typeof data.axis === 'number'
        && Number.isInteger(data.axis) && data.axis >= 0 && data.axis < axes.length
        && typeof data.value === 'number') {
        axes[data.axis] = data.value;
      }
    });
  });
  await page.addInitScript(() => {
    const track = { currentStep: 1, highestUnlockedStep: 1 };
    const profiles = [{ id: 'focus-player', name: 'Player', learnerData: {
      mathProgress: { add: track, subtract: track, multiply: track, divide: track },
      onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
      skitProgress: [],
    } }];
    localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles }));
    localStorage.setItem('math-marsh.active-player-profile', 'focus-player');
  });

  try {
    await page.goto('/');
    await page.getByText('A game by').waitFor();
    await pressActionKey(page, 'Space');
    await page.getByText('Built with').waitFor();
    await pressActionKey(page, 'Space');
    await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();

    // Opening Settings with the mouse leaves its programmatically focused checkbox
    // outside the browser's :focus-visible heuristic.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const soundEffects = page.locator('#sound-effects');
    const backgroundMusic = page.locator('#background-music');
    await expect(soundEffects).toBeFocused();
    expect(await focusStyle(page, '#sound-effects')).toMatchObject({
      focusVisible: false,
      outlineStyle: 'none',
    });

    // Claim the simulated controller, then navigate with the D-pad.
    await setGamepadButton(page, 0, true);
    await setGamepadButton(page, 0, false);
    await setGamepadButton(page, 13, true);
    await setGamepadButton(page, 13, false);
    await expect(backgroundMusic).toBeFocused();
    const controllerRing = await focusStyle(page, '#background-music');
    expect(controllerRing).toMatchObject({
      focusVisible: false,
      outlineStyle: 'solid',
      outlineWidth: '3px',
      outlineColor: 'rgb(244, 210, 122)',
    });
    expect(controllerRing.boxShadow).not.toBe('none');

    const layouts = [
      { name: 'tv-1280x720', width: 1280, height: 720 },
      { name: 'deck-1280x800', width: 1280, height: 800 },
      { name: 'mobile-390x844', width: 390, height: 844 },
    ] as const;
    await layouts.reduce(async (previous, layout) => {
      await previous;
      await page.setViewportSize({ width: layout.width, height: layout.height });
      await expect(backgroundMusic).toBeFocused();
      expect(await focusStyle(page, '#background-music')).toMatchObject({
        outlineStyle: 'solid',
        outlineWidth: '3px',
        outlineColor: 'rgb(244, 210, 122)',
      });
      const bounds = await backgroundMusic.boundingBox();
      if (!bounds) throw new Error('Background Music focus target is not visible');
      expect(bounds.x - 16).toBeGreaterThanOrEqual(0);
      expect(bounds.y - 16).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width + 16).toBeLessThanOrEqual(layout.width);
      expect(bounds.y + bounds.height + 16).toBeLessThanOrEqual(layout.height);
      await page.screenshot({ path: testInfo.outputPath(`settings-focus-${layout.name}.png`) });
    }, Promise.resolve());

    // Left-stick navigation uses the same visible focus path.
    await setGamepadAxis(page, 1, 1);
    await setGamepadAxis(page, 1, 0);
    const autoMode = page.locator('[data-touch-mode="auto"]');
    await expect(autoMode).toBeFocused();
    expect(await focusStyle(page, '[data-touch-mode="auto"]')).toMatchObject({
      focusVisible: false,
      outlineStyle: 'solid',
      outlineWidth: '3px',
    });

    // Controller cancel restores the menu focus with its indicator; keyboard
    // navigation keeps it visible as well.
    await setGamepadButton(page, 1, true);
    await setGamepadButton(page, 1, false);
    const startGame = page.getByRole('button', { name: 'Start Game', exact: true });
    await expect(startGame).toBeFocused();
    expect((await focusStyle(page, '.menu-primary-action')).outlineStyle).toBe('solid');
    await pressActionKey(page, 'ArrowDown');
    await expect(page.getByRole('button', { name: 'Scenes', exact: true })).toBeFocused();
    expect((await focusStyle(page, '#main-menu .menu-secondary-action:focus')).outlineStyle).toBe('solid');

    // A touch opens Settings after navigation and returns to pointer focus.
    await page.setViewportSize({ width: 390, height: 844 });
    const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
    const settingsBounds = await settingsButton.boundingBox();
    if (!settingsBounds) throw new Error('Settings button is not visible');
    await page.touchscreen.tap(settingsBounds.x + settingsBounds.width / 2, settingsBounds.y + settingsBounds.height / 2);
    await expect(soundEffects).toBeFocused();
    expect(await page.locator('html').getAttribute('data-focus-navigation')).toBeNull();
    expect(await focusStyle(page, '#sound-effects')).toMatchObject({
      focusVisible: false,
      outlineStyle: 'none',
    });
  } finally {
    await context.close();
  }
});
