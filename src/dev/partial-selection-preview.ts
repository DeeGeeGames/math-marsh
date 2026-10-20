import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { gameEngine } from '../ecs/Engine';
import type { EquationModeState } from '../ecs/types';
import { BOARD_SIZES } from '../ecs/boardGeometry';
import { gridCells } from '../ecs/lilyPads';
import { gridToPixel } from '../ecs/gameUtils';
import { createEquationModeState, equationSelectionText } from '../math/equations';
import { enemyComponents, mathProblemComponents, playerComponents } from '../ecs/entities';
import { addRenderSystemToEngine, initializeRenderSystem } from '../ecs/systems/RenderSystem';
import { addCollisionSystemToEngine } from '../ecs/systems/CollisionSystem';
import { addMovementSystemToEngine } from '../ecs/systems/MovementSystem';
import { addEquationFeedbackSystemToEngine } from '../ecs/systems/EquationFeedbackSystem';
import { addPlayerSpriteSystemToEngine } from '../ecs/systems/PlayerSpriteSystem';
import { addControllerSelectionSystemToEngine, registerControllerRecoveryLifecycle } from '../ecs/systems/ControllerSelectionSystem';
import { registerGameplayClockLifecycle } from '../ecs/gameplayClockLifecycle';
import { bindBoardPointer } from '../ui/boardPointer';
import { createAudioPreview } from '../audio/audio';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const resetButton = document.querySelector<HTMLButtonElement>('#reset');
const disruptButton = document.querySelector<HTMLButtonElement>('#disrupt');
const pauseButton = document.querySelector<HTMLButtonElement>('#pause');
const modeSelect = document.querySelector<HTMLSelectElement>('#mode');
const sound = document.querySelector<HTMLInputElement>('#sound');
const slow = document.querySelector<HTMLInputElement>('#slow');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas || !resetButton || !disruptButton || !pauseButton || !modeSelect || !sound || !slow || !status) {
	throw new Error('Missing preview controls');
}

// Standalone composition root: reuse actual game systems without progression or enemy AI.
const world = gameEngine;
const audio = createAudioPreview();
const gameplay = world.systemScope({ inScreens: ['playing'] });
addMovementSystemToEngine(gameplay);
addCollisionSystemToEngine(gameplay);
addEquationFeedbackSystemToEngine(gameplay);
addPlayerSpriteSystemToEngine(gameplay);
addRenderSystemToEngine(world);
registerGameplayClockLifecycle(world);
addControllerSelectionSystemToEngine(world);
registerControllerRecoveryLifecycle(world);
world.setResource('board', BOARD_SIZES.easy);
world.setResource('gameMode', ['subtract']);
world.setResource('mathDifficulty', 'medium');
world.setResource('remainingTimeSeconds', 60);

let promptKind: EquationModeState['promptKind'] = 'selectOperands';
let paused = false;
let suspended = false;
let disposed = false;
let frame = 0;
let lastTime = performance.now();

const reset = function(): void {
	world.getEntitiesWithQuery(['position']).forEach(entity => world.commands.removeEntity(entity.id));
	const mode: EquationModeState = {
		...createEquationModeState(1, 'medium', ['subtract']),
		promptKind, operandsRequired: promptKind === 'selectResult' ? 1 : 2,
		target: 5, promptValues: [8, 3],
	};
	world.setResource('equationMode', mode);
	world.setResource('equationsSolved', 0);
	world.setResource('equationsSolvedThisBoard', 0);
	world.setResource('tapRequest', null);
	world.setResource('tapEat', null);
	world.setResource('tapFeedback', null);
	const position = gridToPixel(0, 0);
	world.commands.spawn({
		...playerComponents(position.x, position.y),
		// The stationary preview enemy demonstrates disruption without damage noise.
		timers: { invulnerability: createTimer(Number.POSITIVE_INFINITY) },
	});
	const values = [8, 3, 5, 8, 3, 9, 2, 4, 6];
	gridCells(BOARD_SIZES.easy).forEach(function(cell, index): void {
		const value = values[index];
		if (value === undefined) throw new Error('Missing preview pad');
		const position = gridToPixel(cell.x, cell.y);
		world.commands.spawn(mathProblemComponents(position.x, position.y, value, 1));
	});
	world.update(0);
	initializeRenderSystem(canvas, () => world.getResource('board'));
};

resetButton.addEventListener('click', function(): void { reset(); canvas.focus(); });
modeSelect.addEventListener('change', function(): void {
	const value = modeSelect.value;
	if (value !== 'selectOperands' && value !== 'selectOperandAndResult' && value !== 'selectResult') return;
	promptKind = value;
	reset();
	canvas.focus();
});
disruptButton.addEventListener('click', function(): void {
	const id = world.getResource('equationMode').selectedProblemIds[0];
	const position = id === undefined ? undefined : world.getComponent(id, 'position');
	if (!position) return;
	world.commands.spawn({ ...enemyComponents(position.x, position.y, 'lizard', 'guard'), timers: {} });
	canvas.focus();
});
pauseButton.addEventListener('click', async function(): Promise<void> {
	if (world.isScreenActive('controllerRecovery')) {
		await world.popScreen();
		paused = false;
	} else {
		if (paused) await world.popScreen();
		else await world.pushScreen('paused', {});
		paused = !paused;
	}
	pauseButton.textContent = paused ? 'Resume' : 'Pause';
	canvas.focus();
});
sound.addEventListener('change', function(): void { audio.setSoundEffects(sound.checked); });
bindBoardPointer(canvas, function(point): void {
	if (!paused) world.setResource('tapRequest', point);
	canvas.focus();
});

await world.initialize();
await world.setScreen('playing', { level: 1, isFreshGame: true });
reset();
resetButton.disabled = false;
pauseButton.disabled = false;

const tick = function(time: number): void {
	if (disposed || suspended) return;
	const dt = document.hidden ? 0 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
	lastTime = time;
	world.update(dt * (slow.checked ? 0.2 : 1));
	const mode = world.getResource('equationMode');
	const values = mode.selectedProblemIds.flatMap(function(id): number[] {
		const problem = world.getComponent(id, 'mathProblem');
		return problem ? [problem.value] : [];
	});
	const path = world.tryGetSingleton(['pathFollower'])?.components.pathFollower;
	const location = path ? ` · Tile ${path.anchorGridX + 1},${path.anchorGridY + 1} ${path.breadcrumbs.length ? 'moving' : 'settled'}` : '';
	status.textContent = `${paused ? 'Paused. ' : ''}${mode.feedback?.displayText ?? equationSelectionText(mode, values)} · ${mode.feedback?.kind ?? (values.length ? 'Partial selection' : 'Ready')} · ${world.getResource('equationsSolved')} solved${location}`;
	const recovering = world.isScreenActive('controllerRecovery');
	if (recovering) {
		status.textContent = 'Controller disconnected. Reconnect it, or continue with keyboard.';
		pauseButton.textContent = 'Continue';
	}
	resetButton.disabled = paused || recovering;
	modeSelect.disabled = paused || recovering;
	disruptButton.disabled = paused || recovering || !values.length || mode.feedback !== undefined;
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
