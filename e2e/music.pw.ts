import { expect, test } from 'playwright/test';
import { installMusicProbe } from './fixtures/musicProbe';
import type { ToneProbe } from './fixtures/musicProbe';
import { gameMusicEvents, GAME_NORMAL_INTERVAL_MS, INTRO_STEPS, GAME_MUSIC_LOOP_STEPS } from '../src/audio/musicScore';

const notes = function(probes: readonly ToneProbe[]): readonly string[] {
	return probes.map(function(probe): string {
		return `${probe.type}:${probe.frequency.toFixed(4)}:${((probe.stop ?? probe.start) - probe.start - 0.04).toFixed(4)}`;
	}).sort();
};
const expectedNotes = function(step: number, scale = 1): readonly string[] {
	return gameMusicEvents(step).flatMap(function(event): readonly string[] {
		return event.kind === 'tone' ? [`${event.type}:${(261.63 * 2 ** (event.note / 12)).toFixed(4)}:${(event.duration * scale).toFixed(4)}`] : [];
	}).sort();
};

test.beforeEach(async ({ page }) => { await page.addInitScript(installMusicProbe); });

test('native gameplay audio plays the approved opening, every section, and the repeat', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
	await page.goto('/music');
	await page.getByRole('button', { name: 'Play gameplay', exact: true }).click();
	await page.clock.runFor((INTRO_STEPS + GAME_MUSIC_LOOP_STEPS) * GAME_NORMAL_INTERVAL_MS);
	const probes = await page.evaluate(() => window.musicProbe.tones);
	const first = probes[0];
	if (!first) throw new Error('No gameplay audio was scheduled');
	for (let step = 0; step <= INTRO_STEPS + GAME_MUSIC_LOOP_STEPS; step += 1) {
		expect(notes(probes.filter(function(probe): boolean { return probe.at === first.at + step * GAME_NORMAL_INTERVAL_MS; })), `beat ${step}`).toEqual(expectedNotes(step));
	}
});

test('low-time warning, recovery, mute, and scene transitions preserve the music lifecycle', async ({ page }) => {
	await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
	await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
	await page.goto('/music');
	await page.getByRole('button', { name: 'Play gameplay', exact: true }).click();
	await page.clock.runFor(34 * GAME_NORMAL_INTERVAL_MS);
	await page.getByRole('button', { name: 'Low time', exact: true }).click();
	await page.clock.runFor(GAME_NORMAL_INTERVAL_MS);
	const warning = await page.evaluate(() => window.musicProbe.tones.filter(note => note.type === 'square'));
	expect(warning.map(function(note): number { return Math.round(12 * Math.log2(note.frequency / 261.63)); })).toEqual([7, 7, 6, 6, 0]);
	await page.clock.runFor(650);
	const bridge = await page.evaluate(() => window.musicProbe.tones);
	const resumed = bridge.at(-1);
	if (!resumed) throw new Error('Music did not resume after warning');
	expect(notes(bridge.filter(function(note): boolean { return note.at === resumed.at; }))).toEqual(expectedNotes(35, 1 / 1.2));
	await page.clock.runFor(359);
	const urgent = await page.evaluate(() => window.musicProbe);
	const next = urgent.tones.at(-1);
	if (!next) throw new Error('Missing urgent beat');
	expect(next.at - resumed.at).toBeCloseTo(GAME_NORMAL_INTERVAL_MS / 1.2, 0);
	expect(urgent.noises.some(function(noise): boolean { return noise.at === next.at && Math.abs(noise.duration - 0.055) < 0.00005; })).toBe(true);
	await page.getByRole('button', { name: 'Recover time', exact: true }).click();
	await page.clock.runFor(359 + GAME_NORMAL_INTERVAL_MS);
	const recovered = await page.evaluate(() => window.musicProbe.tones);
	const last = recovered.at(-1);
	if (!last) throw new Error('Missing recovered beat');
	expect(notes(recovered.filter(function(note): boolean { return note.at === last.at; }))).toEqual(expectedNotes(38));
	await page.getByRole('button', { name: 'Low time', exact: true }).click();
	await page.getByRole('button', { name: 'Recover time', exact: true }).click();
	await page.clock.runFor(GAME_NORMAL_INTERVAL_MS);
	expect(await page.evaluate(() => window.musicProbe.tones.filter(note => note.type === 'square').length)).toBe(5);
	await page.getByRole('button', { name: 'Low time', exact: true }).click();
	await page.getByRole('button', { name: 'Title', exact: true }).click();
	await page.clock.runFor(520);
	expect(await page.evaluate(() => window.musicProbe.tones.filter(note => note.type === 'square').length)).toBe(5);
	await page.getByRole('button', { name: 'Mute', exact: true }).click();
	const muted = await page.evaluate(() => window.musicProbe.tones.length);
	await page.clock.runFor(2_000);
	expect(await page.evaluate(() => window.musicProbe.tones.length)).toBe(muted);
	await page.getByRole('button', { name: 'Unmute', exact: true }).click();
	expect(await page.evaluate(() => window.musicProbe.tones.length)).toBeGreaterThan(muted);
});

test('starting a game through normal controls reaches the new pulse layer', async ({ page }) => {
	await page.addInitScript(() => {
		const track = { currentStep: 1, highestUnlockedStep: 1 };
		const profiles = [{ id: 'music-player', name: 'Player', learnerData: {
			mathProgress: { add: track, subtract: track, multiply: track, divide: track },
			onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' }, skitProgress: [],
		} }];
		localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles }));
		localStorage.setItem('math-marsh.active-player-profile', 'music-player');
	});
	await page.goto('/');
	await page.getByText('A game by').waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByText('Built with').waitFor();
	await page.keyboard.press('Space', { delay: 200 });
	await page.getByRole('button', { name: 'Start Game', exact: true }).click();
	await page.locator('[data-operation="add"]').click();
	await page.locator('[data-next-to-pond]').click();
	await page.locator('[data-difficulty="easy"]').click();
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.locator('#game-canvas').waitFor({ state: 'visible' });
	await page.waitForFunction(() => window.musicProbe.tones.some(note => note.type === 'sine' && Math.abs(note.frequency - 261.63 / 4) < 0.001), undefined, { timeout: 12_000 });
	await page.screenshot({ path: 'output/music-options/gameplay-with-approved-music.png' });
});
