import { expect, test } from 'playwright/test';
import type {} from './fixtures/demoArcade';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`demo Practice gates topics at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/demo-arcade');
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    for (const [operation, allowed, locked] of [
      ['add', 'add-make-10', 'add-make-11'],
      ['subtract', 'subtract-range-0-20', 'subtract-range-0-100'],
      ['multiply', 'multiply-table-6', 'multiply-table-7'],
      ['divide', 'divide-table-6', 'divide-table-7'],
    ]) {
      await page.locator(`[data-practice-operation="${operation}"]`).click();
      await expect(page.locator(`[data-practice-topic="${allowed}"]`)).not.toContainText('Full version');
      await expect(page.locator(`[data-practice-topic="${locked}"]`)).toContainText('Full version');
      await page.locator(`[data-practice-topic="${locked}"]`).click();
      await expect(page.locator('[data-practice-start]')).toHaveCount(0);
      await expect(page.locator('[data-practice-store]')).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`${operation}-locked.png`) });
      await page.locator('[data-practice-store]').click();
      await page.locator('[data-practice-back]').click();
      await page.locator(`[data-practice-topic="${allowed}"]`).click();
      await expect(page.locator('[data-practice-start]')).toBeVisible();
      await page.locator('[data-practice-back]').click();
      await page.locator('[data-practice-back]').click();
    }
    expect(await page.evaluate(() => window.demoArcadeFixture.state().storeOpens)).toBe(4);
    await page.goto('/demo-arcade?role=paid');
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    await page.locator('[data-practice-operation="multiply"]').click();
    await page.locator('[data-practice-topic="multiply-table-12"]').click();
    await page.locator('[data-practice-start]').click();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });
}
