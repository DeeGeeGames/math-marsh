import { gameEngine as world } from '../ecs/Engine';
import { gridToPixel } from '../ecs/gameUtils';
import { gridCells } from '../ecs/lilyPads';
import { enemyComponents, mathProblemComponents, playerComponents } from '../ecs/entities';
import { beginEnemyElimination } from '../ecs/enemyElimination';
import { addEnemyEliminationFeedbackSystem } from '../ecs/systems/EnemyEliminationFeedbackSystem';
import { addRenderSystemToEngine, initializeRenderSystem } from '../ecs/systems/RenderSystem';
import { registerGameplayClockLifecycle } from '../ecs/gameplayClockLifecycle';
import { createAudioPreview, unlockAudio } from '../audio/audio';
import { createEquationModeState } from '../math/equations';
import type { EnemyType } from '../types/shared';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const replay = document.querySelector<HTMLButtonElement>('#replay');
const scenario = document.querySelector<HTMLSelectElement>('#scenario');
const muted = document.querySelector<HTMLInputElement>('#muted');
const pause = document.querySelector<HTMLButtonElement>('#pause');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas || !replay || !scenario || !muted || !pause || !status) throw new Error('Missing review controls');

// Standalone composition root using the game's elimination, tween, audio and renderer.
const audio = createAudioPreview();
addEnemyEliminationFeedbackSystem(world);
addRenderSystemToEngine(world);
registerGameplayClockLifecycle(world);
world.setResource('tapFeedback', null);
world.setResource('equationMode', { ...createEquationModeState(1, 'easy', ['add']), target: 9, promptValues: [6, 3] });
world.setResource('remainingTimeSeconds', 60);
let targets: number[] = [];
let frame = 0;
let lastTime = performance.now();
let disposed = false;
let suspended = false;

const reset = function(): void {
	world.getEntitiesWithQuery(['position']).forEach(entity => world.commands.removeEntity(entity.id));
	world.update(0);
	gridCells(world.getResource('board')).forEach(function(cell, index): void {
		const position = gridToPixel(cell.x, cell.y);
		world.spawn(mathProblemComponents(position.x, position.y, index % 9 + 1, 1), { scope: 'playing' });
	});
	const player = gridToPixel(0, 0);
	world.spawn(playerComponents(player.x, player.y), { scope: 'playing' });
	const value = scenario.value;
	const types: readonly EnemyType[] = value === 'all' ? ['lizard', 'frog', 'spider']
		: [value === 'frog' || value === 'spider' ? value : 'lizard'];
	targets = types.map(function(type, index): number {
		const position = gridToPixel(index, 1);
		return world.spawn({ ...enemyComponents(position.x, position.y, type, 'guard'), timers: {} }, { scope: 'playing' }).id;
	});
	world.update(0);
	initializeRenderSystem(canvas, () => world.getResource('board'));
};

await world.initialize();
await world.setScreen('playing', { level: 1, isFreshGame: false });
reset();
status.textContent = 'Ready. Select a scenario and replay.';
replay.disabled = false;
replay.addEventListener('click', async function(): Promise<void> {
	if (world.getCurrentScreen() === 'paused') await world.popScreen();
	if (disposed) return;
	pause.textContent = 'Pause';
	reset();
	unlockAudio();
	for (const id of targets) {
		const entity = world.getEntity(id);
		if (entity?.components.enemy && entity.components.position && entity.components.timers) {
			beginEnemyElimination(world, { id, components: { enemy: entity.components.enemy, position: entity.components.position, timers: entity.components.timers } }, 'easy');
		}
	}
	world.update(0);
	status.textContent = `Playing ${scenario.value === 'all' ? 'three synchronized eliminations' : scenario.value} · ${muted.checked ? 'muted' : 'sound enabled'}`;
});
muted.addEventListener('change', function(): void {
	audio.setSoundEffects(!muted.checked);
});
pause.addEventListener('click', async function(): Promise<void> {
	if (world.getCurrentScreen() === 'paused') await world.popScreen();
	else await world.pushScreen('paused', {});
	if (disposed) return;
	pause.textContent = world.getCurrentScreen() === 'paused' ? 'Resume' : 'Pause';
});

const tick = function(time: number): void {
	if (disposed || suspended) return;
	const dt = document.hidden ? 0 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
	lastTime = time;
	world.update(dt);
	frame = requestAnimationFrame(tick);
};
frame = requestAnimationFrame(tick);
window.addEventListener('pagehide', function(event: PageTransitionEvent): void {
	suspended = true;
	cancelAnimationFrame(frame);
	if (event.persisted) { audio.stop(); return; }
	disposed = true;
	audio.dispose();
	void world.dispose();
});
window.addEventListener('pageshow', function(event: PageTransitionEvent): void {
	if (!event.persisted || disposed || !suspended) return;
	suspended = false;
	lastTime = performance.now();
	frame = requestAnimationFrame(tick);
});
