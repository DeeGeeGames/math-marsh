import { createNavGrid, findPath } from 'ecspresso/plugins/ai/pathfinding';
import { GAME_CONFIG } from '../config';
import type { GridCell } from './lilyPads';

const navGrid = createNavGrid({
  width: GAME_CONFIG.GRID.WIDTH,
  height: GAME_CONFIG.GRID.HEIGHT,
  cellSize: GAME_CONFIG.GRID.CELL_SIZE,
});

export function shortestCardinalRoute(start: GridCell, goal: GridCell): GridCell[] {
  const path = findPath(
    navGrid,
    navGrid.cellFromXY(start.x, start.y),
    navGrid.cellFromXY(goal.x, goal.y),
  );
  return path?.slice(1).map(cell => navGrid.cellToXY(cell)) ?? [];
}
