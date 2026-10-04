import spiderImage from '../../assets/images/spider.png';
import lizardWalkSide from '../../assets/lizard-walk-side.png';
import type { AdditionalSkitPresentation } from '../../ecs/additionalSkits';
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
				<header><p class="skit-kicker">A little marsh mischief</p><h1 id="skit-title">Snack Break</h1></header>
				<div class="skit-stage" role="img" aria-label="A frog tries to catch a fly, but catches a lily pad instead. The fly escapes.">
					<div class="skit-reeds"></div><div class="skit-ripple"></div>
					<div class="skit-extra" aria-hidden="true">
						<div class="skit-gap-pad skit-gap-left"></div><div class="skit-gap-pad skit-gap-right"></div>
						<div id="scene-pluck" class="scene-pluck"></div>
						<div id="scene-web" class="scene-web"><span></span></div>
						<div id="scene-diagram" class="scene-diagram"><span>↓</span><span>→ ● ←</span></div>
						<div id="scene-tongue" class="skit-tongue"></div>
						<div id="scene-frog" class="scene-actor scene-frog" style="background-image:url('${frogSide}')"></div>
						<div id="scene-lizard" class="scene-actor scene-lizard" style="background-image:url('${lizardWalkSide}')"></div>
						<div id="scene-spider" class="scene-actor" style="background-image:url('${spiderImage}')"></div>
						<div id="scene-fly" class="scene-actor scene-fly" style="background-image:url('${flySide}')"></div>
						<div id="scene-pad" class="skit-pad"></div><div id="scene-splash" class="scene-splash"></div>
						<div id="scene-burst" class="scene-burst"></div>
					</div>
					<div class="skit-perch"></div>
					<div id="skit-tongue" class="skit-tongue"></div>
					<div id="skit-pad" class="skit-pad"></div>
					<div id="skit-frog" class="skit-frog"></div>
					<div id="skit-fly" class="skit-fly" style="background-image:url('${flySide}')"></div>
				</div>
				<p id="skit-caption" class="skit-caption" aria-live="polite" aria-atomic="true"><span id="skit-speaker" class="skit-speaker"></span> <span id="skit-line"></span></p>
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
	root.dataset.scene = skit.id;
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (skit.id !== 'snack-break') {
		updateAdditionalScene(root, skit.presentation(elapsed, reducedMotion));
		return;
	}
	const view = skit.presentation(elapsed, reducedMotion);
	const fly = root.querySelector<HTMLElement>('#skit-fly');
	const frog = root.querySelector<HTMLElement>('#skit-frog');
	const tongue = root.querySelector<HTMLElement>('#skit-tongue');
	const pad = root.querySelector<HTMLElement>('#skit-pad');
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
	updateCaption(root, view.caption);
};

const updateAdditionalScene = function(root: HTMLElement, view: AdditionalSkitPresentation): void {
	for (const actor of ['fly', 'frog', 'spider', 'lizard', 'pad'] as const) {
		const element = root.querySelector<HTMLElement>(`#scene-${actor}`);
		const pose = view[actor];
		if (!element) continue;
		element.hidden = !pose.visible;
		element.style.left = `${pose.x}%`;
		element.style.top = `${pose.y}%`;
		element.style.transform = `translate(-50%, -100%) rotate(${pose.tilt}deg) scaleX(${pose.facing})`;
		if (actor === 'fly' || actor === 'lizard') element.style.backgroundPositionX = `${pose.frame / 7 * 100}%`;
	}
	for (const prop of ['web', 'diagram', 'tongue', 'splash', 'pluck'] as const) {
		const element = root.querySelector<HTMLElement>(`#scene-${prop}`);
		if (!element) continue;
		element.hidden = !view[prop];
		if (prop === 'web') element.style.transform = `rotate(${view.webTilt}deg) scale(${view.webBuild})`;
	}
	const burst = root.querySelector<HTMLElement>('#scene-burst');
	if (burst) {
		burst.hidden = !view.burst;
		if (burst.textContent !== view.burst) burst.textContent = view.burst;
	}
	const strand = root.querySelector<HTMLElement>('.scene-web span');
	if (strand) strand.style.transform = view.pluck ? 'rotate(-12deg)' : 'rotate(0deg)';
	const tongue = root.querySelector<HTMLElement>('#scene-tongue');
	const frog = root.querySelector<HTMLElement>('#scene-frog');
	const caughtPad = root.querySelector<HTMLElement>('#scene-pad');
	if (frog) {
		frog.style.backgroundImage = `url('${view.tongue ? frogMouth : frogSide}')`;
		frog.style.backgroundSize = `${view.tongue ? 400 : 800}% 100%`;
		frog.style.backgroundPositionX = view.tongue ? '100%' : '0%';
	}
	if (view.tongue && tongue && frog && caughtPad) {
		const mouthX = frog.offsetLeft + frog.offsetWidth * .12;
		const mouthY = frog.offsetTop - frog.offsetWidth * .52;
		const dx = caughtPad.offsetLeft - mouthX;
		const dy = caughtPad.offsetTop - caughtPad.offsetHeight / 2 - mouthY;
		tongue.style.left = `${mouthX}px`;
		tongue.style.top = `${mouthY}px`;
		tongue.style.width = `${Math.hypot(dx, dy) * view.tongueReach}px`;
		tongue.style.transformOrigin = 'left center';
		tongue.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
	}
	if (view.hat && view.lizard.visible) {
		const lizard = root.querySelector<HTMLElement>('#scene-lizard');
		const pad = root.querySelector<HTMLElement>('#scene-pad');
		if (lizard && pad) {
			pad.style.left = `${lizard.offsetLeft + lizard.offsetWidth * .18}px`;
			pad.style.top = `${lizard.offsetTop - lizard.offsetWidth * .8}px`;
		}
	}
	updateCaption(root, view.caption);
};

// Keep speaker and dialogue stable between beats, including the live region.
const updateCaption = function(root: HTMLElement, caption: string): void {
	const speaker = root.querySelector<HTMLElement>('#skit-speaker');
	const line = root.querySelector('#skit-line');
	const match = /^(Fly|Frog|Spider|Lizard|Together): “(.*)”$/.exec(caption);
	const name = match?.[1] ?? '';
	const words = match?.[2] ?? caption;
	if (speaker) {
		if (speaker.textContent !== name) speaker.textContent = name;
		speaker.hidden = !name;
		speaker.dataset.speaker = name.toLowerCase();
	}
	if (line && line.textContent !== words) line.textContent = words;
};
