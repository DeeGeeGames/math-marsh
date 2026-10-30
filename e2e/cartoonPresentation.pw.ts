import { expect, test, type Page, type TestInfo } from 'playwright/test';

const viewports = [
	{ width: 1920, height: 1080 }, { width: 1280, height: 720 },
	{ width: 390, height: 844 }, { width: 320, height: 568 },
	{ width: 844, height: 390 }, { width: 568, height: 320 },
] as const;

const openMenu = async function(page: Page): Promise<void> {
	await page.addInitScript(function(): void {
		const track = { currentStep: 1, highestUnlockedStep: 1 };
		localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [{
			id: 'presentation-player', name: 'Alexandria-Rose', learnerData: {
				mathProgress: { add: track, subtract: track, multiply: track, divide: track },
				onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
				skitProgress: [],
			},
		}] }));
		localStorage.setItem('math-marsh.active-player-profile', 'presentation-player');
	});
	await page.goto('/gameplay-toasts');
	await page.getByText('A game by', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByText('Built with', { exact: true }).waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeVisible();
};

const capture = async function(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(async function() { await document.fonts.ready; });
	await info.attach(name, { body: await page.screenshot({ path: info.outputPath(`${name}.png`) }), contentType: 'image/png' });
};

// Observe actual canvas draw calls, including both text-fit and CSS scaling.
const headerTextSizes = async function(page: Page): Promise<readonly number[]> {
	return page.locator('#game-canvas').evaluate(async function(canvas) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Missing canvas context');
		const drawText = ctx.fillText;
		const sizes: number[] = [];
		ctx.fillText = function(text, x, y, maxWidth): void {
			if (text.includes('=') || /^(Time )?\d+:\d{2}$/.test(text)) {
				const fontSize = Number(/([\d.]+)px/.exec(ctx.font)?.[1]);
				sizes.push(fontSize * Math.abs(ctx.getTransform().a) * canvas.getBoundingClientRect().width / canvas.width);
			}
			if (maxWidth === undefined) drawText.call(ctx, text, x, y);
			else drawText.call(ctx, text, x, y, maxWidth);
		};
		try { await new Promise<void>(resolve => requestAnimationFrame(function() { resolve(); })); }
		finally { ctx.fillText = drawText; }
		return sizes;
	});
};

for (const viewport of viewports) {
	test(`cartoon title, settings, phases, pause and results ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
		await page.setViewportSize(viewport);
		await openMenu(page);
		await capture(page, info, 'title');
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		await expect(page.locator('#sound-effects')).toBeVisible();
		await capture(page, info, 'settings');
		expect(await page.evaluate(function() { return document.fonts.check('32px "Lilita One"'); })).toBe(true);
		if (viewport.width < 900) await page.locator('[data-touch-mode="on"]').click();
		await page.locator('#back-to-menu-btn').click();
		await page.getByRole('button', { name: 'Arcade', exact: true }).click();
		await page.locator('[data-operation="add"]').click();
		await page.locator('[data-next-to-pond]').click();
		await page.locator('[data-difficulty="expert"]').click();
		await page.locator('[data-play-selected]').click();
		await expect(page.locator('#game-canvas')).toBeVisible();

		// Real renderer/HUD with deterministic prompt phases, not mock board markup.
		for (const [kind, phase] of [
			['selectResult', 'morning'], ['selectOperands', 'dusk'], ['selectOperandAndResult', 'night'],
		] as const) {
			await page.evaluate(function(kind): void {
				const engine = window.toastTestEngine;
				engine.setResource('remainingTimeSeconds', 90);
				engine.setResource('equationMode', {
					...engine.getResource('equationMode'), promptKind: kind,
					operandsRequired: kind === 'selectResult' ? 1 : 2,
					target: null, promptValues: [], selectedProblemIds: [], feedback: undefined,
				});
			}, kind);
			await expect(page.locator('#game-container')).toHaveAttribute('data-pond-phase', phase);
			await expect.poll(function() { return page.evaluate(function() {
				return window.toastTestEngine.getResource('equationMode').target !== null;
			}); }).toBe(true);
			await expect.poll(async function() {
				const sizes = await headerTextSizes(page);
				return sizes.length >= 2 && sizes.every(function(size) { return size >= 15.9; });
			}).toBe(true);
			await capture(page, info, phase);
		}

		if (viewport.width < 900) {
			const board = await page.locator('#game-canvas').boundingBox();
			if (!board) throw new Error('Board has no bounds');
			for (const target of await page.locator('.touch-controls button').all()) {
				const bounds = await target.boundingBox();
				if (!bounds) throw new Error('Touch target is hidden');
				expect(bounds.width).toBeGreaterThanOrEqual(44);
				expect(bounds.height).toBeGreaterThanOrEqual(44);
				expect(bounds.x).toBeGreaterThanOrEqual(0);
				expect(bounds.y).toBeGreaterThanOrEqual(0);
				expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
				expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
				expect(bounds.x >= board.x + board.width || bounds.x + bounds.width <= board.x || bounds.y >= board.y + board.height).toBe(true);
			}
		}
		await page.locator('#pause-btn').click();
		await expect(page.locator('#resume-btn')).toBeFocused();
		await capture(page, info, 'pause');
		await page.locator('#pause-settings-btn').click();
		await page.locator('#back-to-menu-btn').click();
		await expect(page.locator('#pause-screen')).toBeVisible();
		await page.locator('#resume-btn').click();
		await page.evaluate(function(): void { window.toastTestEngine.setResource('remainingTimeSeconds', 0); });
		await expect(page.locator('#game-over-screen')).toBeVisible();
		await capture(page, info, 'results');
		for (const selector of ['#play-again-btn', '#main-menu-btn']) {
			const target = page.locator(selector);
			await target.scrollIntoViewIfNeeded();
			const bounds = await target.boundingBox();
			if (!bounds) throw new Error('Results action is hidden');
			expect(bounds.height).toBeGreaterThanOrEqual(44);
			expect(bounds.y).toBeGreaterThanOrEqual(0);
			expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
		}
		await page.locator('#main-menu-btn').click();
		await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeFocused();
	});
}
