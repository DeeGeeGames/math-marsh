import { GAME_CONFIG } from '../../../config';
import type { AllComponents } from '../../types';
import { cellCenter } from '../../gameUtils';
import { ENEMY_BURST_SECONDS } from '../EnemyEliminationFeedbackSystem';

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
