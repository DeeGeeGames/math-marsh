import { describe, expect, test } from 'bun:test';
import { createMathSession, mathSessionForBoard, equationModeForMathSession, mathSceneIdsForUnlockedSteps, mathTutorialForLevel } from './mathMode';
import { initialSavedMathProgress } from './mathProgressStore';

describe('math sessions and scene unlock thresholds', () => {
	test('starts independent samples at saved ability for every operation', () => {
		const session = createMathSession({
			...initialSavedMathProgress(),
			multiply: { currentStep: 7, highestUnlockedStep: 11 },
		});
		expect(session.tracks.multiply).toEqual({
			step: 7,
			boardStep: 7,
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

	test('keeps formats fixed by difficulty and arcade level at every saved skill step', () => {
		for (const step of [1, 4, 7, 11]) {
			const session = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: step, highestUnlockedStep: step } });
			for (const level of [1, 2, 3, 4, 11, 20]) {
				expect(equationModeForMathSession(session, ['add'], level, 0, 'easy').promptKind).toBe('selectResult');
				expect(equationModeForMathSession(session, ['add'], level, 0, 'medium').promptKind)
					.toBe(level % 2 === 1 ? 'selectResult' : 'selectOperands');
				const formats = ['selectResult', 'selectOperands', 'selectOperandAndResult'] as const;
				expect(equationModeForMathSession(session, ['add'], level, 0, 'expert').promptKind).toBe(formats[(level - 1) % 3]);
			}
		}
	});

	test('keeps all operation ranges until the next board even after skill advances', () => {
		const session = createMathSession(initialSavedMathProgress());
		const advanced = { tracks: { ...session.tracks, add: { ...session.tracks.add, step: 7 } } };
		expect(equationModeForMathSession(advanced, ['add'], 1).operandRanges.left.max).toBe(3);
		expect(equationModeForMathSession(advanced, ['subtract'], 1).operandRanges.left.max).toBe(3);
		const nextBoard = mathSessionForBoard(advanced);
		expect(equationModeForMathSession(nextBoard, ['add'], 2).operandRanges.left.max).toBe(12);
		expect(equationModeForMathSession(nextBoard, ['subtract'], 2).operandRanges.left.max).toBe(3);
		expect(session.tracks.add.boardStep).toBe(1);
	});

	test('offers equation lessons only at the difficulty appropriate level', () => {
		expect(mathTutorialForLevel(2, 'easy', 'pending', 'pending')).toBeUndefined();
		expect(mathTutorialForLevel(3, 'easy', 'pending', 'pending')).toBeUndefined();
		expect(mathTutorialForLevel(2, 'medium', 'pending', 'pending')).toBe('operands');
		expect(mathTutorialForLevel(3, 'medium', 'pending', 'pending')).toBeUndefined();
		expect(mathTutorialForLevel(2, 'expert', 'pending', 'pending')).toBe('operands');
		expect(mathTutorialForLevel(3, 'expert', 'completed', 'pending')).toBe('operandAndResult');
		expect(mathTutorialForLevel(3, 'expert', 'completed', 'completed')).toBeUndefined();
	});

	test('unlocks every scene threshold crossed by a math jump', () => {
		expect(mathSceneIdsForUnlockedSteps([2, 3])).toEqual(['snack-break']);
		expect(mathSceneIdsForUnlockedSteps([4, 5, 6, 7])).toEqual(['the-big-jump']);
		expect(mathSceneIdsForUnlockedSteps([8, 9, 10, 11])).toEqual(['the-web-guitar', 'the-big-plan']);
	});
});
