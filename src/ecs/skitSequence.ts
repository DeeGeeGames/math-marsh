import { SKIT_ENTRIES } from './additionalSkits';

export const shouldPlaySkit = function(completedLevel: number): boolean {
	return skitForCompletedLevel(completedLevel) !== undefined;
};

export type SkitPresentation = {
	flyX: number; flyY: number; frogTilt: number; tongueReach: number;
	padX: number; padY: number; padCaught: boolean; mouthOpen: boolean; flyFrame: number; caption: string;
};

// Add each playable scene here; the intermission schedule and gallery share it.
export const SKITS = SKIT_ENTRIES;

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
