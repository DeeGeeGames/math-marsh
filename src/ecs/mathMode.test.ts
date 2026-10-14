import { describe, expect, test } from 'bun:test';
import { createMathSession, equationModeForMathSession, mathSceneIdsForUnlockedSteps, mathTutorialForMode } from './mathMode';
import { initialSavedMathProgress } from './mathProgressStore';

describe('math sessions and scene unlock thresholds', () => {
	test('starts independent samples at saved ability for every operation', () => {
		const session = createMathSession({
			...initialSavedMathProgress(),
			multiply: { currentStep: 7, highestUnlockedStep: 11 },
		});
		expect(session.tracks.multiply).toEqual({
			step: 7,
			accelerationStreak: 0,
			assessment: { correctAnswers: 0, incorrectAnswers: 0, activeSeconds: 0, expectedSecondsTotal: 0 },
		});
		expect(session.tracks.add.step).toBe(1);
		expect(session.tracks.add.assessment).not.toBe(session.tracks.multiply.assessment);
	});

	test('uses saved math ability independently of arcade level and retains board progress', () => {
		const session = createMathSession({
			...initialSavedMathProgress(),
			add: { currentStep: 7, highestUnlockedStep: 7 },
		});
		const mode = equationModeForMathSession(session, ['add'], 2, 3);
		expect(mode.level).toBe(2);
		expect(mode.clearedThisLevel).toBe(3);
		expect(mode.operandRanges).toEqual({ left: { min: 1, max: 12 }, right: { min: 1, max: 12 } });
		expect(equationModeForMathSession(session, ['subtract'], 20).operandRanges)
			.toEqual({ left: { min: 1, max: 3 }, right: { min: 1, max: 3 } });
	});

	test('offers newly needed equation lessons based on saved ability rather than arcade difficulty', () => {
		const advanced = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: 7, highestUnlockedStep: 7 } });
		expect(mathTutorialForMode(advanced, ['add'], 'pending', 'pending')).toBe('operands');
		expect(mathTutorialForMode(advanced, ['add'], 'completed', 'pending')).toBe('operandAndResult');
		expect(mathTutorialForMode(advanced, ['add'], 'skipped', 'pending')).toBe('operandAndResult');
		expect(mathTutorialForMode(advanced, ['add'], 'completed', 'completed')).toBeUndefined();
		expect(mathTutorialForMode(advanced, ['subtract'], 'pending', 'pending')).toBeUndefined();
		const revisited = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: 1, highestUnlockedStep: 7 } });
		expect(mathTutorialForMode(revisited, ['add'], 'completed', 'completed')).toBeUndefined();
		expect(mathTutorialForMode(advanced, ['subtract', 'add'], 'pending', 'pending')).toBe('operands');
	});

	test('unlocks every scene threshold crossed by a math jump', () => {
		expect(mathSceneIdsForUnlockedSteps([2, 3])).toEqual(['snack-break']);
		expect(mathSceneIdsForUnlockedSteps([4, 5, 6, 7])).toEqual(['the-big-jump']);
		expect(mathSceneIdsForUnlockedSteps([8, 9, 10, 11])).toEqual(['the-web-guitar', 'the-big-plan']);
	});
});
