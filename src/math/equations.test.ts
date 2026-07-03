import { describe, expect, test } from 'bun:test';
import type { EquationOperation, GameMode, MathDifficulty } from '../ecs/types';
import {
  createEquationModeState,
  createRandomEquationCandidate,
  chooseEquationCandidate,
  equationOperandRanges,
  evaluateEquationSelection,
  operationForMode,
} from './equations';

const modes = ['addition', 'subtraction', 'multiplication', 'division'] as const satisfies readonly GameMode[];

const validResultSelection = (mode: GameMode): boolean => {
  const state = createEquationModeState(1, 'medium', mode);
  const candidate = createRandomEquationCandidate(state);
  return state.promptKind === 'selectResult'
    && evaluateEquationSelection(
      { ...state, target: candidate.target, promptValues: candidate.operandValues },
      [candidate.target],
    );
};

const validOperandSelection = (mode: GameMode): boolean => {
  const state = createEquationModeState(2, 'medium', mode);
  const candidate = createRandomEquationCandidate(state);
  return state.promptKind === 'selectOperands'
    && evaluateEquationSelection(
      { ...state, target: candidate.target, promptValues: candidate.operandValues },
      candidate.operandValues,
    );
};

const candidateTargetsFor = (
  mode: GameMode,
  difficulty: MathDifficulty,
  level: number,
  count: number,
): number[] =>
  Array.from({ length: count }, () => {
    const state = createEquationModeState(level, difficulty, mode);
    return createRandomEquationCandidate(state).target;
  });

const expectPairedDifficultyGrowth = (
  difficulty: MathDifficulty,
  operation: EquationOperation,
): void => {
  expect(equationOperandRanges(1, difficulty, operation)).toEqual(equationOperandRanges(2, difficulty, operation));
  expect(equationOperandRanges(3, difficulty, operation)).toEqual(equationOperandRanges(4, difficulty, operation));
  expect(equationOperandRanges(2, difficulty, operation)).not.toEqual(equationOperandRanges(3, difficulty, operation));
};

describe('equation generation', () => {
  test('each operation can produce valid odd-level result prompts', () => {
    expect(modes.every(validResultSelection)).toBe(true);
  });

  test('each operation can produce valid even-level operand prompts', () => {
    expect(modes.every(validOperandSelection)).toBe(true);
  });

  test('subtraction and division operand prompts are ordered', () => {
    const subtraction = createEquationModeState(2, 'medium', 'subtraction');
    const subtractionCandidate = createRandomEquationCandidate(subtraction);
    const division = createEquationModeState(2, 'medium', 'division');
    const divisionCandidate = createRandomEquationCandidate(division);

    expect(evaluateEquationSelection(
      { ...subtraction, target: subtractionCandidate.target },
      subtractionCandidate.operandValues,
    )).toBe(true);
    expect(evaluateEquationSelection(
      { ...subtraction, target: subtractionCandidate.target },
      [...subtractionCandidate.operandValues].reverse(),
    )).toBe(subtractionCandidate.operandValues[0] === subtractionCandidate.operandValues[1]);

    expect(evaluateEquationSelection(
      { ...division, target: divisionCandidate.target },
      divisionCandidate.operandValues,
    )).toBe(true);
    expect(evaluateEquationSelection(
      { ...division, target: divisionCandidate.target },
      [...divisionCandidate.operandValues].reverse(),
    )).toBe(divisionCandidate.operandValues[0] === divisionCandidate.operandValues[1]);
  });

  test('easy subtraction operand prompts do not target negative results', () => {
    const originalRandom = Math.random;
    const state = createEquationModeState(2, 'easy', 'subtraction');
    const operands = [
      { id: 1, value: 1 },
      { id: 2, value: 2 },
    ] as const;

    Math.random = function random(): number {
      return 0;
    };

    try {
      const candidate = chooseEquationCandidate(state, operands);
      if (!candidate) throw new Error('Expected subtraction operand candidate');

      expect(candidate.target).toBeGreaterThanOrEqual(0);
      expect(candidate.operandValues).toEqual([2, 1]);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('division produces only integer-result equations', () => {
    const targets = candidateTargetsFor('division', 'expert', 8, 200);
    expect(targets.every(Number.isInteger)).toBe(true);
  });

  test('easy and medium ranges grow to caps without exceeding caps', () => {
    expect(equationOperandRanges(20, 'easy', 'add')).toEqual({
      left: { min: 1, max: 10 },
      right: { min: 1, max: 10 },
    });
    expect(equationOperandRanges(20, 'easy', 'multiply')).toEqual({
      left: { min: 1, max: 6 },
      right: { min: 1, max: 6 },
    });
    expect(equationOperandRanges(20, 'medium', 'subtract')).toEqual({
      left: { min: 1, max: 20 },
      right: { min: 1, max: 20 },
    });
    expect(equationOperandRanges(20, 'medium', 'divide')).toEqual({
      left: { min: 1, max: 12 },
      right: { min: 1, max: 12 },
    });
  });

  test('operand ranges keep the same difficulty across each prompt pair', () => {
    expectPairedDifficultyGrowth('medium', 'add');
    expectPairedDifficultyGrowth('expert', 'multiply');
  });

  test('expert ranges grow linearly without caps', () => {
    expect(equationOperandRanges(5, 'expert', 'add')).toEqual({
      left: { min: 1, max: 40 },
      right: { min: 1, max: 40 },
    });
    expect(equationOperandRanges(5, 'expert', 'multiply')).toEqual({
      left: { min: 1, max: 20 },
      right: { min: 1, max: 20 },
    });
  });

  test('anything can generate all four operations over repeated candidates', () => {
    const originalRandom = Math.random;
    const sequence = [0, 0.25, 0.5, 0.75] as const;
    const state = { index: 0 };

    Math.random = function random(): number {
      const value = sequence[state.index % sequence.length];
      state.index += 1;
      return value;
    };

    try {
      const operations = new Set(
        Array.from({ length: 4 }, () => operationForMode('anything')),
      );
      expect(operations).toEqual(new Set(['add', 'subtract', 'multiply', 'divide']));
    } finally {
      Math.random = originalRandom;
    }
  });
});
