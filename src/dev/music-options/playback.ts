import { BEAT_SECONDS, INTRO_STEPS } from './score';
import type { RenderedPreview } from './score';
import { audioKey, renderMix, SECTION_STEPS } from './mixer';
import type { Mix } from './mixer';

export type Position = Readonly<{ elapsed: number; position: number; total: number; section: number | null; label: string }>;
export type StartPoint = 'start' | 'layers' | 'seam' | number;

export const createPlayback = function(onPosition: (position: Position | null) => void, onStatus: (message: string) => void): {
	play: (mix: Mix, from: StartPoint, label?: string) => Promise<void>;
	stop: () => void;
	setVolume: (value: number) => void;
	dispose: () => void;
} {
	const cache = new Map<string, Promise<RenderedPreview>>();
	let context: AudioContext | undefined;
	let master: GainNode | undefined;
	let voice: GainNode | undefined;
	let sources: AudioBufferSourceNode[] = [];
	let generation = 0;
	let frame: number | undefined;
	let volume = 2;
	const stop = function(): void {
		generation += 1;
		sources.forEach(function(source): void { source.stop(); source.disconnect(); });
		sources = [];
		voice?.disconnect();
		voice = undefined;
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
		onPosition(null);
	};
	const play = async function(mix: Mix, from: StartPoint, label = mix.name): Promise<void> {
		stop();
		const token = generation;
		try {
			context ??= new AudioContext();
			const activeContext = context;
			if (!master) {
				master = activeContext.createGain();
				master.gain.value = volume;
				master.connect(activeContext.destination);
			}
			const destination = master;
			const resumed = activeContext.resume();
			onStatus(`Preparing ${label}…`);
			const key = audioKey(mix);
			let audio = cache.get(key);
			if (!audio) {
				audio = renderMix(mix);
				cache.set(key, audio);
				if (cache.size > 3) {
					const oldest = cache.keys().next().value;
					if (oldest !== undefined) cache.delete(oldest);
				}
				void audio.catch(function(): void { cache.delete(key); });
			}
			const [rendered] = await Promise.all([audio, resumed]);
			if (token !== generation) return;
			const intro = rendered.intro.duration;
			const loop = rendered.loop.duration;
			const beat = BEAT_SECONDS * (mix.tempo === 'faster' ? 1 / 1.2 : 1);
			const offset = typeof from === 'number' ? intro + from * SECTION_STEPS * beat : from === 'layers' ? intro - 3 * beat : from === 'seam' ? intro + loop - 6 * beat : 0;
			const starts = activeContext.currentTime + 0.035;
			voice = activeContext.createGain();
			voice.gain.value = 0;
			voice.gain.setValueAtTime(0, starts);
			voice.gain.linearRampToValueAtTime(1, starts + 0.012);
			voice.connect(destination);
			if (offset < intro) {
				const source = activeContext.createBufferSource();
				source.buffer = rendered.intro;
				source.connect(voice);
				source.start(starts, offset);
				sources.push(source);
			}
			const source = activeContext.createBufferSource();
			source.buffer = rendered.loop;
			source.loop = true;
			source.connect(voice);
			source.start(starts + Math.max(0, intro - offset), Math.max(0, offset - intro) % loop);
			sources.push(source);
			const update = function(): void {
				if (generation !== token) return;
				const elapsed = Math.max(0, activeContext.currentTime - starts) + offset;
				const inIntro = elapsed < intro;
				const position = inIntro ? elapsed : intro + (elapsed - intro) % loop;
				onPosition({ elapsed, position, total: intro + loop, section: inIntro ? null : Math.min(mix.sections - 1, Math.floor((position - intro) / (SECTION_STEPS * beat))), label });
				frame = requestAnimationFrame(update);
			};
			update();
		} catch (error) {
			if (token !== generation) return;
			stop();
			onStatus(error instanceof Error ? `Playback failed: ${error.message}` : 'Playback could not start');
			console.error(error);
		}
	};
	return {
		play, stop,
		setVolume: function(value): void {
			volume = value;
			if (context && master) master.gain.setTargetAtTime(value, context.currentTime, 0.025);
		},
		dispose: function(): void {
			stop();
			const closing = context;
			context = undefined;
			master = undefined;
			cache.clear();
			if (closing) void closing.close();
		},
	};
};

export const introSeconds = INTRO_STEPS * BEAT_SECONDS;
