import { expect, test, type Locator } from 'playwright/test';

const pressActionKey = async (
  page: import('playwright/test').Page,
  key: string,
): Promise<void> => {
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
};

const skipSplash = async (page: import('playwright/test').Page): Promise<void> => {
  await page.getByText('A game by').waitFor();
  await pressActionKey(page, 'Space');
  await page.getByText('Built with').waitFor();
  await pressActionKey(page, 'Space');
  await page.getByRole('heading', { name: 'Who’s playing?' }).waitFor();
};

const submitPlayerName = async (page: import('playwright/test').Page, name: string): Promise<void> => {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Player name').fill(name);
  await dialog.getByRole('button', { name: /Continue|Create player|Save name/ }).click();
};

const openRoster = async (page: import('playwright/test').Page): Promise<void> => {
  await page.locator('#player-profile-badge').click();
  await page.getByRole('dialog', { name: 'Player profiles' }).waitFor();
};

const tap = async (page: import('playwright/test').Page, target: Locator): Promise<void> => {
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error('Touch target is not visible');
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
};

const setGamepadButton = async (
  page: import('playwright/test').Page,
  button: number,
  pressed: boolean,
): Promise<void> => {
  await page.evaluate(state => window.postMessage({ type: 'math-marsh-test-gamepad', ...state }, '*'), {
    button,
    pressed,
  });
};

test('first-use naming and roster return keep controller-friendly focus', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);

  const nameInput = page.getByRole('dialog', { name: 'Who’s playing?' }).getByLabel('Player name');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(nameInput).toHaveValue('Player');
  await expect(continueButton).toBeFocused();
  await pressActionKey(page, 'Enter');

  const startGame = page.getByRole('button', { name: 'Start Game' });
  const badge = page.locator('#player-profile-badge');
  await expect(startGame).toBeFocused();
  await expect(badge).toHaveAttribute('aria-label', 'Active player Player. Open player roster');

  await badge.focus();
  await pressActionKey(page, 'Enter');
  const drawer = page.getByRole('dialog', { name: 'Player profiles' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Choose player')).toBeVisible();
  await expect(drawer.getByText('Close')).toBeVisible();
  await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#main-menu')).toHaveJSProperty('inert', true);
  await expect(page.locator('[data-active-player-row]')).toBeFocused();
  await pressActionKey(page, 'Escape');
  await expect(badge).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await badge.click();
  const drawerBox = await page.locator('#player-roster-screen .player-roster-drawer').boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(drawerBox?.x).toBe(0);
  expect(drawerBox?.width).toBe(390);
  expect(drawerBox?.height).toBe(844);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  await pressActionKey(page, 'Escape');
  await expect(badge).toBeFocused();
});

test('player name fields retain ordinary keyboard text editing', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);

  const nameInput = page.getByRole('dialog', { name: 'Who’s playing?' }).getByLabel('Player name');
  await nameInput.fill('');
  await nameInput.pressSequentially('sam d');
  await expect(nameInput).toHaveValue('sam d');
  await expect(nameInput).toBeFocused();
  await nameInput.press('ArrowLeft');
  await nameInput.press('x');
  await expect(nameInput).toHaveValue('sam xd');
});

test('Enter submits first-use naming without activating the next screen', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);

  const nameInput = page.getByRole('dialog', { name: 'Who’s playing?' }).getByLabel('Player name');
  await nameInput.fill('Sam D');
  await nameInput.press('Enter');

  const startGame = page.getByRole('button', { name: 'Start Game' });
  await expect(startGame).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Pick your math' })).toHaveCount(0);
});

test('profiles enforce capacity and keep management actions attached to stable players', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);
  await submitPlayerName(page, 'Mira');

  await openRoster(page);
  await page.getByRole('button', { name: /Add player/ }).click();
  await submitPlayerName(page, 'mira');
  await expect(page.locator('#player-add-screen [data-profile-name-error]')).toContainText('already in use');
  await submitPlayerName(page, 'Player 2');

  await Array.from({ length: 8 }, (_, index) => `Player ${index + 3}`)
    .reduce(async (previous, name) => {
      await previous;
      await openRoster(page);
      await page.getByRole('button', { name: /Add player/ }).click();
      await submitPlayerName(page, name);
    }, Promise.resolve());

  await openRoster(page);
  await expect(page.locator('[data-player-row]')).toHaveCount(10);
  await expect(page.getByRole('progressbar')).toHaveCount(40);
  await expect(page.getByRole('button', { name: /Add player/ })).toBeDisabled();
  await expect(page.getByText('10-player limit')).toBeVisible();
  await page.getByRole('button', { name: 'Manage players' }).click();

  const secondPlayer = page.locator('.player-management-row[data-player-index="1"]');
  await secondPlayer.getByRole('button', { name: 'Rename' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename player' });
  await renameDialog.getByLabel('Player name').fill('Player Two');
  await renameDialog.getByRole('button', { name: 'Save name' }).click();
  await expect(secondPlayer).toContainText('Player Two');
  await expect(secondPlayer.getByRole('button', { name: 'Rename' })).toBeFocused();

  const thirdPlayer = page.locator('.player-management-row[data-player-index="2"]');
  await thirdPlayer.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete Player 3?' })).toBeVisible();
  await expect(page.getByText('Their profile and learner progress will be removed from this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep player' }).click();
  await expect(thirdPlayer.getByRole('button', { name: 'Delete' })).toBeFocused();
  await thirdPlayer.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete player' }).click();
  await expect(page.locator('#player-profile-badge')).toContainText('Player 10');

  await openRoster(page);
  await page.getByRole('button', { name: 'Manage players' }).click();
  const activePlayer = page.locator('.player-management-row').filter({ hasText: 'Player 10' });
  await activePlayer.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete player' }).click();
  await expect(page.locator('#player-profile-badge')).toContainText('Mira');
  await openRoster(page);
  await expect(page.locator('[data-player-row]')).toHaveCount(8);
  await expect(page.locator('[data-active-player-row]')).toContainText('Mira');
});

test('touch controls fit a small portrait screen and switch the active player', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);
  await page.getByRole('dialog', { name: 'Who’s playing?' }).getByLabel('Player name').fill('Mira');
  await tap(page, page.getByRole('button', { name: 'Continue' }));

  const badge = page.locator('#player-profile-badge');
  await tap(page, badge);
  await tap(page, page.getByRole('button', { name: /Add player/ }));
  await tap(page, page.getByRole('button', { name: 'Create player' }));
  await expect(badge).toHaveAttribute('aria-label', 'Active player Player. Open player roster');

  await tap(page, badge);
  await tap(page, page.locator('#player-roster-screen [data-player-row]').first());
  await expect(badge).toContainText('Mira');

  await tap(page, badge);
  const drawer = page.locator('#player-roster-screen .player-roster-drawer');
  const bounds = await drawer.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.width).toBe(320);
  expect(bounds?.height).toBe(568);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await context.close();
});

test('gamepad select and back use the active profile screens and restore focus', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const gamepad = {
      id: 'Math Marsh test controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons,
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [gamepad, null, null, null] });
    window.addEventListener('message', event => {
      if (typeof event.data !== 'object' || event.data === null || event.data.type !== 'math-marsh-test-gamepad') return;
      const button = buttons[event.data.button];
      if (!button) return;
      button.pressed = Boolean(event.data.pressed);
      button.value = button.pressed ? 1 : 0;
    });
  });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await skipSplash(page);
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await expect(continueButton).toBeFocused();

  await setGamepadButton(page, 0, true);
  await page.waitForTimeout(200);
  await setGamepadButton(page, 0, false);
  await page.waitForTimeout(200);

  const nameInput = page.getByRole('dialog', { name: 'Who’s playing?' }).getByLabel('Player name');
  await nameInput.focus();
  await setGamepadButton(page, 13, true);
  await page.waitForTimeout(200);
  await setGamepadButton(page, 13, false);
  await expect(continueButton).toBeFocused();

  await setGamepadButton(page, 0, true);
  await page.getByRole('button', { name: 'Start Game' }).waitFor();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeFocused();
  await setGamepadButton(page, 0, false);
  await page.waitForTimeout(150);

  const badge = page.locator('#player-profile-badge');
  await badge.focus();
  await setGamepadButton(page, 0, true);
  await page.getByRole('dialog', { name: 'Player profiles' }).waitFor();
  await expect(page.locator('[data-active-player-row]')).toBeFocused();
  await setGamepadButton(page, 0, false);
  await page.waitForTimeout(150);
  await setGamepadButton(page, 1, true);
  await expect(page.locator('#player-profile-badge')).toBeFocused();
  await setGamepadButton(page, 1, false);
  await context.close();
});

test('the full roster keeps its active row usable at TV, portrait, and short-landscape sizes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const track = { currentStep: 1, highestUnlockedStep: 1 };
    const profiles = Array.from({ length: 10 }, (_, index) => ({
      id: `profile-${index + 1}`,
      name: `Player ${index + 1}`,
      learnerData: {
        mathProgress: { add: track, subtract: track, multiply: track, divide: track },
        onboarding: { basics: 'pending', operands: 'pending', operandAndResult: 'pending' },
        skitProgress: [],
      },
    }));
    window.localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles }));
    window.localStorage.setItem('math-marsh.active-player-profile', 'profile-10');
  });
  await page.goto('/');
  await page.getByText('A game by').waitFor();
  await pressActionKey(page, 'Space');
  await page.getByText('Built with').waitFor();
  await pressActionKey(page, 'Space');
  const badge = page.locator('#player-profile-badge');
  await badge.waitFor();

  const viewports = [
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ] as const;

  await viewports.reduce(async (previous, viewport) => {
    await previous;
    await page.setViewportSize(viewport);
    await badge.click();
    await page.getByRole('dialog', { name: 'Player profiles' }).waitFor();
    const bounds = await page.evaluate(() => {
      const list = document.querySelector('.player-roster-list');
      const active = document.querySelector('[data-active-player-row]');
      if (!(list instanceof HTMLElement) || !(active instanceof HTMLElement)) {
        throw new Error('Active profile row or roster list is missing');
      }
      const listRect = list.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        list: { top: listRect.top, bottom: listRect.bottom },
        active: { top: activeRect.top, bottom: activeRect.bottom },
      };
    });
    expect(bounds.documentWidth).toBe(viewport.width);
    expect(bounds.active.top).toBeGreaterThanOrEqual(bounds.list.top - 1);
    expect(bounds.active.bottom).toBeLessThanOrEqual(bounds.list.bottom + 1);
    await page.getByRole('button', { name: 'Close player profiles' }).click();
    await page.getByRole('dialog', { name: 'Player profiles' }).waitFor({ state: 'hidden' });
  }, Promise.resolve());
  await context.close();
});
