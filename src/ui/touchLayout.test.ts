import { describe, expect, test } from 'bun:test';
import { touchControlLayout } from './touchLayout';

const baseArea = {
	width: 320,
	height: 568,
	canvasLeft: 8,
	canvasRight: 312,
	canvasBottom: 376,
	edgeGap: 10,
	safeTop: 0,
	safeRight: 0,
	safeBottom: 0,
	safeLeft: 0,
} as const;

describe('touch control safe-area layout', function() {
	test('small portrait fits 44px direction targets beneath the board', function() {
		const layout = touchControlLayout(baseArea);
		expect(Math.floor((layout.dpadSize - 4 * 2) / 3)).toBe(44);
		expect(layout.dpadTop).toBeGreaterThan(baseArea.canvasBottom);
		expect(layout.dpadTop + layout.dpadSize).toBeLessThanOrEqual(baseArea.height - baseArea.edgeGap);
		expect(layout.actionTop + layout.actionSize).toBeLessThanOrEqual(baseArea.height - baseArea.edgeGap);
	});

	test('portrait bottom inset stays clear while controls share the thumb region', function() {
		const layout = touchControlLayout({ ...baseArea, canvasBottom: 352, safeBottom: 34 });
		expect(layout.dpadSize).toBe(140);
		expect(layout.dpadTop + layout.dpadSize).toBeLessThanOrEqual(baseArea.height - 34);
		expect(layout.actionTop).toBe(layout.dpadTop);
	});

	test('short landscape safe-area rails fit 44px direction targets outside the board', function() {
		const layout = touchControlLayout({
			...baseArea,
			width: 568,
			height: 320,
			canvasLeft: 194,
			canvasRight: 408,
			canvasBottom: 280,
			safeTop: 24,
			safeLeft: 44,
			safeBottom: 21,
		});
		expect(layout.dpadSize).toBe(140);
		expect(Math.floor((layout.dpadSize - 4 * 2) / 3)).toBe(44);
		expect(44 + layout.dpadSize).toBeLessThan(194);
		expect(layout.actionSize).toBe(140);
		expect(layout.dpadTop).toBeGreaterThanOrEqual(24);
		expect(layout.actionTop + layout.actionSize).toBeLessThanOrEqual(299);
	});

	test('constrained height never produces negative control dimensions', function() {
		const layout = touchControlLayout({ ...baseArea, canvasBottom: 560, safeBottom: 34 });
		expect(layout.dpadSize).toBe(0);
		expect(layout.actionSize).toBe(0);
	});
});
