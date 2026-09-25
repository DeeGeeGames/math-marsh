import { GAME_CONFIG } from '../../../config';
import { ANSWER_CONSUMPTION_DURATION_MS } from '../../systemConfigs';
import { activePlayerGridCell, cellCenter, positionInGridCell } from '../../gameUtils';
import { gridCellKey, positionedEntityGridCellKey } from '../../lilyPads';
import type { MathProblemEntity, PlayerEntity } from '../../queries';
import type { Resources } from '../../types';
import type { RenderMargins } from './context';
import type { EquationValueTarget } from './objective';

const cell = GAME_CONFIG.GRID.CELL_SIZE;
const lilyPadRadius = cell * 0.38;
const BURST_PARTICLE_COUNT = 10;

const burstParticles = Array.from({ length: BURST_PARTICLE_COUNT }, (_, index) => ({
  angle: (index / BURST_PARTICLE_COUNT) * Math.PI * 2,
  distance: 32 + (index % 3) * 8,
  size: 3 + (index % 3),
  color: index % 2 === 0 ? '#d5f6f4' : '#9bd45e',
}));

type LilyPadMotion = {
  centerX: number;
  centerY: number;
  rotation: number;
};

function lilyPadMotion(problem: MathProblemEntity, currentTime: number): LilyPadMotion {
  const center = cellCenter(problem.components.position);
  const phase = problem.id * 0.73
    + problem.components.position.x * 0.013
    + problem.components.position.y * 0.019;

  return {
    centerX: center.x,
    centerY: center.y + Math.sin(currentTime * 0.0011 + phase) * 1.8,
    rotation: -0.18 + Math.sin(currentTime * 0.0007 + phase) * 0.025,
  };
}

const drawLilyPadShape = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
): void => {
  const gradient = ctx.createRadialGradient(
    centerX - radius * 0.28,
    centerY - radius * 0.35,
    radius * 0.1,
    centerX,
    centerY,
    radius,
  );
  gradient.addColorStop(0, '#9bd45e');
  gradient.addColorStop(0.62, '#4b9f3b');
  gradient.addColorStop(1, '#276b35');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, -0.28, Math.PI * 1.82);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(17, 72, 36, 0.72)';
  ctx.lineWidth = 3;
  ctx.stroke();
};

const drawLilyPadVeins = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
): void => {
  const veinAngles = [-1.9, -1.25, -0.68, 0.68, 1.28] as const;

  ctx.strokeStyle = 'rgba(224, 248, 156, 0.28)';
  ctx.lineWidth = 2;
  veinAngles.forEach(angle => {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angle) * radius * 0.78,
      centerY + Math.sin(angle) * radius * 0.78,
    );
    ctx.stroke();
  });
};

const drawLilyPad = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  rotation: number,
): void => {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.translate(-centerX, -centerY);

  drawLilyPadShape(ctx, centerX, centerY, lilyPadRadius);
  drawLilyPadVeins(ctx, centerX, centerY, lilyPadRadius);
  ctx.restore();
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function consumptionProgress(startedAt: number, currentTime: number): number {
  return clamp((currentTime - startedAt) / ANSWER_CONSUMPTION_DURATION_MS);
}

function drawConsumptionRipple(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  progress: number,
): void {
  const rippleProgress = easeOutCubic(progress);
  ctx.strokeStyle = `rgba(213, 246, 244, ${(1 - progress) * 0.72})`;
  ctx.lineWidth = 5 - progress * 3;
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY,
    lilyPadRadius * (0.72 + rippleProgress * 1.15),
    lilyPadRadius * (0.28 + rippleProgress * 0.52),
    -0.18,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
}

function drawConsumptionPad(
  ctx: CanvasRenderingContext2D,
  motion: LilyPadMotion,
  progress: number,
  reducedMotion: boolean,
): void {
  const fade = 1 - clamp((progress - 0.58) / 0.42);
  const rebound = reducedMotion
    ? 1
    : 1 - Math.sin(progress * Math.PI * 3) * (1 - progress) * 0.12;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(motion.centerX, motion.centerY);
  ctx.scale(1 + (1 - rebound) * 0.34, rebound);
  ctx.translate(-motion.centerX, -motion.centerY);
  drawLilyPad(ctx, motion.centerX, motion.centerY, motion.rotation);
  ctx.restore();
}

function drawConsumptionNumber(
  ctx: CanvasRenderingContext2D,
  problem: MathProblemEntity,
  motion: LilyPadMotion,
  target: EquationValueTarget,
  progress: number,
  reducedMotion: boolean,
): void {
  const numberProgress = clamp((progress - 0.06) / 0.94);
  const travel = reducedMotion ? 1 : easeOutCubic(numberProgress);
  const arc = reducedMotion ? 0 : Math.sin(numberProgress * Math.PI) * cell * 0.34;
  const x = motion.centerX + (target.x - motion.centerX) * travel;
  const y = motion.centerY + (target.y - motion.centerY) * travel - arc;
  const scale = reducedMotion
    ? 1
    : 1 + Math.sin(numberProgress * Math.PI) * 0.52;
  const text = problem.components.mathProblem.value.toString();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(12, 54, 28, 0.9)';
  ctx.lineWidth = 7;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#fff7c6';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawBurstParticles(
  ctx: CanvasRenderingContext2D,
  problem: MathProblemEntity,
  motion: LilyPadMotion,
  progress: number,
): void {
  const particleProgress = clamp(progress / 0.78);
  const fade = 1 - particleProgress;

  burstParticles.forEach(particle => {
    const angle = particle.angle + problem.id * 0.41;
    const distance = easeOutCubic(particleProgress) * particle.distance;
    const x = motion.centerX + Math.cos(angle) * distance;
    const y = motion.centerY
      + Math.sin(angle) * distance * 0.58
      + particleProgress ** 2 * 18;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.rotate(angle + particleProgress * 2.4);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, particle.size * 1.55, particle.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawAnswerConsumptionEffects(
  ctx: CanvasRenderingContext2D,
  mathProblems: MathProblemEntity[],
  answerTargets: ReadonlyMap<number, EquationValueTarget>,
  margins: RenderMargins,
  currentTime: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  mathProblems.forEach(problem => {
    const effect = problem.components.answerConsumption;
    if (!effect) return;

    const progress = consumptionProgress(effect.startedAt, currentTime);
    if (progress >= 1) return;

    const canvasTarget = answerTargets.get(problem.id);
    if (!canvasTarget) return;

    const motion = lilyPadMotion(problem, reducedMotion ? 0 : currentTime);
    const target = {
      x: canvasTarget.x - margins.left,
      y: canvasTarget.y - margins.top,
    };
    drawConsumptionRipple(ctx, motion.centerX, motion.centerY, progress);
    drawConsumptionPad(ctx, motion, progress, reducedMotion);
    drawConsumptionNumber(ctx, problem, motion, target, progress, reducedMotion);
    if (!reducedMotion) drawBurstParticles(ctx, problem, motion, progress);
  });
  ctx.restore();
}

const activeProblemAtPlayer = (
  player: PlayerEntity,
  mathProblems: MathProblemEntity[],
  blockedCells: ReadonlySet<string>,
): MathProblemEntity | undefined => {
  const activeCell = activePlayerGridCell(player);
  return mathProblems.find(p =>
    !p.components.mathProblem.consumed
      && !blockedCells.has(gridCellKey(activeCell))
      && positionInGridCell(p.components.position, activeCell),
  );
};

export const drawPlayerHighlight = (
  ctx: CanvasRenderingContext2D,
  player: PlayerEntity | undefined,
  mathProblems: MathProblemEntity[],
  blockedCells: ReadonlySet<string>,
  currentTime: number,
): void => {
  if (!player) return;

  const problem = activeProblemAtPlayer(player, mathProblems, blockedCells);
  if (!problem) return;

  const { centerX, centerY, rotation } = lilyPadMotion(problem, currentTime);
  const time = currentTime / 300;
  const alpha = 0.3 + 0.2 * Math.sin(time);

  ctx.save();
  ctx.strokeStyle = `rgba(248, 232, 112, ${alpha + 0.18})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, lilyPadRadius + 9, lilyPadRadius * 0.76 + 7, rotation, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

export function drawTapTargetFeedback(
  ctx: CanvasRenderingContext2D,
  feedback: Resources['tapFeedback'],
  player: PlayerEntity | undefined,
  currentTime: number,
  reducedMotion: boolean,
): void {
  if (!feedback) return;
  const elapsed = Math.max(0, currentTime - feedback.startedAt);
  const routeEnd = player?.components.pathFollower.breadcrumbs.at(-1);
  const enRoute = routeEnd?.x === feedback.x && routeEnd.y === feedback.y;
  const duration = 900;
  if (!enRoute && elapsed >= duration) return;

  const centerX = (feedback.x + 0.5) * cell;
  const centerY = (feedback.y + 0.5) * cell;
  const fade = enRoute ? 1 : 1 - elapsed / duration;

  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.strokeStyle = '#fff7c6';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#e6ba47';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, lilyPadRadius + 20, lilyPadRadius * 0.76 + 18, -0.18, 0, Math.PI * 2);
  ctx.stroke();

  if (!reducedMotion && elapsed < duration) {
    const progress = elapsed / duration;
    ctx.globalAlpha = (1 - progress) * 0.7;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      lilyPadRadius + 20 + progress * 20,
      lilyPadRadius * 0.76 + 18 + progress * 15,
      -0.18,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export const drawEquationSelectionHighlights = (
  ctx: CanvasRenderingContext2D,
  mathProblems: MathProblemEntity[],
  selectedProblemIds: readonly number[],
  blockedCells: ReadonlySet<string>,
  currentTime: number,
): void => {
  if (selectedProblemIds.length === 0) return;

  ctx.save();
  selectedProblemIds.forEach((id, index) => {
    const problem = mathProblems.find(candidate => candidate.id === id);
    if (!problem || problem.components.mathProblem.consumed) return;
    if (blockedCells.has(positionedEntityGridCellKey(problem))) return;

    const { centerX, centerY, rotation } = lilyPadMotion(problem, currentTime);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, lilyPadRadius + 14, lilyPadRadius * 0.76 + 12, rotation, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(8, 47, 73, 0.9)';
    ctx.beginPath();
    ctx.arc(centerX + lilyPadRadius * 0.62, centerY - lilyPadRadius * 0.62, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), centerX + lilyPadRadius * 0.62, centerY - lilyPadRadius * 0.62);
  });
  ctx.restore();
};

function forEachVisibleMathProblem(
  mathProblems: MathProblemEntity[],
  drawProblem: (problem: MathProblemEntity) => void,
): void {
  mathProblems.forEach(problem => {
    if (problem.components.mathProblem.consumed) return;
    drawProblem(problem);
  });
}

export const drawMathProblemLilyPads = (
  ctx: CanvasRenderingContext2D,
  mathProblems: MathProblemEntity[],
  currentTime: number,
): void => {
  ctx.save();
  forEachVisibleMathProblem(mathProblems, problem => {
    const motion = lilyPadMotion(problem, currentTime);
    drawLilyPad(ctx, motion.centerX, motion.centerY, motion.rotation);
  });
  ctx.restore();
};

export const drawMathProblemNumbers = (
  ctx: CanvasRenderingContext2D,
  mathProblems: MathProblemEntity[],
  currentTime: number,
): void => {
  ctx.save();
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  forEachVisibleMathProblem(mathProblems, problem => {
    const motion = lilyPadMotion(problem, currentTime);
    const text = problem.components.mathProblem.value.toString();

    ctx.strokeStyle = 'rgba(12, 54, 28, 0.9)';
    ctx.lineWidth = 7;
    ctx.strokeText(text, motion.centerX, motion.centerY);

    ctx.fillStyle = '#fff7c6';
    ctx.fillText(text, motion.centerX, motion.centerY);
  });

  ctx.restore();
};
