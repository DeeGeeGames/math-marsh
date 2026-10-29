import { html, type TemplateResult } from 'lit-html';
import {
	flyMoveToward, flyMoveSide, flyTurnTowardSide, flyEatToward,
	frogHopToward, frogHopSide, frogTurnFrontSide,
	lizardWalkToward, lizardWalkSide, lizardTurnTowardSide, spiderWalkToward,
} from '../ecs/assets';
import { titleDemoState, titlePatrolPose, titleSpiderPose, type TitlePose } from './titleChoreography';
import { $ } from './dom';

const SHEETS = {
	fly: { front: flyMoveToward, side: flyMoveSide, turn: flyTurnTowardSide, eat: flyEatToward },
	frog: { front: frogHopToward, side: frogHopSide, turn: frogTurnFrontSide, eat: frogHopToward },
	lizard: { front: lizardWalkToward, side: lizardWalkSide, turn: lizardTurnTowardSide, eat: lizardWalkToward },
} as const;
const actor = function(name: keyof typeof SHEETS): TemplateResult {
	return html`<span class="title-actor title-${name}" style="background-image:url('${SHEETS[name].front}')" data-title-actor=${name}></span>`;
};
export const titleDemoTemplate = function(): TemplateResult {
	return html`<div class="title-demo" aria-hidden="true">
		<div class="title-equation"><small data-title-caption>Find the answer</small><strong data-title-problem>6 + 2 = ?</strong></div>
		<div class="title-water"></div><div class="title-ripple"></div>
		${[6, 2, 8].map(function(value, index) { return html`<div class="title-pad title-pad-${index}" data-title-pad><span>${value}</span></div>`; })}
		${actor('fly')}
	</div>`;
};
export const titleCastTemplate = function(): TemplateResult {
	return html`<div class="title-cast" aria-hidden="true">
		<div class="title-silk"></div><span class="title-actor title-spider" style="background-image:url('${spiderWalkToward}')" data-title-spider></span>
		${actor('frog')}${actor('lizard')}
		${['left', 'right'].map(function(side) { return html`<div class="title-reeds title-reeds-${side}">${[0, 1, 2, 3, 4].map(function(n) { return html`<i style="--reed:${n}"></i>`; })}</div>`; })}
	</div>`;
};
// Existing asset URLs are preloaded by the browser without creating another renderer.
export const titlePreloadsTemplate = function(): TemplateResult {
	return html`${Object.values(SHEETS).flatMap(function(sheets) { return Object.values(sheets); }).map(function(src) {
		return html`<img hidden src=${src} alt="" decoding="async">`;
	})}`;
};
type SceneNodes = Readonly<{
	demo: HTMLElement; equation: HTMLElement; problem: HTMLElement; caption: HTMLElement;
	fly: HTMLElement; frog: HTMLElement; lizard: HTMLElement; spider: HTMLElement; silk: HTMLElement;
	pads: readonly Readonly<{ pad: HTMLElement; number: HTMLElement }>[];
}>;
const sceneNodes = new WeakMap<HTMLElement, SceneNodes>();
const nodesFor = function(root: HTMLElement): SceneNodes {
	const cached = sceneNodes.get(root);
	if (cached) return cached;
	const nodes: SceneNodes = {
		demo: $(root, '.title-demo'), equation: $(root, '.title-equation'),
		problem: $(root, '[data-title-problem]'), caption: $(root, '[data-title-caption]'),
		fly: $(root, '[data-title-actor="fly"]'), frog: $(root, '[data-title-actor="frog"]'),
		lizard: $(root, '[data-title-actor="lizard"]'), spider: $(root, '[data-title-spider]'), silk: $(root, '.title-silk'),
		pads: Array.from(root.querySelectorAll<HTMLElement>('[data-title-pad]'), function(pad) { return { pad, number: $(pad, 'span') }; }),
	};
	sceneNodes.set(root, nodes);
	return nodes;
};
const presentPose = function(element: HTMLElement, animal: keyof typeof SHEETS, pose: TitlePose): void {
	element.style.backgroundImage = `url('${SHEETS[animal][pose.sheet]}')`;
	element.style.backgroundPosition = `${pose.frame / 7 * 100}% 50%`;
	element.style.setProperty('--x', String(pose.x));
	element.style.setProperty('--y', String(pose.y));
	element.style.transform = pose.flip ? 'scaleX(-1)' : 'none';
};
export const presentTitleScene = function(root: HTMLElement, seconds: number): void {
	const nodes = nodesFor(root);
	const demo = titleDemoState(seconds);
	presentPose(nodes.fly, 'fly', demo.pose);
	presentPose(nodes.frog, 'frog', titlePatrolPose('frog', seconds));
	presentPose(nodes.lizard, 'lizard', titlePatrolPose('lizard', seconds));
	const problem = `${demo.expression} = ${demo.consumed ? `${demo.answer} ✓` : '?'}`;
	if (nodes.problem.textContent !== problem) nodes.problem.textContent = problem;
	nodes.caption.textContent = demo.consumed ? 'Correct!' : 'Find the answer';
	nodes.equation.classList.toggle('is-solved', demo.consumed);
	nodes.pads.forEach(function({ pad, number }, index): void {
		const value = demo.values[index];
		if (value === undefined) return;
		if (number.textContent !== String(value)) number.textContent = String(value);
		const amount = index === demo.target ? demo.bite : 0;
		number.style.opacity = String(1 - amount);
		number.style.transform = `translateY(${-30 * amount}px) scale(${1 - .7 * amount})`;
		pad.classList.toggle('is-solved', index === demo.target && demo.consumed);
	});
	const spider = titleSpiderPose(seconds);
	nodes.spider.style.top = `${spider.y}%`;
	nodes.spider.style.visibility = spider.visible ? 'visible' : 'hidden';
	nodes.spider.style.backgroundPosition = `${spider.frame / 7 * 100}% 50%`;
	nodes.silk.style.height = `${Math.max(0, spider.y + 8)}%`;
	nodes.silk.style.visibility = spider.visible ? 'visible' : 'hidden';
};
export const titleSceneVisible = function(root: HTMLElement): boolean {
	return getComputedStyle(nodesFor(root).demo).display !== 'none';
};
