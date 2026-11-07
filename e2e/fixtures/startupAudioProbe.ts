import { expect } from 'playwright/test';
import type { Page } from 'playwright/test';

type StartupAudioProbe = {
	contexts: AudioContext[];
	contextAttempts: number;
	resumeAttempts: number;
	tones: number;
	constructorFailures: number;
	resumeFailures: number;
	buttons: { pressed: boolean; touched: boolean; value: number }[];
	axes: number[];
};

declare global {
	interface Window { startupAudioProbe: StartupAudioProbe; }
}

// Exercise real browser audio, with recoverable device failures injected at the API boundary.
export const installStartupAudioProbe = function(failures: { constructor: number; resume: number }): void {
	const probe: StartupAudioProbe = {
		contexts: [], contextAttempts: 0, resumeAttempts: 0, tones: 0,
		constructorFailures: failures.constructor, resumeFailures: failures.resume,
		buttons: Array.from({ length: 17 }, function() { return { pressed: false, touched: false, value: 0 }; }),
		axes: [0, 0, 0, 0],
	};
	window.startupAudioProbe = probe;
	class ProbedAudioContext extends AudioContext {
		constructor(options?: AudioContextOptions) {
			probe.contextAttempts += 1;
			if (probe.constructorFailures > 0) {
				probe.constructorFailures -= 1;
				throw new Error('Temporary audio device failure');
			}
			super(options);
			probe.contexts.push(this);
		}
		override resume(): Promise<void> {
			probe.resumeAttempts += 1;
			if (probe.resumeFailures > 0) {
				probe.resumeFailures -= 1;
				return Promise.reject(new Error('Temporary audio resume failure'));
			}
			return super.resume();
		}
		override createOscillator(): OscillatorNode {
			probe.tones += 1;
			return super.createOscillator();
		}
	}
	window.AudioContext = ProbedAudioContext;
	const gamepad = {
		id: 'Xbox startup audio controller', index: 0, connected: true, mapping: 'standard',
		timestamp: 0, buttons: probe.buttons, axes: probe.axes,
	};
	Object.defineProperty(navigator, 'getGamepads', { value: function() { return [gamepad]; } });
	const track = { currentStep: 1, highestUnlockedStep: 1 };
	localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [{
		id: 'audio-player', name: 'Player', learnerData: {
			mathProgress: { add: track, subtract: track, multiply: track, divide: track },
			onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' }, skitProgress: [],
		},
	}] }));
	localStorage.setItem('math-marsh.active-player-profile', 'audio-player');
};

export const openTitle = async function(page: Page, failures = { constructor: 0, resume: 0 }): Promise<void> {
	await page.addInitScript(installStartupAudioProbe, failures);
	await page.goto('/');
	await expect(page.locator('#main-menu')).toBeVisible({ timeout: 12_000 });
};
