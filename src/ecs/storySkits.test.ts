// Story, timing, and caption tests for the skits defined in src/ecs/additionalSkits.ts.
import { expect, test } from 'bun:test';
import { SKITS } from './skitSequence';
import { BIG_JUMP_BEATS, WEB_GUITAR_BEATS, BIG_PLAN_BEATS, SNACK_BREAK_BEATS, bigJumpPresentation, webGuitarPresentation, bigPlanPresentation, snackBreakPresentation } from './additionalSkits';

const allBeats = [SNACK_BREAK_BEATS, BIG_JUMP_BEATS, WEB_GUITAR_BEATS, BIG_PLAN_BEATS];
const beatsFor = (id: string): readonly unknown[] => ({ 'snack-break': SNACK_BREAK_BEATS, 'the-big-jump': BIG_JUMP_BEATS, 'the-web-guitar': WEB_GUITAR_BEATS, 'the-big-plan': BIG_PLAN_BEATS } as Record<string, readonly unknown[]>)[id] ?? [];
test('lines are short (<=10 words)', () => {
	for (const beats of allBeats) for (const b of beats) expect(b.line.split(/\s+/).length).toBeLessThanOrEqual(10);
});
test('catchphrase only in Snack Break and The Big Plan', () => {
	const has = (beats: readonly { line: string }[]): boolean => beats.some(b => b.line.includes('Buzz you later'));
	expect([SNACK_BREAK_BEATS, BIG_JUMP_BEATS, WEB_GUITAR_BEATS, BIG_PLAN_BEATS].map(has)).toEqual([true, false, false, true]);
});
test('schedule and ids', () => {
	expect(SKITS.map(s => [s.id, s.completedLevel, s.durationSeconds])).toEqual([
		['snack-break', 3, 15.5], ['the-big-jump', 6, 16.5], ['the-web-guitar', 9, 17], ['the-big-plan', 12, 20],
	]);
});
test('each caption shows >=2s, punchline >=4s, every beat appears', () => {
	for (const scene of SKITS) {
		let prev = scene.presentation(0).caption; let start = 0; const seen = new Set([prev]);
		for (let tick = 1; tick < scene.durationSeconds * 10; tick += 1) {
			const t = tick / 10; const c = scene.presentation(t).caption;
			if (c === prev) continue;
			expect(t - start).toBeGreaterThanOrEqual(2);
			prev = c; start = t; seen.add(c);
		}
		expect(scene.durationSeconds - start).toBeGreaterThanOrEqual(4);
		expect(seen.size).toBe(beatsFor(scene.id).length);
	}
});
test('speaker format parses', () => {
	for (const scene of SKITS) for (let t = 0; t < scene.durationSeconds; t += 0.5)
		expect(/^(Fly|Frog|Spider|Lizard|Together): “(.*)”$/.test(scene.presentation(t).caption)).toBe(true);
});
test('reduced motion keeps captions', () => {
	for (const scene of SKITS) for (let t = 0; t < scene.durationSeconds; t += 0.3)
		expect(scene.presentation(t, true).caption).toBe(scene.presentation(t).caption);
});
test('story beats', () => {
	// Snack Break: dodge before pad caught; pad at frog; fly exits
	expect(snackBreakPresentation(5.4).flyY).toBeLessThan(snackBreakPresentation(2).flyY - 20);
	expect(snackBreakPresentation(7).padCatch).toBe(1);
	expect(snackBreakPresentation(15.4).flyX).toBeGreaterThan(100);
	// Big Jump: splash hides lizard, then hat on emergence before "Nice hat!"
	expect(bigJumpPresentation(9.5).lizardInWater).toBe(true);
	expect(bigJumpPresentation(9.5).burst).toBe('SPLOOSH!');
	expect(bigJumpPresentation(10.2).hat).toBe(true);
	expect(bigJumpPresentation(10.5).caption).toContain('Nice hat');
	// Web Guitar: pluck during guitar line and during "one more"
	expect(webGuitarPresentation(6).pluck).toBe(true);
	expect(webGuitarPresentation(6).caption).toContain('guitar');
	expect(webGuitarPresentation(11.5).pluck).toBe(true);
	expect(webGuitarPresentation(4).fly.x).toBeLessThan(80);
	// Big Plan: fly on the dot while asking; gone at bonk; frog tongue during pad line
	const asking = bigPlanPresentation(8);
	expect(asking.fly.x).toBeCloseTo(50); expect(asking.diagram).toBe(true);
	const bonk = bigPlanPresentation(11.6);
	expect(bonk.burst).toBe('BONK!'); expect(bonk.fly.y).toBeLessThan(35);
	expect(bigPlanPresentation(12.8).tongue).toBe(true);
	expect(bigPlanPresentation(13.5).caption).toContain('AGAIN');
	expect(bigPlanPresentation(19.9).fly.x).toBeGreaterThan(100);
});

test('Big Plan keeps the hovering fly inside the stage until its exit', () => {
	// The fly slot is at most 23% of stage height, anchored at its bottom.
	for (const reducedMotion of [false, true]) {
		for (let tick = 113; tick < 175; tick += 1) {
			expect(bigPlanPresentation(tick / 10, reducedMotion).fly.y).toBeGreaterThan(23);
		}
	}
});


test('catches, consumption, and retraction remain ordered with and without reduced motion', () => {
	for (const reduced of [false, true]) {
		const dodge = snackBreakPresentation(4.7, reduced);
		expect(dodge.flyY).toBeLessThan(30);
		expect(dodge.tongueReach).toBeLessThan(1);
		const chew = snackBreakPresentation(7, reduced);
		expect(chew.padCatch).toBe(1);
		expect(chew.tongueReach).toBe(0);
		expect(snackBreakPresentation(9.5, reduced).padScale).toBeLessThan(chew.padScale);
		expect(snackBreakPresentation(10, reduced).padVisible).toBe(false);
		const caught = bigPlanPresentation(13.5, reduced);
		expect(caught.padCatch).toBe(1);
		expect(caught.caption).toContain('Got him');
		expect(bigPlanPresentation(13.2, reduced).tongueReach).toBeLessThan(bigPlanPresentation(12.7, reduced).tongueReach);
		expect(bigPlanPresentation(14.5, reduced).tongue).toBe(false);
		expect(bigPlanPresentation(14.5, reduced).mouthOpen).toBe(true);
		expect(bigPlanPresentation(16, reduced).pad.visible).toBe(false);
	}
});

test('jump key poses and hat travel precede the reveal caption', () => {
	for (const reduced of [false, true]) {
		expect(bigJumpPresentation(7.6, reduced).lizardSquash).toBeLessThan(1);
		expect(bigJumpPresentation(8.2, reduced).lizard.frame).not.toBe(bigJumpPresentation(7.6, reduced).lizard.frame);
		expect(bigJumpPresentation(8.2, reduced).lizard.y).toBeLessThan(73);
		expect(bigJumpPresentation(9.5, reduced).lizard.y).toBeGreaterThan(100);
		expect(bigJumpPresentation(10.2, reduced).hatTravel).toBeGreaterThan(0);
		expect(bigJumpPresentation(10.2, reduced).hatTravel).toBeLessThan(1);
		expect(bigJumpPresentation(10.5, reduced).hatTravel).toBe(1);
		expect(bigJumpPresentation(11, reduced).lizardInWater).toBe(true);
	}
});
