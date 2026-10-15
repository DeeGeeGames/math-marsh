import { GAME_CONFIG } from '../config';
import type { GameTimer } from './types';
import type { PlayerEntity } from './queries';

type GridCell = { x: number; y: number };
type Position = { x: number; y: number };

/**
 * Fraction of a timer's duration still remaining, in [0, 1].
 * Returns 1 when the timer is absent — useful for entities that haven't been
 * given the slot yet.
 */
export const timerProgress = (timer: GameTimer | undefined): number =>
  timer ? Math.max(0, 1 - timer.elapsed / timer.duration) : 1;

export const timerElapsedProgress = (timer: GameTimer | undefined): number =>
  timer ? clamp(timer.elapsed / timer.duration, 0, 1) : 1;

export function sameGridPosition(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): boolean {
  const cell = GAME_CONFIG.GRID.CELL_SIZE;
  return Math.round(pos1.x / cell) === Math.round(pos2.x / cell)
    && Math.round(pos1.y / cell) === Math.round(pos2.y / cell);
}

export const sameGridCell = (cellA: GridCell, cellB: GridCell): boolean =>
  cellA.x === cellB.x && cellA.y === cellB.y;

export const activePlayerGridCell = (
  player: { components: Pick<PlayerEntity['components'], 'pathFollower'> },
): GridCell => {
  const { anchorGridX, anchorGridY, breadcrumbs } = player.components.pathFollower;
  const head = breadcrumbs[0];
  return head ? { x: head.x, y: head.y } : { x: anchorGridX, y: anchorGridY };
};

export const positionInGridCell = (position: Position, cell: GridCell): boolean =>
  sameGridCell(pixelToGrid(position.x, position.y), cell);

export function pixelToGrid(x: number, y: number): { x: number; y: number } {
  const cell = GAME_CONFIG.GRID.CELL_SIZE;
  return { x: Math.round(x / cell), y: Math.round(y / cell) };
}

export function gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
  const cell = GAME_CONFIG.GRID.CELL_SIZE;
  return { x: gridX * cell, y: gridY * cell };
}

export const cellCenter = (pos: { x: number; y: number }): { x: number; y: number } => {
  const half = GAME_CONFIG.GRID.CELL_SIZE / 2;
  return { x: pos.x + half, y: pos.y + half };
};

export const gridCellCenter = (gridX: number, gridY: number): { x: number; y: number } => {
  const cell = GAME_CONFIG.GRID.CELL_SIZE;
  return { x: gridX * cell + cell / 2, y: gridY * cell + cell / 2 };
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
