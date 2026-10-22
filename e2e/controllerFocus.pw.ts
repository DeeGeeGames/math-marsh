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

const configureControllerPage = async function(page: Page): Promise<void> {
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
      if ('connected' in data && typeof data.connected === 'boolean') gamepad.connected = data.connected;
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
};

test('mouse and touch opened Settings keep rendered focus visible during controller navigation', async ({ browser }, testInfo) => {
  testInfo.setTimeout(60_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  const page = await context.newPage();
  await configureControllerPage(page);

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
    const startGame = page.getByRole('button', { name: 'Arcade', exact: true });
    await expect(startGame).toBeFocused();
    expect((await focusStyle(page, '.menu-primary-action.btn-success')).outlineStyle).toBe('solid');
    await pressActionKey(page, 'ArrowDown');
    await expect(page.getByRole('button', { name: 'Practice', exact: true })).toBeFocused();
    expect((await focusStyle(page, '#main-menu .menu-primary-action:focus')).outlineStyle).toBe('solid');

    // Continue through Practice using the same input-plugin controller fixture.
    await page.setViewportSize({ width: 1280, height: 720 });
    const controllerPress = async function(button: number): Promise<void> {
      await setGamepadButton(page, button, true);
      await setGamepadButton(page, button, false);
    };
    await controllerPress(0);
    await expect(page.locator('[data-practice-operation="add"]')).toBeFocused();
    await controllerPress(13);
    await expect(page.locator('[data-practice-operation="multiply"]')).toBeFocused();
    await controllerPress(0);
    await expect(page.locator('[data-practice-topic="multiply-table-1"]')).toBeFocused();
    await controllerPress(0);
    await expect(page.locator('[data-practice-start]')).toBeFocused();
    await controllerPress(12);
    await expect(page.locator('[data-practice-change-pond]')).toBeFocused();
    await controllerPress(0);
    await expect(page.locator('[data-practice-pond="easy"]')).toBeFocused();
    await controllerPress(15);
    await expect(page.locator('[data-practice-pond="medium"]')).toBeFocused();
    await controllerPress(0);
    await expect(page.locator('[data-practice-pond="medium"]')).toHaveAttribute('aria-pressed', 'true');
    await controllerPress(1);
    await expect(page.locator('[data-practice-change-pond]')).toBeFocused();
    await expect(page.locator('.practice-pond-summary')).toContainText('Medium');
    await controllerPress(13);
    await expect(page.locator('[data-practice-start]')).toBeFocused();
    await controllerPress(0);
    await expect(page.locator('#game-canvas')).toBeVisible();
    await controllerPress(9);
    await expect(page.locator('#resume-btn')).toBeFocused();
    await controllerPress(13);
    await controllerPress(13);
    await controllerPress(13);
    await expect(page.locator('#quit-to-menu-btn')).toBeFocused();
    await controllerPress(0);
    await expect(page.getByRole('heading', { name: 'Partial practice', exact: true })).toBeVisible();
    await expect(page.locator('[data-practice-again]')).toBeFocused();
    await controllerPress(1);
    await expect(startGame).toBeFocused();

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


test('tutorial controls support controller focus, later lessons, and keyboard navigation', async ({ page }, testInfo) => {
  await configureControllerPage(page);
  const pressButton = async function(button: number): Promise<void> {
    await setGamepadButton(page, button, true);
    await setGamepadButton(page, button, false);
  };
  await page.goto('/');
  await page.getByText('A game by').waitFor();
  await pressActionKey(page, 'Space');
  await page.getByText('Built with').waitFor();
  await pressActionKey(page, 'Space');
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await page.getByRole('button', { name: 'Play Tutorial', exact: true }).click();
  const next = page.locator('#tutorial-next-btn');
  const back = page.locator('#tutorial-back-btn');
  const skip = page.locator('#skip-tutorial-btn');
  const step = page.locator('#gameplay-onboarding-kicker');
  await expect(next).toBeFocused();
  await expect(back).toBeDisabled();
  // Claim is consumed until the controller is released.
  await pressButton(0);
  await expect(step).toHaveText('Step 1 of 5');
  await pressButton(0);
  await expect(step).toHaveText('Step 2 of 5');
  await pressButton(14);
  await expect(back).toBeFocused();
  expect(await focusStyle(page, '#tutorial-back-btn')).toMatchObject({ outlineStyle: 'solid', outlineWidth: '3px' });
  await pressButton(0);
  await expect(step).toHaveText('Step 1 of 5');
  await expect(next).toBeFocused();
  // Disabled Back must not capture focus. Stick navigation reaches Skip.
  await pressButton(14);
  await expect(next).toBeFocused();
  await setGamepadAxis(page, 1, 1);
  await setGamepadAxis(page, 1, 0);
  await expect(skip).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('tutorial-controller-focus.png') });
  await pressButton(0);
  await expect(page.getByRole('button', { name: 'Play Tutorial', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play Tutorial', exact: true }).click();
  // Complete basics to reach the later lessons, which have no enemy singleton.
  for (let index = 1; index <= 5; index++) {
    await expect(step).toHaveText(`Step ${index} of 5`);
    await pressButton(0);
  }
  await expect(page.locator('#gameplay-onboarding-title')).toHaveText('Find two numbers');
  await expect(step).toHaveText('Step 1 of 5');
  await expect(next).toBeFocused();
  await pressButton(0);
  await expect(step).toHaveText('Step 2 of 5');
  await pressButton(1);
  await expect(step).toHaveText('Step 1 of 5');
  // Disconnect recovery must return focus to Next without activating it.
  await page.evaluate(() => window.postMessage({ type: 'math-marsh-focus-gamepad', connected: false }, '*'));
  await expect(page.getByRole('heading', { name: 'CONTROLLER DISCONNECTED' })).toBeVisible();
  await page.evaluate(() => window.postMessage({ type: 'math-marsh-focus-gamepad', connected: true }, '*'));
  await pressButton(0);
  await pressButton(0);
  await expect(page.getByRole('heading', { name: 'CONTROLLER DISCONNECTED' })).toBeHidden();
  await expect(step).toHaveText('Step 1 of 5');
  await expect(next).toBeFocused();
  for (let index = 1; index <= 5; index++) {
    await expect(step).toHaveText(`Step ${index} of 5`);
    await pressButton(0);
  }
  await expect(page.locator('#gameplay-onboarding-title')).toHaveText('Choose a number and a result');
  await pressActionKey(page, 'Enter');
  await expect(step).toHaveText('Step 2 of 5');
  await pressActionKey(page, 'ArrowLeft');
  await expect(back).toBeFocused();
  await pressActionKey(page, 'Enter');
  await expect(step).toHaveText('Step 1 of 5');
  await pressButton(9);
  await expect(page.getByRole('button', { name: 'Play Tutorial', exact: true })).toBeVisible();
});
