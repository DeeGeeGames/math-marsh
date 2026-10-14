import { describe, expect, test } from 'bun:test';
import {
  MATH_FINAL_STEP,
  MATH_STEPS,
  createMathEquationModeState,
  mathOperandRanges,
  mathQuestionBudgetSeconds,
  mathPromptForAnswer,
  mathStepForNumber,
} from './mathSteps';

const countFormats = (step: number): Record<string, number> => {
  const formats = mathStepForNumber(step)?.assessmentFormats ?? [];
  return formats.reduce<Record<string, number>>((counts, format) => ({
    ...counts,
    [format]: (counts[format] ?? 0) + 1,
  }), {});
};

describe('adaptive math steps', () => {
  test('defines the approved 11-step catalog and terminal step', () => {
    expect(MATH_STEPS.map(({ step }) => step)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    expect(MATH_FINAL_STEP).toBe(11);
  });

  test('uses operation-specific maxima for each operand range', () => {
    expect(mathOperandRanges(1, 'add')).toEqual({
      left: { min: 1, max: 3 },
      right: { min: 1, max: 3 },
    });
    expect(mathOperandRanges(1, 'multiply')).toEqual({
      left: { min: 1, max: 4 },
      right: { min: 1, max: 4 },
    });
    expect(mathOperandRanges(11, 'subtract')?.left.max).toBe(20);
    expect(mathOperandRanges(11, 'divide')?.right.max).toBe(16);
    expect(mathOperandRanges(0, 'add')).toBeUndefined();
    expect(mathOperandRanges(12, 'divide')).toBeUndefined();
  });

  test('uses result prompts on steps 1 to 3, result and operand prompts on 4 to 6, then all formats', () => {
    expect(countFormats(1)).toEqual({ selectResult: 6 });
    expect(countFormats(3)).toEqual({ selectResult: 6 });
    expect(countFormats(4)).toEqual({ selectResult: 3, selectOperands: 3 });
    expect(countFormats(6)).toEqual({ selectResult: 3, selectOperands: 3 });
    expect(countFormats(7)).toEqual({
      selectResult: 2,
      selectOperands: 2,
      selectOperandAndResult: 2,
    });
    expect(countFormats(11)).toEqual({
      selectResult: 2,
      selectOperands: 2,
      selectOperandAndResult: 2,
    });
  });

  test('builds each six-question math prompt from the saved step and operation', () => {
		const prompts = Array.from({ length: 6 }, (_, index) => mathPromptForAnswer(7, index));
		expect(prompts).toEqual([
			'selectResult',
			'selectOperands',
			'selectOperandAndResult',
			'selectResult',
			'selectOperands',
			'selectOperandAndResult',
		]);
		const state = createMathEquationModeState(7, 'divide', 2, 4);
		expect(state).toMatchObject({
			operation: 'divide',
			promptKind: 'selectOperandAndResult',
			difficulty: 'easy',
			operandsRequired: 2,
			clearedThisLevel: 4,
			level: 7,
			operandRanges: { left: { min: 1, max: 10 }, right: { min: 1, max: 10 } },
		});
		expect(mathQuestionBudgetSeconds(7, 'divide', 'selectOperandAndResult')).toBeGreaterThan(0);
		expect(mathPromptForAnswer(12, 0)).toBeUndefined();
		expect(mathQuestionBudgetSeconds(1, 'add', 'selectOperandAndResult')).toBeGreaterThan(0);
	});
});
