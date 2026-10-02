import type { BoardSize } from '../../boardGeometry';
import { GAME_CONFIG } from '../../../config';
import { cellCenter } from '../../gameUtils';
import type { PlayerEntity } from '../../queries';


const easeOutCubic = (progress: number): number =>
  1 - (1 - progress) ** 3;

export function drawDamageFeedback(
  ctx: CanvasRenderingContext2D,
  player: PlayerEntity,
  reducedMotion: boolean,
  board: BoardSize,
): void {
  const BOARD_WIDTH = board.width * GAME_CONFIG.GRID.CELL_SIZE;
  const BOARD_HEIGHT = board.height * GAME_CONFIG.GRID.CELL_SIZE;
  const timer = player.components.timers.damageFeedback;
  if (!timer?.active) return;

  const progress = Math.min(timer.elapsed / timer.duration, 1);
  const fade = 1 - progress;
  const center = cellCenter(player.components.position);
  const ringProgress = reducedMotion ? 0.5 : easeOutCubic(progress);
  const ringRadius = GAME_CONFIG.GRID.CELL_SIZE * (0.22 + ringProgress * 0.72);

  ctx.save();
  ctx.fillStyle = `rgba(190, 35, 35, ${fade * 0.16})`;
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.strokeStyle = `rgba(255, 198, 154, ${fade * 0.84})`;
  ctx.lineWidth = 8 * fade + 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 91, 75, ${fade * 0.78})`;
  ctx.lineWidth = 18 * fade + 2;
  ctx.strokeRect(9, 9, BOARD_WIDTH - 18, BOARD_HEIGHT - 18);
  ctx.restore();
}
