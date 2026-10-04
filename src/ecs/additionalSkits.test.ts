import { expect, test } from 'bun:test';
import { shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation } from './additionalSkits';
import { SKITS, skitForCompletedLevel, skitById } from './skitSequence';

test('each scheduled level selects the right scene and identity survives lookup', () => {
	for (const scene of SKITS) {
		expect(skitForCompletedLevel(scene.completedLevel)).toBe(scene);
		expect(skitById(scene.id)).toBe(scene);
	}
});

test('Shortcut: Fly crosses the gap, Lizard jumps through the middle pad, then wears it', () => {
	const linedUp = shortcutPresentation(5);
	expect(linedUp.fly.x).toBeGreaterThan(70);
	expect(linedUp.lizard.x).toBeLessThan(25);
	expect(linedUp.pad.x).toBeGreaterThan(linedUp.lizard.x);
	expect(linedUp.pad.x).toBeLessThan(linedUp.fly.x);
	expect(linedUp.hat).toBe(false);
	expect(linedUp.caption).toContain('will not fit');

	const jumping = shortcutPresentation(6.8);
	expect(jumping.lizard.x).toBeGreaterThan(linedUp.lizard.x);
	expect(jumping.lizard.y).toBeLessThan(linedUp.lizard.y);
	expect(shortcutPresentation(7.6).splash).toBe(true);
	expect(shortcutPresentation(7.6).lizard.visible).toBe(false);
	expect(shortcutPresentation(7.6).burst).toBe('SPLOOSH!');

	const rising = shortcutPresentation(8.6);
	const hatted = shortcutPresentation(10);
	expect(rising.lizard.visible).toBe(true);
	expect(rising.hat).toBe(true);
	expect(rising.lizard.y).toBeGreaterThan(hatted.lizard.y);
	expect(hatted.pad.x).toBeCloseTo(hatted.lizard.x);
	expect(hatted.pad.y).toBeLessThan(hatted.lizard.y);
	expect(hatted.caption).toContain('reached the pad');
	expect(shortcutPresentation(13).caption).toContain('head');
});

test('Do Not Disturb: Spider wants a quiet trap, Fly plucks twice, and the noise is Spider', () => {
	expect(doNotDisturbPresentation(2).webBuild).toBe(1);
	expect(doNotDisturbPresentation(4).caption).toContain('loose');
	expect(doNotDisturbPresentation(4).pluck).toBe(false);
	expect(doNotDisturbPresentation(7).pluck).toBe(true);
	expect(doNotDisturbPresentation(7).caption).toContain('Leave the trap alone');
	expect(doNotDisturbPresentation(8.6).pluck).toBe(false);
	expect(doNotDisturbPresentation(10.4).pluck).toBe(true);
	expect(doNotDisturbPresentation(10.4).caption).toContain('sound');
	expect(doNotDisturbPresentation(7).webTilt).not.toBe(0);
	expect(doNotDisturbPresentation(13).caption).toContain('That sound is me');
	expect(doNotDisturbPresentation(16).fly.x).toBeGreaterThan(100);
});

test('Dinner Committee: Fly turns the plan, the hunters follow it into each other, then Frog catches salad', () => {
	const plan = dinnerCommitteePresentation(2);
	expect(plan.diagram).toBe(true);
	expect(plan.diagramTurn).toBe(0);
	expect(plan.caption).toContain('point at the fly');
	expect(plan.lizard.x - plan.frog.x).toBeGreaterThan(25);
	expect(plan.fly.x).toBeGreaterThan(plan.lizard.x);

	const turning = dinnerCommitteePresentation(5.6);
	expect(turning.caption).toContain('turn the arrows');
	expect(turning.fly.x).toBeLessThan(plan.fly.x);
	expect(turning.diagramTurn).toBeGreaterThan(0);
	expect(turning.diagramTurn).toBeLessThan(1);
	expect(dinnerCommitteePresentation(5.6, true).diagramTurn).toBe(1);

	const collision = dinnerCommitteePresentation(7.5);
	const settled = dinnerCommitteePresentation(8.6);
	expect(collision.burst).toBe('BONK!');
	expect(collision.diagramTurn).toBe(1);
	expect(collision.lizard.x - collision.frog.x).toBeLessThan(plan.lizard.x - plan.frog.x);
	expect(settled.frog.x).toBeLessThan(collision.frog.x);
	expect(settled.lizard.x).toBeGreaterThan(collision.lizard.x);
	expect(settled.lizard.facing).toBe(-1);
	expect(settled.burst).toBe('');

	expect(dinnerCommitteePresentation(8.7).tongueReach).toBeGreaterThan(0);
	expect(dinnerCommitteePresentation(8.7).tongueReach).toBeLessThan(1);
	expect(dinnerCommitteePresentation(10).tongue).toBe(true);
	expect(dinnerCommitteePresentation(10).pad.x).toBeLessThan(plan.pad.x);
	expect(dinnerCommitteePresentation(10).pad.y).toBeLessThan(plan.pad.y);
	expect(dinnerCommitteePresentation(13).tongue).toBe(false);
	expect(dinnerCommitteePresentation(13).pad.x).toBeCloseTo(dinnerCommitteePresentation(10).pad.x);
	expect(dinnerCommitteePresentation(11).caption).toContain('Salad');
	expect(dinnerCommitteePresentation(13).diagram).toBe(true);
	expect(dinnerCommitteePresentation(13).caption).toContain('point at you');
});

test('reduced motion retains the story without flutter, bounce, or shake', () => {
	for (const present of [shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation]) {
		for (const time of [0, 3.4, 5.6, 6.9, 8.7, 10.4, 15]) {
			expect(present(time, true).caption).toBe(present(time).caption);
			expect(present(time, true).fly.frame).toBe(0);
		}
	}
	expect(shortcutPresentation(6.8, true).lizard.y).toBe(shortcutPresentation(5, true).lizard.y);
	expect(shortcutPresentation(6.8, true).lizard.tilt).toBe(0);
	expect(doNotDisturbPresentation(7, true).spider.y).toBe(58);
	expect(doNotDisturbPresentation(7, true).webTilt).toBe(0);
	expect(dinnerCommitteePresentation(7.5, true).frog.tilt).toBeCloseTo(0);
	expect(dinnerCommitteePresentation(7.5, true).diagramTurn).toBe(1);
});

test('new scenes leave at least two seconds for each caption and four for the punchline', () => {
	for (const scene of SKITS.filter(scene => scene.id !== 'snack-break')) {
		let previousCaption = scene.presentation(0).caption;
		let beatStarted = 0;
		for (let tick = 1; tick < scene.durationSeconds * 10; tick += 1) {
			const time = tick / 10;
			const caption = scene.presentation(time).caption;
			if (caption === previousCaption) continue;
			expect(time - beatStarted).toBeGreaterThanOrEqual(2);
			previousCaption = caption;
			beatStarted = time;
		}
		expect(scene.durationSeconds - beatStarted).toBeGreaterThanOrEqual(4);
	}
});
