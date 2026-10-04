import { ADDITIONAL_SKIT_DURATION_SECONDS, shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation } from './additionalSkits';

export const shouldPlaySkit = function(completedLevel: number): boolean {
	return skitForCompletedLevel(completedLevel) !== undefined;
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
			: 'Fly: “One extra-green lunch!”',
	};
};

// Add each playable scene here; the intermission schedule and gallery share it.
export const SKITS = [{
	id: 'snack-break',
	title: 'Snack Break',
	completedLevel: 3,
	durationSeconds: SKIT_DURATION_SECONDS,
	presentation: skitPresentation,
	stageLabel: 'A frog tries to catch a fly, but catches a lily pad instead. The fly escapes.',
}, {
	id: 'the-shortcut', title: 'The Shortcut', completedLevel: 6,
	durationSeconds: ADDITIONAL_SKIT_DURATION_SECONDS, presentation: shortcutPresentation,
	stageLabel: 'Lizard tries a big jump, splashes into the pond, then pops up wearing a lily pad. Fly calls him a lily pad with toes.',
}, {
	id: 'do-not-disturb', title: 'Do Not Disturb', completedLevel: 9,
	durationSeconds: ADDITIONAL_SKIT_DURATION_SECONDS, presentation: doNotDisturbPresentation,
	stageLabel: 'Spider settles down for a nap. Fly plucks the web like a harp. Spider bounces, enjoys the wiggles, and asks for another bouncy lullaby.',
}, {
	id: 'dinner-committee', title: 'Dinner Committee', completedLevel: 12,
	durationSeconds: ADDITIONAL_SKIT_DURATION_SECONDS, presentation: dinnerCommitteePresentation,
	stageLabel: 'Fly points to the middle of the snack team’s map. Frog, Spider, and Lizard bump together, then spread out. Frog catches a leaf, and Fly suggests a salad picnic.',
}] as const;

export type Skit = (typeof SKITS)[number];
export type SkitId = Skit['id'];
export type SkitScreenConfig =
	| { nextLevel: number; skitId?: SkitId; replay?: false }
	| { replay: true; skitId: SkitId; nextLevel?: never };

export const skitForCompletedLevel = function(completedLevel: number): Skit | undefined {
	return SKITS.find(skit => skit.completedLevel === completedLevel);
};

export const skitById = function(id: SkitId | undefined): Skit {
	return SKITS.find(skit => skit.id === id) ?? SKITS[0];
};
