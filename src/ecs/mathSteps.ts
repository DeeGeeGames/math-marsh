import { GAME_CONFIG } from '../config';
import type {
	EquationModeState,
	EquationOperandRanges,
	EquationOperation,
	EquationPromptKind,
	MathDifficulty,
} from './types';

export type MathStepDefinition = Readonly<{
  step: number;
  operandMaxima: Readonly<Record<EquationOperation, number>>;
  assessmentFormats: readonly EquationPromptKind[];
}>;

export const MATH_FINAL_STEP = 11;

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

const defineMathStep = function(
  step: number,
  addSubtractMaximum: number,
  multiplyDivideMaximum: number,
  assessmentFormats: readonly EquationPromptKind[],
): MathStepDefinition {
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

export const MATH_STEPS: readonly MathStepDefinition[] = [
  defineMathStep(1, 3, 4, resultOnlyFormats),
  defineMathStep(2, 4, 5, resultOnlyFormats),
  defineMathStep(3, 5, 6, resultOnlyFormats),
  defineMathStep(4, 6, 7, resultAndOperandFormats),
  defineMathStep(5, 8, 8, resultAndOperandFormats),
  defineMathStep(6, 10, 9, resultAndOperandFormats),
  defineMathStep(7, 12, 10, allFormats),
  defineMathStep(8, 14, 11, allFormats),
  defineMathStep(9, 16, 12, allFormats),
  defineMathStep(10, 18, 14, allFormats),
  defineMathStep(11, 20, 16, allFormats),
];

export const mathStepForNumber = function(step: number): MathStepDefinition | undefined {
  return MATH_STEPS.find(candidate => candidate.step === step);
};

export const mathPromptForAnswer = function(
	step: number,
	completedCorrectAnswers: number,
): EquationPromptKind | undefined {
	if (!Number.isSafeInteger(completedCorrectAnswers) || completedCorrectAnswers < 0) return undefined;
	const formats = mathStepForNumber(step)?.assessmentFormats;
	return formats?.[completedCorrectAnswers % formats.length];
};

export const mathOperandRanges = function(
  step: number,
  operation: EquationOperation,
): EquationOperandRanges | undefined {
  const maximum = mathStepForNumber(step)?.operandMaxima[operation];
  if (!maximum) return undefined;
  return {
    left: { min: 1, max: maximum },
    right: { min: 1, max: maximum },
  };
};

export const createMathEquationModeState = function(
	step: number,
	operation: EquationOperation,
	completedCorrectAnswers: number,
	clearedThisLevel = 0,
): EquationModeState | undefined {
	const promptKind = mathPromptForAnswer(step, completedCorrectAnswers);
	const operandRanges = mathOperandRanges(step, operation);
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

export const mathQuestionBudgetSeconds = function(
	step: number,
	operation: EquationOperation,
	promptKind: EquationPromptKind,
	difficulty: MathDifficulty = 'easy',
): number | undefined {
	const definition = mathStepForNumber(step);
	const ranges = mathOperandRanges(step, operation);
	const base = GAME_CONFIG.MATH_PROGRESSION.BASE_SECONDS_PER_CORRECT[operation][promptKind];
	const perOperandStep = GAME_CONFIG.MATH_PROGRESSION.SECONDS_PER_OPERAND_ABOVE_THREE;
	if (!definition
		|| !ranges
		|| !Number.isFinite(base)
		|| base <= 0
		|| !Number.isFinite(perOperandStep)
		|| perOperandStep < 0) {
		return undefined;
	}
	const rangeAdjustment = Math.max(0, Math.max(ranges.left.max, ranges.right.max) - 3) * perOperandStep;
	const budget = (base + rangeAdjustment) * GAME_CONFIG.MATH_PROGRESSION.BOARD_TIME_MULTIPLIER[difficulty];
	return Number.isFinite(budget) && budget > 0 ? budget : undefined;
};

export const mathStepLabel = function(step: number, operation: EquationOperation): string {
  const definition = mathStepForNumber(step);
  if (!definition) return 'Math skill unavailable';
  const name = { add: 'Addition', subtract: 'Subtraction', multiply: 'Multiplication', divide: 'Division' }[operation];
  const maximum = definition.operandMaxima[operation];
  const range = operation === 'multiply' ? `factors 1–${maximum}`
    : operation === 'divide' ? `dividends up to ${maximum}` : `numbers 1–${maximum}`;
  return `${name} · ${range}`;
};
