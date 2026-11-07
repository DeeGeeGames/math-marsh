import { describe, expect, test } from 'bun:test';
import {
  type PracticeFact,
  PRACTICE_TOPICS,
  practiceFactId,
  practiceFactLabel,
  practiceFacts,
  practiceTopic,
} from './practiceTopics';

const topicFacts = function (id: string, related = false): readonly PracticeFact[] {
  const topic = practiceTopic(id);
  if (!topic) throw new Error(`Missing topic ${id}`);
  return practiceFacts(topic, related);
};

const factIds = function (id: string, related = false): Set<string> {
  return new Set(topicFacts(id, related).map(fact => fact.id));
};

const range = function (start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

describe('Practice topic catalog', () => {
  test('has stable topic identities and safely rejects unknown persisted input', () => {
    expect(PRACTICE_TOPICS).toHaveLength(68);
    expect(new Set(PRACTICE_TOPICS.map(topic => topic.id)).size).toBe(68);
    for (const invalid of [undefined, null, {}, [], 1, 'retired', 'multiply-table-0', 'divide-table-13']) {
      expect(practiceTopic(invalid)).toBeUndefined();
    }
  });

  test('every table includes exactly multipliers 1–12 and both orientations', () => {
    range(1, 12).forEach(table => {
      const expected = new Set(range(1, 12).flatMap(multiplier => [
        `multiply:${table}:${multiplier}`,
        `multiply:${multiplier}:${table}`,
      ]));
      expect(factIds(`multiply-table-${table}`)).toEqual(expected);
      expect(topicFacts(`multiply-table-${table}`)).toHaveLength(23);
      expect(factIds(`divide-table-${table}`)).toEqual(new Set(
        range(1, 12).map(quotient => `divide:${table * quotient}:${table}`),
      ));
    });
  });

  test('Make topics enumerate all nonnegative ordered pairs and their inverse subtractions', () => {
    range(3, 20).forEach(target => {
      expect(factIds(`add-make-${target}`)).toEqual(new Set(
        range(0, target).map(left => `add:${left}:${target - left}`),
      ));
      expect(factIds(`subtract-make-${target}`)).toEqual(new Set(
        range(0, target).map(right => `subtract:${target}:${right}`),
      ));
    });
  });

  test('addition and subtraction retain Make 3 through Make 20 in their existing order', () => {
    for (const operation of ['add', 'subtract']) {
      expect(PRACTICE_TOPICS.filter(topic => topic.operation === operation && topic.kind === 'make').map(topic => topic.id))
        .toEqual(range(3, 20).map(target => `${operation}-make-${target}`));
      for (const suffix of ['doubles', 'near-doubles', 'mixed-to-20', 'make-0', 'make-1', 'make-2', 'make-21']) {
        expect(practiceTopic(`${operation}-${suffix}`)).toBeUndefined();
      }
      for (const target of range(3, 20)) {
        const facts = topicFacts(`${operation}-make-${target}`);
        expect(facts).toHaveLength(target + 1);
        expect(facts.every(fact => fact.left >= 0 && fact.right >= 0 && fact.result >= 0)).toBe(true);
        expect(factIds(`${operation}-make-${target}`)).toContain(`${operation}:${operation === 'add' ? 0 : target}:${target}`);
        expect(factIds(`${operation}-make-${target}`)).toContain(`${operation}:${target}:0`);
      }
    }
  });

  test('range topics cover each requested answer using only permitted operands', () => {
    const cases = [
      { id: 'add-range-2-5', minOperand: 1, maxOperand: 4, minAnswer: 2, maxAnswer: 5, count: 10 },
      { id: 'add-range-2-10', minOperand: 1, maxOperand: 9, minAnswer: 2, maxAnswer: 10, count: 45 },
      { id: 'add-range-2-20', minOperand: 1, maxOperand: 19, minAnswer: 2, maxAnswer: 20, count: 190 },
      { id: 'add-range-2-100', minOperand: 1, maxOperand: 99, minAnswer: 2, maxAnswer: 100, count: 4950 },
      { id: 'subtract-range-1-4', minOperand: 1, maxOperand: 5, minAnswer: 1, maxAnswer: 4, count: 10 },
      { id: 'subtract-range-1-9', minOperand: 1, maxOperand: 10, minAnswer: 1, maxAnswer: 9, count: 45 },
      { id: 'subtract-range-0-20', minOperand: 0, maxOperand: 20, minAnswer: 0, maxAnswer: 20, count: 231 },
      { id: 'subtract-range-0-100', minOperand: 0, maxOperand: 100, minAnswer: 0, maxAnswer: 100, count: 5151 },
    ];
    for (const scenario of cases) {
      const facts = topicFacts(scenario.id);
      expect(facts).toHaveLength(scenario.count);
      expect(new Set(facts.map(fact => fact.result))).toEqual(new Set(range(scenario.minAnswer, scenario.maxAnswer)));
      expect(facts.every(fact => fact.left >= scenario.minOperand && fact.left <= scenario.maxOperand
        && fact.right >= scenario.minOperand && fact.right <= scenario.maxOperand)).toBe(true);
    }
    expect(factIds('add-range-2-5')).toContain('add:1:1');
    expect(factIds('add-range-2-5')).toContain('add:1:4');
    expect(factIds('add-range-2-5')).toContain('add:4:1');
    expect(factIds('subtract-range-1-4')).toContain('subtract:5:1');
    expect(factIds('subtract-range-1-9')).toContain('subtract:10:1');
    for (const max of [20, 100]) {
      const ids = factIds(`subtract-range-0-${max}`);
      expect(ids).toContain('subtract:0:0');
      expect(ids).toContain(`subtract:${max}:${max}`);
      expect(ids).toContain(`subtract:${max}:0`);
    }
  });

  test('related facts are off by default and expand only their exact fact families', () => {
    expect(factIds('divide-table-7')).not.toContain('divide:21:3');
    expect(factIds('divide-table-7', true)).toContain('divide:21:3');
    expect(factIds('divide-table-7', true)).toContain('multiply:3:7');
    expect(factIds('divide-table-7', true)).not.toContain('multiply:3:8');
    expect(factIds('multiply-table-7', true)).toEqual(factIds('divide-table-7', true));
    expect(factIds('add-make-5', true)).toEqual(new Set([
      ...factIds('add-make-5'), ...factIds('subtract-make-5'),
    ]));
    expect(factIds('subtract-make-3', true)).toEqual(new Set([
      ...factIds('add-make-3'), ...factIds('subtract-make-3'),
    ]));
  });

  test('all catalog facts have unique ordered identities, correct integer results and no zero divisors', () => {
    PRACTICE_TOPICS.forEach(topic => {
      [false, true].forEach(related => {
        const facts = practiceFacts(topic, related);
        expect(new Set(facts.map(fact => fact.id)).size).toBe(facts.length);
        facts.forEach(fact => {
          expect(fact.id).toBe(practiceFactId(fact.operation, fact.left, fact.right));
          expect(Number.isInteger(fact.result)).toBe(true);
          expect(fact.result).toBeGreaterThanOrEqual(0);
          if (fact.operation === 'add') expect(fact.result).toBe(fact.left + fact.right);
          if (fact.operation === 'subtract') expect(fact.result).toBe(fact.left - fact.right);
          if (fact.operation === 'multiply') expect(fact.result).toBe(fact.left * fact.right);
          if (fact.operation === 'divide') {
            expect(fact.right).toBeGreaterThan(0);
            expect(fact.result * fact.right).toBe(fact.left);
          }
        });
      });
    });
    expect(practiceFactId('add', 2, 3)).not.toBe(practiceFactId('add', 3, 2));
    expect(practiceFactId('multiply', 2, 3)).not.toBe(practiceFactId('divide', 6, 3));
  });

  test('example labels derive directly from catalog facts', () => {
    const fact = topicFacts('divide-table-7').find(candidate => candidate.result === 3);
    if (!fact) throw new Error('Expected division example');
    expect(practiceFactLabel(fact)).toBe('21 ÷ 7 = 3');
  });
});
