import { GAME_CONFIG } from '../../../config';
import { renderMargins } from '../../boardGeometry';
import type { Components } from '../../types';
import { SPLASH_CELEBRATION_SECONDS, splashTitle } from '../../splashCelebration';
import { drawPondCelebration } from './levelComplete';

const clamp = function(value: number): number { return Math.max(0, Math.min(1, value)); };
const easeOutCubic = function(value: number): number { return 1 - (1 - value) ** 3; };
const easeOutBack = function(value: number): number {
	const c = 1.70158;
	return 1 + (c + 1) * (value - 1) ** 3 + c * (value - 1) ** 2;
};

export const drawSplashCelebration = function(
	ctx: CanvasRenderingContext2D,
	celebration: Readonly<Components['eliminationCelebration']>,
	reducedMotion: boolean,
): void {
	const { age, enemyIds } = celebration;
	if (age === null || age < 0 || age >= SPLASH_CELEBRATION_SECONDS) return;
	const progress = age / SPLASH_CELEBRATION_SECONDS;
	const enter = clamp(age / 0.18);
	const exit = clamp((age - 0.93) / 0.27);
	const alpha = easeOutCubic(enter) * (1 - exit ** 3);
	const pulse = reducedMotion ? 1 : (0.7 + 0.3 * easeOutBack(enter)) * (1 - 0.2 * exit ** 3);
	const margins = renderMargins();
	const { width, height } = ctx.canvas;
	ctx.save();
	// The source leaves can rise beyond the pond. Keep the live HUD clear.
	ctx.beginPath();
	ctx.rect(margins.left, margins.top, width - margins.left - margins.right, height - margins.top - margins.bottom);
	ctx.clip();
	ctx.translate(width / 2, height / 2);
	ctx.scale(0.82, 0.82);
	ctx.translate(-width / 2, -height / 2);
	if (!reducedMotion) {
		drawPondCelebration(ctx, progress, ctx.canvas, enemyIds.length >= 4 ? 24 : enemyIds.length === 3 ? 20 : 16, 1 - exit);
	}
	const titleSize = Math.max(30, Math.min(54, width * 0.075));
	const subtitleSize = titleSize * 0.48;
	const lift = reducedMotion ? 0 : 7 * (1 - easeOutCubic(enter)) - 12 * exit ** 3;
	ctx.translate(width / 2, height / 2 + lift);
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
	const title = splashTitle(enemyIds.length);
	// Keep the longest label inside the pond even on the smallest board.
	const availableWidth = (width - margins.left - margins.right) / 0.82 - GAME_CONFIG.GRID.CELL_SIZE * 0.12;
	const fit = Math.min(1, availableWidth / (ctx.measureText(title).width + 10));
	ctx.scale(fit, fit);
	ctx.strokeText(title, 0, -subtitleSize * 0.4);
	ctx.fillText(title, 0, -subtitleSize * 0.4);
	ctx.shadowBlur = 8;
	ctx.font = `bold ${subtitleSize}px ui-rounded, Trebuchet MS, Arial`;
	ctx.lineWidth = 6;
	const subtitle = `${enemyIds.length} TOGETHER!`;
	ctx.strokeText(subtitle, 0, titleSize * 0.78);
	ctx.fillStyle = '#b7ff88';
	ctx.fillText(subtitle, 0, titleSize * 0.78);
	ctx.restore();
};
