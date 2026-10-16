// Pure note data shared by gameplay and the development mixer.
export const GAME_NORMAL_INTERVAL_MS = 430;
export const BEAT_SECONDS = GAME_NORMAL_INTERVAL_MS / 1_000;
export const INTRO_STEPS = 16;
export const LOOP_STEPS = 64;
export const GAME_MUSIC_SECTION_STEPS = 16;
// Approved mix: pulse; pulse + offbeats; all four; chords + plucks; chords.
const GAME_MUSIC_SECTIONS = [
	{ chords: false, plucks: false, offbeats: false, rhythm: true },
	{ chords: false, plucks: false, offbeats: true, rhythm: true },
	{ chords: true, plucks: true, offbeats: true, rhythm: true },
	{ chords: true, plucks: true, offbeats: false, rhythm: false },
	{ chords: true, plucks: false, offbeats: false, rhythm: false },
] as const;
export const GAME_MUSIC_LOOP_STEPS = GAME_MUSIC_SECTIONS.length * GAME_MUSIC_SECTION_STEPS;

export type Arrangement = 'original' | 'bloom' | 'groove' | 'conversation';
type Layer = 'original' | 'harmony' | 'pluck' | 'answer' | 'rhythm';
type Tone = Readonly<{
	kind: 'tone';
	layer: Layer;
	step: number;
	note: number;
	duration: number;
	volume: number;
	type: OscillatorType;
}>;
type Noise = Readonly<{
	kind: 'noise';
	layer: Layer;
	step: number;
	duration: number;
	volume: number;
	filterFrequency: number;
	filterType: BiquadFilterType;
}>;
export type MusicEvent = Tone | Noise;

const BASS = [-12, -7, -5, -10] as const;
const MELODY = [0, 3, 5, 7, 10, 7, 5, 3] as const;
// Cm7 / F9(no third) / Gm7 / Dm7. Eb in the final melody is a passing tone.
// Open voicings avoid thickening the original D/Eb tension at the turnaround.
const CHORDS = [[-9, -5, -2], [-7, 0, 3], [-5, -2, 2], [-10, -3, 0]] as const;
const PLUCKS = [[0, 7, 10, 7], [5, 7, 12, 7], [7, 10, 14, 10], [2, 5, 12, 7]] as const;
const ANSWERS = [
	[null, 19, null, 15, null, 17, null, 12],
	[null, 12, null, 19, null, 22, 19, 15],
	[null, 24, 22, 19, null, 17, null, 15],
	[null, 19, null, 17, null, 14, null, 12],
] as const;

const at = function<T>(values: readonly T[], index: number): T {
	const value = values[index % values.length];
	if (value === undefined) throw new Error('An audition sequence is empty');
	return value;
};

// Lift the accompaniment by 6 dB while preserving the original opening and bed.
const ACCOMPANIMENT_GAIN = 2;

const tone = function(layer: Layer, step: number, note: number, duration: number, volume: number, type: OscillatorType = 'triangle'): Tone {
	return { kind: 'tone', layer, step, note, duration, volume: volume * (layer === 'original' ? 1 : ACCOMPANIMENT_GAIN), type };
};

const noise = function(layer: Layer, step: number, duration: number, volume: number, filterFrequency: number, filterType: BiquadFilterType): Noise {
	return { kind: 'noise', layer, step, duration, volume: volume * (layer === 'original' ? 1 : ACCOMPANIMENT_GAIN), filterFrequency, filterType };
};

// Matches scheduleGameMusic in src/audio/audio.ts, including the 80 ms melody offset.
export const originalEvents = function(step: number): readonly MusicEvent[] {
	return [
		tone('original', step, at(BASS, Math.floor(step / 2)), 0.46, 0.03, 'sine'),
		tone('original', step + 0.08 / BEAT_SECONDS, at(MELODY, step) + 12, 0.16, 0.018),
		...(step % 2 === 0 ? [noise('original', step, 0.055, 0.012, 900, 'bandpass')] : []),
	];
};

const bloomEvents = function(step: number): readonly MusicEvent[] {
	const section = Math.floor(step / 16);
	const chord = at(CHORDS, Math.floor(step / 2));
	const sparse = section === 0 || (section === 3 && step % 16 >= 8);
	return [
		...(step % 2 === 0 ? chord.map(function(note): Tone {
			return tone('harmony', step, note, 0.74, 0.004, 'sine');
		}) : []),
		...(step % 2 === 1 ? [tone('pluck', step + 0.5, at(chord, section + Math.floor(step / 2)) + 12, 0.24, 0.008)] : []),
		...(!sparse && step % 4 === 3 ? [tone('answer', step + 0.5, at([19, 17, 22, 14], Math.floor(step / 4)), 0.32, 0.006, 'sine')] : []),
	];
};

const grooveEvents = function(step: number): readonly MusicEvent[] {
	const section = Math.floor(step / 16);
	const chord = at(CHORDS, Math.floor(step / 2));
	const active = section === 1 || section === 2;
	return [
		...(step % 2 === 1 ? chord.slice(1).map(function(note): Tone {
			return tone('harmony', step + 0.5, note + 12, 0.12, 0.005);
		}) : []),
		...(step % 4 === 0 ? [tone('rhythm', step, -24, 0.11, 0.012, 'sine')] : []),
		...(step % 4 === 2 ? [noise('rhythm', step, 0.045, 0.005, 1_600, 'bandpass')] : []),
		noise('rhythm', step + 0.5, 0.035, 0.003, 4_500, 'highpass'),
		...(active ? [tone('pluck', step + 0.75, at(at(PLUCKS, Math.floor(step / 2)), step + section), 0.1, 0.006)] : []),
		...(section === 2 && step % 8 === 7 ? [tone('answer', step + 0.5, 19, 0.18, 0.006, 'sine')] : []),
	];
};

const conversationEvents = function(step: number): readonly MusicEvent[] {
	const section = Math.floor(step / 16);
	const chord = at(CHORDS, Math.floor(step / 2));
	const answer = at(at(ANSWERS, section), step);
	const answering = section === 1 || section === 2 || step % 8 >= 4;
	return [
		...(step % 2 === 1 ? [tone('pluck', step + 0.5, at(chord, Math.floor(step / 2) + section) + 12, 0.19, 0.008)] : []),
		...(step % 4 === 0 ? chord.slice(1).map(function(note): Tone {
			return tone('harmony', step, note, 0.95, 0.0035, 'sine');
		}) : []),
		...(answering && answer !== null ? [tone('answer', step + 0.52, answer, 0.27, 0.009, 'sine')] : []),
		...(section === 2 && step % 2 === 1 ? [noise('rhythm', step + 0.5, 0.03, 0.003, 3_600, 'highpass')] : []),
	];
};

export const loopEvents = function(arrangement: Arrangement): readonly MusicEvent[] {
	return Array.from({ length: LOOP_STEPS }, function(_, step): readonly MusicEvent[] {
		const original = originalEvents(step);
		if (arrangement === 'original') return original;
		if (arrangement === 'bloom') return [...original, ...bloomEvents(step)];
		if (arrangement === 'groove') return [...original, ...grooveEvents(step)];
		return [...original, ...conversationEvents(step)];
	}).flat();
};

// A scene starts with two bare cycles once. Thereafter only the five-section
// body repeats; original notes continue at the same bass/melody phase.
export const gameMusicEvents = function(step: number): readonly MusicEvent[] {
	const baseline = originalEvents(step);
	if (step < INTRO_STEPS) return baseline;
	const bodyStep = (step - INTRO_STEPS) % GAME_MUSIC_LOOP_STEPS;
	const section = GAME_MUSIC_SECTIONS[Math.floor(bodyStep / GAME_MUSIC_SECTION_STEPS)];
	if (!section) throw new Error('Missing gameplay music section');
	const phraseStep = bodyStep % GAME_MUSIC_SECTION_STEPS;
	const additions = [
		...bloomEvents(phraseStep).filter(function(event): boolean {
			return event.layer === 'harmony' && section.chords || event.layer === 'pluck' && section.plucks;
		}),
		...grooveEvents(phraseStep).filter(function(event): boolean {
			return event.layer === 'harmony' && section.offbeats || event.layer === 'rhythm' && section.rhythm;
		}),
	];
	return [...baseline, ...additions.map(function(event): MusicEvent {
		return { ...event, step: step + event.step - phraseStep };
	})];
};
