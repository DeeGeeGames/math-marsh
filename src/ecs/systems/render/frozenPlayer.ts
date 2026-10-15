import { GAME_CONFIG } from '../../../config';
import { cellCenter, timerProgress } from '../../gameUtils';
import type { PlayerPresentationEntity } from '../../queries';

const drawIceCrystal = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  angle: number,
  crystalLength: number,
): void => {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(angle) * crystalLength,
    centerY + Math.sin(angle) * crystalLength,
  );
  ctx.stroke();

  const sideLength = crystalLength * 0.4;
  const branchX = centerX + Math.cos(angle) * crystalLength * 0.7;
  const branchY = centerY + Math.sin(angle) * crystalLength * 0.7;

  for (const sideAngle of [angle + Math.PI / 6, angle - Math.PI / 6]) {
    ctx.beginPath();
    ctx.moveTo(branchX, branchY);
    ctx.lineTo(
      branchX + Math.cos(sideAngle) * sideLength,
      branchY + Math.sin(sideAngle) * sideLength,
    );
    ctx.stroke();
  }
};

export const drawFrozenPlayerEffect = (
  ctx: CanvasRenderingContext2D,
  player: PlayerPresentationEntity,
  currentTime: number,
): void => {
  const freeze = player.components.timers.freeze;
  if (!freeze?.active) return;

  const pos = player.components.position;
  const freezeProgress = timerProgress(freeze);
  const { x: centerX, y: centerY } = cellCenter(pos);

  ctx.save();

  ctx.fillStyle = `rgba(173, 216, 230, ${0.4 * freezeProgress})`;
  ctx.fillRect(pos.x, pos.y, GAME_CONFIG.GRID.CELL_SIZE, GAME_CONFIG.GRID.CELL_SIZE);

  ctx.strokeStyle = `rgba(135, 206, 250, ${freezeProgress})`;
  ctx.lineWidth = 2;

  const crystalLength = 20 * freezeProgress;
  for (let i = 0; i < 6; i++) {
    drawIceCrystal(ctx, centerX, centerY, (i * Math.PI) / 3, crystalLength);
  }

  const sparkleCount = Math.floor(8 * freezeProgress);
  ctx.fillStyle = `rgba(255, 255, 255, ${freezeProgress * 0.8})`;

  for (let i = 0; i < sparkleCount; i++) {
    const sparkleAngle = (i * 2 * Math.PI) / sparkleCount + currentTime * 0.002;
    const sparkleRadius = 25 + 10 * Math.sin(currentTime * 0.003 + i);
    const sparkleX = centerX + Math.cos(sparkleAngle) * sparkleRadius;
    const sparkleY = centerY + Math.sin(sparkleAngle) * sparkleRadius;

    ctx.beginPath();
    ctx.arc(sparkleX, sparkleY, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
};
