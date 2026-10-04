import { expect, test } from 'bun:test';
import { shouldPlaySkit, skitPresentation, SKIT_DURATION_SECONDS } from './skitSequence';

test('intermissions follow only the four scheduled levels', () => {
	expect(Array.from({ length: 31 }, (_, level) => level).filter(shouldPlaySkit)).toEqual([3, 6, 9, 12]);
});

test('the fly dodges before the lily pad is pulled to the frog, then escapes', () => {
	const waiting = skitPresentation(2);
	const dodge = skitPresentation(4.5);
	const salad = skitPresentation(6);
	expect(waiting.tongueReach).toBe(0);
	expect(dodge.tongueReach).toBe(1);
	expect(dodge.flyY).toBeLessThan(waiting.flyY - 20);
	expect(dodge.padCaught).toBe(false);
	expect(salad.padCaught).toBe(true);
	expect(salad.padX).toBeCloseTo(27);
	expect(salad.tongueReach).toBe(0);
	expect(salad.caption).toContain('salad');
	expect(skitPresentation(SKIT_DURATION_SECONDS).flyX).toBeGreaterThan(100);
});

test('reduced motion preserves the story without flutter or shaking', () => {
	const view = skitPresentation(6.2, true);
	expect(view.frogTilt).toBe(0);
	expect(view.flyFrame).toBe(0);
	expect(view.flyY).toBe(27);
	expect(view.caption).toBe(skitPresentation(6.2).caption);
});
