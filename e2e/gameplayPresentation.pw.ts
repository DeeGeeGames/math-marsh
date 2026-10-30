import { expect, test, type Page } from 'playwright/test';

const startPond = async function(page: Page, difficulty: string): Promise<void> {
	await page.addInitScript(function() {
		const track = { currentStep: 1, highestUnlockedStep: 1 };
		localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [{
			id: 'presentation-player', name: 'Player', learnerData: {
				mathProgress: { add: track, subtract: track, multiply: track, divide: track },
				onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' }, skitProgress: [],
			},
		}] }));
		localStorage.setItem('math-marsh.active-player-profile', 'presentation-player');
		localStorage.setItem('math-marsh.touchControls', 'on');
	});
	await page.goto('/');
	await page.getByText('A game by', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByText('Built with', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByRole('button', { name: 'Arcade', exact: true }).click();
	await page.locator('[data-operation="add"]').click();
	await page.locator('[data-next-to-pond]').click();
	await page.locator(`[data-difficulty="${difficulty}"]`).click();
	await page.locator('[data-play-selected]').click();
	await expect(page.locator('#game-canvas')).toBeVisible();
};

const controlsFit = async function(page: Page): Promise<boolean> {
	return page.evaluate(function() {
		const canvas = document.querySelector('#game-canvas');
		if (!(canvas instanceof HTMLCanvasElement)) return false;
		const board = canvas.getBoundingClientRect();
		const buttons = Array.from(document.querySelectorAll('#touch-dpad button, #touch-eat'));
		return buttons.length === 5 && buttons.every(function(button) {
			const bounds = button.getBoundingClientRect();
			const outsideBoard = bounds.right <= board.left || bounds.left >= board.right
				|| bounds.bottom <= board.top || bounds.top >= board.bottom;
			return bounds.width >= 44 && bounds.height >= 44 && outsideBoard
				&& bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
		});
	});
};

for (const difficulty of ['easy', 'medium', 'expert']) {
	test(`${difficulty} pond keeps thumb controls outside the board through phone orientations`, async ({ page }, testInfo) => {
		await startPond(page, difficulty);
		for (const [width, height] of [[390, 844], [320, 568], [844, 390], [568, 320]]) {
			if (width === undefined || height === undefined) throw new Error('Missing viewport dimensions');
			await page.setViewportSize({ width, height });
			await expect.poll(function() { return controlsFit(page); }).toBe(true);
			await page.screenshot({ path: testInfo.outputPath(`${difficulty}-${width}x${height}.png`) });
		}
	});
}

test('safe-area simulation keeps touch controls inside landscape insets', async ({ page }) => {
	await startPond(page, 'expert');
	await page.setViewportSize({ width: 568, height: 320 });
	await page.locator('#gameplay-ui').evaluate(function(root) {
		if (!(root instanceof HTMLElement)) throw new Error('Missing gameplay root');
		root.style.setProperty('--touch-safe-left', '44px');
		root.style.setProperty('--touch-safe-top', '24px');
		root.style.setProperty('--touch-safe-bottom', '21px');
		window.dispatchEvent(new Event('resize'));
	});
	await expect.poll(function() { return controlsFit(page); }).toBe(true);
	const dpad = await page.locator('#touch-dpad').boundingBox();
	const action = await page.locator('#touch-action').boundingBox();
	if (!dpad || !action) throw new Error('Missing touch control bounds');
	expect(dpad.x).toBeGreaterThanOrEqual(44);
	expect(dpad.y).toBeGreaterThanOrEqual(24);
	expect(dpad.y + dpad.height).toBeLessThanOrEqual(299);
	expect(action.y + action.height).toBeLessThanOrEqual(299);
});
