import { GAME_CONFIG } from '../../../config';
import { cellCenter, timerElapsedProgress, timerProgress } from '../../gameUtils';
import type { SpiderWebEntity } from '../../queries';

const spokeAngles = Array.from({ length: 10 }, (_, index) => (index / 10) * Math.PI * 2);
const ringScales = [0.22, 0.38, 0.55, 0.73, 0.9] as const;
const sparkleAngles = Array.from({ length: 6 }, (_, index) => (index * Math.PI) / 3);

const webPoint = (
  centerX: number,
  centerY: number,
  angle: number,
  radius: number,
  wobble: number,
): { x: number; y: number } => {
  return {
    x: centerX + Math.cos(angle) * radius * wobble,
    y: centerY + Math.sin(angle) * radius * (2 - wobble),
  };
};

const drawHalo = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  webSize: number,
  opacity: number,
): void => {
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    webSize * 0.18,
    centerX,
    centerY,
    webSize * 1.18,
  );

  gradient.addColorStop(0, `rgba(222, 190, 255, ${opacity * 0.22})`);
  gradient.addColorStop(0.58, `rgba(166, 83, 210, ${opacity * 0.11})`);
  gradient.addColorStop(1, 'rgba(166, 83, 210, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, webSize * 1.2, 0, Math.PI * 2);
  ctx.fill();
};

const drawWebLines = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  webSize: number,
): void => {
  spokeAngles.forEach((angle, index) => {
    const inner = webPoint(centerX, centerY, angle, webSize * 0.13, 1);
    const outer = webPoint(centerX, centerY, angle, webSize, 0.9 + (index % 3) * 0.06);

    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  });

  ringScales.forEach((scale, ringIndex) => {
    const points = spokeAngles.map((angle, spokeIndex) =>
      webPoint(
        centerX,
        centerY,
        angle,
        webSize * scale,
        0.92 + ((ringIndex + spokeIndex) % 3) * 0.04,
      ),
    );
    const [first, ...rest] = points;

    if (!first) return;

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    rest.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.stroke();
  });
};

const drawLinePass = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  webSize: number,
  strokeStyle: string,
  lineWidth: number,
): void => {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  drawWebLines(ctx, centerX, centerY, webSize);
};

const drawKnots = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  webSize: number,
  opacity: number,
): void => {
  ctx.fillStyle = `rgba(244, 230, 255, ${opacity * 0.92})`;

  ringScales.slice(1, 4).forEach((scale, ringIndex) => {
    spokeAngles
      .filter((_, spokeIndex) => (spokeIndex + ringIndex) % 2 === 0)
      .forEach((angle, spokeIndex) => {
        const point = webPoint(centerX, centerY, angle, webSize * scale, 0.94 + (spokeIndex % 2) * 0.05);

        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
  });
};

const drawSparkles = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  webSize: number,
  currentTime: number,
  opacity: number,
): void => {
  ctx.fillStyle = `rgba(248, 232, 255, ${opacity * 0.9})`;

  sparkleAngles.forEach(sparkleAngle => {
    const angle = sparkleAngle + (currentTime * 0.001);

    ctx.beginPath();
    ctx.arc(
      centerX + Math.cos(angle) * webSize * 0.8,
      centerY + Math.sin(angle) * webSize * 0.8,
      2,
      0,
      2 * Math.PI,
    );
    ctx.fill();
  });
};

export const drawEnhancedSpiderWebs = (
  ctx: CanvasRenderingContext2D,
  spiderWebs: SpiderWebEntity[],
  currentTime: number,
  reducedMotion: boolean,
): void => {
  spiderWebs.forEach(webEntity => {
    const fadeProgress = timerProgress(webEntity.components.timers.webExpiry);
    const buildProgress = timerElapsedProgress(webEntity.components.timers.webBuild);
    const buildScale = reducedMotion ? 1 : 1 - (1 - buildProgress) ** 3;
    const baseOpacity = 0.82 * fadeProgress * (reducedMotion ? 1 : buildProgress);
    const { x: centerX, y: centerY } = cellCenter(webEntity.components.position);
    const webSize = GAME_CONFIG.GRID.CELL_SIZE * 0.42;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(buildScale, buildScale);
    ctx.translate(-centerX, -centerY);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawHalo(ctx, centerX, centerY, webSize, baseOpacity);
    drawLinePass(ctx, centerX, centerY, webSize, `rgba(48, 22, 72, ${baseOpacity * 0.72})`, 5);
    drawLinePass(ctx, centerX, centerY, webSize, `rgba(236, 222, 255, ${baseOpacity})`, 2.4);
    drawKnots(ctx, centerX, centerY, webSize, baseOpacity);

    if (buildProgress >= 1 && fadeProgress > 0.5) {
      drawSparkles(ctx, centerX, centerY, webSize, currentTime, (fadeProgress - 0.5) * 2);
    }

    ctx.restore();
  });
};
