import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { createCoroutinePlugin } from 'ecspresso/plugins/scripting/coroutine';
import * as audio from '../audio/audio';
import type { GameEngine } from './Engine';
import type { TimerSlot } from './types';
import { configureGameScreens } from './screenConfiguration';
import { registerGameplayClockLifecycle } from './gameplayClockLifecycle';
import { addAISystemToEngine } from './systems/AISystem';
import { addEnemyEliminationFeedbackSystem } from './systems/EnemyEliminationFeedbackSystem';
import { registerFrogTongueInit } from './systems/FrogTongueSystem';
import { consumeSplashSupport, populateSplashScenario, type SplashPreviewCount } from '../dev/splashScenario';
import { splashDropletPose } from './splashCelebration';

type TestConfig = Omit<ConfigOf<GameEngine>, 'screens' | 'resources'> & {
	screens: {};
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

const createScenario = async function(count: SplashPreviewCount, staggered = false, reverse = false): Promise<{
	world: GameEngine; enemyIds: number[]; supportIds: number[];
}> {
	const world = ECSpresso.create<TestConfig>()
		.withPlugin(createTimerPlugin<TimerSlot>({ priority: 95 }))
		.withPlugin(createTweenPlugin({ priority: 75 }))
		.withPlugin(createCoroutinePlugin({ priority: 90, phase: 'preUpdate' }))
		.withScreens(configureGameScreens)
		.build();
	addAISystemToEngine(world.systemScope({ inScreens: ['playing'] }));
	addEnemyEliminationFeedbackSystem(world);
	registerFrogTongueInit(world);
	registerGameplayClockLifecycle(world);
	await world.initialize();
	await world.setScreen('playing', { level: 1, isFreshGame: false });
	const scenario = populateSplashScenario(world, count, { staggered, reverseOrder: reverse });
	world.update(0);
	return { world, ...scenario };
};

const consumeAllSupports = function(world: GameEngine, supportIds: readonly number[]): void {
	supportIds.forEach(id => consumeSplashSupport(world, id));
	world.update(0);
};

describe('same-update Splash celebrations', () => {
	beforeEach(() => { spyOn(audio, 'playSound').mockImplementation(() => {}); });
	afterEach(() => { mock.restore(); });

	for (const count of [1, 2, 3, 4] as const) {
		for (const reverse of [false, true]) {
			test(`${count} eliminations finalize one tier, independent of enemy order (${reverse})`, async () => {
				const { world, enemyIds, supportIds } = await createScenario(count, false, reverse);
				const sound = spyOn(audio, 'playSound');
				try {
					expect(world.getEntitiesWithQuery(['enemyElimination'])).toHaveLength(0);
					consumeAllSupports(world, supportIds);
					expect(world.getEntitiesWithQuery(['enemyElimination'])).toHaveLength(count);
					const groups = world.getEntitiesWithQuery(['eliminationCelebration']);
					expect(groups).toHaveLength(count === 1 ? 0 : 1);
					expect(sound).not.toHaveBeenCalled();
					if (count > 1) expect(groups[0]?.components.eliminationCelebration).toEqual({ enemyIds, age: null });
					world.update(0.15);
					expect(sound).not.toHaveBeenCalled();
					world.update(0.15);
					const expected: [audio.SoundEffect][] = count === 1 ? [['enemyPop']]
						: [['enemyPop'], [count === 2 ? 'doubleSplash' : count === 3 ? 'tripleSplash' : 'superSplash']];
					expect(sound.mock.calls).toEqual(expected);
					world.update(0.5);
					expect(sound.mock.calls).toEqual(expected);
					world.update(0.71);
					expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(0);
					world.update(3);
					expect(sound.mock.calls).toEqual(expected);
				} finally { await world.dispose(); }
			});
		}
	}

	test('separate AI updates never combine, even when both land in the same long frame', async () => {
		const { world, supportIds } = await createScenario(2, true);
		const sound = spyOn(audio, 'playSound');
		try {
			for (const id of supportIds) {
				consumeSplashSupport(world, id);
				world.update(0);
			}
			expect(world.getEntitiesWithQuery(['enemyElimination'])).toHaveLength(2);
			world.update(0.6);
			expect(sound.mock.calls).toEqual([['enemyPop']]);
			expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(0);
		} finally { await world.dispose(); }
	});

	test('long frames retain the landing cue and pause preserves pending and active effects', async () => {
		const { world, supportIds } = await createScenario(3);
		const sound = spyOn(audio, 'playSound');
		try {
			consumeAllSupports(world, supportIds);
			await world.pushScreen('paused', {});
			world.update(10);
			expect(sound).not.toHaveBeenCalled();
			await world.popScreen();
			world.update(0.7);
			const group = world.getEntitiesWithQuery(['eliminationCelebration'])[0];
			expect(group?.components.eliminationCelebration.age).toBe(0);
			expect(sound.mock.calls).toEqual([['enemyPop'], ['tripleSplash']]);
			world.update(0.95);
			expect(group?.components.eliminationCelebration.age).toBeCloseTo(0.95);
			await world.pushScreen('settings', { returnTo: 'playing' });
			world.update(20);
			expect(group?.components.eliminationCelebration.age).toBeCloseTo(0.95);
			await world.popScreen();
			world.update(0.26);
			expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(0);
			expect(sound).toHaveBeenCalledTimes(2);
		} finally { await world.dispose(); }
	});

	for (const landed of [false, true]) {
		test(`restart/new board cleans ${landed ? 'active' : 'pending'} celebrations`, async () => {
			const { world, supportIds } = await createScenario(4);
			try {
				consumeAllSupports(world, supportIds);
				if (landed) world.update(0.3);
				expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(1);
				await world.setScreen('playing', { level: 2, isFreshGame: true });
				world.update(1);
				expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(0);
			} finally { await world.dispose(); }
		});
	}

	test('removing all sources before landing cancels the pending celebration', async () => {
		const { world, enemyIds, supportIds } = await createScenario(2);
		const sound = spyOn(audio, 'playSound');
		try {
			consumeAllSupports(world, supportIds);
			enemyIds.forEach(id => world.commands.removeEntity(id));
			world.update(0.5);
			expect(world.getEntitiesWithQuery(['eliminationCelebration'])).toHaveLength(0);
			expect(sound).not.toHaveBeenCalled();
		} finally { await world.dispose(); }
	});

	test('a later group replaces the callout without inheriting count or age', async () => {
		const { world, supportIds } = await createScenario(2);
		const sound = spyOn(audio, 'playSound');
		try {
			consumeAllSupports(world, supportIds);
			world.update(0.3);
			world.update(0.4);
			const oldGroup = world.getEntitiesWithQuery(['eliminationCelebration'])[0];
			world.getEntitiesWithQuery(['position']).forEach(entity => world.commands.removeEntity(entity.id));
			world.update(0);
			const next = populateSplashScenario(world, 3);
			world.update(0);
			consumeAllSupports(world, next.supportIds);
			world.update(0.3);
			const groups = world.getEntitiesWithQuery(['eliminationCelebration']);
			expect(groups).toHaveLength(1);
			expect(groups[0]?.id).not.toBe(oldGroup?.id);
			expect(groups[0]?.components.eliminationCelebration).toEqual({ enemyIds: next.enemyIds, age: 0 });
			expect(sound.mock.calls).toEqual([['enemyPop'], ['doubleSplash'], ['enemyPop'], ['tripleSplash']]);
		} finally { await world.dispose(); }
	});
});

test('water drops follow the trajectory tangent while rising, at the apex, and falling', () => {
	for (const side of [-1, 1]) for (const lane of [0, 1, 2]) for (const progress of [0.1, 0.5, 0.9]) {
		const pose = splashDropletPose(side, lane, progress);
		const before = splashDropletPose(side, lane, progress - 0.00001);
		const after = splashDropletPose(side, lane, progress + 0.00001);
		const vx = after.x - before.x;
		const vy = after.y - before.y;
		const alignment = (-Math.sin(pose.rotation) * vx + Math.cos(pose.rotation) * vy) / Math.hypot(vx, vy);
		expect(alignment).toBeCloseTo(1, 6);
	}
});
