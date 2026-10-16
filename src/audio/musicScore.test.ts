import { expect, test } from 'bun:test';
import { gameMusicEvents, GAME_MUSIC_LOOP_STEPS, INTRO_STEPS, originalEvents } from './musicScore';
import type { MusicEvent } from './musicScore';
import { mixEvents } from '../dev/music-options/mixer';
import { savedMix } from '../dev/music-options/saved-arrangement';

const canonical = function(events: readonly MusicEvent[], offset: number): readonly string[] {
	return events.map(function(event): string {
		return JSON.stringify({ ...event, step: Math.round((event.step - offset) * 1e9) / 1e9 });
	}).sort();
};

test('gameplay preserves the original two-cycle introduction exactly', function(): void {
	for (let step = 0; step < INTRO_STEPS; step += 1) expect(gameMusicEvents(step)).toEqual(originalEvents(step));
	expect(originalEvents(0)).toEqual([
		{ kind: 'tone', layer: 'original', step: 0, note: -12, duration: 0.46, volume: 0.03, type: 'sine' },
		{ kind: 'tone', layer: 'original', step: 0.08 / 0.43, note: 12, duration: 0.16, volume: 0.018, type: 'triangle' },
		{ kind: 'noise', layer: 'original', step: 0, duration: 0.055, volume: 0.012, filterFrequency: 900, filterType: 'bandpass' },
	]);
});

test('every note in three gameplay loops matches the owner recipe without replaying the bare introduction', function(): void {
	const approved = mixEvents(savedMix());
	expect(GAME_MUSIC_LOOP_STEPS).toBe(80);
	for (let loop = 0; loop < 3; loop += 1) {
		for (let bodyStep = 0; bodyStep < GAME_MUSIC_LOOP_STEPS; bodyStep += 1) {
			const step = INTRO_STEPS + loop * GAME_MUSIC_LOOP_STEPS + bodyStep;
			const expected = approved.filter(function(event): boolean { return Math.floor(event.step) === bodyStep; });
			expect(canonical(gameMusicEvents(step), step)).toEqual(canonical(expected, bodyStep));
		}
	}
});
