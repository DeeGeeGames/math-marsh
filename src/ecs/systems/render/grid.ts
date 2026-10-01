import { GAME_CONFIG } from '../../../config';
import type { PondTheme } from '../../pondTheme';

const boardWidth = GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.CELL_SIZE;
const boardHeight = GAME_CONFIG.GRID.HEIGHT * GAME_CONFIG.GRID.CELL_SIZE;
const cell = GAME_CONFIG.GRID.CELL_SIZE;
const waterHighlightOffsets = [0, boardWidth * 0.38, boardWidth * 0.76] as const;
const reedOffsets = [0, 7, 14] as const;

type Ripple = {
  x: number;
  y: number;
  width: number;
  alpha: number;
  phase: number;
};

type PondBubble = {
  x: number;
  y: number;
  radius: number;
  phase: number;
};

type ReedCluster = {
  x: number;
  y: number;
  direction: -1 | 1;
  phase: number;
};

const pondRipples: Ripple[] = Array.from(
  { length: GAME_CONFIG.GRID.HEIGHT },
  (_, row) => row,
).flatMap(row =>
  Array.from({ length: GAME_CONFIG.GRID.WIDTH }, (_, column) => ({
    x: column * cell + cell * (0.24 + ((row + column) % 3) * 0.21),
    y: row * cell + cell * (0.26 + ((row * 2 + column) % 4) * 0.14),
    width: 12 + ((row + column * 2) % 4) * 5,
    alpha: 0.10 + ((row * 3 + column) % 3) * 0.035,
    phase: row * 1.7 + column * 0.9,
  })),
);

const pondBubbles: PondBubble[] = [
  { x: cell * 0.72, y: cell * 1.56, radius: 3.2, phase: 0.2 },
  { x: cell * 2.42, y: cell * 0.74, radius: 2.4, phase: 0.66 },
  { x: cell * 4.88, y: cell * 1.92, radius: 3.6, phase: 0.42 },
  { x: cell * 1.36, y: cell * 3.72, radius: 2.8, phase: 0.84 },
  { x: cell * 3.64, y: cell * 4.24, radius: 2.2, phase: 0.08 },
] as const;

const reedClusters: ReedCluster[] = [
  { x: 15, y: cell * 0.86, direction: 1, phase: 0.2 },
  { x: 13, y: cell * 3.48, direction: 1, phase: 1.6 },
  { x: boardWidth - 14, y: cell * 1.62, direction: -1, phase: 0.9 },
  { x: boardWidth - 15, y: cell * 4.12, direction: -1, phase: 2.3 },
] as const;

const reflectionStreaks = Array.from({ length: 14 }, (_, index) => ({
  depth: index / 14,
  phase: index * 1.9,
  width: 12 + (index / 14) * 58 + Math.cos(index * 2.3) * 6,
}));

const bankFireflies = Array.from({ length: 10 }, (_, index) => ({
  phase: index * 2.4,
  x: index % 2 === 0 ? 10 : boardWidth - 10,
  y: 35 + ((index * 73) % (boardHeight - 70)),
}));

function drawWater(ctx: CanvasRenderingContext2D, theme: PondTheme): void {
  const gradient = ctx.createLinearGradient(0, 0, boardWidth, boardHeight);
  gradient.addColorStop(0, theme.water[0]);
  gradient.addColorStop(0.45, theme.water[1]);
  gradient.addColorStop(1, theme.water[2]);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, boardWidth, boardHeight);
}

function drawSoftPondEdges(ctx: CanvasRenderingContext2D, theme: PondTheme): void {
  ctx.strokeStyle = theme.bank;
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, boardWidth - 16, boardHeight - 16);

  ctx.strokeStyle = theme.bankHighlight;
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, boardWidth - 36, boardHeight - 36);
}

const drawRipple = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  alpha: number,
  theme: PondTheme,
): void => {
  ctx.strokeStyle = `rgba(${theme.ripple}, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, width, width * 0.18, -0.18, 0, Math.PI * 2);
  ctx.stroke();
};

function drawWaterHighlights(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  const travel = (currentTime * 0.014) % (boardWidth + cell * 2) - cell;

  ctx.save();
  ctx.strokeStyle = `rgba(${theme.light}, 0.075)`;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  waterHighlightOffsets.forEach((offset, index) => {
    const x = (travel + offset) % (boardWidth + cell) - cell * 0.5;
    const y = cell * (0.8 + index * 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + cell * 0.75, y - 12, x + cell * 1.5, y + 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawCellRipples(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  pondRipples.forEach(({ x, y, width, alpha, phase }) => {
    const pulse = (Math.sin(currentTime * 0.0011 + phase) + 1) * 0.5;
    drawRipple(ctx, x, y + pulse * 1.5, width + pulse * 5, alpha * (0.58 + pulse * 0.42), theme);
  });
}

function drawBubbles(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  pondBubbles.forEach(({ x, y, radius, phase }) => {
    const progress = (currentTime * 0.00012 + phase) % 1;
    const alpha = Math.sin(progress * Math.PI) * 0.24;
    const rise = progress * cell * 0.28;

    ctx.strokeStyle = `rgba(${theme.ripple}, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - rise, radius * (0.75 + progress * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawReedCluster(
  ctx: CanvasRenderingContext2D,
  cluster: ReedCluster,
  currentTime: number,
  theme: PondTheme,
): void {
  const sway = Math.sin(currentTime * 0.0008 + cluster.phase) * 3;

  ctx.strokeStyle = theme.reeds;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  reedOffsets.forEach((offset, index) => {
    const rootX = cluster.x + cluster.direction * offset;
    const height = 23 + index * 5;
    ctx.beginPath();
    ctx.moveTo(rootX, cluster.y + 15);
    ctx.quadraticCurveTo(
      rootX + cluster.direction * 4,
      cluster.y - height * 0.45,
      rootX + cluster.direction * (8 + sway),
      cluster.y - height,
    );
    ctx.stroke();
  });
}

function drawEdgeReeds(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  reedClusters.forEach(cluster => drawReedCluster(ctx, cluster, currentTime, theme));
}

// Broken streaks of sunlight / moonlight stay under the lily pads and actors.
function drawLightReflection(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  const centerX = boardWidth * 0.76;
  const glow = ctx.createRadialGradient(centerX, 0, 0, centerX, 0, boardHeight * 0.9);
  glow.addColorStop(0, `rgba(${theme.light}, 0.22)`);
  glow.addColorStop(1, `rgba(${theme.light}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  ctx.lineCap = 'round';
  reflectionStreaks.forEach(({ depth, phase, width }) => {
    const drift = Math.sin(currentTime * 0.00065 + phase);
    const x = centerX + drift * (8 + depth * 18);
    const y = 18 + depth * boardHeight * 0.82;
    const alpha = (1 - depth) * 0.18;
    ctx.strokeStyle = `rgba(${theme.light}, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - width, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  });
}

function drawFireflies(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  if (theme.fireflyOpacity === 0) return;

  // Restrict these to the banks so they cannot be mistaken for board targets.
  bankFireflies.forEach(({ phase, x, y }) => {
    const pulse = (Math.sin(currentTime * 0.0012 + phase) + 1) * 0.5;
    const drift = Math.sin(currentTime * 0.0007 + phase) * 5;
    const alpha = (0.25 + pulse * 0.75) * theme.fireflyOpacity;
    ctx.fillStyle = `rgba(226, 255, 164, ${alpha})`;
    ctx.shadowColor = '#d9ff9a';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(x + drift, y + drift, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

export function drawGrid(ctx: CanvasRenderingContext2D, currentTime: number, theme: PondTheme): void {
  ctx.save();
  drawWater(ctx, theme);
  drawLightReflection(ctx, currentTime, theme);
  drawWaterHighlights(ctx, currentTime, theme);
  drawCellRipples(ctx, currentTime, theme);
  drawBubbles(ctx, currentTime, theme);
  drawEdgeReeds(ctx, currentTime, theme);
  drawSoftPondEdges(ctx, theme);
  drawFireflies(ctx, currentTime, theme);
  ctx.restore();
}
