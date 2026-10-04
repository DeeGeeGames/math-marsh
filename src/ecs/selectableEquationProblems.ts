import { collectGridCellKeys, positionedEntityGridCellKey } from './lilyPads';
import type { MathProblemEntityWithRenderable, PositionEntity } from './queries';

export const selectableEquationProblems = function (
  mathProblems: readonly MathProblemEntityWithRenderable[],
  enemies: readonly PositionEntity[],
): MathProblemEntityWithRenderable[] {
  const occupiedCells = collectGridCellKeys(enemies);
  return mathProblems.filter(problem =>
    !problem.components.mathProblem.consumed
      && !occupiedCells.has(positionedEntityGridCellKey(problem)),
  );
};
