import { createNavGrid, findPath, type NavGrid } from 'ecspresso/plugins/ai/pathfinding';
import { GAME_CONFIG } from '../config';
import { gridCells, type GridCell } from './lilyPads';

// On this 6x5 board, a shortest route has at most nine steps. Its total
// alignment penalty is at most 45, so the base cost keeps every extra step
// more expensive than any improvement in alignment.
const BASE_STEP_COST = 100;

function alignedGrid(start: GridCell, goal: GridCell): NavGrid {
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  const majorDistance = Math.max(Math.abs(dx), Math.abs(dy), 1);
  // Bias ties toward the vertical-first side of the line. Without this,
  // symmetric off-line cells can produce long straight runs at equal cost.
  const preferredSide = -Math.sign(dx * dy);
  const cells = Uint8Array.from(gridCells().map(cell => {
    const cross = (cell.x - start.x) * dy - (cell.y - start.y) * dx;
    const sideMultiplier = Math.sign(cross) === preferredSide ? 1 : 2;
    const penalty = Math.min(5, Math.round(Math.abs(cross) / majorDistance) * sideMultiplier);
    return BASE_STEP_COST + penalty;
  }));

  return createNavGrid({
    width: GAME_CONFIG.GRID.WIDTH,
    height: GAME_CONFIG.GRID.HEIGHT,
    cellSize: GAME_CONFIG.GRID.CELL_SIZE,
    cells,
  });
}

export function shortestCardinalRoute(start: GridCell, goal: GridCell): GridCell[] {
  const navGrid = alignedGrid(start, goal);
  const path = findPath(
    navGrid,
    navGrid.cellFromXY(start.x, start.y),
    navGrid.cellFromXY(goal.x, goal.y),
  );
  return path?.slice(1).map(cell => navGrid.cellToXY(cell)) ?? [];
}
