import { expect, test } from 'playwright/test';
import { openTitle } from './fixtures/startupAudioProbe';

test.use({ launchOptions: { args: [
	'--autoplay-policy=document-user-activation-required',
	'--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies',
] } });

test.describe('browser gesture restrictions', function() {
	test('a pending startup resume schedules nothing and retries on a real gesture', async function({ page }) {
		await openTitle(page);
		expect(await page.evaluate(function() { return window.startupAudioProbe.contexts[0]?.state; })).toBe('suspended');
		expect(await page.evaluate(function() { return window.startupAudioProbe.resumeAttempts; })).toBe(1);
		expect(await page.evaluate(function() { return window.startupAudioProbe.tones; })).toBe(0);
		await page.keyboard.press('Shift');
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.contexts[0]?.state; }); }).toBe('running');
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(0);
		expect(await page.evaluate(function() { return window.startupAudioProbe.contexts.length; })).toBe(1);
	});

	test('rejected resume attempts leave later interactions available for recovery', async function({ page }) {
		const errors: string[] = [];
		page.on('pageerror', function(error) { errors.push(error.message); });
		await openTitle(page, { constructor: 0, resume: 2 });
		await page.keyboard.press('Shift');
		expect(await page.evaluate(function() { return window.startupAudioProbe.resumeAttempts; })).toBe(2);
		expect(await page.evaluate(function() { return window.startupAudioProbe.tones; })).toBe(0);
		await page.keyboard.press('Shift');
		await expect.poll(function() { return page.evaluate(function() { return window.startupAudioProbe.tones; }); }).toBeGreaterThan(0);
		expect(errors).toEqual([]);
	});
});
