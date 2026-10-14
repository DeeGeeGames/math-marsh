import { describe, expect, test } from 'bun:test';
import { createPracticeSession, practiceSceneIdsForUnlockedSteps } from './practiceMode';

describe('practice sessions and scene unlock thresholds', () => {
	test('starts a fresh six-answer sample while carrying the in-memory streak', () => {
		expect(createPracticeSession('multiply', 7, 2)).toEqual({
			operation: 'multiply',
			step: 7,
			accelerationStreak: 2,
			assessment: {
				correctAnswers: 0,
				incorrectAnswers: 0,
				activeSeconds: 0,
				expectedSecondsTotal: 0,
			},
		});
	});

	test('unlocks every scene threshold crossed by a practice jump', () => {
		expect(practiceSceneIdsForUnlockedSteps([2, 3])).toEqual(['snack-break']);
		expect(practiceSceneIdsForUnlockedSteps([4, 5, 6, 7])).toEqual(['the-big-jump']);
		expect(practiceSceneIdsForUnlockedSteps([8, 9, 10, 11])).toEqual([
			'the-web-guitar',
			'the-big-plan',
		]);
	});
});
