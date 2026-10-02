import { describe, expect, test } from 'bun:test';
import { BOARD_SIZES } from './boardGeometry';
import { levelClearTarget } from './levelProgression';

describe('level clear target', () => {
	test('requires two thirds of the board with the default enemy counts', () => {
		expect(levelClearTarget(BOARD_SIZES.easy, 1, 1)).toBe(6);
		expect(levelClearTarget(BOARD_SIZES.easy, 1, 2)).toBe(6);
		expect(levelClearTarget(BOARD_SIZES.medium, 4, 2)).toBe(14);
		expect(levelClearTarget(BOARD_SIZES.expert, 5, 2)).toBe(20);
	});

	test('leaves space for the full roster and an extra pad for two-number answers', () => {
		expect(levelClearTarget(BOARD_SIZES.easy, 5, 1)).toBe(4);
		expect(levelClearTarget(BOARD_SIZES.easy, 5, 2)).toBe(3);
		expect(levelClearTarget(BOARD_SIZES.medium, 8, 2)).toBe(11);
	});

	test('never completes automatically before at least one pad is cleared', () => {
		expect(levelClearTarget(BOARD_SIZES.easy, 9, 2)).toBe(1);
	});
});
