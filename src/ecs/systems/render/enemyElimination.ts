import { GAME_CONFIG } from '../../../config';
import type { AllComponents } from '../../types';
import { cellCenter } from '../../gameUtils';
import { ENEMY_BURST_SECONDS, ENEMY_SPLASH_SECONDS } from '../EnemyEliminationFeedbackSystem';
import { splashDropletPose } from '../../splashCelebration';

export const drawEnemyEliminationBursts = function(
	ctx: CanvasRenderingContext2D,
	enemies: readonly { components: Pick<AllComponents, 'enemyElimination'> }[],
	reducedMotion: boolean,
): void {
	for (const enemy of enemies) {
		const impact = enemy.components.enemyElimination.impact;
		if (!impact?.played || impact.age >= ENEMY_BURST_SECONDS) continue;
		const progress = impact.age / ENEMY_BURST_SECONDS;
		const center = cellCenter(impact);
		const cell = GAME_CONFIG.GRID.CELL_SIZE;
		// Six short cream rays stay inside this cell and leave the pose visible.
		const radius = cell * (reducedMotion ? 0.31 : 0.22 + progress * 0.13);
		const length = cell * (reducedMotion ? 0.065 : 0.12 * (1 - progress) + 0.025);
		ctx.save();
		ctx.globalAlpha = (1 - progress) * 0.9;
		ctx.lineCap = 'round';
		for (let ray = 0; ray < 6; ray++) {
			const angle = ray * Math.PI / 3 - Math.PI / 6;
			ctx.beginPath();
			ctx.moveTo(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
			ctx.lineTo(center.x + Math.cos(angle) * (radius + length), center.y + Math.sin(angle) * (radius + length));
			ctx.strokeStyle = '#593924';
			ctx.lineWidth = 5;
			ctx.stroke();
			ctx.strokeStyle = '#fff1b5';
			ctx.lineWidth = 2.5;
			ctx.stroke();
		}
		ctx.restore();
	}
};

const drawWaterRing = function(
	ctx: CanvasRenderingContext2D,
	x: number, y: number, radiusX: number, radiusY: number, alpha: number,
): void {
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.beginPath();
	ctx.ellipse(x, y, radiusX, radiusY, -0.06, 0, Math.PI * 2);
	ctx.lineWidth = 4.5;
	ctx.strokeStyle = '#194e5c';
	ctx.stroke();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = '#c1faff';
	ctx.stroke();
	ctx.restore();
};

export const drawEnemySplashes = function(
	ctx: CanvasRenderingContext2D,
	enemies: readonly { components: Pick<AllComponents, 'enemyElimination'> }[],
	reducedMotion: boolean,
): void {
	const cell = GAME_CONFIG.GRID.CELL_SIZE;
	for (const enemy of enemies) {
		const impact = enemy.components.enemyElimination.impact;
		if (!impact?.played || impact.age >= ENEMY_SPLASH_SECONDS) continue;
		const progress = impact.age / ENEMY_SPLASH_SECONDS;
		const fade = (1 - progress) ** 0.65;
		const x = impact.x + cell / 2;
		const y = impact.y + cell * GAME_CONFIG.RENDER.ENTITY_BASELINE_RATIO;
		if (reducedMotion) {
			drawWaterRing(ctx, x, y, 24, 7, fade * 0.9);
			drawWaterRing(ctx, x, y + 1, 34, 10, fade * 0.65);
			continue;
		}
		const ease = 1 - (1 - progress) ** 3;
		drawWaterRing(ctx, x, y, 15 + ease * 27, 5 + ease * 7, fade);
		if (progress > 0.1) {
			const delayed = Math.min(1, (progress - 0.1) / 0.9);
			const radius = 1 - (1 - delayed) ** 3;
			drawWaterRing(ctx, x, y + 1, 9 + radius * 23, 3 + radius * 7, (1 - delayed) * 0.8);
		}
		if (progress < 0.35) {
			ctx.save();
			ctx.translate(x, y);
			ctx.globalAlpha = (1 - progress / 0.35) * 0.85;
			ctx.fillStyle = '#77d9df';
			ctx.strokeStyle = '#d0ffff';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(-20, 0);
			ctx.quadraticCurveTo(-17, -3, -18, -15);
			ctx.quadraticCurveTo(-7, -3, -7, -17);
			ctx.quadraticCurveTo(0, -5, 2, -20);
			ctx.quadraticCurveTo(10, -4, 13, -14);
			ctx.lineTo(22, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
		for (let index = 0; index < 6; index++) {
			const pose = splashDropletPose(index < 3 ? -1 : 1, index % 3, progress);
			const size = (3.8 - index % 2 * 0.7) * (1 - progress * 0.45);
			ctx.save();
			ctx.translate(x + pose.x, y + pose.y);
			ctx.rotate(pose.rotation);
			ctx.globalAlpha = fade;
			ctx.fillStyle = index % 2 ? '#88e1ee' : '#c7fbff';
			ctx.strokeStyle = '#245f6c';
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			ctx.moveTo(0, -size * 1.7);
			ctx.bezierCurveTo(size * 1.2, -size * 0.2, size * 1.2, size, 0, size);
			ctx.bezierCurveTo(-size * 1.2, size, -size * 1.2, -size * 0.2, 0, -size * 1.7);
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}
	}
};
