import { GAME_CONFIG } from '../config';
import { renderMargins } from '../ecs/systems/render/context';
import type { GridCell } from '../ecs/lilyPads';

const MAX_TAP_TRAVEL_PX = 14;
const HIT_RADIUS_RATIO = 0.42;

export function boardCellAtClientPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): GridCell | null {
  const rect = canvas.getBoundingClientRect();
  if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return null;
  const x = (clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth;
  const y = (clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight;
  const margins = renderMargins();
  const boardX = x - margins.left;
  const boardY = y - margins.top;
  const cellSize = GAME_CONFIG.GRID.CELL_SIZE;
  const column = Math.floor(boardX / cellSize);
  const row = Math.floor(boardY / cellSize);
  if (column < 0 || column >= GAME_CONFIG.GRID.WIDTH
    || row < 0 || row >= GAME_CONFIG.GRID.HEIGHT) return null;

  const centerX = (column + 0.5) * cellSize;
  const centerY = (row + 0.5) * cellSize;
  if (Math.hypot(boardX - centerX, boardY - centerY) > cellSize * HIT_RADIUS_RATIO) return null;
  return { x: column, y: row };
}

export function bindBoardPointer(
  canvas: HTMLCanvasElement,
  onTap: (cell: GridCell) => void,
): void {
  const start = { pointerId: -1, x: 0, y: 0 };

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    start.pointerId = event.pointerId;
    start.x = event.clientX;
    start.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointerup', event => {
    if (event.pointerId !== start.pointerId) return;
    start.pointerId = -1;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MAX_TAP_TRAVEL_PX) return;
    const cell = boardCellAtClientPoint(canvas, event.clientX, event.clientY);
    if (cell) onTap(cell);
  });

  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId === start.pointerId) start.pointerId = -1;
  });
}
