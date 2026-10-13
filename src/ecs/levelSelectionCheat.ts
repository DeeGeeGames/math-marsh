export const LEVEL_SELECT_SEQUENCE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'] as const;
export type CheatDirection = typeof LEVEL_SELECT_SEQUENCE[number];
export type LevelSelectSequenceState = { inputs: readonly CheatDirection[]; idleSeconds: number };
export const initialLevelSelectSequence = function(): LevelSelectSequenceState {
	return { inputs: [], idleSeconds: 0 };
};

// Retain the longest matching prefix so an extra Up can begin a new attempt.
export const advanceLevelSelectSequence = function(
	state: Readonly<LevelSelectSequenceState>,
	directions: readonly CheatDirection[],
	dt: number,
	interrupted: boolean,
): { state: LevelSelectSequenceState; unlocked: boolean } {
	const idleSeconds = state.idleSeconds + dt;
	const inputs = interrupted || idleSeconds > 3 ? [] : state.inputs;
	if (interrupted || directions.length > 1) return { state: initialLevelSelectSequence(), unlocked: false };
	const direction = directions[0];
	if (!direction) return { state: { inputs, idleSeconds }, unlocked: false };
	const candidate = [...inputs, direction];
	if (candidate.length === LEVEL_SELECT_SEQUENCE.length
		&& candidate.every((value, index) => value === LEVEL_SELECT_SEQUENCE[index])) {
		return { state: initialLevelSelectSequence(), unlocked: true };
	}
	const length = Array.from({ length: Math.min(candidate.length, LEVEL_SELECT_SEQUENCE.length - 1) }, (_, index) => index + 1)
		.reverse().find(length => candidate.slice(-length).every((value, index) => value === LEVEL_SELECT_SEQUENCE[index])) ?? 0;
	return { state: { inputs: length === 0 ? [] : candidate.slice(-length), idleSeconds: 0 }, unlocked: false };
};

export const selectedStartingLevel = function(level: number): number {
	return Number.isFinite(level) ? Math.max(1, Math.min(99, Math.floor(level))) : 1;
};
