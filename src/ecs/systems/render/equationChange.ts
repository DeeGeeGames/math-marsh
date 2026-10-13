import type { EquationModeState } from '../../types';
import type { RenderMargins } from '../../boardGeometry';
import { GAME_CONFIG } from '../../../config';
import { boardObjectiveRegion } from './objective';

export const EQUATION_CHANGE_DURATION_MS = 2200;
const FLIGHT_START_MS = 180;
const FLIGHT_DURATION_MS = 650;
const amber = '#ffd18a';

/** Drawn by the existing renderer, using the pause-aware gameplay timeline. */
export const drawEquationChange = function(
  ctx: CanvasRenderingContext2D,
  equationMode: EquationModeState,
  margins: RenderMargins,
  currentTime: number,
  reducedMotion: boolean,
): void {
  const notice = equationMode.changeNotice;
  if (!notice || equationMode.feedback) return;
  const elapsed = currentTime - notice.startedAt;
  if (elapsed < 0 || elapsed >= EQUATION_CHANGE_DURATION_MS) return;
  const opacity = Math.min(1, (EQUATION_CHANGE_DURATION_MS - elapsed) / 400);
  const target = boardObjectiveRegion(ctx, margins.top);
  const origin = { x: notice.origin.x + margins.left, y: notice.origin.y + margins.top };

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = amber;
  ctx.fillStyle = amber;
  ctx.lineCap = 'round';

  if (elapsed < 650) {
    const progress = elapsed / 650;
    const radius = GAME_CONFIG.GRID.CELL_SIZE * 0.42 + (reducedMotion ? 0 : progress * 18);
    ctx.globalAlpha = opacity * (1 - progress);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(origin.x, origin.y, radius, radius * 0.78, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!reducedMotion && elapsed >= FLIGHT_START_MS && elapsed < FLIGHT_START_MS + FLIGHT_DURATION_MS) {
    const progress = (elapsed - FLIGHT_START_MS) / FLIGHT_DURATION_MS;
    const point = function(t: number): { x: number; y: number } {
      const bend = Math.sin(t * Math.PI) * GAME_CONFIG.GRID.CELL_SIZE * 0.35;
      return { x: origin.x + (target.x - origin.x) * t + bend, y: origin.y + (target.y - origin.y) * t };
    };
    const head = point(progress);
    ctx.globalAlpha = opacity;
    ctx.shadowColor = amber;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let index = 0; index <= 8; index += 1) {
      const position = point(Math.max(0, progress - 0.17 + index * 0.17 / 8));
      if (index === 0) ctx.moveTo(position.x, position.y);
      else ctx.lineTo(position.x, position.y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // The message appears immediately; the equation border brightens on arrival.
  const arrival = reducedMotion ? 1 : Math.max(0, 1 - Math.abs(elapsed - 830) / 400);
  ctx.globalAlpha = opacity * (0.45 + arrival * 0.55);
  ctx.lineWidth = 2 + arrival;
  ctx.beginPath();
  ctx.roundRect(target.left - 7, target.y - 21, target.width + 14, 41, 10);
  ctx.stroke();

  ctx.globalAlpha = opacity;
  const text = notice.reason === 'answerBlocked'
    ? 'Answer blocked · New equation'
    : 'No available answer · New equation';
  ctx.font = 'bold 16px Arial';
  const fit = Math.min(1, target.width / Math.max(1, ctx.measureText(text).width));
  ctx.translate(target.left, margins.top * 0.88);
  ctx.scale(fit, fit);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#09292c';
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
};
