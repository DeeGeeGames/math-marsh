import type {
  EquationModeState,
  EquationOperandRanges,
  EquationOperation,
  EquationPromptKind,
  EquationValueRange,
  GameMode,
  MathDifficulty,
} from '../ecs/types';

export interface EquationOperandCandidate {
  id: number;
  value: number;
}

export interface EquationCandidate {
  operandValues: number[];
  target: number;
}

interface EquationOperationDefinition {
  symbol: string;
  operandCount: 2;
  evaluate: (operands: readonly number[]) => number;
  resultRange: (ranges: EquationOperandRanges) => EquationValueRange;
  randomCandidate: (ranges: EquationOperandRanges) => EquationCandidate;
  operandCandidates: (
    operands: readonly EquationOperandCandidate[],
    difficulty: MathDifficulty,
  ) => EquationCandidate[];
  resultCandidates: (
    answers: readonly EquationOperandCandidate[],
    ranges: EquationOperandRanges,
  ) => EquationCandidate[];
}

const operationByMode: Record<Exclude<GameMode, 'anything'>, EquationOperation> = {
  addition: 'add',
  subtraction: 'subtract',
  multiplication: 'multiply',
  division: 'divide',
} as const;

const operationsList: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'] as const;

const randomIndex = (length: number): number => Math.floor(Math.random() * length);

const randomFrom = <T>(items: readonly T[]): T => {
  const item = items[randomIndex(items.length)];
  if (!item) throw new Error('Cannot choose from an empty list');
  return item;
};

const randomValue = (range: EquationValueRange): number =>
  range.min + Math.floor(Math.random() * (range.max - range.min + 1));

const valuesInRange = (range: EquationValueRange): number[] =>
  Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);

function difficultyGrowthStepsForLevel(level: number): number {
  return Math.floor((level - 1) / 2);
}

const rangeMax = (
  difficulty: MathDifficulty,
  level: number,
  config: Record<MathDifficulty, { start: number; growth: number; cap?: number }>,
): number => {
  const difficultyGrowthSteps = difficultyGrowthStepsForLevel(level);
  const uncapped = config[difficulty].start + difficultyGrowthSteps * config[difficulty].growth;
  const cap = config[difficulty].cap;
  return cap ? Math.min(cap, uncapped) : uncapped;
};

const addSubtractConfig = {
  easy: { start: 3, growth: 2, cap: 10 },
  medium: { start: 5, growth: 3, cap: 20 },
  expert: { start: 20, growth: 10 },
} as const;

const multiplyDivideLeftConfig = {
  easy: { start: 3, growth: 1, cap: 6 },
  medium: { start: 4, growth: 2, cap: 12 },
  expert: { start: 12, growth: 4 },
} as const;

const multiplyDivideRightConfig = {
  easy: { start: 4, growth: 1, cap: 6 },
  medium: { start: 6, growth: 2, cap: 12 },
  expert: { start: 12, growth: 4 },
} as const;

const operationUsesProductRanges = (operation: EquationOperation): boolean =>
  operation === 'multiply' || operation === 'divide';

export const equationOperandRanges = (
  level: number,
  difficulty: MathDifficulty,
  operation: EquationOperation,
): EquationOperandRanges => {
  const config = operationUsesProductRanges(operation)
    ? { left: multiplyDivideLeftConfig, right: multiplyDivideRightConfig }
    : { left: addSubtractConfig, right: addSubtractConfig };

  return {
    left: { min: 1, max: rangeMax(difficulty, level, config.left) },
    right: { min: 1, max: rangeMax(difficulty, level, config.right) },
  };
};

const shuffled = <T>(items: readonly T[]): T[] =>
  items
    .map(item => ({ item, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);

const addOperandCandidates = (operands: readonly EquationOperandCandidate[]): EquationCandidate[] =>
  operands.flatMap((left, leftIndex) =>
    operands.slice(leftIndex + 1).map((right) => ({
      operandValues: [left.value, right.value],
      target: left.value + right.value,
    })),
  );

const multiplyOperandCandidates = (operands: readonly EquationOperandCandidate[]): EquationCandidate[] =>
  operands.flatMap((left, leftIndex) =>
    operands.slice(leftIndex + 1).map((right) => ({
      operandValues: [left.value, right.value],
      target: left.value * right.value,
    })),
  );

const orderedOperandCandidates = (
  operands: readonly EquationOperandCandidate[],
  evaluate: (operands: readonly number[]) => number,
): EquationCandidate[] =>
  operands.flatMap(left =>
    operands
      .filter(right => right.id !== left.id)
      .map(right => ({
        operandValues: [left.value, right.value],
        target: evaluate([left.value, right.value]),
      })),
  );

const subtractOperandCandidates = (
  operands: readonly EquationOperandCandidate[],
  difficulty: MathDifficulty,
): EquationCandidate[] =>
  orderedOperandCandidates(operands, ([left, right]) => left - right)
    .filter(candidate => difficulty !== 'easy' || candidate.target >= 0);

const divideOperandCandidates = (operands: readonly EquationOperandCandidate[]): EquationCandidate[] =>
  orderedOperandCandidates(operands, ([left, right]) => left / right)
    .filter(candidate => Number.isInteger(candidate.target));

const addResultCandidates = (
  answers: readonly EquationOperandCandidate[],
  ranges: EquationOperandRanges,
): EquationCandidate[] =>
  answers.flatMap(answer =>
    valuesInRange(ranges.left)
      .map(left => ({ left, right: answer.value - left }))
      .filter(({ right }) => right >= ranges.right.min && right <= ranges.right.max)
      .map(({ left, right }) => ({
        operandValues: [left, right],
        target: answer.value,
      })),
  );

const subtractResultCandidates = (
  answers: readonly EquationOperandCandidate[],
  ranges: EquationOperandRanges,
): EquationCandidate[] =>
  answers.flatMap(answer =>
    valuesInRange(ranges.right)
      .map(right => ({ left: answer.value + right, right }))
      .filter(({ left }) => left >= ranges.left.min && left <= ranges.left.max)
      .map(({ left, right }) => ({
        operandValues: [left, right],
        target: answer.value,
      })),
  );

const multiplyResultCandidates = (
  answers: readonly EquationOperandCandidate[],
  ranges: EquationOperandRanges,
): EquationCandidate[] =>
  answers.flatMap(answer =>
    valuesInRange(ranges.left)
      .filter(left => answer.value % left === 0)
      .map(left => ({ left, right: answer.value / left }))
      .filter(({ right }) => right >= ranges.right.min && right <= ranges.right.max)
      .map(({ left, right }) => ({
        operandValues: [left, right],
        target: answer.value,
      })),
  );

const divideResultCandidates = (
  answers: readonly EquationOperandCandidate[],
  ranges: EquationOperandRanges,
): EquationCandidate[] =>
  answers.flatMap(answer =>
    valuesInRange(ranges.right)
      .map(right => ({ left: answer.value * right, right }))
      .filter(({ left }) => left >= ranges.left.min && left <= ranges.left.max)
      .map(({ left, right }) => ({
        operandValues: [left, right],
        target: answer.value,
      })),
  );

const randomAddCandidate = (ranges: EquationOperandRanges): EquationCandidate => {
  const operandValues = [randomValue(ranges.left), randomValue(ranges.right)];
  return { operandValues, target: operandValues[0] + operandValues[1] };
};

const randomSubtractCandidate = (ranges: EquationOperandRanges): EquationCandidate => {
  const right = randomValue(ranges.right);
  const left = randomValue({ min: right, max: ranges.left.max });
  return { operandValues: [left, right], target: left - right };
};

const randomMultiplyCandidate = (ranges: EquationOperandRanges): EquationCandidate => {
  const operandValues = [randomValue(ranges.left), randomValue(ranges.right)];
  return { operandValues, target: operandValues[0] * operandValues[1] };
};

const randomDivideCandidate = (ranges: EquationOperandRanges): EquationCandidate => {
  const right = randomValue(ranges.right);
  const quotientMax = Math.max(1, Math.floor(ranges.left.max / right));
  const target = randomValue({ min: 1, max: quotientMax });
  return { operandValues: [target * right, right], target };
};

const operations: Record<EquationOperation, EquationOperationDefinition> = {
  add: {
    symbol: '+',
    operandCount: 2,
    evaluate: ([left, right]) => left + right,
    resultRange: ranges => ({ min: ranges.left.min + ranges.right.min, max: ranges.left.max + ranges.right.max }),
    randomCandidate: randomAddCandidate,
    operandCandidates: addOperandCandidates,
    resultCandidates: addResultCandidates,
  },
  subtract: {
    symbol: '-',
    operandCount: 2,
    evaluate: ([left, right]) => left - right,
    resultRange: ranges => ({ min: 0, max: ranges.left.max - ranges.right.min }),
    randomCandidate: randomSubtractCandidate,
    operandCandidates: subtractOperandCandidates,
    resultCandidates: subtractResultCandidates,
  },
  multiply: {
    symbol: 'x',
    operandCount: 2,
    evaluate: ([left, right]) => left * right,
    resultRange: ranges => ({ min: ranges.left.min * ranges.right.min, max: ranges.left.max * ranges.right.max }),
    randomCandidate: randomMultiplyCandidate,
    operandCandidates: multiplyOperandCandidates,
    resultCandidates: multiplyResultCandidates,
  },
  divide: {
    symbol: '÷',
    operandCount: 2,
    evaluate: ([left, right]) => left / right,
    resultRange: ranges => ({ min: 1, max: ranges.left.max }),
    randomCandidate: randomDivideCandidate,
    operandCandidates: divideOperandCandidates,
    resultCandidates: divideResultCandidates,
  },
} as const;

export const operationForMode = (gameMode: GameMode): EquationOperation =>
  gameMode === 'anything' ? randomFrom(operationsList) : operationByMode[gameMode];

export const equationPromptKindForLevel = (level: number): EquationPromptKind =>
  level % 2 === 1 ? 'selectResult' : 'selectOperands';

export const equationResultRange = (
  operation: EquationOperation,
  ranges: EquationOperandRanges,
): EquationValueRange =>
  operations[operation].resultRange(ranges);

export const createEquationModeState = (
  level: number,
  difficulty: MathDifficulty,
  gameMode: GameMode,
  clearedThisLevel = 0,
): EquationModeState => {
  const operation = operationForMode(gameMode);
  const promptKind = equationPromptKindForLevel(level);
  return {
    operation,
    promptKind,
    difficulty,
    operandsRequired: promptKind === 'selectResult' ? 1 : operations[operation].operandCount,
    target: 0,
    promptValues: [],
    selectedProblemIds: [],
    clearedThisLevel,
    level,
    operandRanges: equationOperandRanges(level, difficulty, operation),
  };
};

export const createRandomEquationCandidate = (state: EquationModeState): EquationCandidate =>
  operations[state.operation].randomCandidate(state.operandRanges);

export const chooseEquationCandidate = (
  state: EquationModeState,
  operands: readonly EquationOperandCandidate[],
): EquationCandidate | undefined => {
  const operation = operations[state.operation];
  const candidates = state.promptKind === 'selectResult'
    ? operation.resultCandidates(operands, state.operandRanges)
    : operation.operandCandidates(operands, state.difficulty);
  return candidates[randomIndex(candidates.length)];
};

export const equationProblemValuesForCandidate = (
  state: EquationModeState,
  candidate: EquationCandidate,
  totalProblems: number,
): number[] => {
  const answerValues = state.promptKind === 'selectResult'
    ? [candidate.target]
    : candidate.operandValues;
  const decoyRange = state.promptKind === 'selectResult'
    ? equationResultRange(state.operation, state.operandRanges)
    : state.operandRanges.left;
  const decoysNeeded = Math.max(0, totalProblems - answerValues.length);
  const decoys = Array.from({ length: decoysNeeded }, () => randomValue(decoyRange));
  return shuffled([...answerValues, ...decoys]);
};

export const equationSelectionText = (
  state: EquationModeState,
  selectedValues: readonly number[],
): string => {
  const operation = operations[state.operation];
  if (state.promptKind === 'selectResult') {
    const result = selectedValues[0]?.toString() ?? '_';
    return `${state.promptValues.join(` ${operation.symbol} `)} = ${result}`;
  }

  const blanks = Array.from({ length: state.operandsRequired }, (_, index) =>
    selectedValues[index]?.toString() ?? '_',
  );
  return `${blanks.join(` ${operation.symbol} `)} = ${state.target}`;
};

export const evaluateEquationSelection = (
  state: EquationModeState,
  selectedValues: readonly number[],
): boolean =>
  selectedValues.length === state.operandsRequired
    && (state.promptKind === 'selectResult'
      ? selectedValues[0] === state.target
      : operations[state.operation].evaluate(selectedValues) === state.target);
