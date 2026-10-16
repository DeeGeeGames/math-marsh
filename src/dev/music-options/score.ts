import { BEAT_SECONDS, INTRO_STEPS, LOOP_STEPS, loopEvents, originalEvents } from '../../audio/musicScore';
import type { Arrangement, MusicEvent } from '../../audio/musicScore';
export { BEAT_SECONDS, INTRO_STEPS, LOOP_STEPS, loopEvents, originalEvents } from '../../audio/musicScore';
export type { Arrangement, MusicEvent } from '../../audio/musicScore';

export const SAMPLE_RATE = 48_000;

const scheduleEvent = function(context: OfflineAudioContext, master: GainNode, event: MusicEvent, offset: number, tempo: number): void {
	const start = offset + event.step * BEAT_SECONDS * tempo;
	const duration = event.duration * (event.kind === 'noise' && event.layer === 'original' ? 1 : tempo);
	const gain = context.createGain();
	gain.gain.value = 0.0001;
	gain.connect(master);
	const attack = event.kind === 'noise' ? 0.006 : Math.min(0.018, duration * 0.25);
	const decay = event.kind === 'noise' ? duration : Math.max(0.04, duration);
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(event.volume, start + attack);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
	if (event.kind === 'tone') {
		const source = context.createOscillator();
		source.type = event.type;
		source.frequency.setValueAtTime(261.63 * 2 ** (event.note / 12), start);
		source.connect(gain);
		source.start(start);
		source.stop(start + duration + 0.04);
		return;
	}
	const buffer = context.createBuffer(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
	const samples = buffer.getChannelData(0);
	// Repeatable percussion makes baseline comparisons and loop checks reproducible.
	let seed = (Math.floor(event.step * 100) % 800 + 1) * 7_919;
	for (let i = 0; i < samples.length; i += 1) {
		seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
		samples[i] = seed / 2 ** 31 - 1;
	}
	const source = context.createBufferSource();
	const filter = context.createBiquadFilter();
	filter.type = event.filterType;
	filter.frequency.setValueAtTime(event.filterFrequency, start);
	source.buffer = buffer;
	source.connect(filter);
	filter.connect(gain);
	source.start(start);
};

export type RenderedPreview = Readonly<{
	intro: AudioBuffer;
	loop: AudioBuffer;
}>;

export const renderEvents = async function(events: readonly MusicEvent[], loopSteps: number, urgent = false): Promise<RenderedPreview> {
	const tempo = urgent ? 1 / 1.2 : 1;
	const introFrames = Math.round(INTRO_STEPS * BEAT_SECONDS * tempo * SAMPLE_RATE);
	const loopFrames = Math.round(loopSteps * BEAT_SECONDS * tempo * SAMPLE_RATE);
	const render = async function(intro: boolean): Promise<AudioBuffer> {
		const frames = intro ? introFrames : loopFrames * 2;
		const context = new OfflineAudioContext(1, frames, SAMPLE_RATE);
		const master = context.createGain();
		master.gain.value = 0.46;
		master.connect(context.destination);
		if (intro) {
			Array.from({ length: INTRO_STEPS }, function(_, step): void {
				originalEvents(step).forEach(function(event): void { scheduleEvent(context, master, event, 0, tempo); });
			});
		} else {
			// Render a complete warm-up cycle so sustained tails survive the loop seam.
			[0, loopFrames / SAMPLE_RATE].forEach(function(offset): void {
				events.forEach(function(event): void { scheduleEvent(context, master, event, offset, tempo); });
			});
		}
		const rendered = await context.startRendering();
		if (intro) return rendered;
		const loop = new AudioBuffer({ numberOfChannels: 1, length: loopFrames, sampleRate: SAMPLE_RATE });
		loop.copyToChannel(rendered.getChannelData(0).subarray(loopFrames), 0);
		return loop;
	};
	const [intro, loop] = await Promise.all([render(true), render(false)]);
	return { intro, loop };
};

export const renderPreview = function(arrangement: Arrangement, urgent = false): Promise<RenderedPreview> {
	return renderEvents(loopEvents(arrangement), LOOP_STEPS, urgent);
};
