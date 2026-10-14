import { expect, test } from 'bun:test';
import { MATH_FINAL_STEP } from '../ecs/mathSteps';
import {
	advanceModeSelectToPond,
	chooseModeSelectDifficulty,
	closeModeSelectPanel,
	createModeSelectSetupState,
	mathProgressCue,
	modeSelectGameRequest,
	revealModeSelectLevelSelection,
	returnModeSelectToMath,
	showModeSelectPanel,
	toggleModeSelectOperation,
} from './modeSelectSetup';

test('progress copy and fill use highest unlocks rather than the current step', () => {
	const current = mathProgressCue({ currentStep: 4, highestUnlockedStep: 6 }, MATH_FINAL_STEP);
	const revisited = mathProgressCue({ currentStep: 2, highestUnlockedStep: 6 }, MATH_FINAL_STEP);
	expect(current).toEqual({
		highestUnlockedStep: 6,
		caption: '6 steps unlocked',
		valueText: `6 of ${MATH_FINAL_STEP} steps unlocked`,
		percentage: (6 / MATH_FINAL_STEP) * 100,
	});
	expect(revisited).toEqual(current);
	expect(mathProgressCue({ currentStep: 1, highestUnlockedStep: 1 }, MATH_FINAL_STEP).caption).toBe('1 step unlocked');
	expect(mathProgressCue({ currentStep: MATH_FINAL_STEP, highestUnlockedStep: MATH_FINAL_STEP }, MATH_FINAL_STEP).percentage).toBe(100);
});

test('requires an operation before advancing and retains choices across Back', () => {
	const initial = createModeSelectSetupState();
	expect(advanceModeSelectToPond(initial)).toBe(initial);

	const selected = toggleModeSelectOperation(
		toggleModeSelectOperation(initial, 'add'),
		'multiply',
	);
	const pond = advanceModeSelectToPond(selected);
	expect(pond.step).toBe('pond');
	expect(pond.selectedOperations).toEqual(['add', 'multiply']);

	const chosen = chooseModeSelectDifficulty(pond, 'expert');
	const math = returnModeSelectToMath(chosen);
	expect(math.selectedOperations).toEqual(['add', 'multiply']);
	expect(math.difficulty).toBe('expert');
	expect(advanceModeSelectToPond(math)).toEqual(chosen);
});

test('operation cards support any nonempty combination including all four', () => {
	const selected = (['add', 'subtract', 'multiply', 'divide'] as const)
		.reduce(toggleModeSelectOperation, createModeSelectSetupState());
	expect(selected.selectedOperations).toEqual(['add', 'subtract', 'multiply', 'divide']);
	expect(advanceModeSelectToPond(selected).step).toBe('pond');
	expect(toggleModeSelectOperation(selected, 'subtract').selectedOperations)
		.toEqual(['add', 'multiply', 'divide']);
});

test('optional panels keep the setup, and only the explicit pond screen can choose difficulty', () => {
	const selected = toggleModeSelectOperation(createModeSelectSetupState(), 'divide');
	const steps = showModeSelectPanel(selected, 'math-steps');
	expect(steps.panel).toBe('math-steps');
	expect(toggleModeSelectOperation(steps, 'add')).toBe(steps);
	expect(closeModeSelectPanel(steps)).toEqual(selected);
	expect(showModeSelectPanel(selected, 'difficulty-help')).toBe(selected);

	const pond = advanceModeSelectToPond(selected);
	const help = showModeSelectPanel(pond, 'difficulty-help');
	expect(chooseModeSelectDifficulty(help, 'easy')).toBe(help);
	expect(closeModeSelectPanel(help)).toEqual(pond);
	expect(chooseModeSelectDifficulty(pond, 'easy').difficulty).toBe('easy');
});

test('Play requests a run only with operations and a selected difficulty', () => {
	const selected = toggleModeSelectOperation(createModeSelectSetupState(), 'subtract');
	expect(modeSelectGameRequest(selected, 1)).toBeUndefined();

	const pond = advanceModeSelectToPond(selected);
	expect(modeSelectGameRequest(pond, 3)).toBeUndefined();
	expect(modeSelectGameRequest(chooseModeSelectDifficulty(pond, 'medium'), 3)).toEqual({
		mode: ['subtract'],
		difficulty: 'medium',
		startingLevel: 3,
	});
});

test('revealing starting level opens Math steps from either setup step', () => {
	const selected = toggleModeSelectOperation(createModeSelectSetupState(), 'multiply');
	const pond = chooseModeSelectDifficulty(advanceModeSelectToPond(selected), 'medium');

	expect(revealModeSelectLevelSelection(pond)).toEqual({
		...pond,
		step: 'math',
		panel: 'math-steps',
	});
	expect(revealModeSelectLevelSelection(createModeSelectSetupState())).toMatchObject({
		step: 'math',
		panel: 'math-steps',
	});
});
