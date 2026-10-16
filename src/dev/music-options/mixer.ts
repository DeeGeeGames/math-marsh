import { loopEvents, originalEvents, renderEvents } from './score';
import type { Arrangement, MusicEvent, RenderedPreview } from './score';

export const SECTION_STEPS = 16;
export const MIN_SECTIONS = 2;
export const MAX_SECTIONS = 8;
const PATTERN_IDS = ['A', 'B', 'C', 'D'] as const;
export type PatternId = typeof PATTERN_IDS[number];
type Source = Exclude<Arrangement, 'original'>;
type AddedLayer = Exclude<MusicEvent['layer'], 'original'>;

const DEFINITIONS = [
	{ id: 'bloom.harmony', name: 'Gentle chords', source: 'bloom', layer: 'harmony' },
	{ id: 'bloom.pluck', name: 'Wooden plucks', source: 'bloom', layer: 'pluck' },
	{ id: 'bloom.answer', name: 'High replies', source: 'bloom', layer: 'answer' },
	{ id: 'groove.harmony', name: 'Offbeat chords', source: 'groove', layer: 'harmony' },
	{ id: 'groove.rhythm', name: 'Pulse & shaker', source: 'groove', layer: 'rhythm' },
	{ id: 'groove.pluck', name: 'Moving plucks', source: 'groove', layer: 'pluck' },
	{ id: 'groove.answer', name: 'Little chime', source: 'groove', layer: 'answer' },
	{ id: 'conversation.harmony', name: 'Soft chords', source: 'conversation', layer: 'harmony' },
	{ id: 'conversation.pluck', name: 'Light plucks', source: 'conversation', layer: 'pluck' },
	{ id: 'conversation.answer', name: 'Answer melody', source: 'conversation', layer: 'answer' },
	{ id: 'conversation.rhythm', name: 'Extra shaker', source: 'conversation', layer: 'rhythm' },
] as const satisfies readonly { id: string; name: string; source: Source; layer: AddedLayer }[];

export type StemId = typeof DEFINITIONS[number]['id'];
type Pattern = Readonly<{ id: PatternId; name: string; events: readonly MusicEvent[] }>;
type Stem = typeof DEFINITIONS[number] & Readonly<{ patterns: readonly Pattern[]; original: readonly (PatternId | null)[] }>;
export type MixTrack = Readonly<{ id: StemId; level: number; clips: readonly (PatternId | null)[] }>;
export type Mix = Readonly<{
	name: string;
	tempo: 'normal' | 'faster';
	sections: number;
	tracks: readonly MixTrack[];
	notes: string;
}>;

const patternName = function(id: StemId, pattern: PatternId): string {
	if (id === 'conversation.answer') {
		if (pattern === 'A') return 'A · Sparse';
		if (pattern === 'B') return 'B · Rising';
		if (pattern === 'C') return 'C · High';
		return 'D · Resolving';
	}
	if (id === 'bloom.answer') return pattern === 'D' ? 'D · Short replies' : 'B · Full replies';
	if (id === 'groove.pluck') return pattern === 'B' ? 'B · Bouncing' : 'C · Rolling';
	return `${pattern} · Main`;
};

// Deduplicate identical phrases and omit silent ones. Any available phrase can
// be moved into any destination section without inheriting its old entry gate.
export const STEMS: readonly Stem[] = DEFINITIONS.map(function(definition): Stem {
	const events = loopEvents(definition.source).filter(function(event): boolean { return event.layer === definition.layer; });
	const patterns: Pattern[] = [];
	const keys: string[] = [];
	const original = PATTERN_IDS.map(function(id, section): PatternId | null {
		const start = section * SECTION_STEPS;
		const phrase = events.filter(function(event): boolean { return event.step >= start && event.step < start + SECTION_STEPS; }).map(function(event): MusicEvent {
			return { ...event, step: Math.round((event.step - start) * 1e9) / 1e9 };
		});
		if (phrase.length === 0) return null;
		const key = JSON.stringify(phrase);
		const existing = keys.indexOf(key);
		if (existing !== -1) {
			const found = patterns[existing];
			if (!found) throw new Error('Missing phrase');
			return found.id;
		}
		keys.push(key);
		patterns.push({ id, name: patternName(definition.id, id), events: phrase });
		return id;
	});
	return { ...definition, patterns, original };
});

export const presetMix = function(source: Arrangement = 'bloom'): Mix {
	return {
		name: source === 'original' ? 'My mix' : source === 'bloom' ? 'Gentle bloom' : source === 'groove' ? 'Pond groove' : 'Call & response',
		tempo: 'normal', sections: 4, notes: '',
		tracks: STEMS.map(function(stem): MixTrack {
			return { id: stem.id, level: 100, clips: stem.original.map(function(pattern): PatternId | null { return stem.source === source ? pattern : null; }) };
		}),
	};
};

export const setClip = function(mix: Mix, id: StemId, section: number, pattern: PatternId | null): Mix {
	return { ...mix, tracks: mix.tracks.map(function(track): MixTrack {
		return track.id === id ? { ...track, clips: track.clips.map(function(clip, index): PatternId | null { return index === section ? pattern : clip; }) } : track;
	}) };
};

export const setLevel = function(mix: Mix, id: StemId, level: number): Mix {
	return { ...mix, tracks: mix.tracks.map(function(track): MixTrack { return track.id === id ? { ...track, level } : track; }) };
};

export const resizeMix = function(mix: Mix, sections: number): Mix {
	if (!Number.isInteger(sections) || sections < MIN_SECTIONS || sections > MAX_SECTIONS) throw new Error('Choose 2–8 sections');
	return { ...mix, sections, tracks: mix.tracks.map(function(track): MixTrack {
		return { ...track, clips: Array.from({ length: sections }, function(_, index): PatternId | null { return track.clips[index] ?? null; }) };
	}) };
};

export const moveSection = function(mix: Mix, from: number, to: number): Mix {
	if (from < 0 || to < 0 || from >= mix.sections || to >= mix.sections) return mix;
	return { ...mix, tracks: mix.tracks.map(function(track): MixTrack {
		return { ...track, clips: track.clips.map(function(clip, index): PatternId | null {
			if (index === to) return track.clips[from] ?? null;
			if (index === from) return track.clips[to] ?? null;
			return clip;
		}) };
	}) };
};

export const mixEvents = function(mix: Mix): readonly MusicEvent[] {
	const baseline = Array.from({ length: mix.sections * SECTION_STEPS }, function(_, step): readonly MusicEvent[] { return originalEvents(step); }).flat();
	const added = mix.tracks.flatMap(function(track): readonly MusicEvent[] {
		const stem = STEMS.find(function(value): boolean { return value.id === track.id; });
		if (!stem || track.level === 0) return [];
		return track.clips.flatMap(function(id, section): readonly MusicEvent[] {
			if (id === null) return [];
			const pattern = stem.patterns.find(function(value): boolean { return value.id === id; });
			if (!pattern) throw new Error(`Unknown pattern for ${stem.name}`);
			return pattern.events.map(function(event): MusicEvent {
				return { ...event, step: section * SECTION_STEPS + event.step, volume: event.volume * (track.level / 100) };
			});
		});
	});
	return [...baseline, ...added];
};

export const renderMix = function(mix: Mix): Promise<RenderedPreview> {
	return renderEvents(mixEvents(mix), mix.sections * SECTION_STEPS, mix.tempo === 'faster');
};

export const audioKey = function(mix: Mix): string {
	return JSON.stringify({ tempo: mix.tempo, sections: mix.sections, tracks: mix.tracks });
};

export const mixText = function(mix: Mix): string {
	return [
		'Math Marsh mix v1', `name: ${mix.name}`, `tempo: ${mix.tempo}`,
		'opening-cycles: 2', 'section-cycles: 2', `sections: ${mix.sections}`,
		'background: original (always on)',
		...mix.tracks.map(function(track): string {
			const stem = STEMS.find(function(value): boolean { return value.id === track.id; });
			if (!stem) throw new Error('Unknown layer');
			return `${stem.name} @${track.level}: ${track.clips.map(function(clip): string { return clip ?? '-'; }).join(' ')}`;
		}),
		...mix.notes.split('\n').map(function(note): string { return `note: ${note}`; }),
	].join('\n');
};

export const parseMixText = function(text: string): Mix {
	if (text.length > 8_000) throw new Error('Arrangement text is too long');
	const lines = text.trim().split(/\r?\n/);
	if (lines.shift() !== 'Math Marsh mix v1') throw new Error('Expected “Math Marsh mix v1” on the first line');
	const fields = new Map<string, string>();
	const notes: string[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		const colon = line.indexOf(':');
		if (colon === -1) throw new Error(`Missing colon: ${line}`);
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		if (key === 'note') { notes.push(value); continue; }
		if (fields.has(key)) throw new Error(`Repeated field: ${key}`);
		fields.set(key, value);
	}
	const take = function(key: string): string {
		const value = fields.get(key);
		if (value === undefined) throw new Error(`Missing field: ${key}`);
		fields.delete(key);
		return value;
	};
	const name = take('name');
	if (name.length < 1 || name.length > 80) throw new Error('Mix name must have 1–80 characters');
	const tempo = take('tempo');
	if (tempo !== 'normal' && tempo !== 'faster') throw new Error('Tempo must be normal or faster');
	if (take('opening-cycles') !== '2' || take('section-cycles') !== '2') throw new Error('Opening and section size must each be 2 cycles');
	if (take('background') !== 'original (always on)') throw new Error('The original background must stay on');
	const count = take('sections');
	if (!/^[2-8]$/.test(count)) throw new Error('Choose 2–8 sections');
	const sections = Number(count);
	const tracks = STEMS.map(function(stem): MixTrack {
		const matching = Array.from(fields.keys()).filter(function(key): boolean { return key.startsWith(`${stem.name} @`); });
		if (matching.length !== 1) throw new Error(`Expected one row for ${stem.name}`);
		const key = matching[0];
		if (key === undefined) throw new Error('Missing layer row');
		const levelText = key.slice(stem.name.length + 2);
		if (!/^(0|[1-9]\d{0,2})$/.test(levelText)) throw new Error(`Invalid volume for ${stem.name}`);
		const level = Number(levelText);
		if (level > 150) throw new Error(`Volume for ${stem.name} must be 0–150`);
		const values = take(key).split(/\s+/);
		if (values.length !== sections) throw new Error(`${stem.name} needs ${sections} columns`);
		const clips = values.map(function(value): PatternId | null {
			if (value === '-') return null;
			const pattern = stem.patterns.find(function(candidate): boolean { return candidate.id === value; });
			if (!pattern) throw new Error(`Unknown pattern “${value}” for ${stem.name}`);
			return pattern.id;
		});
		return { id: stem.id, level, clips };
	});
	if (fields.size > 0) throw new Error(`Unknown field: ${fields.keys().next().value}`);
	const note = notes.join('\n');
	if (note.length > 1_000) throw new Error('Notes must fit within 1,000 characters');
	return { name, tempo, sections, tracks, notes: note };
};
