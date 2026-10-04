import { SKITS, skitForCompletedLevel, type SkitId } from './skitSequence';

export const SKIT_PROGRESS_KEY = 'math-marsh-scenes';
export type SkitProgress = readonly SkitId[];

export const unlockSkitForCompletedLevel = function(progress: SkitProgress, completedLevel: number): SkitProgress {
	const skit = skitForCompletedLevel(completedLevel);
	return !skit || progress.includes(skit.id) ? progress : [...progress, skit.id];
};

export const skitProgressFromStoredValue = function(stored: string | null): SkitProgress {
	if (!stored) return [];
	try {
		const value: unknown = JSON.parse(stored);
		if (!Array.isArray(value)) return [];
		return SKITS.filter(skit => value.includes(skit.id)).map(skit => skit.id);
	} catch {
		return [];
	}
};

export const loadSkitProgress = function(): SkitProgress {
	try {
		return skitProgressFromStoredValue(localStorage.getItem(SKIT_PROGRESS_KEY));
	} catch {
		return [];
	}
};

export const saveSkitProgress = function(progress: SkitProgress): void {
	try {
		localStorage.setItem(SKIT_PROGRESS_KEY, JSON.stringify(progress));
	} catch {
		// Storage can be unavailable; the ECS resource retains session unlocks.
	}
};
