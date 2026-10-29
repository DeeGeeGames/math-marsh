import { expect, test, type Page } from 'playwright/test';

const openTitle = async function(page: Page, desktop = false): Promise<void> {
	await page.addInitScript(function(desktop) {
		const track = { currentStep: 1, highestUnlockedStep: 1 };
		localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [
			{ id: 'title-player', name: 'Player', learnerData: {
				mathProgress: { add: track, subtract: track, multiply: track, divide: track },
				onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' }, skitProgress: [],
			} },
		] }));
		localStorage.setItem('math-marsh.active-player-profile', 'title-player');
		if (desktop) Object.defineProperty(window, 'mathMarshDesktop', { value: { quit: async function() {} } });
	}, desktop);
	await page.goto('/');
	await page.getByText('A game by', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByText('Built with', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeFocused();
};

test('title choices, logo and profile access fit TV and phone layouts, including desktop Quit', async ({ page }) => {
	await openTitle(page, true);
	for (const [width, height] of [[1920, 1080], [1280, 720], [390, 844], [390, 780], [360, 740], [320, 568], [844, 390], [568, 320]]) {
		if (width === undefined || height === undefined) throw new Error('Invalid viewport');
		await page.setViewportSize({ width, height });
		const root = page.locator('#main-menu');
		await expect(root.locator('.menu-logo')).toHaveJSProperty('complete', true);
		expect(await root.evaluate(function(element) { return element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight; })).toBe(true);
		const choices = root.locator('.menu-actions button');
		await expect(choices).toHaveCount(6);
		for (const choice of await choices.all()) {
			const bounds = await choice.boundingBox();
			if (!bounds) throw new Error('Menu choice is hidden');
			expect(bounds.height).toBeGreaterThanOrEqual(46);
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.y).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
			expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
		}
		await expect(page.getByRole('button', { name: 'Active player Player. Open player roster', exact: true })).toBeVisible();
	}
});

test('fly eats an answer, cycles the problem, and stops when the menu is inactive', async ({ page }) => {
	await openTitle(page);
	const equation = page.locator('.title-equation');
	await expect(equation).toHaveClass(/is-solved/, { timeout: 16000 });
	await expect(page.locator('[data-title-problem]')).toHaveText('6 + 2 = 8 ✓');
	await expect(page.locator('.title-pad-2 span')).toHaveCSS('opacity', '0');
	await expect(page.locator('[data-title-problem]')).toHaveText('9 − 5 = ?', { timeout: 5000 });
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const fly = page.locator('[data-title-actor="fly"]');
	const stopped = await fly.getAttribute('style');
	await page.waitForTimeout(500); // Observe that an inactive title does not advance.
	expect(await fly.getAttribute('style')).toBe(stopped);
	await page.locator('#back-to-menu-btn').click();
	await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeFocused();
	await expect(page.locator('[data-title-problem]')).toHaveText('6 + 2 = ?');
});

test('reduced motion freezes title presentation and compact layouts hide the demo', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openTitle(page);
	const fly = page.locator('[data-title-actor="fly"]');
	const initial = await fly.getAttribute('style');
	await page.waitForTimeout(500);
	expect(await fly.getAttribute('style')).toBe(initial);
	await page.setViewportSize({ width: 320, height: 568 });
	await expect(page.locator('.title-demo')).toBeHidden();
	await page.getByRole('button', { name: 'Practice', exact: true }).click();
	await expect(page.locator('[data-practice-operation="add"]')).toBeVisible();
});
