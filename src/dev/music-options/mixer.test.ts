import { describe, expect, test } from 'bun:test';
import { audioKey, MAX_SECTIONS, mixEvents, mixText, moveSection, parseMixText, presetMix, resizeMix, SECTION_STEPS, setClip, setLevel, STEMS } from './mixer';
import type { Mix } from './mixer';
import { loopEvents, originalEvents } from './score';
import type { MusicEvent } from './score';

const canonical = function(events: readonly MusicEvent[]): readonly string[] {
	return events.map(function(event): string { return JSON.stringify({ ...event, step: Math.round(event.step * 1e6) / 1e6 }); }).sort();
};

describe('music timeline composition', function(): void {
	test('original presets retain every authored event without duplicating the background', function(): void {
		for (const source of ['original', 'bloom', 'groove', 'conversation'] as const) {
			expect(canonical(mixEvents(presetMix(source)))).toEqual(canonical(loopEvents(source)));
		}
	});
	test('later replies can be moved into the first section, independently of their original entry gate', function(): void {
		const source = presetMix('original');
		const moved = setClip(source, 'conversation.answer', 0, 'C');
		const events = mixEvents(moved);
		expect(events.some(function(event): boolean { return event.layer === 'answer' && event.step < SECTION_STEPS; })).toBe(true);
		expect(events.some(function(event): boolean { return event.layer !== 'original' && event.step >= SECTION_STEPS; })).toBe(false);
		expect(source.tracks.every(function(track): boolean { return track.clips.every(function(clip): boolean { return clip === null; }); })).toBe(true);
	});
	test('swapping sections moves all parts while preserving layer volumes and the source draft', function(): void {
		const source = setLevel(setClip(setClip(presetMix('original'), 'groove.pluck', 0, 'B'), 'conversation.answer', 1, 'D'), 'groove.pluck', 73);
		const moved = moveSection(source, 0, 1);
		expect(moved.tracks.find(function(track): boolean { return track.id === 'groove.pluck'; })).toEqual({ id: 'groove.pluck', level: 73, clips: [null, 'B', null, null] });
		expect(moved.tracks.find(function(track): boolean { return track.id === 'conversation.answer'; })?.clips).toEqual(['D', null, null, null]);
		expect(source.tracks.find(function(track): boolean { return track.id === 'groove.pluck'; })?.clips).toEqual(['B', null, null, null]);
	});
	test('muting and extending leave the original background continuous across every section', function(): void {
		const muted = STEMS.reduce(function(mix, stem): Mix { return setLevel(mix, stem.id, 0); }, presetMix());
		const longer = resizeMix(muted, MAX_SECTIONS);
		const expected = Array.from({ length: MAX_SECTIONS * SECTION_STEPS }, function(_, step): readonly MusicEvent[] { return originalEvents(step); }).flat();
		expect(canonical(mixEvents(longer))).toEqual(canonical(expected));
		expect(longer.tracks.every(function(track): boolean { return track.clips.slice(4).every(function(clip): boolean { return clip === null; }); })).toBe(true);
		expect(function(): Mix { return resizeMix(muted, MAX_SECTIONS + 1); }).toThrow();
	});
});

describe('plain text arrangement sharing', function(): void {
	test('text restores a cross-option mix, non-default levels, tempo, ordering, and notes', function(): void {
		const mixed = setLevel(setClip(setClip(presetMix(), 'groove.rhythm', 2, 'A'), 'conversation.answer', 3, 'D'), 'conversation.answer', 73);
		const named: Mix = { ...moveSection(resizeMix(mixed, 5), 2, 4), name: 'Pond mix 🐸', tempo: 'faster', notes: 'Keep the build-up.\nFinal answer: quieter, please.' };
		const text = mixText(named);
		expect(parseMixText(text)).toEqual(named);
		expect(mixText(parseMixText(text))).toBe(text);
		expect(audioKey({ ...named, name: 'Renamed', notes: 'Different notes' })).toBe(audioKey(named));
		expect(audioKey(setClip(named, 'groove.rhythm', 0, 'A'))).not.toBe(audioKey(named));
	});
	test('invalid text cannot silently change the baseline, timeline, clips, or volumes', function(): void {
		const valid = mixText(presetMix());
		const invalid = [
			valid.replace('mix v1', 'mix v2'),
			valid.replace('original (always on)', 'off'),
			valid.replace('sections: 4', 'sections: 200'),
			valid.replace('Gentle chords @100:', 'Gentle chords @151:'),
			valid.replace('Gentle chords @100:', 'Gentle chords @1.5:'),
			valid.replace('Gentle chords @100: A A A A', 'Gentle chords @100: A A Z A'),
			valid.replace('Gentle chords @100: A A A A', 'Gentle chords @100: A A'),
			`${valid}\nGentle chords @100: A A A A`,
			`${valid}\nUnknown layer @100: A A A A`,
		];
		invalid.forEach(function(text): void { expect(function(): Mix { return parseMixText(text); }).toThrow(); });
	});
});
