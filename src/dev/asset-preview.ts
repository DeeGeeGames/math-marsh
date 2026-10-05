import ECSpresso from 'ecspresso';
import { html, render } from 'lit-html';
import { configureImageAssets } from '../ecs/assets';
import { createAudioPreview, type SoundEffect } from '../audio/audio';
import { CHARACTERS, EFFECTS, MUSIC, SPRITES, type SpritePreview } from './assetCatalog';

const root = document.querySelector<HTMLElement>('#preview-app');
if (!root) throw new Error('Preview root not found');
const initialSprite = SPRITES.find(function(sprite) { return sprite.key === 'flyMoveToward'; });
if (!initialSprite) throw new Error('Initial sprite not found');

const state = {
	sprite: initialSprite,
	frame: 0,
	elapsed: 0,
	playing: true,
	speed: 1,
	flipX: false,
	reverse: false,
	audioLabel: 'Stopped',
	background: 'checker',
};
const ecs = ECSpresso.create().withAssets(configureImageAssets).withResource('preview', state).build();
const audio = createAudioPreview();

const updateFrame = function(): void {
	const frameElement = document.querySelector<HTMLElement>('#sprite-frame');
	const frameLabel = document.querySelector<HTMLElement>('#frame-label');
	const scrubber = document.querySelector<HTMLInputElement>('#frame-scrubber');
	if (frameElement) frameElement.style.backgroundPosition = `${state.sprite.frameCount === 1 ? 0 : state.frame / (state.sprite.frameCount - 1) * 100}% 0`;
	if (frameLabel) frameLabel.textContent = `Frame ${state.frame + 1} / ${state.sprite.frameCount}`;
	if (scrubber) scrubber.value = String(state.frame);
};

const step = function(delta: number): void {
	state.playing = false;
	state.elapsed = 0;
	state.frame = (state.frame + delta + state.sprite.frameCount) % state.sprite.frameCount;
	draw();
};
const selectSprite = function(sprite: SpritePreview): void {
	state.sprite = sprite;
	state.frame = state.reverse ? sprite.frameCount - 1 : 0;
	state.elapsed = 0;
	draw();
};
const draw = function(): void {
	const image = ecs.getAsset(state.sprite.key);
	render(html`
		<header><p class="eyebrow">MATH MARSH / DEVELOPMENT</p><h1>Asset Preview</h1><p>Inspect a character, study each frame, and audition the game’s audio.</p></header>
		<div class="workspace">
			<section class="panel sprites" aria-labelledby="sprites-title">
				<h2 id="sprites-title">Characters & animations</h2>
				<div class="characters" role="group" aria-label="Character">${CHARACTERS.map(function(character) {
					return html`<button aria-pressed=${state.sprite.character === character} @click=${function(): void {
						const sprite = SPRITES.find(function(item) { return item.character === character; });
						if (sprite) selectSprite(sprite);
					}}>${character}</button>`;
				})}</div>
				<label>Animation<select @change=${function(event: Event): void {
					if (!(event.target instanceof HTMLSelectElement)) return;
					const key = event.target.value;
					const sprite = SPRITES.find(function(item) { return item.key === key; });
					if (sprite) selectSprite(sprite);
				}}>${SPRITES.filter(function(item) { return item.character === state.sprite.character; }).map(function(item) {
					return html`<option value=${item.key} .selected=${item.key === state.sprite.key}>${item.label}</option>`;
				})}</select></label>
				<div class="stage ${state.background}"><div id="sprite-frame" role="img" aria-label=${`${state.sprite.character} ${state.sprite.label}`} style=${`background-image: url("${image.src}"); background-size: ${state.sprite.frameCount * 100}% 100%; transform: scaleX(${state.flipX ? -1 : 1});`}></div></div>
				<div class="frame-info"><strong id="frame-label"></strong><span>${(image.naturalWidth / state.sprite.frameCount).toFixed(0)} × ${image.naturalHeight} px · ${state.sprite.fps.toFixed(1)} FPS</span></div>
				<input id="frame-scrubber" aria-label="Frame" type="range" min="0" max=${state.sprite.frameCount - 1} .value=${String(state.frame)} @input=${function(event: Event): void {
					if (!(event.target instanceof HTMLInputElement)) return;
					state.frame = Number(event.target.value); state.playing = false; state.elapsed = 0; draw();
				}}>
				<div class="transport">
					<button @click=${function(): void { step(-1); }}>Previous frame</button>
					<button class="primary" @click=${function(): void { state.playing = !state.playing; state.elapsed = 0; draw(); }}>${state.playing ? 'Pause' : 'Play loop'}</button>
					<button @click=${function(): void { step(1); }}>Next frame</button>
				</div>
				<div class="options">
					<label>Speed<select @change=${function(event: Event): void {
						if (event.target instanceof HTMLSelectElement) { state.speed = Number(event.target.value); state.elapsed = 0; }
					}}>${[0.25, 0.5, 1, 2].map(function(speed) { return html`<option value=${speed} .selected=${state.speed === speed}>${speed}×</option>`; })}</select></label>
					<label><input type="checkbox" .checked=${state.flipX} @change=${function(): void { state.flipX = !state.flipX; draw(); }}> Mirror</label>
					<label><input type="checkbox" .checked=${state.reverse} @change=${function(): void { state.reverse = !state.reverse; state.elapsed = 0; draw(); }}> Reverse</label>
					<label>Backdrop<select @change=${function(event: Event): void {
						if (event.target instanceof HTMLSelectElement) { state.background = event.target.value; draw(); }
					}}>${['checker', 'dark', 'light'].map(function(value) { return html`<option .selected=${state.background === value}>${value}</option>`; })}</select></label>
				</div>
				<p class="hint">Stepping or scrubbing pauses playback. Frames wrap in either direction.</p>
			</section>
			<aside class="panel audio" aria-labelledby="audio-title">
				<h2 id="audio-title">Audio audition</h2><p>Uses the same synthesized music and effects as the game.</p>
				<h3>Music</h3><div class="audio-list">${MUSIC.map(function(track) {
					return html`<button @click=${function(): void { audio.playMusic(track.scene, track.lowTime); state.audioLabel = track.label; draw(); }}>${track.label}</button>`;
				})}</div>
				<h3>Sound effects</h3><div class="effects">${Object.entries(EFFECTS).map(function([key, label]) {
					return html`<button @click=${function(): void { audio.playEffect(key as SoundEffect); state.audioLabel = label; draw(); }}>${label}</button>`;
				})}</div>
				<div class="audio-status"><span role="status">Last played: ${state.audioLabel}</span><button @click=${function(): void { audio.stop(); state.audioLabel = 'Stopped'; draw(); }}>Stop all audio</button></div>
				<p class="hint">Preview audio is enabled here without changing your saved game settings.</p>
			</aside>
		</div>`, root);
	updateFrame();
};

ecs.addSystem('assetPreviewPlayback').withResources(['preview']).setProcess(function({ dt, resources }): void {
	const preview = resources.preview;
	if (!preview.playing || document.hidden) return;
	preview.elapsed += dt * preview.speed * preview.sprite.fps;
	const frames = Math.floor(preview.elapsed);
	if (frames === 0) return;
	preview.elapsed -= frames;
	preview.frame = ((preview.frame + frames * (preview.reverse ? -1 : 1)) % preview.sprite.frameCount + preview.sprite.frameCount) % preview.sprite.frameCount;
	updateFrame();
});

let animationFrame = 0;
let ready = false;
let lastTime = performance.now();
const tick = function(time: number): void {
	ecs.update(document.hidden ? 0 : Math.min((time - lastTime) / 1000, 0.1));
	lastTime = time;
	animationFrame = requestAnimationFrame(tick);
};

render(html`<p>Loading character assets…</p>`, root);
try {
	await ecs.initialize();
	ready = true;
	draw();
	lastTime = performance.now();
	animationFrame = requestAnimationFrame(tick);
} catch (error) {
	render(html`<p role="alert">Unable to load assets: ${error instanceof Error ? error.message : String(error)}</p>`, root);
}
window.addEventListener('pagehide', function(): void {
	cancelAnimationFrame(animationFrame);
	animationFrame = 0;
	audio.dispose();
});
window.addEventListener('pageshow', function(event: PageTransitionEvent): void {
	if (!event.persisted || !ready || animationFrame !== 0) return;
	lastTime = performance.now();
	animationFrame = requestAnimationFrame(tick);
});
document.addEventListener('visibilitychange', function(): void {
	lastTime = performance.now();
	if (!document.hidden || !ready) return;
	audio.stop(); state.audioLabel = 'Stopped'; draw();
});
