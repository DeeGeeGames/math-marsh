import { expect, test } from 'bun:test';
import { shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation } from './additionalSkits';
import { SKITS, skitForCompletedLevel, skitById } from './skitSequence';

test('each scheduled level selects the right scene and identity survives lookup', () => {
	for (const scene of SKITS) {
		expect(skitForCompletedLevel(scene.completedLevel)).toBe(scene);
		expect(skitById(scene.id)).toBe(scene);
	}
});

test('Shortcut: Fly crosses before the leap, then splash, hat, and punchline', () => {
	expect(shortcutPresentation(4).fly.x).toBe(81);
	expect(shortcutPresentation(4).lizard.x).toBe(20);
	expect(shortcutPresentation(5).lizard.x).toBeGreaterThan(20);
	expect(shortcutPresentation(6).splash).toBe(true);
	expect(shortcutPresentation(6).lizard.visible).toBe(false);
	const hat = shortcutPresentation(7);
	expect(hat.lizard.visible).toBe(true);
	expect(hat.pad.x).toBe(hat.lizard.x);
	expect(hat.pad.y).toBeLessThan(hat.lizard.y);
	expect(hat.caption).toContain('I calculated that!');
	expect(shortcutPresentation(10).caption).toContain('Forgot to carry the lizard.');
});

test('Do Not Disturb: two plucks react, separated by the trap/instrument exchange', () => {
	expect(doNotDisturbPresentation(0).webBuild).toBe(0);
	expect(doNotDisturbPresentation(2).webBuild).toBe(1);
	expect(doNotDisturbPresentation(3.4).pluck).toBe(true);
	expect(doNotDisturbPresentation(8).pluck).toBe(false);
	expect(doNotDisturbPresentation(9.3).pluck).toBe(true);
	expect(doNotDisturbPresentation(3.4).webTilt).not.toBe(0);
	expect(doNotDisturbPresentation(6).caption).toContain('This is a trap!');
	expect(doNotDisturbPresentation(8).caption).toContain('Sounds like an instrument.');
	expect(doNotDisturbPresentation(9.3).webTilt).not.toBe(0);
	expect(doNotDisturbPresentation(12).fly.x).toBeGreaterThan(100);
});

test('Dinner Committee: sabotage precedes charge, collision, pad catch, and closing lines', () => {
	expect(dinnerCommitteePresentation(3).diagramTilt).toBe(0);
	expect(dinnerCommitteePresentation(4.5).diagramTilt).toBe(180);
	expect(dinnerCommitteePresentation(4.5).frog.x).toBe(22);
	expect(dinnerCommitteePresentation(6.2).caption).toContain('BONK');
	expect(dinnerCommitteePresentation(6.2).pad.x).toBe(78);
	expect(dinnerCommitteePresentation(7.4).tongue).toBe(true);
	expect(dinnerCommitteePresentation(8.3).caption).toContain('Salad. Again.');
	expect(dinnerCommitteePresentation(10).caption).toContain('Three predators. Zero coordination.');
});

test('reduced motion retains actions and dialogue while removing bounce and shake', () => {
	for (const present of [shortcutPresentation, doNotDisturbPresentation, dinnerCommitteePresentation]) {
		for (const time of [0, 3.4, 5, 6.2, 7.4, 9.3, 11]) {
			expect(present(time, true).caption).toBe(present(time).caption);
		}
	}
	expect(shortcutPresentation(5, true).lizard.tilt).toBe(0);
	expect(doNotDisturbPresentation(3.4, true).spider.y).toBe(55);
	expect(doNotDisturbPresentation(3.4, true).webTilt).toBe(1);
	expect(dinnerCommitteePresentation(6.2, true).frog.tilt).toBe(-18);
});
