import { describe, expect, test } from 'bun:test';
import {
	advanceLevelSelectSequence,
	initialLevelSelectSequence,
	LEVEL_SELECT_SEQUENCE,
	selectedStartingLevel,
	type CheatDirection,
} from './levelSelectionCheat';

const enter = function(directions: readonly CheatDirection[]): boolean {
	let state = initialLevelSelectSequence();
	let unlocked = false;
	for (const direction of directions) {
		const next = advanceLevelSelectSequence(state, [direction], 0.1, false);
		state = next.state;
		unlocked = next.unlocked;
	}
	return unlocked;
};

describe('level selection cheat', function() {
	test('requires all eight directions in order', function() {
		expect(enter(LEVEL_SELECT_SEQUENCE.slice(0, -1))).toBe(false);
		expect(enter(LEVEL_SELECT_SEQUENCE)).toBe(true);
		expect(enter(['up', 'up', 'down', 'down', 'right', 'left', 'right', 'left'])).toBe(false);
	});

	test('recovers from an overlapping prefix and an incorrect attempt', function() {
		expect(enter(['up', ...LEVEL_SELECT_SEQUENCE])).toBe(true);
		expect(enter(['up', 'down', 'left', ...LEVEL_SELECT_SEQUENCE])).toBe(true);
	});

	test('held inputs do not advance; a pause longer than three seconds resets', function() {
		const first = advanceLevelSelectSequence(initialLevelSelectSequence(), ['up'], 0, false);
		const held = advanceLevelSelectSequence(first.state, [], 0.5, false);
		expect(held.state.inputs).toEqual(['up']);
		const expired = advanceLevelSelectSequence(held.state, [], 3, false);
		expect(expired.state.inputs).toEqual([]);
	});

	test('controller handoff, menu actions, and ambiguous directions reset progress', function() {
		const first = advanceLevelSelectSequence(initialLevelSelectSequence(), ['up'], 0, false);
		expect(advanceLevelSelectSequence(first.state, ['up'], 0, true).state.inputs).toEqual([]);
		expect(advanceLevelSelectSequence(first.state, ['up', 'down'], 0, false).state.inputs).toEqual([]);
		expect(initialLevelSelectSequence().inputs).toEqual([]);
	});

	test('starting levels are bounded positive integers', function() {
		expect(selectedStartingLevel(0)).toBe(1);
		expect(selectedStartingLevel(100)).toBe(99);
		expect(selectedStartingLevel(7.8)).toBe(7);
		expect(selectedStartingLevel(Number.NaN)).toBe(1);
	});
});
