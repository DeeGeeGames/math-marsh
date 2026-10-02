import { describe, expect, test } from 'bun:test';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { createEquationModeState } from '../math/equations';
import { GAME_CONFIG } from '../config';
import type { EnemyEntityWithCollider, MathProblemEntityWithRenderable } from './queries';
import { disruptedSelectionProblems } from './selectionDisruption';

const problemAt = (id: number, x: number, consumed = false): MathProblemEntityWithRenderable => ({
  id,
  components: {
    position: { x: x * GAME_CONFIG.GRID.CELL_SIZE, y: 0 },
    mathProblem: { value: id, difficulty: 1, consumed },
    answerConsumption: undefined,
    collider: { width: 40, height: 40, group: 'problem' },
    renderable: { shape: 'circle', color: 'green', size: 40, layer: 1 },
  },
});

const enemyAt = (x: number, telegraph = false): EnemyEntityWithCollider => ({
  id: 100,
  components: {
    position: { x: x * GAME_CONFIG.GRID.CELL_SIZE, y: 0 },
    enemy: { enemyType: 'lizard', behaviorType: 'random' },
    collider: { width: 40, height: 40, group: 'enemy' },
    timers: telegraph ? { enemySpawnTelegraph: createTimer(0.65) } : {},
  },
});

const mode = { ...createEquationModeState(2, 'medium', ['add']), selectedProblemIds: [1, 2] };

describe('enemy disruption of selected numbers', () => {
  test('identifies only selected pads occupied by an active enemy', () => {
    const problems = [problemAt(1, 0), problemAt(2, 1), problemAt(3, 2)];
    const disrupted = disruptedSelectionProblems(mode, problems, [enemyAt(0), enemyAt(2)]);
    expect(disrupted.map(problem => problem.id)).toEqual([1]);
    expect(mode.selectedProblemIds).toEqual([1, 2]);
    expect(disruptedSelectionProblems(mode, problems, [enemyAt(3)])).toEqual([]);
  });

  test('handles multiple invaded pads without duplicating effects for shared enemies', () => {
    expect(disruptedSelectionProblems(mode, [problemAt(1, 0), problemAt(2, 1)], [enemyAt(0), enemyAt(0), enemyAt(1)])
      .map(problem => problem.id)).toEqual([1, 2]);
  });

  test('ignores spawn warnings and consumed or successfully submitted answers', () => {
    expect(disruptedSelectionProblems(mode, [problemAt(1, 0)], [enemyAt(0, true)])).toEqual([]);
    expect(disruptedSelectionProblems(mode, [problemAt(1, 0, true)], [enemyAt(0)])).toEqual([]);
    expect(disruptedSelectionProblems({ ...mode, feedback: { kind: 'correct', startedAt: 0 } }, [problemAt(1, 0)], [enemyAt(0)])).toEqual([]);
  });
});
