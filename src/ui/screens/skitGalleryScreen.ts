import { html, render } from 'lit-html';
import { SKITS } from '../../ecs/skitSequence';
import type { ScreenSpec } from '../screenTypes';
import { BTN_CHROME, BTN_SIZE, OVERLAY_BASE, type ScreenSpecActions } from './shared';

export const createSkitGalleryScreenSpec = function(actions: ScreenSpecActions): ScreenSpec {
	return {
		id: 'skit-gallery-screen',
		className: `${OVERLAY_BASE} app-background`,
		html: html`
			<section class="scene-gallery-shell" aria-labelledby="scene-gallery-title">
				<header class="scene-gallery-heading">
					<h1 id="scene-gallery-title" class="pond-title text-gold">Scenes</h1>
					<p>Little stories from the marsh. Complete levels to unlock them.</p>
					<p id="scene-gallery-count" class="scene-gallery-count"></p>
				</header>
				<div class="scene-gallery-grid" data-scenes></div>
				<button @click=${actions.goToMenu} class="scene-gallery-back btn-secondary ${BTN_CHROME} ${BTN_SIZE.lg}">← Back to Menu</button>
				<div class="input-prompts-slot" data-input-prompts></div>
			</section>`,
		onShow: function(root): void {
			const progress = actions.getSkitProgress();
			const unlockedCount = SKITS.filter(skit => progress.includes(skit.id)).length;
			const count = root.querySelector('#scene-gallery-count');
			if (count) count.textContent = `${unlockedCount} of ${SKITS.length} unlocked · ${SKITS.length - unlockedCount} left to unlock`;
			const grid = root.querySelector<HTMLElement>('[data-scenes]');
			if (!grid) return;
			render(SKITS.map((skit, index) => {
				const unlocked = progress.includes(skit.id);
				return html`
					<button class="scene-card" aria-disabled=${String(!unlocked)}
						aria-label=${unlocked ? `Play ${skit.title}` : `Scene ${index + 1} locked. Complete level ${skit.completedLevel} to unlock.`}
						@click=${function(): void { if (unlocked) actions.replaySkit(skit.id); }}>
						<span class="scene-card-number">Scene ${index + 1}</span>
						<span class="scene-card-symbol" aria-hidden="true">${unlocked ? '▶' : '?'}</span>
						<span class="scene-card-title">${unlocked ? skit.title : '???'}</span>
						<span class="scene-card-detail">${unlocked ? 'Play Scene' : `Complete level ${skit.completedLevel}`}</span>
					</button>`;
			}), grid);
		},
		prompts: [{ action: 'select', label: 'Play' }, { action: 'back', label: 'Back' }],
		promptPlacement: 'panel',
		onCancel: actions.goToMenu,
	};
};
