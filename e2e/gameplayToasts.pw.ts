import { expect, test, type Page } from 'playwright/test';

const pressActionKey = async function(page: Page, key: string): Promise<void> {
	await page.keyboard.down(key);
	await page.waitForTimeout(200);
	await page.keyboard.up(key);
};

const startGame = async function(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const track = { currentStep: 1, highestUnlockedStep: 1 };
		const profiles = [{
			id: 'toast-player',
			name: 'Player',
			learnerData: {
				mathProgress: { add: track, subtract: track, multiply: track, divide: track },
				onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
				skitProgress: [],
			},
		}];
		window.localStorage.clear();
		window.localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles }));
		window.localStorage.setItem('math-marsh.active-player-profile', 'toast-player');
	});
	await page.goto('/gameplay-toasts');
	await page.getByText('A game by').waitFor();
	await pressActionKey(page, 'Space');
	await page.getByText('Built with').waitFor();
	await pressActionKey(page, 'Space');
	await page.getByRole('button', { name: 'Arcade Play for a high score', exact: true }).click();
	await page.locator('[data-operation="add"]').click();
	await page.locator('[data-next-to-pond]').click();
	await page.locator('[data-difficulty="easy"]').click();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.locator('#game-canvas').waitFor({ state: 'visible' });
};

// Supply a completed assessment to the real progression system rather than
// injecting toast markup or bypassing the HUD adapter.
const completeAssessment = async function(page: Page, fast = true): Promise<void> {
	await page.evaluate(fast => {
		const gameEngine = window.toastTestEngine;
		const session = gameEngine.getResource('mathSession');
		if (!session) throw new Error('Missing math session');
		gameEngine.setResource('mathRoundCompletedThisBoard', false);
		gameEngine.setResource('mathSession', {
			...session,
			tracks: {
				...session.tracks,
				add: {
					...session.tracks.add,
					assessment: {
						correctAnswers: 6,
						incorrectAnswers: fast ? 0 : 6,
						activeSeconds: fast ? 12 : 120,
						expectedSecondsTotal: 60,
					},
				},
			},
		});
	}, fast);
};

test('progress toasts preserve the board, pause their lifetime, expire, and allow repeat feedback', async ({ page }) => {
	await startGame(page);
	const board = page.locator('#game-canvas');
	const notice = page.getByRole('status');
	const before = await board.boundingBox();
	await completeAssessment(page, false);
	await expect(notice).toContainText('keep practicing');
	expect(await board.boundingBox()).toEqual(before);
	await page.locator('#pause-btn').click();
	await expect(page.getByRole('dialog', { name: 'PAUSED' })).toBeVisible();
	await page.waitForTimeout(8500);
	await page.getByRole('button', { name: 'Resume Game' }).click();
	await expect(notice).toBeVisible();
	await expect(notice).toBeHidden({ timeout: 4_000 });
	expect(await board.boundingBox()).toEqual(before);
	await completeAssessment(page, false);
	await expect(notice).toContainText('keep practicing');
	await expect(notice).toBeVisible();
	expect(await board.boundingBox()).toEqual(before);
	await page.locator('#pause-btn').click();
	await page.getByRole('button', { name: 'Quit to Menu' }).click();
	await expect(notice).toBeHidden();
});

test('progress toasts fit TV, desktop, portrait, and short landscape without shifting the board or focus', async ({ page }) => {
	await startGame(page);
	await completeAssessment(page);
	const notice = page.getByRole('status');
	await expect(notice).toContainText('Advanced');
	const summary = await page.evaluate(() => window.toastTestEngine.getResource('mathRoundSummary'));
	if (!summary) throw new Error('Missing progression summary');
	const viewports = [
		{ width: 1920, height: 1080 },
		{ width: 1280, height: 720 },
		{ width: 390, height: 844 },
		{ width: 320, height: 568 },
		{ width: 568, height: 320 },
	] as const;
	await viewports.reduce(async (previous, viewport) => {
		await previous;
		await page.setViewportSize(viewport);
		await page.waitForTimeout(150);
		const board = page.locator('#game-canvas');
		const visibleBoard = await board.boundingBox();
		const toastBox = await notice.boundingBox();
		if (!toastBox) throw new Error('Toast is not visible');
		expect(toastBox.x).toBeGreaterThanOrEqual(0);
		expect(toastBox.y).toBeGreaterThanOrEqual(0);
		expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(viewport.width);
		expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(viewport.height);
		const focusBefore = await page.evaluate(() => document.activeElement?.id);
		await page.evaluate(() => {
			window.toastTestEngine.setResource('mathRoundSummary', null);
		});
		await expect(notice).toBeHidden();
		expect(await board.boundingBox()).toEqual(visibleBoard);
		await page.evaluate(summary => {
			const gameEngine = window.toastTestEngine;
			gameEngine.setResource('mathRoundSummary', {
				...summary,
				startedAt: gameEngine.getResource('gameplayClock').elapsed * 1000,
			});
		}, summary);
		await expect(notice).toBeVisible();
		expect(await board.boundingBox()).toEqual(visibleBoard);
		expect(await page.evaluate(() => document.activeElement?.id)).toBe(focusBefore);
		await page.screenshot({ path: `/tmp/math-marsh-toast-${viewport.width}x${viewport.height}.png` });
	}, Promise.resolve());
});
