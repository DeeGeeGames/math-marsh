import { expect, test } from 'playwright/test';
import { installStartupAudioProbe, openTitle } from './fixtures/startupAudioProbe';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test.describe('desktop autoplay', function() {
	test('silent logos lead to automatic title music, with no backlog after suspension', async function({ page }, testInfo) {
		await page.addInitScript(installStartupAudioProbe, { constructor: 0, resume: 0 });
		await page.addInitScript(function() {
			localStorage.setItem('math-marsh-audio-settings', JSON.stringify({ soundEffects: false, backgroundMusic: true }));
		});
		await page.goto('/');
		await expect(page.getByText('A game by')).toBeVisible();
		expect(await page.evaluate(function() { return window.startupAudioProbe.contexts.length; })).toBe(1);
		expect(await page.evaluate(function() { return window.startupAudioProbe.tones; })).toBe(0);
		await expect(page.locator('#main-menu')).toBeVisible({ timeout: 12_000 });
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(0);
		await page.screenshot({ path: testInfo.outputPath('automatic-title-audio.png') });
		await page.evaluate(async function() { await window.startupAudioProbe.contexts[0]?.suspend(); });
		const suspended = await page.evaluate(function() { return window.startupAudioProbe.tones; });
		await page.waitForTimeout(1_100);
		expect(await page.evaluate(function() { return window.startupAudioProbe.tones; })).toBe(suspended);
		await page.evaluate(async function() { await window.startupAudioProbe.contexts[0]?.resume(); });
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(suspended);
		expect(await page.evaluate(function() { return window.startupAudioProbe.contexts.length; })).toBe(1);
	});

	test('controller input recovers a failed startup without keyboard or pointer input', async function({ page }, testInfo) {
		const errors: string[] = [];
		page.on('pageerror', function(error) { errors.push(error.message); });
		await openTitle(page, { constructor: 1, resume: 0 });
		expect(await page.evaluate(function() { return window.startupAudioProbe.contexts.length; })).toBe(0);
		await page.evaluate(function() {
			const button = window.startupAudioProbe.buttons[0];
			if (button) { button.pressed = true; button.value = 1; }
		});
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(0);
		await page.evaluate(function() {
			const button = window.startupAudioProbe.buttons[0];
			if (button) { button.pressed = false; button.value = 0; }
		});
		await page.waitForTimeout(100);
		await page.evaluate(function() { window.startupAudioProbe.axes[1] = 1; });
		await expect(page.getByRole('button', { name: 'Practice', exact: true })).toBeFocused();
		expect(await page.evaluate(function() { return window.startupAudioProbe.contextAttempts; })).toBe(2);
		expect(errors).toEqual([]);
		await page.screenshot({ path: testInfo.outputPath('controller-title-audio.png') });
	});

	test('saved mute settings remain silent until music is enabled', async function({ page }) {
		await page.addInitScript(function() {
			localStorage.setItem('math-marsh-audio-settings', JSON.stringify({ soundEffects: false, backgroundMusic: false }));
		});
		await openTitle(page);
		expect(await page.evaluate(function() { return window.startupAudioProbe.contextAttempts; })).toBe(0);
		await page.getByRole('button', { name: 'Settings', exact: true }).click();
		expect(await page.evaluate(function() { return window.startupAudioProbe.tones; })).toBe(0);
		await page.locator('#background-music').check();
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(0);
	});
});
