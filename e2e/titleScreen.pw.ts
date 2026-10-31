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
	const pausedProblem = await page.locator('[data-title-problem]').textContent();
	await page.getByRole('button', { name: 'Settings', exact: true }).click();
	const fly = page.locator('[data-title-actor="fly"]');
	const stopped = await fly.getAttribute('style');
	await page.waitForTimeout(500); // Observe that an inactive title does not advance.
	expect(await fly.getAttribute('style')).toBe(stopped);
	await page.locator('#back-to-menu-btn').click();
	await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeFocused();
	if (!pausedProblem) throw new Error('Title problem is missing');
	await expect(page.locator('[data-title-problem]')).toHaveText(pausedProblem);
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

test('web Steam sign fits responsive layouts and opens the store separately', async ({ page }) => {
	await openTitle(page);
	const sign = page.getByRole('link', { name: 'Wishlist on Steam' });
	await expect(sign).toHaveAttribute('href', 'https://store.steampowered.com/app/4927380/Math_Marsh/');
	await expect(sign).toHaveAttribute('rel', 'noopener noreferrer');
	for (const [width, height] of [[1920, 1080], [1280, 720], [390, 844], [390, 780], [360, 740], [320, 568], [844, 390], [568, 320]]) {
		if (width === undefined || height === undefined) throw new Error('Invalid viewport');
		await page.setViewportSize({ width, height });
		const bounds = await sign.boundingBox();
		if (!bounds) throw new Error('Steam sign is hidden');
		expect(bounds.height).toBeGreaterThanOrEqual(44);
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.y).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
		expect(bounds.y + bounds.height + 16).toBeLessThanOrEqual(height);
		await page.screenshot({ path: `/tmp/math-marsh-steam-sign/${width}x${height}.png` });
		expect(await page.locator('#main-menu').evaluate(function(root) { return { width: root.clientWidth, scrollWidth: root.scrollWidth, height: root.clientHeight, scrollHeight: root.scrollHeight }; }), `${width}x${height}`).toEqual({ width, scrollWidth: width, height, scrollHeight: height });
		for (const control of await page.locator('.menu-actions button, .menu-logo, .title-equation').all()) {
			if (!await control.isVisible()) continue;
			const other = await control.boundingBox();
			if (!other) throw new Error('Title control has no bounds');
			expect(bounds.x >= other.x + other.width || bounds.x + bounds.width <= other.x || bounds.y >= other.y + other.height || bounds.y + bounds.height <= other.y).toBe(true);
		}
	}
	await page.setViewportSize({ width: 1280, height: 720 });
	for (let step = 0; step < 12 && !await sign.evaluate(function(element) { return element === document.activeElement; }); step++) {
		await page.keyboard.press('ArrowDown', { delay: 200 });
	}
	await expect(sign).toBeFocused();
	await expect(sign).toHaveCSS('outline-style', 'solid');
	await page.context().route('https://store.steampowered.com/**', function(route) { return route.fulfill({ body: 'Steam navigation verified' }); });
	const popupPromise = page.waitForEvent('popup');
	await page.keyboard.press('Enter', { delay: 200 });
	const popup = await popupPromise;
	await popup.waitForLoadState();
	expect(popup.url()).toBe('https://store.steampowered.com/app/4927380/Math_Marsh/');
	await popup.close();
	await expect(page.locator('#main-menu')).toBeVisible();
	await page.getByRole('button', { name: 'Practice', exact: true }).click();
	await expect(sign).toBeHidden();
});

for (const role of ['minimal', 'demo', 'paid'] as const) {
	test(`desktop ${role} bridge omits the web Steam sign`, async ({ page }) => {
		await page.addInitScript(function(role) {
			Object.defineProperty(window, 'mathMarshDesktop', { value: role === 'minimal' ? {} : { steamRole: role } });
		}, role);
		await openTitle(page);
		await expect(page.locator('.title-steam-sign')).toHaveCount(0);
	});
}
