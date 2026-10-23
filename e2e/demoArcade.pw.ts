import { expect, test, type Page } from 'playwright/test';
import type {} from './fixtures/demoArcade';

const startArcade = async function(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Arcade', exact: true }).click();
  await page.locator('[data-operation="add"]').click();
  await page.locator('[data-next-to-pond]').click();
  await page.locator('.pond-choice.easy').click();
  await page.locator('[data-play-selected]').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
};

for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`five-round ending, store action, and repeat play at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/demo-arcade');
    await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeVisible();
    await startArcade(page);
    for (let round = 0; round < 5; round++) {
      await page.evaluate(() => window.demoArcadeFixture.completePond());
      const state = await page.evaluate(() => window.demoArcadeFixture.state());
      expect(state.run?.completedLevels).toHaveLength(round + 1);
      expect(state.screen).toBe(round === 4 ? 'gameOver' : 'playing');
    }
    await expect(page.locator('#run-result')).toContainText('5 rounds cleared');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('#demo-end-screen')).toBeVisible();
    await expect(page.locator('[data-demo-store]')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-demo-store]')).toBeFocused();
    await expect(page.locator('[data-demo-store]')).toHaveCSS('outline-style', 'solid');
    expect(await page.locator('.demo-end-art').evaluate(image => image instanceof HTMLImageElement && image.naturalWidth > 0))
      .toBe(true);
    expect(await page.locator('#demo-end-screen').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`demo-end-${viewport.width}.png`), fullPage: true });
    await page.locator('[data-demo-store]').click();
    expect(await page.evaluate(() => window.demoArcadeFixture.state().storeOpens)).toBe(1);
    // Six replays in the same launch, each with a fresh pond budget.
    for (let replay = 0; replay < 6; replay++) {
      await page.locator('[data-demo-replay]').click();
      await expect(page.locator('#game-canvas')).toBeVisible();
      expect(await page.evaluate(() => window.demoArcadeFixture.state().run?.completedLevels)).toEqual([]);
      for (let round = 0; round < 5; round++) await page.evaluate(() => window.demoArcadeFixture.completePond());
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.locator('#demo-end-screen')).toBeVisible();
    }
    await page.keyboard.press('Escape', { delay: 150 });
    await expect(page.getByRole('button', { name: 'Practice', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    await page.locator('[data-practice-operation="multiply"]').click();
    await page.locator('[data-practice-topic="multiply-table-12"]').click();
    await page.locator('[data-practice-start]').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    expect(await page.evaluate(() => window.demoArcadeFixture.state().run)).toBeNull();
  });
}

for (const role of ['paid', 'standalone']) {
  test(`${role} Arcade continues after five ponds`, async ({ page }) => {
    await page.goto(`/demo-arcade?role=${role}`);
    await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeVisible();
    await startArcade(page);
    for (let round = 0; round < 6; round++) await page.evaluate(() => window.demoArcadeFixture.completePond());
    const state = await page.evaluate(() => window.demoArcadeFixture.state());
    expect(state.screen).toBe('playing');
    expect(state.level).toBe(7);
    expect(state.run).toBeNull();
  });
}
