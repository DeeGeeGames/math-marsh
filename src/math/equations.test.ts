import { describe, expect, test } from 'bun:test';
import type { EquationOperation, GameMode, MathDifficulty } from '../ecs/types';
import {
  createEquationModeState,
  createRandomEquationCandidate,
  chooseEquationCandidate,
  equationOperandRanges,
  equationProblemValuesForCandidate,
  equationSelectionText,
  evaluateEquationSelection,
  operationForMode,
} from './equations';

const modes = [['add'], ['subtract'], ['multiply'], ['divide']] as const satisfies readonly GameMode[];

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

const expectTripletDifficultyGrowth = (
  difficulty: MathDifficulty,
  operation: EquationOperation,
): void => {
  expect(equationOperandRanges(1, difficulty, operation)).toEqual(equationOperandRanges(2, difficulty, operation));
  expect(equationOperandRanges(2, difficulty, operation)).toEqual(equationOperandRanges(3, difficulty, operation));
  expect(equationOperandRanges(4, difficulty, operation)).toEqual(equationOperandRanges(6, difficulty, operation));
  expect(equationOperandRanges(2, difficulty, operation)).not.toEqual(equationOperandRanges(4, difficulty, operation));
};

describe('equation generation', () => {
  test('each operation can produce valid first-level result prompts', () => {
    expect(modes.every(validResultSelection)).toBe(true);
  });

  test('each operation can produce valid second-level operand prompts', () => {
    expect(modes.every(validOperandSelection)).toBe(true);
  });

  test('subtraction and division operand prompts are ordered', () => {
    const subtraction = createEquationModeState(2, 'medium', ['subtract']);
    const subtractionCandidate = createRandomEquationCandidate(subtraction);
    const division = createEquationModeState(2, 'medium', ['divide']);
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
    const state = createEquationModeState(2, 'easy', ['subtract']);
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
    const targets = candidateTargetsFor(['divide'], 'expert', 8, 200);
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

  test('operand ranges keep the same difficulty across each prompt triplet', () => {
    modes.forEach(([operation]) => {
      (['easy', 'medium', 'expert'] as const).forEach(difficulty => expectTripletDifficultyGrowth(difficulty, operation));
    });
  });

  test('expert ranges grow linearly without caps', () => {
    expect(equationOperandRanges(7, 'expert', 'add')).toEqual({
      left: { min: 1, max: 40 },
      right: { min: 1, max: 40 },
    });
    expect(equationOperandRanges(7, 'expert', 'multiply')).toEqual({
      left: { min: 1, max: 20 },
      right: { min: 1, max: 20 },
    });
  });

  test('selected operations are chosen randomly without including unselected operations', () => {
    const originalRandom = Math.random;
    const sequence = [0, 0.49, 0.5, 0.99] as const;
    const state = { index: 0 };

    Math.random = function random(): number {
      const value = sequence[state.index % sequence.length];
      state.index += 1;
      return value;
    };

    try {
      const operations = new Set(
        Array.from({ length: 4 }, () => operationForMode(['add', 'divide'])),
      );
      expect(operations).toEqual(new Set(['add', 'divide']));
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe('mixed operand and result prompts', () => {
  test('cycles all three prompt types before growing the number ranges', () => {
    expect(Array.from({ length: 6 }, (_, index) => createEquationModeState(index + 1, 'easy', ['add']).promptKind)).toEqual([
      'selectResult', 'selectOperands', 'selectOperandAndResult',
      'selectResult', 'selectOperands', 'selectOperandAndResult',
    ]);
  });

  test('fresh and remaining boards provide playable mixed prompts for all operations', () => {
    modes.forEach(mode => {
      (['easy', 'medium', 'expert'] as const).forEach(difficulty => {
        Array.from({ length: 50 }, () => {
          const state = createEquationModeState(3, difficulty, mode);
          const candidate = createRandomEquationCandidate(state);
          const values = equationProblemValuesForCandidate(state, candidate, 18);
          const populated = { ...state, target: candidate.target, promptValues: candidate.operandValues };
          expect(candidate.target).not.toBe(0);
          expect(evaluateEquationSelection(populated, [candidate.operandValues[1], candidate.target])).toBe(true);
          expect(values).toContain(candidate.operandValues[1]);
          expect(values).toContain(candidate.target);
          const next = chooseEquationCandidate(state, values.map((value, id) => ({ id, value })));
          if (!next) throw new Error('Expected a playable mixed prompt');
          expect(evaluateEquationSelection({ ...state, target: next.target, promptValues: next.operandValues }, [next.operandValues[1], next.target])).toBe(true);
        });
      });
    });
  });

  test('fills the operand first and accepts alternative correct pairs', () => {
    const state = { ...createEquationModeState(3, 'medium', ['add']), target: 5, promptValues: [3, 2] };
    expect(equationSelectionText(state, [])).toBe('3 + _ = _');
    expect(equationSelectionText(state, [4])).toBe('3 + 4 = _');
    expect(equationSelectionText(state, [4, 7])).toBe('3 + 4 = 7');
    expect(evaluateEquationSelection(state, [4])).toBe(false);
    expect(evaluateEquationSelection(state, [4, 7])).toBe(true);
    expect(evaluateEquationSelection(state, [7, 4])).toBe(false);
    expect(evaluateEquationSelection(state, [4, 8])).toBe(false);
  });

  test('subtraction and division preserve operand order and reject invalid arithmetic', () => {
    const subtract = { ...createEquationModeState(3, 'medium', ['subtract']), target: 3, promptValues: [5, 2] };
    const divide = { ...createEquationModeState(3, 'medium', ['divide']), target: 2, promptValues: [4, 2] };
    expect(evaluateEquationSelection(subtract, [1, 4])).toBe(true);
    expect(evaluateEquationSelection(subtract, [4, 1])).toBe(true);
    expect(evaluateEquationSelection(subtract, [2, 7])).toBe(false);
    expect(evaluateEquationSelection(subtract, [5, 0])).toBe(true);
    expect(evaluateEquationSelection(divide, [1, 4])).toBe(true);
    expect(evaluateEquationSelection(divide, [3, 1])).toBe(false);
    expect(evaluateEquationSelection(divide, [0, Infinity])).toBe(false);
  });

  test('equal operand and result values require separate pads', () => {
    const state = createEquationModeState(3, 'medium', ['divide']);
    expect(chooseEquationCandidate(state, [{ id: 1, value: 2 }])).toBeUndefined();
    const candidate = chooseEquationCandidate(state, [{ id: 1, value: 2 }, { id: 2, value: 2 }]);
    if (!candidate) throw new Error('Expected a duplicate-value candidate');
    expect(candidate).toEqual({ operandValues: [4, 2], target: 2 });
    expect(equationProblemValuesForCandidate(state, candidate, 2)).toEqual([2, 2]);
  });

  test('reports no candidate when remaining pads cannot form a valid pair', () => {
    const state = createEquationModeState(3, 'easy', ['add']);
    expect(chooseEquationCandidate(state, [{ id: 1, value: 20 }, { id: 2, value: 30 }])).toBeUndefined();
  });
});
