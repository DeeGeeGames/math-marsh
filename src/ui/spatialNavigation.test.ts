import { describe, expect, test } from 'bun:test';
import {
	findSpatialTargetIndex,
	type SpatialRect,
} from './spatialNavigation';

const rect = function rect(left: number, top: number, width = 100, height = 50): SpatialRect {
	return { left, right: left + width, top, bottom: top + height };
};

describe('findSpatialTargetIndex', () => {
	test('moves in the requested visual direction on a grid', () => {
		const rects = [
			rect(0, 0),
			rect(120, 0),
			rect(0, 70),
			rect(120, 70),
		];
		const targets = [
			['up', null],
			['down', 2],
			['left', null],
			['right', 1],
		] as const;

		targets.forEach(([direction, target]) => {
			expect(findSpatialTargetIndex(rects, 0, direction)).toBe(target);
		});
	});

	test('does not treat a horizontal neighbor as a down target', () => {
		const rects = [rect(0, 0), rect(120, 0), rect(0, 100)];

		expect(findSpatialTargetIndex(rects, 0, 'down')).toBe(2);
	});

	test('ignores small offsets caused by focused-control styling', () => {
		const rects = [rect(0, -2), rect(120, 0), rect(0, 100)];

		expect(findSpatialTargetIndex(rects, 0, 'down')).toBe(2);
	});

	test('prefers an aligned target over a closer diagonal target', () => {
		const rects = [rect(0, 0), rect(140, 55), rect(0, 100)];

		expect(findSpatialTargetIndex(rects, 0, 'down')).toBe(2);
	});

	test('keeps focus at an edge instead of wrapping backward', () => {
		const rects = [rect(0, 0), rect(120, 0)];

		expect(findSpatialTargetIndex(rects, 1, 'right')).toBeNull();
	});

	test('returns the first target when current focus is missing', () => {
		expect(findSpatialTargetIndex([rect(0, 0), rect(120, 0)], -1, 'right')).toBe(0);
	});

	test('keeps horizontal operation navigation in its row above a centered Back button', () => {
		const rects = [
			rect(0, 0, 400, 140),
			rect(420, 0, 400, 140),
			rect(0, 160, 400, 140),
			rect(420, 160, 400, 140),
			rect(180, 320, 460, 60),
		];

		expect(findSpatialTargetIndex(rects, 2, 'right')).toBe(3);
		expect(findSpatialTargetIndex(rects, 3, 'left')).toBe(2);
		expect(findSpatialTargetIndex(rects, 2, 'left')).toBeNull();
		expect(findSpatialTargetIndex(rects, 3, 'right')).toBeNull();
		expect(findSpatialTargetIndex(rects, 2, 'down')).toBe(4);
		expect(findSpatialTargetIndex(rects, 3, 'down')).toBe(4);
	});
});
