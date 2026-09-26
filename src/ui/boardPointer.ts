import { GAME_CONFIG } from '../config';
import { renderMargins } from '../ecs/boardGeometry';
import type { BoardPoint } from '../ecs/lilyPads';

const MAX_TAP_TRAVEL_PX = 14;

export function boardPointAtCanvasPixel(x: number, y: number): BoardPoint | null {
  const margins = renderMargins();
  const boardX = x - margins.left;
  const boardY = y - margins.top;
  const cellSize = GAME_CONFIG.GRID.CELL_SIZE;
  if (boardX < 0 || boardX > GAME_CONFIG.GRID.WIDTH * cellSize
    || boardY < 0 || boardY > GAME_CONFIG.GRID.HEIGHT * cellSize) return null;
  return { x: boardX, y: boardY };
}

export function boardPointAtClientPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): BoardPoint | null {
  const rect = canvas.getBoundingClientRect();
  if (canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return null;
  const x = (clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth;
  const y = (clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight;
  return boardPointAtCanvasPixel(x, y);
}

export function bindBoardPointer(
  canvas: HTMLCanvasElement,
  onTap: (point: BoardPoint) => void,
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
    const point = boardPointAtClientPoint(canvas, event.clientX, event.clientY);
    if (point) onTap(point);
  });

  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId === start.pointerId) start.pointerId = -1;
  });
}
