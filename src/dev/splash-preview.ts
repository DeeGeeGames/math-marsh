import { gameEngine as world } from '../ecs/Engine';
import { addAISystemToEngine } from '../ecs/systems/AISystem';
import { addEnemyEliminationFeedbackSystem } from '../ecs/systems/EnemyEliminationFeedbackSystem';
import { addRenderSystemToEngine, initializeRenderSystem } from '../ecs/systems/RenderSystem';
import { registerFrogTongueInit } from '../ecs/systems/FrogTongueSystem';
import { registerGameplayClockLifecycle } from '../ecs/gameplayClockLifecycle';
import { createAudioPreview, unlockAudio } from '../audio/audio';
import { createEquationModeState } from '../math/equations';
import { splashTitle } from '../ecs/splashCelebration';
import { consumeSplashSupport, populateSplashScenario, type SplashPreviewCount } from './splashScenario';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const replay = document.querySelector<HTMLButtonElement>('#replay');
const reset = document.querySelector<HTMLButtonElement>('#reset');
const scenario = document.querySelector<HTMLSelectElement>('#scenario');
const boardSize = document.querySelector<HTMLSelectElement>('#board-size');
const muted = document.querySelector<HTMLInputElement>('#muted');
const pause = document.querySelector<HTMLButtonElement>('#pause');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas || !replay || !reset || !scenario || !boardSize || !muted || !pause || !status) throw new Error('Missing Splash review controls');

// Standalone composition root; all triggers and effects use production systems.
const audio = createAudioPreview();
addAISystemToEngine(world.systemScope({ inScreens: ['playing'] }));
addEnemyEliminationFeedbackSystem(world);
addRenderSystemToEngine(world);
registerFrogTongueInit(world);
registerGameplayClockLifecycle(world);
world.setResource('tapFeedback', null);
world.setResource('equationMode', { ...createEquationModeState(1, 'expert', ['add']), target: 9, promptValues: [6, 3] });
world.setResource('remainingTimeSeconds', 60);
let supportIds: number[] = [];
let elapsed = 0;
let running = false;
let busy = false;
let disposed = false;
let suspended = false;
let frame = 0;
let lastTime = performance.now();
const seenGroups = new Set<number>();
const labels: string[] = [];

const selectedCount = function(): SplashPreviewCount {
	return scenario.value === 'single' ? 1 : scenario.value === 'triple' ? 3 : scenario.value === 'super' ? 4 : 2;
};

const prepare = async function(): Promise<void> {
	running = false;
	await world.setScreen('playing', { level: 1, isFreshGame: true });
	if (disposed) return;
	const difficulty = boardSize.value === 'easy' ? 'easy' : boardSize.value === 'medium' ? 'medium' : 'expert';
	const fixture = populateSplashScenario(world, selectedCount(), { staggered: scenario.value === 'staggered', difficulty });
	supportIds = fixture.supportIds;
	world.update(0);
	initializeRenderSystem(canvas, () => world.getResource('board'));
	world.update(0);
	elapsed = 0;
	seenGroups.clear();
	labels.length = 0;
	pause.disabled = true;
	pause.textContent = 'Pause';
	status.textContent = 'Ready. Replay removes the supporting pad and runs the real AI.';
};

const rebuild = async function(play: boolean): Promise<void> {
	if (busy || disposed) return;
	busy = true;
	replay.disabled = true;
	reset.disabled = true;
	scenario.disabled = true;
	boardSize.disabled = true;
	try {
		if (play) unlockAudio();
		await prepare();
		if (disposed || !play) return;
		const first = supportIds[0];
		if (first === undefined) throw new Error('Missing support pad');
		consumeSplashSupport(world, first);
		world.update(0);
		running = true;
		lastTime = performance.now();
		pause.disabled = false;
		status.textContent = 'Playing · the AI has started elimination.';
	} finally {
		busy = false;
		if (!disposed) {
			replay.disabled = false;
			reset.disabled = false;
			scenario.disabled = false;
			boardSize.disabled = false;
		}
	}
};

await world.initialize();
await rebuild(false);
replay.addEventListener('click', () => { void rebuild(true); });
reset.addEventListener('click', () => { void rebuild(false); });
scenario.addEventListener('change', () => { void rebuild(false); });
boardSize.addEventListener('change', () => { void rebuild(false); });
muted.addEventListener('change', () => { audio.setSoundEffects(!muted.checked); });
pause.addEventListener('click', async function(): Promise<void> {
	if (world.getCurrentScreen() === 'paused') await world.popScreen();
	else await world.pushScreen('paused', {});
	if (disposed) return;
	lastTime = performance.now();
	pause.textContent = world.getCurrentScreen() === 'paused' ? 'Resume' : 'Pause';
});

const tick = function(time: number): void {
	if (disposed || suspended) return;
	const dt = document.hidden ? 0 : Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
	lastTime = time;
	const advance = running && !busy && world.getCurrentScreen() === 'playing' ? dt : 0;
	if (advance > 0) {
		elapsed += advance;
		const second = supportIds[1];
		if (second !== undefined && elapsed >= 0.16) {
			consumeSplashSupport(world, second);
			supportIds = [];
		}
	}
	world.update(advance);
	for (const entity of world.getEntitiesWithQuery(['eliminationCelebration'])) {
		const celebration = entity.components.eliminationCelebration;
		if (celebration.age !== null && !seenGroups.has(entity.id)) {
			seenGroups.add(entity.id);
			labels.push(splashTitle(celebration.enemyIds.length));
		}
	}
	if (running && elapsed >= 3.2) {
		running = false;
		pause.disabled = true;
		status.textContent = `Finished · ${labels.length === 0 ? 'no group callout' : labels.join(', ')} · ${muted.checked ? 'muted' : 'sound enabled'}`;
	}
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
