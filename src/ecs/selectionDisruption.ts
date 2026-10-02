import { collectGridCellKeys, positionedEntityGridCellKey } from './lilyPads';
import type { EnemyEntityWithCollider, MathProblemEntityWithRenderable } from './queries';
import type { EquationModeState } from './types';
import type { GameEngine } from './Engine';
import { playSound } from '../audio/audio';

export function disruptedSelectionProblems(
  equationMode: EquationModeState,
  mathProblems: readonly MathProblemEntityWithRenderable[],
  enemies: readonly EnemyEntityWithCollider[],
): MathProblemEntityWithRenderable[] {
  if (equationMode.feedback?.kind === 'correct') return [];
  if (equationMode.selectedProblemIds.length === 0) return [];

  const occupiedCells = collectGridCellKeys(
    enemies.filter(enemy => !enemy.components.timers.enemySpawnTelegraph?.active),
  );
  return mathProblems.filter(problem =>
    !problem.components.mathProblem.consumed
      && equationMode.selectedProblemIds.includes(problem.id)
      && occupiedCells.has(positionedEntityGridCellKey(problem)),
  );
}

export function handleEnemySelectionDisruption(
  ecs: GameEngine,
  equationMode: EquationModeState,
  mathProblems: readonly MathProblemEntityWithRenderable[],
  enemies: readonly EnemyEntityWithCollider[],
  startedAt: number,
): EquationModeState {
  const disruptedProblems = disruptedSelectionProblems(equationMode, mathProblems, enemies);
  if (disruptedProblems.length === 0) return equationMode;

  const disruptedIds = new Set(disruptedProblems.map(problem => problem.id));
  const nextMode = {
    ...equationMode,
    selectedProblemIds: equationMode.selectedProblemIds.filter(id => !disruptedIds.has(id)),
  };
  ecs.setResource('equationMode', nextMode);
  playSound('answerDeselect');
  disruptedProblems.forEach(problem => {
    ecs.commands.spawn({
      position: { ...problem.components.position },
      selectionDisruption: { startedAt },
    });
  });
  return nextMode;
}
