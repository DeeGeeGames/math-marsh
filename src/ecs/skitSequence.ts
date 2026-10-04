// One intermission after level three. Later skits can extend this schedule.
export const shouldPlaySkit = function(completedLevel: number): boolean {
	return completedLevel === 3;
};

export const SKIT_DURATION_SECONDS = 12;
const clamp = function(value: number): number { return Math.max(0, Math.min(1, value)); };

export type SkitPresentation = {
	flyX: number; flyY: number; frogTilt: number; tongueReach: number;
	padX: number; padY: number; padCaught: boolean; mouthOpen: boolean; flyFrame: number; caption: string;
};

export const skitPresentation = function(elapsed: number, reducedMotion = false): SkitPresentation {
	const dodge = clamp((elapsed - 4) / 0.45);
	const retract = clamp((elapsed - 5.1) / 0.7);
	const exit = clamp((elapsed - 9) / 1.3);
	const reach = clamp((elapsed - 3.6) / 0.4) * (1 - retract);
	return {
		flyX: 66 + exit * 46,
		flyY: 55 - dodge * 28 + (reducedMotion ? 0 : Math.sin(elapsed * 5) * 1.2),
		frogTilt: reducedMotion || elapsed < 6 || elapsed > 7 ? 0 : Math.sin((elapsed - 6) * Math.PI * 8) * 5,
		tongueReach: reach,
		padX: 66 - retract * 39,
		padY: 63 - retract * 2,
		padCaught: elapsed >= 5.1,
		mouthOpen: elapsed >= 3.3 && elapsed < 8,
		flyFrame: reducedMotion ? 0 : Math.floor(elapsed * 24) % 8,
		caption: elapsed < 3.3 ? 'Frog: “Snack time!”'
			: elapsed < 5.8 ? 'Fly: “Missed me!”'
			: elapsed < 8.5 ? 'Frog: “Why does this taste like salad?”'
			: 'Fly: “You should try the numbers!”',
	};
};
