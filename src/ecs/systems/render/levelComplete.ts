import { LEVEL_COMPLETE_DURATION_MS } from '../../systemConfigs';
import type { LevelCompleteScreenConfig } from '../../types';

type Leaf = {
  x: number;
  delay: number;
  drift: number;
  rotation: number;
  color: string;
};

type CelebrationArea = { width: number; height: number };

const LEAF_COLORS = ['#9bd45e', '#f4d27a', '#fff7c6', '#57c7bd'] as const;
const RING_DELAYS = [0, 0.12, 0.24] as const;

const leaves: readonly Leaf[] = Array.from({ length: 24 }, (_, index) => ({
  x: ((index * 37) % 101) / 100,
  delay: (index % 6) * 0.055,
  drift: ((index % 5) - 2) * 18,
  rotation: (index * 1.7) % (Math.PI * 2),
  color: LEAF_COLORS[index % LEAF_COLORS.length] ?? LEAF_COLORS[0],
}));

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function drawCelebrationRings(
  ctx: CanvasRenderingContext2D,
  progress: number,
  area: CelebrationArea,
  opacity: number,
): void {
  const centerX = area.width / 2;
  const centerY = area.height / 2;

  RING_DELAYS.forEach((delay) => {
    const ringProgress = clamp((progress - delay) / 0.62);
    if (ringProgress <= 0 || ringProgress >= 1) return;

    const radius = easeOutCubic(ringProgress) * Math.min(area.width, area.height) * 0.44;
    ctx.strokeStyle = `rgba(255, 247, 198, ${(1 - ringProgress) * 0.58 * opacity})`;
    ctx.lineWidth = 7 - ringProgress * 4;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius, radius * 0.38, -0.12, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  leaf: Leaf,
  progress: number,
  area: CelebrationArea,
  opacity: number,
): void {
  const leafProgress = clamp((progress - leaf.delay) / (1 - leaf.delay));
  if (leafProgress <= 0 || leafProgress >= 1) return;

  const fade = Math.min(1, leafProgress * 6) * (1 - clamp((leafProgress - 0.72) / 0.28));
  const x = leaf.x * area.width + Math.sin(leafProgress * Math.PI * 2) * leaf.drift;
  const y = area.height * (0.62 - leafProgress * 0.72);
  const size = 7 + (leaf.x * 7);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(leaf.rotation + leafProgress * Math.PI * 3);
  ctx.globalAlpha = fade * opacity;
  ctx.fillStyle = leaf.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Shared pond confetti, also used by the smaller live-game Splash callout. */
export const drawPondCelebration = function(
  ctx: CanvasRenderingContext2D,
  progress: number,
  area: CelebrationArea,
  leafCount = 24,
  opacity = 1,
): void {
  drawCelebrationRings(ctx, progress, area, opacity);
  leaves.slice(0, leafCount).forEach(leaf => drawLeaf(ctx, leaf, progress, area, opacity));
};

function drawCompleteText(
  ctx: CanvasRenderingContext2D,
  completedLevel: number,
  progress: number,
): void {
  const intro = easeOutCubic(clamp(progress / 0.2));
  const outro = 1 - clamp((progress - 0.82) / 0.18);
  const alpha = intro * outro;
  const pulse = 1 + Math.sin(clamp(progress / 0.42) * Math.PI) * 0.12;
  const titleSize = Math.max(30, Math.min(54, ctx.canvas.width * 0.075));
  const subtitleSize = titleSize * 0.48;

  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(155, 212, 94, 0.72)';
  ctx.shadowBlur = 26;
  ctx.font = `bold ${titleSize}px ui-rounded, Trebuchet MS, Arial`;
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(12, 54, 28, 0.94)';
  ctx.fillStyle = '#fff7c6';
  ctx.strokeText('LEVEL COMPLETE!', 0, -subtitleSize * 0.4);
  ctx.fillText('LEVEL COMPLETE!', 0, -subtitleSize * 0.4);
  ctx.shadowBlur = 8;
  ctx.font = `bold ${subtitleSize}px ui-rounded, Trebuchet MS, Arial`;
  ctx.lineWidth = 6;
  ctx.strokeText(`Level ${completedLevel}`, 0, titleSize * 0.78);
  ctx.fillStyle = '#b7ff88';
  ctx.fillText(`Level ${completedLevel}`, 0, titleSize * 0.78);
  ctx.restore();
}

export function drawLevelCompleteCelebration(
  ctx: CanvasRenderingContext2D,
  config: LevelCompleteScreenConfig,
  currentTime: number,
  reducedMotion: boolean,
): void {
  const progress = clamp((currentTime - config.startedAt) / LEVEL_COMPLETE_DURATION_MS);

  ctx.save();
  ctx.fillStyle = `rgba(5, 31, 36, ${Math.sin(progress * Math.PI) * 0.3})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (!reducedMotion) {
    drawPondCelebration(ctx, progress, ctx.canvas);
  }

  drawCompleteText(ctx, config.completedLevel, progress);
  ctx.restore();
}
