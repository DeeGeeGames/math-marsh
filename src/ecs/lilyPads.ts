import { GAME_CONFIG } from '../config';
import { pixelToGrid } from './gameUtils';

export type GridCell = { readonly x: number; readonly y: number };
export type BoardPoint = { readonly x: number; readonly y: number };
type Position = { readonly x: number; readonly y: number };
type PositionedEntity = { readonly components: { readonly position: Position } };
type MathProblemCellEntity = PositionedEntity & {
  readonly components: {
    readonly position: Position;
    readonly mathProblem: { readonly consumed: boolean };
  };
};

export const gridCellKey = ({ x, y }: GridCell): string => `${x},${y}`;

export const positionGridCell = ({ x, y }: Position): GridCell => pixelToGrid(x, y);

export const positionedEntityGridCell = (entity: PositionedEntity): GridCell =>
  positionGridCell(entity.components.position);

export const positionedEntityGridCellKey = (entity: PositionedEntity): string =>
  gridCellKey(positionedEntityGridCell(entity));

export const collectGridCellKeys = (entities: readonly PositionedEntity[]): Set<string> =>
  new Set(entities.map(positionedEntityGridCellKey));

export const activeLilyPadGridCells = (
  mathProblems: readonly MathProblemCellEntity[],
): GridCell[] =>
  mathProblems
    .filter(problem => !problem.components.mathProblem.consumed)
    .map(positionedEntityGridCell);

const distanceSquaredToCellCenter = (point: BoardPoint, cell: GridCell): number => {
  const centerX = (cell.x + 0.5) * GAME_CONFIG.GRID.CELL_SIZE;
  const centerY = (cell.y + 0.5) * GAME_CONFIG.GRID.CELL_SIZE;
  return (point.x - centerX) ** 2 + (point.y - centerY) ** 2;
};

export const boardPointGridCell = (point: BoardPoint): GridCell => ({
  x: Math.min(Math.floor(point.x / GAME_CONFIG.GRID.CELL_SIZE), GAME_CONFIG.GRID.WIDTH - 1),
  y: Math.min(Math.floor(point.y / GAME_CONFIG.GRID.CELL_SIZE), GAME_CONFIG.GRID.HEIGHT - 1),
});

export const isPointOnLilyPad = (point: BoardPoint, cell: GridCell): boolean =>
  distanceSquaredToCellCenter(point, cell) <= (GAME_CONFIG.GRID.CELL_SIZE * 0.42) ** 2;

export const activeLilyPadCellKeys = (
  mathProblems: readonly MathProblemCellEntity[],
): Set<string> =>
  new Set(activeLilyPadGridCells(mathProblems).map(gridCellKey));

export const isActiveLilyPadCell = (
  cell: GridCell,
  activeLilyPadCells: ReadonlySet<string>,
): boolean =>
  activeLilyPadCells.has(gridCellKey(cell));

export const gridCells = (): GridCell[] =>
  Array.from(
    { length: GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.HEIGHT },
    (_, index) => ({
      x: index % GAME_CONFIG.GRID.WIDTH,
      y: Math.floor(index / GAME_CONFIG.GRID.WIDTH),
    }),
  );

export const isEdgeGridCell = ({ x, y }: GridCell): boolean =>
  x === 0
    || y === 0
    || x === GAME_CONFIG.GRID.WIDTH - 1
    || y === GAME_CONFIG.GRID.HEIGHT - 1;
