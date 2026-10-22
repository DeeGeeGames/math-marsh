import type { EquationOperation } from '../ecs/types';

export interface PracticeFact {
  readonly id: string;
  readonly operation: EquationOperation;
  readonly left: number;
  readonly right: number;
  readonly result: number;
}

export interface PracticeTopic {
  readonly id: string;
  readonly label: string;
  readonly operation: EquationOperation;
  readonly facts: readonly PracticeFact[];
}

export const practiceFactId = function (
  operation: EquationOperation,
  left: number,
  right: number,
): string {
  return `${operation}:${left}:${right}`;
};

const createFact = function (
  operation: EquationOperation,
  left: number,
  right: number,
): PracticeFact {
  const result = operation === 'add' ? left + right
    : operation === 'subtract' ? left - right
      : operation === 'multiply' ? left * right : left / right;
  return { id: practiceFactId(operation, left, right), operation, left, right, result };
};

const uniqueFacts = function (facts: readonly PracticeFact[]): PracticeFact[] {
  return Array.from(new Map(facts.map(fact => [fact.id, fact])).values());
};

const inverseFacts = function (fact: PracticeFact): PracticeFact[] {
  const { operation, left, right, result } = fact;
  switch (operation) {
    case 'add':
      return [createFact('subtract', result, left), createFact('subtract', result, right)];
    case 'subtract':
      return [createFact('add', result, right), createFact('add', right, result)];
    case 'multiply':
      return [
        ...(left === 0 ? [] : [createFact('divide', result, left)]),
        ...(right === 0 ? [] : [createFact('divide', result, right)]),
      ];
    case 'divide':
      return [createFact('multiply', result, right), createFact('multiply', right, result)];
  }
};

const range = function (start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const additionGoals = range(3, 20).map(target => ({
  id: `make-${target}`,
  label: `Make ${target}`,
  facts: range(0, target).map(left => createFact('add', left, target - left)),
}));

/** The facts on each topic are the authoritative base membership and denominator. */
export const PRACTICE_TOPICS: readonly PracticeTopic[] = [
  ...range(1, 12).map(table => ({
    id: `multiply-table-${table}`,
    label: `${table} times table`,
    operation: 'multiply' as const,
    facts: uniqueFacts(range(1, 12).flatMap(multiplier => [
      createFact('multiply', table, multiplier),
      createFact('multiply', multiplier, table),
    ])),
  })),
  ...range(1, 12).map(table => ({
    id: `divide-table-${table}`,
    label: `Divide by ${table}`,
    operation: 'divide' as const,
    facts: range(1, 12).map(quotient => createFact('divide', table * quotient, table)),
  })),
  ...additionGoals.map(goal => ({
    id: `add-${goal.id}`,
    label: goal.label,
    operation: 'add' as const,
    facts: goal.facts,
  })),
  ...additionGoals.map(goal => ({
    id: `subtract-${goal.id}`,
    label: goal.label,
    operation: 'subtract' as const,
    facts: uniqueFacts(goal.facts.flatMap(inverseFacts)),
  })),
];

export const practiceTopic = function (id: unknown): PracticeTopic | undefined {
  return typeof id === 'string' ? PRACTICE_TOPICS.find(topic => topic.id === id) : undefined;
};

/** Related facts add the inverse operation; each equation retains its own identity. */
export const practiceFacts = function (topic: PracticeTopic, related = false): readonly PracticeFact[] {
  if (!related) return topic.facts;
  const expanded = uniqueFacts([...topic.facts, ...topic.facts.flatMap(inverseFacts)]);
  // A division topic starts with one divisor. Its related multiplication forms
  // also supply the other division form in each fact family.
  return uniqueFacts([...expanded, ...expanded.flatMap(inverseFacts)]);
};

const symbols: Readonly<Record<EquationOperation, string>> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

export const practiceFactLabel = function (fact: PracticeFact): string {
  return `${fact.left} ${symbols[fact.operation]} ${fact.right} = ${fact.result}`;
};
