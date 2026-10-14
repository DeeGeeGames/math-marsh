import { GAME_CONFIG } from '../config';
import type {
	EquationModeState,
	EquationOperandRanges,
	EquationOperation,
	EquationPromptKind,
} from './types';

export type PracticeStepDefinition = Readonly<{
  step: number;
  operandMaxima: Readonly<Record<EquationOperation, number>>;
  assessmentFormats: readonly EquationPromptKind[];
}>;

export const PRACTICE_FINAL_STEP = 11;

const resultOnlyFormats: readonly EquationPromptKind[] = Array.from(
  { length: 6 },
  () => 'selectResult',
);

const resultAndOperandFormats: readonly EquationPromptKind[] = [
  'selectResult',
  'selectOperands',
  'selectResult',
  'selectOperands',
  'selectResult',
  'selectOperands',
];

const allFormats: readonly EquationPromptKind[] = [
  'selectResult',
  'selectOperands',
  'selectOperandAndResult',
  'selectResult',
  'selectOperands',
  'selectOperandAndResult',
];

const definePracticeStep = function(
  step: number,
  addSubtractMaximum: number,
  multiplyDivideMaximum: number,
  assessmentFormats: readonly EquationPromptKind[],
): PracticeStepDefinition {
  return {
    step,
    operandMaxima: {
      add: addSubtractMaximum,
      subtract: addSubtractMaximum,
      multiply: multiplyDivideMaximum,
      divide: multiplyDivideMaximum,
    },
    assessmentFormats,
  };
};

export const PRACTICE_STEPS: readonly PracticeStepDefinition[] = [
  definePracticeStep(1, 3, 4, resultOnlyFormats),
  definePracticeStep(2, 4, 5, resultOnlyFormats),
  definePracticeStep(3, 5, 6, resultOnlyFormats),
  definePracticeStep(4, 6, 7, resultAndOperandFormats),
  definePracticeStep(5, 8, 8, resultAndOperandFormats),
  definePracticeStep(6, 10, 9, resultAndOperandFormats),
  definePracticeStep(7, 12, 10, allFormats),
  definePracticeStep(8, 14, 11, allFormats),
  definePracticeStep(9, 16, 12, allFormats),
  definePracticeStep(10, 18, 14, allFormats),
  definePracticeStep(11, 20, 16, allFormats),
];

export const practiceStepForNumber = function(step: number): PracticeStepDefinition | undefined {
  return PRACTICE_STEPS.find(candidate => candidate.step === step);
};

export const practicePromptForAnswer = function(
	step: number,
	completedCorrectAnswers: number,
): EquationPromptKind | undefined {
	if (!Number.isSafeInteger(completedCorrectAnswers) || completedCorrectAnswers < 0) return undefined;
	const formats = practiceStepForNumber(step)?.assessmentFormats;
	return formats?.[completedCorrectAnswers % formats.length];
};

export const practiceOperandRanges = function(
  step: number,
  operation: EquationOperation,
): EquationOperandRanges | undefined {
  const maximum = practiceStepForNumber(step)?.operandMaxima[operation];
  if (!maximum) return undefined;
  return {
    left: { min: 1, max: maximum },
    right: { min: 1, max: maximum },
  };
};

export const createPracticeEquationModeState = function(
	step: number,
	operation: EquationOperation,
	completedCorrectAnswers: number,
	clearedThisLevel = 0,
): EquationModeState | undefined {
	const promptKind = practicePromptForAnswer(step, completedCorrectAnswers);
	const operandRanges = practiceOperandRanges(step, operation);
	if (!promptKind || !operandRanges || !Number.isSafeInteger(clearedThisLevel) || clearedThisLevel < 0) {
		return undefined;
	}
	return {
		operation,
		promptKind,
		difficulty: 'easy',
		operandsRequired: promptKind === 'selectResult' ? 1 : 2,
		target: null,
		promptValues: [],
		selectedProblemIds: [],
		clearedThisLevel,
		level: step,
		operandRanges,
	};
};

export const practiceQuestionBudgetSeconds = function(
	step: number,
	operation: EquationOperation,
	promptKind: EquationPromptKind,
): number | undefined {
	const definition = practiceStepForNumber(step);
	const ranges = practiceOperandRanges(step, operation);
	const base = GAME_CONFIG.PRACTICE_PROGRESSION.BASE_SECONDS_PER_CORRECT[operation][promptKind];
	const perOperandStep = GAME_CONFIG.PRACTICE_PROGRESSION.SECONDS_PER_OPERAND_ABOVE_THREE;
	if (!definition?.assessmentFormats.includes(promptKind)
		|| !ranges
		|| !Number.isFinite(base)
		|| base <= 0
		|| !Number.isFinite(perOperandStep)
		|| perOperandStep < 0) {
		return undefined;
	}
	const rangeAdjustment = Math.max(0, Math.max(ranges.left.max, ranges.right.max) - 3) * perOperandStep;
	const budget = base + rangeAdjustment;
	return Number.isFinite(budget) && budget > 0 ? budget : undefined;
};
