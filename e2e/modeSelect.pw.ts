import { expect, test, type Page } from 'playwright/test';

const pressKey = async function(page: Page, key: string): Promise<void> {
	await page.keyboard.press(key, { delay: 120 });
	await page.waitForTimeout(80);
};

const openSetup = async function(page: Page, persistent = true): Promise<void> {
	await page.addInitScript(function(persistent): void {
		const profiles = [{ id: 'setup-player', name: 'Player', learnerData: {
			mathProgress: {
				add: { currentStep: 4, highestUnlockedStep: 6 },
				subtract: { currentStep: 3, highestUnlockedStep: 5 },
				multiply: { currentStep: 2, highestUnlockedStep: 11 },
				divide: { currentStep: 1, highestUnlockedStep: 1 },
			},
			onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
			skitProgress: [],
		} }];
		localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles }));
		localStorage.setItem('math-marsh.active-player-profile', 'setup-player');
		if (!persistent) Object.defineProperty(Storage.prototype, 'setItem', { value: function(): never { throw new Error('Storage unavailable'); } });
	}, persistent);
	await page.goto('/gameplay-toasts');
	await page.getByText('A game by', { exact: true }).waitFor();
	await pressKey(page, 'Space');
	await page.getByText('Built with', { exact: true }).waitFor();
	await pressKey(page, 'Space');
	await page.getByRole('button', { name: 'Arcade', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Pick your math', exact: true })).toBeVisible();
};

const selectAll = async function(page: Page): Promise<void> {
	for (const operation of ['add', 'subtract', 'multiply', 'divide']) {
		const card = page.locator(`[data-operation="${operation}"]`);
		if ((page.viewportSize()?.width ?? 1280) < 700) await card.tap();
		else await card.click();
	}
};

for (const [width, height] of [[320, 568], [390, 844], [568, 320], [1280, 800], [1920, 1080]] as const) {
	test.describe(`setup ${width}x${height}`, function() {
		test.use({ viewport: { width, height }, hasTouch: width < 700 });
		test('both steps and optional controls remain reachable', async ({ page }, testInfo) => {
			await openSetup(page);
			const root = page.locator('#mode-select-screen');
			await expect(root.locator('[data-next-to-pond]')).toBeDisabled();
			await expect(root.locator('[data-open-math-steps]')).toBeDisabled();
			await selectAll(page);
			for (const [operation, unlocked] of [['add', 6], ['subtract', 5], ['multiply', 11], ['divide', 1]] as const) {
				await expect(root.locator(`[data-operation="${operation}"]`)).toHaveAccessibleDescription(`${unlocked} of 11 steps unlocked`);
				await expect(root.locator(`[data-progress-bar="${operation}"]`)).toHaveAttribute('aria-valuenow', String(unlocked));
				await expect(root.locator(`[data-progress-label="${operation}"]`)).toHaveText(`${unlocked} ${unlocked === 1 ? 'step' : 'steps'} unlocked`);
			}
			const checkView = async function(name: string): Promise<void> {
				expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
				const buttons = root.locator('button:visible');
				for (const button of await buttons.all()) {
					const box = await button.boundingBox();
					if (!box) throw new Error('Missing control bounds');
					expect(box.height).toBeGreaterThanOrEqual(48);
					expect(box.x).toBeGreaterThanOrEqual(0);
					expect(box.x + box.width).toBeLessThanOrEqual(width);
				}
				await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
			};
			await checkView('math');
			if (height >= 568) {
				const next = await root.locator('[data-next-to-pond]').boundingBox();
				if (!next) throw new Error('Missing Next');
				expect(next.y + next.height).toBeLessThanOrEqual(height);
			}
			await root.locator('[data-open-math-steps]').click();
			await expect(root.locator('[data-close-setup-panel]:visible')).toBeFocused();
			await checkView('math-steps');
			await root.locator('[data-step-panel="divide"]').scrollIntoViewIfNeeded();
			await page.screenshot({ path: testInfo.outputPath('math-steps-bottom.png') });
			await root.locator('[data-close-setup-panel]:visible').click();
			await expect(root.locator('[data-open-math-steps]')).toBeFocused();
			await root.locator('[data-next-to-pond]').click();
			await expect(root.locator('[data-play-selected]')).toBeDisabled();
			await root.locator('[data-difficulty="medium"]').click();
			await expect(root).toBeVisible();
			await checkView('pond');
			if (height >= 568) {
				const play = await root.locator('[data-play-selected]').boundingBox();
				if (!play) throw new Error('Missing Play');
				expect(play.y + play.height).toBeLessThanOrEqual(height);
			}
			await root.locator('[data-open-difficulty-help]').click();
			await expect(root.locator('.setup-help-row')).toHaveText(['Easy3 × 3 spaces · 1 enemy', 'Medium5 × 4 spaces · 2 enemies', 'Expert6 × 5 spaces · 3 enemies']);
			await checkView('pond-help');
			await pressKey(page, 'Escape');
			await expect(root.locator('[data-open-difficulty-help]')).toBeFocused();
			await root.locator('[data-setup-view="pond"] [data-setup-back]').click();
			await expect(root.locator('.mode-card[aria-pressed="true"]')).toHaveCount(4);
			await root.locator('[data-next-to-pond]').click();
			await expect(root.locator('[data-difficulty="medium"]')).toHaveAttribute('aria-pressed', 'true');
			await root.locator('[data-play-selected]').click();
			await expect(page.locator('#game-canvas')).toBeVisible();
			const run = await page.evaluate(function() {
				const engine = window.toastTestEngine;
				const session = engine.getResource('mathSession');
				return { difficulty: engine.getResource('mathDifficulty'), operations: engine.getResource('gameMode'), step: session?.tracks.add.step };
			});
			expect(run).toEqual({ difficulty: 'medium', operations: ['add', 'subtract', 'multiply', 'divide'], step: 4 });
		});
	});
}

test('earlier steps preserve unlocks and hidden starting-level sequence still launches the selected level', async ({ page }) => {
	await openSetup(page);
	const root = page.locator('#mode-select-screen');
	await root.locator('[data-operation="add"]').click();
	await root.locator('[data-open-math-steps]').click();
	await expect(root.locator('#starting-level-select')).toBeHidden();
	await expect(root.locator('[data-step-for="add"]')).toHaveText('Step 4');
	await root.locator('[data-step-operation="add"][data-step-change="-1"]').click({ clickCount: 2 });
	await expect(root.locator('[data-step-for="add"]')).toHaveText('Step 2');
	for (let step = 2; step < 6; step++) await root.locator('[data-step-operation="add"][data-step-change="1"]').click();
	await expect(root.locator('[data-step-operation="add"][data-step-change="1"]')).toBeDisabled();
	for (let step = 6; step > 2; step--) await root.locator('[data-step-operation="add"][data-step-change="-1"]').click();
	await pressKey(page, 'Escape');
	await expect(root.locator('[data-progress-label="add"]')).toHaveText('6 steps unlocked');
	for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) await pressKey(page, key);
	await expect(root.locator('#starting-level-select')).toBeVisible();
	await expect(root.locator('[data-level-change="1"]')).toBeFocused();
	await pressKey(page, 'Enter');
	await expect(root.locator('#starting-level-value')).toHaveText('2');
	await pressKey(page, 'Escape');
	await root.locator('[data-next-to-pond]').click();
	await root.locator('[data-difficulty="easy"]').click();
	await root.locator('[data-play-selected]').click();
	await expect(page.locator('#game-canvas')).toBeVisible();
	expect(await page.evaluate(function() {
		const engine = window.toastTestEngine;
		return { step: engine.getResource('mathSession')?.tracks.add.step, level: engine.getResource('currentLevel') };
	})).toEqual({ step: 2, level: 2 });
});

test('session-only progress reports unavailable storage', async ({ page }) => {
	await openSetup(page, false);
	await page.locator('[data-operation="add"]').click();
	await page.locator('[data-open-math-steps]').click();
	await page.locator('[data-step-operation="add"][data-step-change="-1"]').click();
	await expect(page.locator('#math-save-status')).toContainText('session');
});

test('keyboard traverses secondary controls and launches only through Play', async ({ page }) => {
	await openSetup(page);
	await pressKey(page, 'Escape');
	await pressKey(page, 'Enter');
	await expect(page.locator('[data-operation="add"]')).toBeFocused();
	await pressKey(page, 'Space');
	await pressKey(page, 'ArrowDown');
	await pressKey(page, 'ArrowDown');
	await expect(page.locator('[data-open-math-steps]')).toBeFocused();
	await pressKey(page, 'Enter');
	await expect(page.locator('[data-close-setup-panel]:visible')).toBeFocused();
	await pressKey(page, 'Escape');
	await pressKey(page, 'ArrowRight');
	await expect(page.locator('[data-next-to-pond]')).toBeFocused();
	await pressKey(page, 'Enter');
	await expect(page.locator('[data-difficulty="easy"]')).toBeFocused();
	await pressKey(page, 'Enter');
	await expect(page.locator('#mode-select-screen')).toBeVisible();
	await pressKey(page, 'ArrowDown');
	await expect(page.locator('[data-open-difficulty-help]')).toBeFocused();
	await pressKey(page, 'Enter');
	await pressKey(page, 'Escape');
	await pressKey(page, 'ArrowRight');
	await expect(page.locator('[data-play-selected]')).toBeFocused();
	await pressKey(page, 'Enter');
	await expect(page.locator('#game-canvas')).toBeVisible();
	expect(await page.evaluate(() => window.toastTestEngine.getResource('gameMode'))).toEqual(['add']);
});

test('simulated controller selects mixed math, closes panels, retains ponds and launches', async ({ page }, testInfo) => {
	await page.addInitScript(function(): void {
		const buttons = Array.from({ length: 17 }, function() { return { pressed: false, touched: false, value: 0 }; });
		const gamepad = { id: 'Xbox setup test controller', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons };
		Object.defineProperty(navigator, 'getGamepads', { value: function() { return [gamepad]; } });
		window.addEventListener('message', function(event: MessageEvent<unknown>): void {
			const data = event.data;
			if (typeof data !== 'object' || data === null || !('setupButton' in data) || typeof data.setupButton !== 'number' || !('pressed' in data) || typeof data.pressed !== 'boolean') return;
			const button = buttons[data.setupButton];
			if (button) { button.pressed = data.pressed; button.value = data.pressed ? 1 : 0; }
		});
	});
	const press = async function(button: number): Promise<void> {
		for (const pressed of [true, false]) {
			await page.evaluate(data => window.postMessage(data, '*'), { setupButton: button, pressed });
			await page.waitForTimeout(140);
		}
	};
	await openSetup(page);
	await press(0); // Claim controller; the initial press does not activate a choice.
	await press(0);
	await expect(page.locator('[data-operation="add"]')).toHaveAttribute('aria-pressed', 'true');
	await press(15);
	await press(0);
	await expect(page.locator('[data-operation="subtract"]')).toHaveAttribute('aria-pressed', 'true');
	await press(13); // Divide
	await press(13); // Next
	await expect(page.locator('[data-next-to-pond]')).toBeFocused();
	const outline = await page.locator('[data-next-to-pond]').evaluate(element => getComputedStyle(element).outlineColor);
	expect(outline).toBe('rgb(255, 247, 198)');
	await page.screenshot({ path: testInfo.outputPath('controller-math-focus.png') });
	await press(0);
	await press(15);
	await expect(page.locator('[data-difficulty="medium"]')).toBeFocused();
	await press(0);
	await press(1);
	await expect(page.locator('[data-next-to-pond]')).toBeFocused();
	await press(0);
	await expect(page.locator('[data-difficulty="medium"]')).toHaveAttribute('aria-pressed', 'true');
	await press(15);
	await press(13);
	await expect(page.locator('[data-play-selected]')).toBeFocused();
	await page.screenshot({ path: testInfo.outputPath('controller-pond-focus.png') });
	await press(14); // What changes?
	await press(0);
	await expect(page.locator('[data-close-setup-panel]:visible')).toBeFocused();
	await press(1);
	await expect(page.locator('[data-open-difficulty-help]')).toBeFocused();
	await press(15);
	await press(0);
	await expect(page.locator('#game-canvas')).toBeVisible();
	expect(await page.evaluate(() => window.toastTestEngine.getResource('gameMode'))).toEqual(['add', 'subtract']);
});
