import { expect, test, type Page } from 'playwright/test';

const openPreview = async function(page: Page): Promise<void> {
	await page.goto('/partial-selection');
	await expect(page.locator('#reset')).toBeEnabled();
	await expect(page.locator('#status')).toContainText('settled');
	await page.locator('#sound').uncheck();
	await page.locator('#slow').check();
};

const resetBoard = async function(page: Page): Promise<void> {
	await page.locator('#reset').click();
	await expect(page.locator('#status')).toContainText('Ready');
	await expect(page.locator('#status')).toContainText('Tile 1,1 settled');
};

const tapPad = async function(page: Page, column: number, row = 0, touch = false): Promise<void> {
	const canvas = page.locator('#game-canvas');
	const point = await canvas.evaluate(function(element, cell): { x: number; y: number } {
		const rect = element.getBoundingClientRect();
		return { x: (cell.left + (cell.column + 0.5) * cell.size) * rect.width / element.width,
			y: (cell.top + (cell.row + 0.5) * cell.size) * rect.height / element.height };
	}, { column, row, size: 106, left: 20, top: 69 });
	const arrived = `Tile ${column + 1},${row + 1} settled`;
	const alreadyThere = (await page.locator('#status').innerText()).includes(arrived);
	const tap = async function(): Promise<void> {
		if (touch) await canvas.tap({ position: point });
		else await canvas.click({ position: point });
	};
	await tap();
	if (!alreadyThere) {
		await expect(page.locator('#status')).toContainText(arrived);
		await tap();
	}
};

const nextFrameNumbers = async function(page: Page) {
	return page.locator('#game-canvas').evaluate(async function(canvas) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Missing canvas context');
		const original = ctx.fillText;
		const values: Array<{ text: string; color: string; x: number; y: number; scale: number; alpha: number }> = [];
		ctx.fillText = function(text, x, y, maxWidth): void {
			const matrix = ctx.getTransform();
			values.push({ text, color: String(ctx.fillStyle),
				x: matrix.a * x + matrix.c * y + matrix.e,
				y: matrix.b * x + matrix.d * y + matrix.f, scale: matrix.a, alpha: ctx.globalAlpha });
			if (maxWidth === undefined) original.call(ctx, text, x, y);
			else original.call(ctx, text, x, y, maxWidth);
		};
		try { await new Promise<void>(resolve => requestAnimationFrame(function(): void { resolve(); })); }
		finally { ctx.fillText = original; }
		return values;
	});
};

test('keyboard and pointer selection share feedback; final answers and disruption take over', async ({ page }, testInfo) => {
	await openPreview(page);
	const status = page.locator('#status');
	await page.locator('#game-canvas').focus();
	await page.keyboard.press('Space', { delay: 60 });
	await expect(status).toContainText('8 - _ = 5 · Partial selection');
	let numbers = await nextFrameNumbers(page);
	expect(numbers.filter(value => value.color === '#e0f2fe' && value.y < 90).map(value => value.text)).toEqual(['8']);
	await page.screenshot({ path: testInfo.outputPath('first-selection.png') });
	await page.locator('#pause').click();
	await expect(status).toContainText('Paused.');
	const pausedCanvas = await page.locator('#game-canvas').screenshot();
	await page.waitForTimeout(350);
	expect(await page.locator('#game-canvas').screenshot()).toEqual(pausedCanvas);
	await page.locator('#pause').click();
	await page.keyboard.press('Space', { delay: 60 });
	await expect(status).toContainText('_ - _ = 5 · Ready');
	await tapPad(page, 0);
	await expect(status).toContainText('8 - _ = 5 · Partial selection');
	await page.locator('#disrupt').click();
	await expect(status).toContainText('_ - _ = 5 · Ready');
	numbers = await nextFrameNumbers(page);
	expect(numbers.filter(value => value.color === '#e0f2fe' && value.y < 90)).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('disrupted.png') });
	await resetBoard(page);
	await tapPad(page, 0);
	await expect(status).toContainText('Partial selection');
	await tapPad(page, 1);
	await expect(status).toContainText('correct · 1 solved');
	await page.screenshot({ path: testInfo.outputPath('correct.png') });
	await resetBoard(page);
	await tapPad(page, 0);
	await expect(status).toContainText('Partial selection');
	await tapPad(page, 0, 1);
	await expect(status).toContainText('incorrect · 0 solved');
	await page.screenshot({ path: testInfo.outputPath('incorrect.png') });
});

test('mixed prompt animates the selected operand slot, including a duplicate of the fixed operand', async ({ page }, testInfo) => {
	await openPreview(page);
	await page.locator('#mode').selectOption('selectOperandAndResult');
	await tapPad(page, 0);
	await expect(page.locator('#status')).toContainText('8 - 8 = _ · Partial selection');
	const numbers = await nextFrameNumbers(page);
	const blueSlot = numbers.filter(value => value.color === '#e0f2fe' && value.y < 90);
	expect(blueSlot.map(value => value.text)).toEqual(['8']);
	expect(blueSlot[0]?.x).toBeGreaterThan(60);
	expect(numbers.some(value => value.text === '8 - ' && value.x < 30 && value.color === '#fff7c6')).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('duplicate-operand.png') });
	// Provisional styling persists after the transient effect and its state expire.
	await page.locator('#slow').uncheck();
	await page.waitForTimeout(350);
	const settledNumbers = await nextFrameNumbers(page);
	const provisional = settledNumbers.find(value => value.text === '8' && value.y < 90 && value.x > 60);
	expect(provisional?.alpha).toBeCloseTo(0.62);
	expect(provisional?.scale).toBe(1);
	expect(settledNumbers.find(value => value.text === '8 - ')?.alpha).toBe(1);
	await page.screenshot({ path: testInfo.outputPath('provisional-after-pop.png') });
	await page.locator('#slow').check();
	await resetBoard(page);
	await tapPad(page, 1);
	await expect(page.locator('#status')).toContainText('8 - 3 = _ · Partial selection');
	await tapPad(page, 2);
	await expect(page.locator('#status')).toContainText('correct · 1 solved');
	await resetBoard(page);
	await tapPad(page, 1);
	await expect(page.locator('#status')).toContainText('Partial selection');
	await tapPad(page, 0);
	await expect(page.locator('#status')).toContainText('incorrect · 0 solved');
});

test('small touch screen and reduced motion keep a stationary acknowledgment and readable slots', async ({ browser }, testInfo) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
	const page = await context.newPage();
	try {
		await openPreview(page);
		await tapPad(page, 0, 0, true);
		await expect(page.locator('#status')).toContainText('Partial selection');
		const numbers = await nextFrameNumbers(page);
		const blueSlot = numbers.find(value => value.color === '#e0f2fe' && value.y < 90);
		expect(blueSlot?.scale).toBe(1);
		const selectedPad = numbers.find(value => value.text === '8' && value.color === '#e0f2fe' && value.y > 90);
		expect(selectedPad).toBeDefined();
		await page.screenshot({ path: testInfo.outputPath('mobile-reduced-motion.png') });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	} finally { await context.close(); }
});


test('a polled gamepad selects through the same feedback path', async ({ page }) => {
	await page.addInitScript(function(): void {
		const button = { pressed: false, touched: false, value: 0 };
		const gamepad = { id: 'Partial selection test pad', index: 0, connected: true, mapping: 'standard',
			timestamp: 0, axes: [0, 0, 0, 0], buttons: [button] };
		Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: function() { return [gamepad]; } });
		window.addEventListener('message', function(event: MessageEvent<unknown>): void {
			if (event.data === 'partial-selection-pad-down') { button.pressed = true; button.value = 1; }
			if (event.data === 'partial-selection-pad-up') { button.pressed = false; button.value = 0; }
		});
	});
	await openPreview(page);
	const press = async function(): Promise<void> {
		await page.evaluate(() => window.postMessage('partial-selection-pad-down', '*'));
		await page.waitForTimeout(100);
		await page.evaluate(() => window.postMessage('partial-selection-pad-up', '*'));
		await page.waitForTimeout(100);
	};
	// The initial press claims the controller; release clears the neutral gate.
	await press();
	await press();
	await expect(page.locator('#status')).toContainText('8 - _ = 5 · Partial selection');
	const numbers = await nextFrameNumbers(page);
	expect(numbers.some(value => value.text === '8' && value.color === '#e0f2fe' && value.y < 90)).toBe(true);
});
