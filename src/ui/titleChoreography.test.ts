import { describe, expect, test } from 'bun:test';
import { TITLE_DEMO_DURATION, TITLE_PROBLEMS, titleDemoState, titlePatrolPose, titleSpiderPose } from './titleChoreography';

describe('title attract choreography', function() {
	test('each problem has one answer and is solved only after reaching and eating its pad', function() {
		const expressions = new Set<string>();
		const targets = new Set<number>();
		let previous = titleDemoState(0);
		for (let time = 0; time < TITLE_DEMO_DURATION; time += .025) {
			const state = titleDemoState(time);
			expressions.add(state.expression); targets.add(state.target);
			expect(state.values.filter(function(value) { return value === state.answer; })).toHaveLength(1);
			expect(state.values[state.target]).toBe(state.answer);
			if (state.consumed) {
				expect(state.pad).toBe(state.target);
				expect(['eat', 'solved']).toContain(state.phase);
				expect(state.bite).toBe(1);
			}
			if (state.expression !== previous.expression) {
				expect(previous.consumed).toBe(true);
				expect(state.consumed).toBe(false);
				expect(state.bite).toBe(0);
			}
			previous = state;
		}
		expect(expressions.size).toBe(TITLE_PROBLEMS.length);
		expect(targets.size).toBe(3);
	});
	test('turning and looking at the player hold position; movement faces its destination', function() {
		for (let time = .001; time < TITLE_DEMO_DURATION; time += .025) {
			const before = titleDemoState(time), after = titleDemoState(time + .001);
			if (before.phase !== after.phase) continue;
			if (before.phase !== 'move') expect(after.pose).toMatchObject({ x: before.pose.x, y: before.pose.y });
			else expect(before.pose.flip).toBe(after.pose.x < before.pose.x);
			if (before.phase === 'idle') expect(before.pose.sheet).toBe('front');
		}
	});
	test('the attract loop returns to the same position without a jump or saved state', function() {
		const first = titleDemoState(0), last = titleDemoState(TITLE_DEMO_DURATION - .001);
		expect(last.pose.x).toBe(first.pose.x);
		expect(last.pose.y).toBe(first.pose.y);
		expect(titleDemoState(TITLE_DEMO_DURATION)).toEqual(first);
	});
	test('both shore characters travel in both directions and rest facing the player', function() {
		for (const animal of ['frog', 'lizard'] as const) {
			const directions = new Set<boolean>();
			const positions = new Set<number>();
			let rests = 0;
			for (let time = 0; time < 30; time += .05) {
				const pose = titlePatrolPose(animal, time);
				if (pose.sheet === 'side') { directions.add(pose.flip); positions.add(pose.x); }
				if (pose.sheet === 'front') rests++;
			}
			expect(directions.size).toBe(2);
			expect(positions.size).toBeGreaterThan(10);
			expect(rests).toBeGreaterThan(30);
		}
	});
	test('the spider drops, holds and retreats, with a quiet interval between visits', function() {
		expect(titleSpiderPose(0).visible).toBe(false);
		expect(titleSpiderPose(5).y).toBeLessThan(titleSpiderPose(6).y);
		expect(titleSpiderPose(6.5)).toEqual(titleSpiderPose(8));
		expect(titleSpiderPose(9.5).y).toBeGreaterThan(titleSpiderPose(10).y);
		expect(titleSpiderPose(11).visible).toBe(false);
		expect(titleSpiderPose(25)).toEqual(titleSpiderPose(0));
	});
});
