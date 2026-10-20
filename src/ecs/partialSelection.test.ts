import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import * as audio from '../audio/audio';
import type { GameEngine } from './Engine';
import type { EquationModeState, TimerSlot } from './types';
import { configureGameScreens } from './screenConfiguration';
import { createEquationModeState } from '../math/equations';
import { enemyComponents, mathProblemComponents, playerComponents } from './entities';
import type { MathProblemEntityWithRenderable } from './queries';
import { handleEquationProblemSelection } from './equationSelection';
import { handleEnemySelectionDisruption } from './selectionDisruption';
import { gameplayClockPlugin, gameplayTimeMs } from './gameplayClock';
import { registerGameplayClockLifecycle } from './gameplayClockLifecycle';
import { addEquationFeedbackSystemToEngine } from './systems/EquationFeedbackSystem';
import { PARTIAL_SELECTION_DURATION_MS, partialSelectionPresentation } from './partialSelection';

type TestConfig = Omit<ConfigOf<GameEngine>, 'resources'> & {
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

const problemsIn = function(world: GameEngine): MathProblemEntityWithRenderable[] {
	return world.getEntitiesWithQuery(['position', 'mathProblem', 'collider', 'renderable']).map(function(entity) {
		return { ...entity, components: { ...entity.components, answerConsumption: entity.components.answerConsumption } };
	});
};

const createFixture = async function(promptKind: EquationModeState['promptKind']): Promise<{
	world: GameEngine; select: (index: number) => void; ids: number[];
}> {
	const world = ECSpresso.create<TestConfig>()
		.withPlugin(createTimerPlugin<TimerSlot>())
		.withPlugin(gameplayClockPlugin)
		.withScreens(configureGameScreens)
		.build();
	world.setResource('equationMode', {
		...createEquationModeState(1, 'medium', ['subtract']),
		promptKind, operandsRequired: promptKind === 'selectResult' ? 1 : 2,
		target: 5, promptValues: [8, 3],
	});
	world.setResource('equationsSolved', 0);
	addEquationFeedbackSystemToEngine(world);
	registerGameplayClockLifecycle(world);
	await world.initialize();
	await world.setScreen('playing', { level: 1, isFreshGame: true });
	world.spawn({ ...playerComponents(0, 0), timers: {} });
	const ids = [8, 8, 3, 5].map(function(value, index): number {
		return world.spawn(mathProblemComponents(index * 100, 0, value, 1)).id;
	});
	const select = function(index: number): void {
		const problems = problemsIn(world);
		const problem = problems.find(candidate => candidate.id === ids[index]);
		if (!problem) throw new Error('Missing test pad');
		handleEquationProblemSelection(world,
			world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']),
			problem, problems, {
				equationMode: world.getResource('equationMode'),
				gameMode: ['subtract'], mathDifficulty: 'medium',
			});
		world.update(0);
	};
	return { world, select, ids };
};

describe('partial selection feedback', function(): void {
	for (const promptKind of ['selectOperands', 'selectOperandAndResult'] as const) {
		test(`${promptKind}: selection, deselection, reselection, disruption and final feedback`, async function(): Promise<void> {
			const { world, select, ids } = await createFixture(promptKind);
			const sound = spyOn(audio, 'playSound').mockImplementation(function(): void {});
			const firstIndex = promptKind === 'selectOperands' ? 0 : 2;
			const firstId = ids[firstIndex];
			if (firstId === undefined) throw new Error('Missing test operand');
			try {
				world.update(0.1);
				select(firstIndex);
				let mode = world.getResource('equationMode');
				expect(mode.partialSelection).toEqual({ problemId: firstId, startedAt: 100 });
				expect(mode.selectedProblemIds).toEqual([firstId]);
				expect(mode.feedback).toBeUndefined();
				expect(sound.mock.calls.map(call => call[0])).toEqual(['answerSelect']);
				// Equal-valued pads are identified by entity, not by number.
				expect(partialSelectionPresentation(mode, ids[1] ?? -1, 150, false).emphasis).toBe(0);
				select(firstIndex);
				expect(world.getResource('equationMode').selectedProblemIds).toEqual([]);
				expect(world.getResource('equationMode').partialSelection).toBeUndefined();
				world.update(0.05);
				select(firstIndex);
				mode = world.getResource('equationMode');
				expect(mode.partialSelection?.startedAt).toBeCloseTo(150);
				const position = world.getComponent(ids[firstIndex] ?? -1, 'position');
				if (!position) throw new Error('Missing selected position');
				world.spawn({ ...enemyComponents(position.x, position.y, 'lizard', 'guard'), timers: {} });
				handleEnemySelectionDisruption(world, mode,
					problemsIn(world),
					world.getEntitiesWithQuery(['position', 'enemy', 'collider', 'timers']), 150);
				expect(world.getResource('equationMode').partialSelection).toBeUndefined();
				expect(world.getResource('equationMode').selectedProblemIds).toEqual([]);
				expect(sound.mock.calls.at(-1)?.[0]).toBe('answerDeselect');
				select(firstIndex);
				select(promptKind === 'selectOperands' ? 2 : 3);
				mode = world.getResource('equationMode');
				expect(mode.partialSelection).toBeUndefined();
				expect(mode.feedback?.kind).toBe('correct');
				expect(mode.feedback?.displayText).toBe('8 - 3 = 5');
				expect(world.getResource('equationsSolved')).toBe(1);
				expect(sound.mock.calls.at(-1)?.[0]).toBe('correct');
				// Correct feedback holds ownership even if another selection arrives.
				select(1);
				expect(world.getResource('equationMode')).toBe(mode);
			} finally { sound.mockRestore(); await world.dispose(); }
		});
		test(`${promptKind}: rapid wrong completion cancels the partial response immediately`, async function(): Promise<void> {
			const { world, select } = await createFixture(promptKind);
			const sound = spyOn(audio, 'playSound').mockImplementation(function(): void {});
			try {
				select(promptKind === 'selectOperands' ? 0 : 2);
				select(1);
				const mode = world.getResource('equationMode');
				expect(mode.feedback?.kind).toBe('incorrect');
				expect(mode.selectedProblemIds).toEqual([]);
				expect(mode.partialSelection).toBeUndefined();
				expect(sound.mock.calls.map(call => call[0])).toEqual(['answerSelect', 'incorrect']);
			} finally { sound.mockRestore(); await world.dispose(); }
		});
	}

	test('the effect freezes on pause, expires after resume, and is absent on a fresh board', async function(): Promise<void> {
		const { world, select, ids } = await createFixture('selectOperands');
		const sound = spyOn(audio, 'playSound').mockImplementation(function(): void {});
		try {
			select(0);
			world.update(0.06);
			const mode = world.getResource('equationMode');
			const id = ids[0] ?? -1;
			const before = partialSelectionPresentation(mode, id, gameplayTimeMs(world.getResource('gameplayClock')), false);
			expect(before.dip).toBeGreaterThan(0);
			expect(before.scale).toBeGreaterThan(1);
			expect(partialSelectionPresentation(mode, id, 60, true)).toEqual({ dip: 0, scale: 1, emphasis: before.emphasis });
			await world.pushScreen('paused', {});
			world.update(30);
			expect(partialSelectionPresentation(world.getResource('equationMode'), id, gameplayTimeMs(world.getResource('gameplayClock')), false)).toEqual(before);
			await world.popScreen();
			world.update(PARTIAL_SELECTION_DURATION_MS / 1000);
			expect(world.getResource('equationMode').partialSelection).toBeUndefined();
			select(0); select(0);
			world.setResource('equationMode', createEquationModeState(1, 'medium', ['subtract']));
			expect(partialSelectionPresentation(world.getResource('equationMode'), id, 0, false).emphasis).toBe(0);
		} finally { sound.mockRestore(); await world.dispose(); }
	});

	test('selectResult evaluates immediately without partial feedback', async function(): Promise<void> {
		const { world, select } = await createFixture('selectResult');
		const sound = spyOn(audio, 'playSound').mockImplementation(function(): void {});
		try {
			select(3);
			expect(world.getResource('equationMode').feedback?.kind).toBe('correct');
			expect(world.getResource('equationMode').partialSelection).toBeUndefined();
			expect(sound.mock.calls.map(call => call[0])).toEqual(['correct']);
		} finally { sound.mockRestore(); await world.dispose(); }
	});
});
