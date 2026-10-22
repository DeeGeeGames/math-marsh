import { expect, test, type Page } from 'playwright/test';

const press = async function(page: Page, key: string): Promise<void> {
	await page.keyboard.press(key, { delay: 200 });
	await page.waitForTimeout(50);
};

const skipSplash = async function(page: Page): Promise<void> {
	await page.getByText('A game by').waitFor();
	await press(page, 'Space');
	await page.getByText('Built with').waitFor();
	await press(page, 'Space');
};

const seedProfiles = async function(page: Page, returning: boolean | 'retired' = false, failSaving = false): Promise<void> {
	await page.addInitScript(function({ returning, failSaving }): void {
		if (!sessionStorage.getItem('practice-fixture-seeded')) {
			const track = { currentStep: 1, highestUnlockedStep: 1 };
			const learnerData = {
				mathProgress: { add: track, subtract: track, multiply: track, divide: track },
				onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
				skitProgress: [],
			};
			const practiceProgress = returning ? {
				version: 1, facts: returning === 'retired'
					? {
						'add:0:0': { attempts: 1, correct: 1 }, 'add:1:4': { attempts: 1, correct: 1 },
						'add:0:4': { attempts: 1, correct: 0 },
						...Object.fromEntries(Array.from({ length: 7 }, function(_, left) {
							return [`add:${left}:${6 - left}`, { attempts: 1, correct: 1 }];
						})),
					}
					: { 'multiply:2:3': { attempts: 3, correct: 1 } },
				lastSelection: { topicId: returning === 'retired' ? 'add-mixed-to-20' : 'multiply-table-2', related: true, pond: 'medium' },
			} : { version: 1, facts: {}, lastSelection: null };
			localStorage.clear();
			localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [
				{ id: 'practice-player', name: 'Mira', learnerData: { ...learnerData, practiceProgress } },
				{ id: 'other-player', name: 'Jordan', learnerData },
			] }));
			localStorage.setItem('math-marsh.active-player-profile', 'practice-player');
			sessionStorage.setItem('practice-fixture-seeded', 'yes');
		}
		if (failSaving) Storage.prototype.setItem = function(): never { throw new DOMException('Storage full', 'QuotaExceededError'); };
	}, { returning, failSaving });
};

const openPractice = async function(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Practice', exact: true }).click();
	await expect(page.locator('#practice-screen')).toBeVisible();
};

const openTimesTopic = async function(page: Page): Promise<void> {
	await page.locator('[data-practice-operation="multiply"]').click();
	await page.locator('[data-practice-topic="multiply-table-2"]').click();
};

test('new Practice journey preserves options and pond across Back, with keyboard focus', async ({ page }) => {
	await seedProfiles(page);
	await page.goto('/');
	await skipSplash(page);
	await expect(page.getByRole('button', { name: 'Arcade', exact: true })).toBeFocused();
	await openPractice(page);
	await expect(page.locator('[data-practice-continue]')).toHaveCount(0);
	await expect(page.locator('[data-practice-operation]')).toHaveCount(4);
	await expect(page.locator('[data-practice-operation="add"]')).toBeFocused();
	await press(page, 'ArrowDown');
	await expect(page.locator('[data-practice-operation="multiply"]')).toBeFocused();
	await press(page, 'Enter');
	await expect(page.locator('[data-practice-topic]')).toHaveCount(12);
	await page.locator('[data-practice-topic="multiply-table-2"]').focus();
	await press(page, 'Enter');
	await expect(page.locator('[data-practice-start]')).toBeFocused();
	await expect(page.locator('[data-practice-related]')).toHaveAttribute('aria-pressed', 'false');
	await page.locator('[data-practice-related]').click();
	await expect(page.locator('[data-practice-related]')).toBeFocused();
	await expect(page.locator('[data-practice-related]')).toHaveAttribute('aria-pressed', 'true');
	await page.locator('[data-practice-change-pond]').click();
	await page.locator('[data-practice-pond="expert"]').click();
	await press(page, 'Escape');
	await expect(page.locator('[data-practice-change-pond]')).toBeFocused();
	await expect(page.locator('.practice-pond-summary')).toContainText('Expert');
	await press(page, 'Escape');
	await expect(page.locator('[data-practice-topic="multiply-table-2"]')).toBeFocused();
	await press(page, 'Enter');
	await expect(page.locator('[data-practice-related]')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.practice-pond-summary')).toContainText('Expert');
	await page.locator('[data-practice-start]').click();
	await expect(page.locator('#game-canvas')).toBeVisible();
	await page.locator('#pause-btn').click();
	await page.getByRole('button', { name: 'Quit to Menu', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Partial practice', exact: true })).toBeVisible();
	await expect(page.locator('#practice-results-screen')).toContainText('0/12 equations solved');
	await expect(page.locator('#practice-results-screen')).toContainText('No submitted attempts yet.');
	await expect(page.locator('[data-practice-again]')).toBeFocused();
	await page.getByRole('button', { name: 'Choose another topic', exact: true }).click();
	await expect(page.locator('[data-practice-continue]')).toContainText('2 times table');
	await expect(page.locator('[data-practice-continue]')).toContainText('Related facts on');
	await expect(page.locator('[data-practice-continue]')).toContainText('Expert');
	await page.reload();
	await skipSplash(page);
	await openPractice(page);
	await expect(page.locator('[data-practice-continue]')).toContainText('2 times table');
});

test('returning progress is truthful, Continue is fresh, and profiles keep independent Practice data', async ({ page }) => {
	await seedProfiles(page, true);
	await page.goto('/');
	await skipSplash(page);
	await openPractice(page);
	await expect(page.locator('[data-practice-continue]')).toBeFocused();
	const operationOrder = await page.locator('[data-practice-operation]').evaluateAll(elements => elements.map(element => element.getAttribute('data-practice-operation')));
	expect(operationOrder).toEqual(['add', 'subtract', 'multiply', 'divide']);
	await press(page, 'ArrowDown');
	await expect(page.locator('[data-practice-operation="add"]')).toBeFocused();
	await press(page, 'ArrowUp');
	await expect(page.locator('[data-practice-continue]')).toBeFocused();
	await press(page, 'ArrowDown');
	await press(page, 'ArrowRight');
	await expect(page.locator('[data-practice-operation="subtract"]')).toBeFocused();
	await press(page, 'ArrowUp');
	await expect(page.locator('[data-practice-continue]')).toBeFocused();
	await page.locator('[data-practice-continue]').click();
	await expect(page.locator('[data-practice-related]')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.practice-pond-summary')).toContainText('Medium');
	await expect(page.locator('.practice-preview-evidence')).toContainText('Practicing');
	await expect(page.locator('.practice-preview-evidence')).toContainText('1 facts practiced');
	await expect(page.locator('#practice-screen')).toContainText('33%');
	await page.locator('[data-practice-start]').click();
	await expect(page.locator('#game-canvas')).toBeVisible();
	await page.locator('#pause-btn').click();
	await page.getByRole('button', { name: 'Quit to Menu', exact: true }).click();
	await expect(page.locator('#practice-results-screen')).toContainText('0/12 equations solved');
	await page.getByRole('button', { name: 'Main menu', exact: true }).click();
	await page.locator('#player-profile-badge').click();
	await page.locator('[data-player-row]').filter({ hasText: 'Jordan' }).click();
	await openPractice(page);
	await expect(page.locator('[data-practice-continue]')).toHaveCount(0);
	await openTimesTopic(page);
	await expect(page.locator('.practice-preview-evidence .practice-status')).toHaveText('New');
	await expect(page.locator('.practice-preview-evidence')).toContainText('0 facts practiced');
});

test('retired topic Continue falls back honestly while preserving overlapping fact evidence', async ({ page }) => {
	await seedProfiles(page, 'retired');
	await page.goto('/');
	await skipSplash(page);
	await openPractice(page);
	await expect(page.locator('[data-practice-continue]')).toHaveCount(0);
	await expect(page.locator('.practice-empty')).toHaveText('Choose a topic below.');
	await page.locator('[data-practice-operation="add"]').click();
	await expect(page.locator('[data-practice-topic]')).toHaveCount(18);
	const fresh = page.locator('[data-practice-topic="add-make-3"]');
	const tried = page.locator('[data-practice-topic="add-make-4"]');
	const partial = page.locator('[data-practice-topic="add-make-5"]');
	const complete = page.locator('[data-practice-topic="add-make-6"]');
	await expect(fresh).toHaveAccessibleName('Make 3. New. 0 facts practiced. 0 of 4 facts solved at least once.');
	await expect(fresh.locator('.practice-topic-fill')).toHaveAttribute('visibility', 'hidden');
	await expect(tried).toHaveAccessibleName('Make 4. In progress. 1 facts practiced. 0 of 5 facts solved at least once.');
	await expect(tried.locator('.practice-topic-fill')).toHaveAttribute('visibility', 'hidden');
	await expect(partial).toHaveAccessibleName('Make 5. In progress. 1 facts practiced. 1 of 6 facts solved at least once.');
	expect(await partial.locator('.practice-topic-fill').evaluate(element => Number(element.getAttribute('stroke-dasharray')?.split(' ')[0]))).toBeCloseTo(100 / 6);
	await expect(complete).toHaveAccessibleName('Make 6. All solved. 7 facts practiced. 7 of 7 facts solved at least once.');
	await expect(complete.locator('.practice-topic-fill')).toHaveAttribute('stroke-dasharray', '100 100');
	await expect(complete.locator('.practice-topic-check')).toBeVisible();
	await expect(partial.locator('.practice-topic-check')).toHaveCount(0);
	await partial.click();
	await expect(page.locator('.practice-preview-evidence')).toContainText('1 facts practiced · 1/6 solved at least once');
	await press(page, 'Escape');
	await expect(partial).toBeFocused();
});

test('Practice stays playable and shows session-only persistence when saving fails', async ({ page }) => {
	await seedProfiles(page, false, true);
	await page.goto('/');
	await skipSplash(page);
	await openPractice(page);
	await openTimesTopic(page);
	await page.locator('[data-practice-start]').click();
	await expect(page.locator('#game-canvas')).toBeVisible();
	await page.locator('#pause-btn').click();
	await page.getByRole('button', { name: 'Quit to Menu', exact: true }).click();
	await expect(page.locator('#practice-results-screen .practice-save-status')).toContainText('session only');
	await page.getByRole('button', { name: 'Choose another topic', exact: true }).click();
	await expect(page.locator('[data-practice-continue]')).toContainText('2 times table');
});

for (const viewport of [
	{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1280, height: 800 },
	{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 568, height: 320 },
]) {
	test(`Practice responsive journey ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
		await page.setViewportSize(viewport);
		await seedProfiles(page);
		await page.goto('/');
		await skipSplash(page);
		const capture = async function(name: string): Promise<void> {
			expect(await page.locator('html').evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(viewport.width);
			const image = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
			await testInfo.attach(name, { body: image, contentType: 'image/png' });
			await page.mouse.move(0, 0);
			for (const button of await page.locator('button:visible').all()) {
				await button.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
				const bounds = await button.boundingBox();
				if (!bounds) throw new Error(`${name}: button has no bounds`);
				expect(bounds.x).toBeGreaterThanOrEqual(0);
				expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
				expect(bounds.y).toBeGreaterThanOrEqual(-1);
				expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
			}
		};
		await capture('menu');
		await openPractice(page);
		await capture('home');
		await page.locator('[data-practice-operation="add"]').click();
		await expect(page.locator('[data-practice-topic]')).toHaveCount(18);
		const prompt = page.locator('#practice-screen [data-input-prompts]');
		const promptBounds = await prompt.boundingBox();
		if (!promptBounds) throw new Error('Practice input prompts are missing');
		const columns = await page.locator('.practice-topic-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
		const rows = Math.ceil(18 / columns);
		for (let row = 1; row < rows; row++) {
			await press(page, 'ArrowDown');
			await expect(page.locator(`[data-practice-topic="add-make-${3 + row * columns}"]`)).toBeFocused();
			const focused = await page.locator('[data-practice-topic]:focus').boundingBox();
			const footer = await prompt.boundingBox();
			const panel = await page.locator('.practice-content').boundingBox();
			if (!focused || !footer || !panel) throw new Error('Practice navigation bounds are missing');
			expect(footer.y).toBeCloseTo(promptBounds.y);
			expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height - 12);
			expect(focused.y).toBeGreaterThanOrEqual(panel.y + 12);
			expect(focused.y + focused.height).toBeLessThanOrEqual(panel.y + panel.height - 12);
			expect(footer.y - focused.y - focused.height).toBeGreaterThanOrEqual(28);
		}
		await page.screenshot({ path: testInfo.outputPath('addition-bottom-row.png') });
		for (let row = rows - 2; row >= 0; row--) {
			await press(page, 'ArrowUp');
			await expect(page.locator(`[data-practice-topic="add-make-${3 + row * columns}"]`)).toBeFocused();
		}
		await capture('addition-collection');
		await page.locator('[data-practice-back]').click();
		await page.locator('[data-practice-operation="subtract"]').click();
		await expect(page.locator('[data-practice-topic]')).toHaveCount(18);
		await capture('subtraction-collection');
		await page.locator('[data-practice-back]').click();
		await page.locator('[data-practice-operation="multiply"]').click();
		await capture('collection');
		await page.locator('[data-practice-topic="multiply-table-2"]').click();
		if (viewport.width >= 800) {
			const prompt = await page.locator('#practice-screen [data-input-prompts]').boundingBox();
			if (!prompt) throw new Error('Practice input prompts are missing');
			expect(prompt.y + prompt.height).toBeLessThanOrEqual(viewport.height);
		}
		await capture('preview');
		await page.locator('[data-practice-change-pond]').click();
		await capture('pond');
		await page.locator('[data-practice-pond-done]').click();
		await page.locator('[data-practice-start]').click();
		await expect(page.locator('#game-canvas')).toBeVisible();
		await capture('gameplay');
		await page.locator('#pause-btn').click();
		await page.getByRole('button', { name: 'Quit to Menu', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Partial practice', exact: true })).toBeVisible();
		if (viewport.width >= 800) {
			const prompt = await page.locator('#practice-results-screen [data-input-prompts]').boundingBox();
			if (!prompt) throw new Error('Practice results prompts are missing');
			expect(prompt.y + prompt.height).toBeLessThanOrEqual(viewport.height);
		}
		await capture('results');
		await page.getByRole('button', { name: 'Main menu', exact: true }).click();
		await page.getByRole('button', { name: 'Arcade', exact: true }).click();
		await capture('arcade-math');
		await page.locator('[data-operation="add"]').click();
		await page.locator('[data-next-to-pond]').click();
		await capture('arcade-pond');
	});
}


test('Practice can be browsed and started with touch only', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
	try {
		const page = await context.newPage();
		await seedProfiles(page);
		await page.goto('/');
		await page.getByText('A game by').waitFor();
		await page.locator('#studioSplash').tap({ delay: 200 });
		await page.getByText('Built with').waitFor();
		await page.locator('#engineSplash').tap({ delay: 200 });
		await page.getByRole('button', { name: 'Practice', exact: true }).tap();
		await expect(page.locator('#practice-screen [data-input-prompts]')).toBeHidden();
		await page.locator('[data-practice-operation="add"]').tap();
		await page.locator('[data-practice-topic="add-make-5"]').tap();
		await page.locator('[data-practice-related]').tap();
		await expect(page.locator('[data-practice-related]')).toHaveAttribute('aria-pressed', 'true');
		await page.locator('[data-practice-start]').tap();
		await expect(page.locator('#game-canvas')).toBeVisible();
		await page.locator('#pause-btn').tap();
		await page.getByRole('button', { name: 'Quit to Menu', exact: true }).tap();
		await expect(page.getByRole('heading', { name: 'Partial practice', exact: true })).toBeVisible();
	} finally { await context.close(); }
});
