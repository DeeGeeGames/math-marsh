import { describe, expect, test } from 'bun:test';
import ECSpresso from 'ecspresso';
import { createInputPlugin, type GamepadLike, type ActionState } from 'ecspresso/plugins/input/input';
import { advanceControllerSelection, controllerActionMap, controllerOnlyActionMap, gameActions, initialControllerSelection, keyboardActionMap } from '../ecs/controllerSelection';
import type { GameAction } from '../ecs/types';
import type { DesktopController, DesktopInputSnapshot, DesktopInputController } from './desktop';
import { createDesktopInputProvider } from './steamInput';

const native = function (id: string, active: readonly GameAction[] = []): DesktopController {
	return {
		kind: 'steam', id, steamHandle: id.split(':')[0] ?? id,
		actions: {
			up: active.includes('up'), down: active.includes('down'),
			left: active.includes('left'), right: active.includes('right'),
			eat: active.includes('eat'), back: active.includes('back'),
			skip: active.includes('skip'), pause: active.includes('pause'),
		},
		prompts: { eat: [{ label: 'A' }] },
	};
};
const pad = function (id: string): GamepadLike {
	return { id, connected: true, buttons: [{ pressed: true, value: 1 }], axes: [0, 0] };
};

describe('desktop input provider', () => {
	test('preserves browser slot positions, empty slots, and identical device models outside Steam', () => {
		const provider = createDesktopInputProvider(() => undefined, () => [null, pad('same'), null, pad('same')]);
		const slots = provider.poll();
		expect(slots.map(p => p?.id ?? null)).toEqual([null, 'browser:1:same', null, 'browser:3:same']);
		expect(provider.poll().map(p => p?.id ?? null)).toEqual(slots.map(p => p?.id ?? null));
	});
	test('uses only authoritative desktop controllers and preserves slots through reordering and capacity pressure', () => {
		let snapshot: DesktopInputSnapshot = { available: true, controllers: [native('a'), native('b'), native('c'), native('d')] };
		let browserPolls = 0;
		const provider = createDesktopInputProvider((): DesktopInputController => ({ snapshot: (): DesktopInputSnapshot => snapshot, setContext(): void {} }), () => {
			browserPolls += 1;
			return [pad('duplicate browser controller')];
		});
		expect(provider.poll().map(p => p?.id)).toEqual(['steam:a', 'steam:b', 'steam:c', 'steam:d']);
		snapshot = { available: true, controllers: [native('new'), native('d'), native('c'), native('b'), native('a')] };
		expect(provider.poll().map(p => p?.id)).toEqual(['steam:a', 'steam:b', 'steam:c', 'steam:d']);
		snapshot = { available: true, controllers: [native('new'), native('d'), native('c'), native('b')] };
		expect(provider.poll().map(p => p?.id)).toEqual(['steam:new', 'steam:b', 'steam:c', 'steam:d']);
		expect(browserPolls).toBe(0);
		expect(provider.getController('steam:new')).toEqual(native('new'));
	});

	test('falls back only when unavailable and namespaces provider transitions', () => {
		let snapshot: DesktopInputSnapshot = { available: false, controllers: [] };
		const provider = createDesktopInputProvider((): DesktopInputController => ({ snapshot: (): DesktopInputSnapshot => snapshot, setContext(): void {} }), () => [pad('same')]);
		expect(provider.poll()[0]?.id).toBe('browser:0:same');
		snapshot = { available: true, controllers: [{ kind: 'gamepad', id: 'same', buttons: [], axes: [] }] };
		expect(provider.poll()[0]?.id).toBe('desktop:same');
		snapshot = { available: true, controllers: [] };
		expect(provider.poll().every(p => p === null)).toBe(true);
	});

	test('sends context changes once and updates a replaced bridge', () => {
		const contexts: string[] = [];
		let bridge: DesktopInputController = { snapshot: (): DesktopInputSnapshot => ({ available: true, controllers: [] }), setContext: (context: string): void => { contexts.push(context); } };
		const provider = createDesktopInputProvider(() => bridge, () => []);
		provider.setContext('menu');
		provider.setContext('menu');
		provider.setContext('gameplay');
		bridge = { ...bridge };
		provider.setContext('gameplay');
		expect(contexts).toEqual(['menu', 'gameplay', 'gameplay']);
	});

	test('routes native edges through framework ownership, neutral handoff, independent skip/pause, and provider replacement', async () => {
		let snapshot: DesktopInputSnapshot = { available: true, controllers: [native('a:1', ['eat', 'skip'])] };
		let browserPad: GamepadLike = pad('browser');
		const provider = createDesktopInputProvider((): DesktopInputController => ({ snapshot: (): DesktopInputSnapshot => snapshot, setContext(): void {} }), () => [browserPad]);
		const world = ECSpresso.create()
			.withPlugin(createInputPlugin<GameAction>({
				gamepad: { poll: provider.poll }, target: new EventTarget(),
				actions: controllerActionMap(initialControllerSelection()),
				players: { keyboard: keyboardActionMap(), controller: controllerOnlyActionMap(initialControllerSelection()) },
			}))
			.withResource('selection', initialControllerSelection())
			.build();
		world.addSystem('ownership').inPhase('preUpdate').setPriority(99)
			.withResources(['inputState', 'selection'])
			.setProcess(({ ecs, resources }) => {
				const advanced = advanceControllerSelection(resources.selection, resources.inputState.gamepads);
				ecs.setResource('selection', advanced.selection);
				if (advanced.rebind) {
					resources.inputState.setActionMap(controllerActionMap(advanced.selection));
					resources.inputState.player('controller')?.setActionMap(controllerOnlyActionMap(advanced.selection));
				}
			});
		const advance = function (): ActionState<GameAction> {
			world.update(1 / 60);
			return gameActions(world.getResource('inputState'), world.getResource('selection'));
		};
		try {
			await world.initialize();
			expect(advance().justActivated('eat')).toBe(false);
			expect(world.getResource('selection').owner?.id).toBe('steam:a:1');
			expect(advance().justActivated('skip')).toBe(false);
			snapshot = { available: true, controllers: [native('a:1')] };
			advance(); advance();
			snapshot = { available: true, controllers: [native('a:1', ['skip'])] };
			let actions = advance();
			expect(actions.justActivated('skip')).toBe(true);
			expect(actions.isActive('pause')).toBe(false);
			expect(advance().justActivated('skip')).toBe(false);
			snapshot = { available: true, controllers: [native('a:1', ['pause'])] };
			actions = advance();
			expect(actions.justActivated('pause')).toBe(true);
			expect(actions.isActive('skip')).toBe(false);
			snapshot = { available: true, controllers: [native('a:2', ['eat'])] };
			expect(advance().justActivated('eat')).toBe(false);
			expect(world.getResource('selection').owner?.id).toBe('steam:a:2');
			expect(world.getResource('selection').waitingForNeutral).toBe(true);
			snapshot = { available: false, controllers: [] };
			expect(advance().justActivated('eat')).toBe(false);
			expect(world.getResource('selection').owner).toBeNull();
			browserPad = { ...pad('browser'), buttons: [] };
			advance();
			browserPad = pad('browser');
			expect(advance().justActivated('eat')).toBe(false);
			expect(world.getResource('selection').owner?.id).toBe('browser:0:browser');
		} finally {
			await world.dispose();
		}
	});
});
