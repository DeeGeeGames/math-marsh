import { expect, test } from 'bun:test';
import { shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation } from './additionalSkits';
import { SKITS, skitForCompletedLevel, skitById } from './skitSequence';

test('each scheduled level selects the right scene and identity survives lookup', () => {
	for (const scene of SKITS) {
		expect(skitForCompletedLevel(scene.completedLevel)).toBe(scene);
		expect(skitById(scene.id)).toBe(scene);
	}
});

test('Shortcut: Fly crosses before the leap, then splash, emergence, and hat joke', () => {
	expect(shortcutPresentation(4.5).fly.x).toBe(81);
	expect(shortcutPresentation(4.5).lizard.x).toBe(20);
	expect(shortcutPresentation(5.7).lizard.x).toBeGreaterThan(20);
	expect(shortcutPresentation(6.8).splash).toBe(true);
	expect(shortcutPresentation(6.8).lizard.visible).toBe(false);
	const hat = shortcutPresentation(8.5);
	expect(hat.lizard.visible).toBe(true);
	expect(hat.hat).toBe(true);
	expect(hat.pad.x).toBe(hat.lizard.x);
	expect(hat.pad.y).toBeLessThan(hat.lizard.y);
	expect(shortcutPresentation(7.5).lizard.y).toBeGreaterThan(hat.lizard.y);
	expect(shortcutPresentation(12).caption).toContain('toes');
});

test('Do Not Disturb: Spider asks for a second pluck before the lullaby', () => {
	expect(doNotDisturbPresentation(2).webBuild).toBe(1);
	expect(doNotDisturbPresentation(5.4).pluck).toBe(true);
	expect(doNotDisturbPresentation(8).pluck).toBe(false);
	expect(doNotDisturbPresentation(10).caption).toContain('Again! Again!');
	expect(doNotDisturbPresentation(11.5).pluck).toBe(true);
	expect(doNotDisturbPresentation(5.4).webTilt).not.toBe(0);
	expect(doNotDisturbPresentation(13).caption).toContain('lullaby');
	expect(doNotDisturbPresentation(16).fly.x).toBeGreaterThan(100);
});

test('Dinner Committee: meet in the middle, collide, separate, catch a leaf, then picnic', () => {
	expect(dinnerCommitteePresentation(3).diagram).toBe(true);
	expect(dinnerCommitteePresentation(5).caption).toContain('Meet in the middle!');
	expect(dinnerCommitteePresentation(5).frog.x).toBe(20);
	const collision = dinnerCommitteePresentation(6.9);
	const separated = dinnerCommitteePresentation(8.2);
	expect(collision.burst).toBe('BONK!');
	expect(separated.frog.x).toBeLessThan(collision.frog.x);
	expect(separated.lizard.x).toBeGreaterThan(collision.lizard.x);
	expect(separated.lizard.facing).toBe(-1);
	expect(dinnerCommitteePresentation(8.7).tongueReach).toBeGreaterThan(0);
	expect(dinnerCommitteePresentation(8.7).tongueReach).toBeLessThan(1);
	expect(dinnerCommitteePresentation(9.4).tongue).toBe(true);
	expect(dinnerCommitteePresentation(10).tongue).toBe(false);
	expect(dinnerCommitteePresentation(10).diagram).toBe(false);
	expect(dinnerCommitteePresentation(10).caption).toContain('leaf');
	expect(dinnerCommitteePresentation(13).caption).toContain('Picnic time!');
});

test('reduced motion retains the story without flutter, bounce, or shake', () => {
	for (const present of [shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation]) {
		for (const time of [0, 3.4, 5.4, 6.9, 8.7, 11.5, 15]) {
			expect(present(time, true).caption).toBe(present(time).caption);
			expect(present(time, true).fly.frame).toBe(0);
		}
	}
	expect(shortcutPresentation(5.7, true).lizard.tilt).toBe(0);
	expect(doNotDisturbPresentation(5.4, true).spider.y).toBe(58);
	expect(doNotDisturbPresentation(5.4, true).webTilt).toBe(0);
	expect(dinnerCommitteePresentation(6.9, true).frog.tilt).toBeCloseTo(0);
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
