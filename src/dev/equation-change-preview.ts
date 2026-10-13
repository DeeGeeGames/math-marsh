import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { gameEngine } from '../ecs/Engine';
import type { MathDifficulty } from '../ecs/types';
import { BOARD_SIZES } from '../ecs/boardGeometry';
import { gridCells } from '../ecs/lilyPads';
import { gridToPixel } from '../ecs/gameUtils';
import { createEquationModeState } from '../math/equations';
import { enemyComponents, mathProblemComponents, playerComponents } from '../ecs/entities';
import { addProblemManagementSystemToEngine } from '../ecs/systems/ProblemManagementSystem';
import { addRenderSystemToEngine, initializeRenderSystem } from '../ecs/systems/RenderSystem';
import { createAudioPreview, unlockAudio } from '../audio/audio';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const replay = document.querySelector<HTMLButtonElement>('#replay');
const difficultySelect = document.querySelector<HTMLSelectElement>('#difficulty');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas || !replay || !difficultySelect || !status) throw new Error('Missing preview controls');

// This standalone entry point is a composition root; no game loop or bootstrap is started.
const world = gameEngine;
const audio = createAudioPreview();
let difficulty: MathDifficulty = 'easy';
let blockedId: number | undefined;
let replayAt: number | undefined;
let frame = 0;
let lastTime = performance.now();
let disposed = false;
let suspended = false;

// Use the actual gameplay renderer and replacement owner, with stationary actors.
addProblemManagementSystemToEngine(world);
addRenderSystemToEngine(world);
world.setResource('tapFeedback', null);
world.setResource('enemySpawn', { index: 0, roster: ['lizard'] });
world.setResource('gameMode', ['add']);
world.setResource('remainingTimeSeconds', 60);

const reset = function(): void {
	world.getEntitiesWithQuery(['position']).forEach(entity => world.commands.removeEntity(entity.id));
	world.setResource('board', BOARD_SIZES[difficulty]);
	world.setResource('mathDifficulty', difficulty);
	const level = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
	world.setResource('currentLevel', level);
	world.setResource('equationMode', {
		...createEquationModeState(level, difficulty, ['add']),
		target: 9,
		promptValues: [6, 3],
	});
	const playerPosition = gridToPixel(1, 1);
	world.commands.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: { problemSpawn: createTimer(100) } });
	gridCells(BOARD_SIZES[difficulty]).forEach(function(cell, index): void {
		const position = gridToPixel(cell.x, cell.y);
		const value = index === 0 ? (difficulty === 'medium' ? 6 : 9) : (difficulty === 'expert' && index % 2 === 0 ? 6 : 3);
		world.commands.spawn(mathProblemComponents(position.x, position.y, value, 1));
	});
	// Commands flush before the next update phase, preserving the old equation.
	world.update(0);
	blockedId = world.getEntitiesWithQuery(['mathProblem', 'position'])[0]?.id;
	replayAt = undefined;
	status.textContent = 'Ready. Replay to block the last available answer.';
	initializeRenderSystem(canvas, () => world.getResource('board'));
};

replay.addEventListener('click', function(): void {
	reset();
	unlockAudio();
	replayAt = world.getResource('gameplayClock').elapsed + 0.45;
	status.textContent = 'An enemy is about to block the answer…';
});
difficultySelect.addEventListener('change', function(): void {
	const value = difficultySelect.value;
	if (value !== 'easy' && value !== 'medium' && value !== 'expert') return;
	difficulty = value;
	reset();
});
document.querySelector('#sound')?.addEventListener('click', function(): void { audio.playEffect('equationChange'); });

await world.initialize();
await world.setScreen('playing', { level: 1, isFreshGame: true });
reset();
replay.disabled = false;

const tick = function(time: number): void {
	if (disposed || suspended) return;
	const dt = document.hidden ? 0 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
	lastTime = time;
	if (replayAt !== undefined && world.getResource('gameplayClock').elapsed >= replayAt && blockedId !== undefined) {
		const position = world.getComponent(blockedId, 'position');
		if (position) {
			world.spawn({ ...enemyComponents(position.x, position.y, 'lizard', 'guard'), timers: {} });
		}
		replayAt = undefined;
		status.textContent = 'Answer blocked. The replacement and cue use the gameplay code.';
	}
	try {
		world.update(dt);
	} catch (error) {
		status.textContent = `Preview failed: ${error instanceof Error ? error.message : String(error)}`;
		console.error(error);
		return;
	}
	frame = requestAnimationFrame(tick);
};
frame = requestAnimationFrame(tick);

window.addEventListener('pagehide', function(event: PageTransitionEvent): void {
	suspended = true;
	cancelAnimationFrame(frame);
	if (event.persisted) {
		audio.stop();
		return;
	}
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
