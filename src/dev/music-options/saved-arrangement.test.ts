import { expect, test } from 'bun:test';
import { mixEvents, mixText, SECTION_STEPS } from './mixer';
import { savedMix, SAVED_ARRANGEMENT_TEXT } from './saved-arrangement';

test('saved arrangement restores the exact five-section owner selection', function(): void {
	const mix = savedMix();
	expect(mixText(mix)).toBe(SAVED_ARRANGEMENT_TEXT);
	expect(mix.sections).toBe(5);
	expect(mix.tempo).toBe('normal');
	expect(mix.tracks.filter(function(track): boolean { return track.clips.some(function(clip): boolean { return clip !== null; }); })).toEqual([
		{ id: 'bloom.harmony', level: 100, clips: [null, null, 'A', 'A', 'A'] },
		{ id: 'bloom.pluck', level: 100, clips: [null, null, 'A', 'A', null] },
		{ id: 'groove.harmony', level: 100, clips: [null, 'A', 'A', null, null] },
		{ id: 'groove.rhythm', level: 100, clips: ['A', 'A', 'A', null, null] },
	]);
	const events = mixEvents(mix);
	expect(events.filter(function(event): boolean { return event.layer === 'original'; })).toHaveLength(5 * SECTION_STEPS * 2.5);
	const layers = Array.from({ length: 5 }, function(_, section): readonly string[] {
		return Array.from(new Set(events.filter(function(event): boolean {
			return event.layer !== 'original' && event.step >= section * SECTION_STEPS && event.step < (section + 1) * SECTION_STEPS;
		}).map(function(event): string { return event.layer; }))).sort();
	});
	expect(layers).toEqual([['rhythm'], ['harmony', 'rhythm'], ['harmony', 'pluck', 'rhythm'], ['harmony', 'pluck'], ['harmony']]);
	expect(mixEvents(savedMix())).toEqual(events);
});
