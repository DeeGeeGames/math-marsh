import flySide from '../../assets/images/fly-move-side.png';
import frogSide from '../../assets/images/frog-hop-side.png';
import frogMouth from '../../assets/images/frog-open-mouth-side.png';
import { skitById, type Skit } from '../../ecs/skitSequence';
import type { ScreenSpec } from '../screenTypes';
import { BTN_CHROME, BTN_SIZE, inputPromptsSlot, OVERLAY_BASE } from './shared';

export const createSkitScreenSpec = function(skip: () => void): ScreenSpec {
	return {
		id: 'skit-screen',
		className: `${OVERLAY_BASE} app-background`,
		html: `
			<section class="skit-layout" aria-labelledby="skit-title">
				<header><p class="skit-kicker">Marsh intermission</p><h1 id="skit-title">Snack Break</h1></header>
				<div class="skit-stage" role="img" aria-label="A frog tries to catch a fly, but catches a lily pad instead. The fly escapes.">
					<div class="skit-reeds"></div><div class="skit-ripple"></div>
					<div class="skit-perch"></div>
					<div id="skit-tongue" class="skit-tongue"></div>
					<div id="skit-pad" class="skit-pad"></div>
					<div id="skit-frog" class="skit-frog"></div>
					<div id="skit-fly" class="skit-fly" style="background-image:url('${flySide}')"></div>
				</div>
				<p id="skit-caption" class="skit-caption" aria-live="polite"></p>
				<button id="skip-skit-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.md}">Skip Scene</button>
				${inputPromptsSlot()}
			</section>`,
		prompts: [{ action: 'select', label: 'Skip' }, { action: 'back', label: 'Skip' }],
		promptPlacement: 'panel',
		wire: function(root): void { root.querySelector('#skip-skit-btn')?.addEventListener('click', skip); },
	};
};

export const updateSkitPresentation = function(elapsed: number, skit: Skit = skitById(undefined)): void {
	const root = document.getElementById('skit-screen');
	if (!root) return;
	const title = root.querySelector('#skit-title');
	if (title) title.textContent = skit.title;
	root.querySelector('.skit-stage')?.setAttribute('aria-label', skit.stageLabel);
	const view = skit.presentation(elapsed, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	const fly = root.querySelector<HTMLElement>('#skit-fly');
	const frog = root.querySelector<HTMLElement>('#skit-frog');
	const tongue = root.querySelector<HTMLElement>('#skit-tongue');
	const pad = root.querySelector<HTMLElement>('#skit-pad');
	const caption = root.querySelector('#skit-caption');
	if (fly) {
		fly.style.left = `${view.flyX}%`;
		fly.style.top = `${Math.max(fly.offsetWidth + 12, (fly.parentElement?.offsetHeight ?? 0) * view.flyY / 100)}px`;
		fly.style.backgroundPositionX = `${view.flyFrame / 7 * 100}%`;
	}
	if (frog) {
		frog.style.backgroundImage = `url('${view.mouthOpen ? frogMouth : frogSide}')`;
		frog.style.backgroundSize = `${view.mouthOpen ? 400 : 800}% 100%`;
		frog.style.backgroundPositionX = view.mouthOpen ? '100%' : '0%';
		frog.style.transform = `translate(-50%, -100%) rotate(${view.frogTilt}deg)`;
	}
	if (tongue && frog && pad) {
		// Anchor the tongue to the mouth in the square sprite slot at every viewport.
		const mouthY = frog.offsetTop - frog.offsetWidth * 0.52;
		tongue.style.top = `${mouthY}px`;
		tongue.style.width = `${view.tongueReach * 39}%`;
		pad.style.marginTop = `${mouthY - (frog.parentElement?.offsetHeight ?? 0) * 0.61}px`;
	}
	if (pad) {
		pad.style.left = `${view.padX}%`;
		pad.style.top = `${view.padY}%`;
		pad.style.transform = `translate(-50%, -50%) rotate(${view.padCaught ? -25 : 0}deg)`;
	}
	if (caption && caption.textContent !== view.caption) caption.textContent = view.caption;
};
