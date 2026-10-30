import type { BoardSize } from '../../boardGeometry';
import { GAME_CONFIG } from '../../../config';
import type { PondTheme } from '../../pondTheme';

export function createPondRenderer(board: BoardSize): (ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme) => void {
  const cell = GAME_CONFIG.GRID.CELL_SIZE;
  const boardWidth = board.width * cell;
  const boardHeight = board.height * cell;
  const ripples = Array.from({ length: board.height }, function(_, row) {
    return Array.from({ length: board.width }, function(_, column) {
      return {
        x: (column + 0.42) * cell,
        y: (row + 0.72) * cell,
        width: 10 + ((row + column * 2) % 4) * 5,
        phase: row * 1.7 + column * 0.9,
      };
    });
  }).flat();
  const fireflies = Array.from({ length: 10 }, function(_, index) {
    return {
      phase: index * 2.4,
      x: index % 2 === 0 ? -13 : boardWidth + 13,
      y: 35 + ((index * 73) % (boardHeight - 70)),
    };
  });

  return function drawPond(ctx, currentTime, theme): void {
    ctx.save();
    const water = ctx.createLinearGradient(0, 0, boardWidth, boardHeight);
    water.addColorStop(0, theme.water[0]);
    water.addColorStop(0.5, theme.water[1]);
    water.addColorStop(1, theme.water[2]);
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, boardWidth, boardHeight);

    // Quiet water leaves the numbers and character silhouettes dominant.
    ctx.strokeStyle = `rgba(${theme.ripple}, 0.1)`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ripples.forEach(function(ripple): void {
      const drift = Math.sin(currentTime * 0.0007 + ripple.phase) * 3;
      ctx.beginPath();
      ctx.moveTo(ripple.x - ripple.width + drift, ripple.y);
      ctx.quadraticCurveTo(ripple.x + drift, ripple.y + 2, ripple.x + ripple.width + drift, ripple.y);
      ctx.stroke();
    });

    // The border stays on the existing board bounds; cell centers and pointer
    // coordinates remain unchanged. Decoration belongs beyond this boundary.
    ctx.strokeStyle = theme.bank;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, boardWidth, boardHeight);
    ctx.strokeStyle = theme.bankHighlight;
    ctx.lineWidth = 3;
    ctx.strokeRect(-5, -5, boardWidth + 10, boardHeight + 10);

    if (theme.fireflyOpacity > 0) {
      fireflies.forEach(function(firefly): void {
        const pulse = (Math.sin(currentTime * 0.0012 + firefly.phase) + 1) * 0.5;
        ctx.fillStyle = `rgba(226, 255, 164, ${(0.25 + pulse * 0.75) * theme.fireflyOpacity})`;
        ctx.beginPath();
        ctx.arc(firefly.x, firefly.y + Math.sin(currentTime * 0.0007 + firefly.phase) * 4, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  };
}
