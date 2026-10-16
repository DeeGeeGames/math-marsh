export type ToneProbe = { at: number; frequency: number; type: OscillatorType; start: number; stop: number | null };
type NoiseProbe = { at: number; duration: number };
declare global {
	interface Window { musicProbe: { tones: ToneProbe[]; noises: NoiseProbe[] } }
}

// Record native Web Audio calls; no production clock or scheduler is replaced.
// This function is self-contained so Playwright can install it before page code.
export const installMusicProbe = function(): void {
	window.musicProbe = { tones: [], noises: [] };
	class ProbedAudioContext extends AudioContext {
		override createOscillator(): OscillatorNode {
			const node = super.createOscillator();
			const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
			const start = node.start.bind(node);
			const stop = node.stop.bind(node);
			let frequency = 440;
			let record: ToneProbe | undefined;
			node.frequency.setValueAtTime = function(value: number, time: number): AudioParam {
				frequency = value;
				return setFrequency(value, time);
			};
			node.start = function(when = 0): void {
				record = { at: Date.now(), frequency, type: node.type, start: when, stop: null };
				window.musicProbe.tones.push(record);
				start(when);
			};
			node.stop = function(when = 0): void { if (record) record.stop = when; stop(when); };
			return node;
		}
		override createBufferSource(): AudioBufferSourceNode {
			const node = super.createBufferSource();
			const start = node.start.bind(node);
			node.start = function(when = 0, offset = 0, duration?: number): void {
				window.musicProbe.noises.push({ at: Date.now(), duration: node.buffer?.duration ?? 0 });
				start(when, offset, duration);
			};
			return node;
		}
	}
	window.AudioContext = ProbedAudioContext;
};
