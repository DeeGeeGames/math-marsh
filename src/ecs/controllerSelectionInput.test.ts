import { describe, expect, test } from 'bun:test';
import ECSpresso from 'ecspresso';
import type ECSpressoInstance from 'ecspresso';
import {
  createInputPlugin,
  gamepadButtonsOn,
  type ActionMap,
  type GamepadLike,
  type InputResourceTypes,
} from 'ecspresso/plugins/input/input';

type ProbeAction = 'eat' | 'right';

type HandoffProbe = {
  owner: number;
  claimFrame: boolean;
  suppressedButtons: number[];
  observedEat: boolean;
  observedRight: boolean;
  deliveredEat: boolean;
  deliveredRight: boolean;
};

type HandoffWorldConfig = {
  readonly components: {};
  readonly events: {};
  readonly resources: InputResourceTypes<ProbeAction> & { handoffProbe: HandoffProbe };
  readonly assets: {};
  readonly screens: {};
};

type HandoffWorld = ECSpressoInstance<HandoffWorldConfig>;

const PAD_SLOTS = [0, 1, 2, 3] as const;
const ROUTED_BUTTONS = [0, 15] as const;
const CLAIM_BUTTONS = [0, 15] as const;

function gamepad(
  id: string,
  pressedButtons: readonly number[],
  buttonCount = 32,
): GamepadLike {
  return {
    id,
    connected: true,
    buttons: Array.from({ length: buttonCount }, (_, index) => {
      const pressed = pressedButtons.includes(index);
      return { pressed, value: pressed ? 1 : 0 };
    }),
    axes: [0, 0, 0, 0],
  };
}

function slots(...connected: Array<GamepadLike | null>): ReadonlyArray<GamepadLike | null> {
  return PAD_SLOTS.map(index => connected[index] ?? null);
}

function pollFrames(
  frames: readonly (readonly (GamepadLike | null)[])[],
): () => ReadonlyArray<GamepadLike | null> {
  const framesIterator = frames.values();
  return () => framesIterator.next().value ?? [];
}

function ownerActionMap(
  owner: number,
  suppressedButtons: readonly number[] = [],
): ActionMap<ProbeAction> {
  return {
    eat: {
      keys: ['Enter'],
      gamepadButtons: suppressedButtons.includes(0) ? [] : gamepadButtonsOn(owner, 0),
    },
    right: {
      keys: ['ArrowRight'],
      gamepadButtons: suppressedButtons.includes(15) ? [] : gamepadButtonsOn(owner, 15),
    },
  };
}

function dispatchKey(target: EventTarget, type: 'keydown' | 'keyup', key: string): void {
  const event = new Event(type);
  Object.defineProperty(event, 'key', { value: key });
  target.dispatchEvent(event);
}

function createHandoffFixture(
  frames: readonly (readonly (GamepadLike | null)[])[],
): { ecs: ReturnType<typeof createHandoffWorld>; target: EventTarget; probe: HandoffProbe } {
  const target = new EventTarget();
  const probe: HandoffProbe = {
    owner: 0,
    claimFrame: false,
    suppressedButtons: [],
    observedEat: false,
    observedRight: false,
    deliveredEat: false,
    deliveredRight: false,
  };
  const ecs = createHandoffWorld(pollFrames(frames), target, probe);
  return { ecs, target, probe };
}

function createHandoffWorld(
  poll: () => ReadonlyArray<GamepadLike | null>,
  target: EventTarget,
  probe: HandoffProbe,
): HandoffWorld {
  const ecs = ECSpresso.create()
    .withPlugin(createInputPlugin<ProbeAction>({
      actions: ownerActionMap(0),
      gamepad: { poll },
      target,
    }))
    .withResource('handoffProbe', probe)
    .build();

  ecs.addSystem('controller-claim-probe')
    .setPriority(99)
    .inPhase('preUpdate')
    .withResources(['inputState', 'handoffProbe'])
    .setProcess(({ resources: { inputState, handoffProbe } }) => {
      const challenger = PAD_SLOTS.find(index => {
        const gamepadState = inputState.gamepads[index];
        return index !== handoffProbe.owner
          && gamepadState?.connected === true
          && CLAIM_BUTTONS.some(button => gamepadState.justPressed(button));
      });

      handoffProbe.claimFrame = challenger !== undefined;

      if (challenger !== undefined) {
        handoffProbe.owner = challenger;
        const gamepadState = inputState.gamepads[challenger];
        handoffProbe.suppressedButtons = ROUTED_BUTTONS.filter(button =>
          gamepadState?.isDown(button) === true,
        );
        inputState.setActionMap(ownerActionMap(challenger, handoffProbe.suppressedButtons));
        return;
      }

      const ownerState = inputState.gamepads[handoffProbe.owner];
      const releasedSuppressedButtons = handoffProbe.suppressedButtons
        .filter(button => ownerState?.isDown(button) !== true);

      if (releasedSuppressedButtons.length === 0) return;

      handoffProbe.suppressedButtons = handoffProbe.suppressedButtons
        .filter(button => !releasedSuppressedButtons.includes(button));
      inputState.setActionMap(ownerActionMap(handoffProbe.owner, handoffProbe.suppressedButtons));
    });

  ecs.addSystem('controller-action-consumer-probe')
    .setPriority(98)
    .inPhase('preUpdate')
    .withResources(['inputState', 'handoffProbe'])
    .setProcess(({ resources: { inputState, handoffProbe } }) => {
      handoffProbe.observedEat = inputState.actions.justActivated('eat');
      handoffProbe.observedRight = inputState.actions.justActivated('right');
      handoffProbe.deliveredEat = handoffProbe.observedEat && !handoffProbe.claimFrame;
      handoffProbe.deliveredRight = handoffProbe.observedRight && !handoffProbe.claimFrame;
    });

  return ecs;
}

describe('ECSpresso 0.22.0 controller handoff feasibility', () => {
  test('slot 1 supports indexed button reads and rebinding while preserving keyboard input', async () => {
    const fixture = createHandoffFixture([
      slots(null, gamepad('shared gamepad', [20])),
      slots(null, gamepad('shared gamepad', [20])),
      slots(null, gamepad('shared gamepad', [])),
    ]);
    await fixture.ecs.initialize();
    fixture.ecs.update(1 / 60);

    const inputState = fixture.ecs.getResource('inputState');
    const slotOne = inputState.gamepads[1];
    expect(inputState.gamepads).toHaveLength(4);
    expect(slotOne?.connected).toBe(true);
    expect(slotOne?.justPressed(20)).toBe(true);
    expect('buttonCount' in (slotOne ?? {})).toBe(false);
    expect('buttons' in (slotOne ?? {})).toBe(false);
    expect(inputState.actions.isActive('eat')).toBe(false);

    const highIndexActionMap: ActionMap<ProbeAction> = {
      eat: { keys: ['Enter'], gamepadButtons: gamepadButtonsOn(1, 20) },
      right: { keys: ['ArrowRight'], gamepadButtons: gamepadButtonsOn(1, 15) },
    };
    inputState.setActionMap(highIndexActionMap);
    expect(inputState.getActionMap()).toEqual(highIndexActionMap);
    expect(inputState.actions.isActive('eat')).toBe(false);

    fixture.ecs.update(1 / 60);
    expect(inputState.actions.justActivated('eat')).toBe(true);
    expect(inputState.actions.isActive('eat')).toBe(true);

    dispatchKey(fixture.target, 'keydown', 'Enter');
    fixture.ecs.update(1 / 60);
    expect(inputState.keyboard.justPressed('Enter')).toBe(true);
    expect(inputState.actions.isActive('eat')).toBe(true);
  });

  test('identical IDs remain separate slots, but same-slot replacement between polls is invisible', async () => {
    const firstConnection = gamepad('identical controller id', [0]);
    const replacementBetweenPolls = gamepad('identical controller id', [0]);
    const secondController = gamepad('identical controller id', []);
    expect(replacementBetweenPolls).not.toBe(firstConnection);

    const fixture = createHandoffFixture([
      slots(firstConnection, secondController),
      slots(replacementBetweenPolls, secondController),
      slots(null, secondController),
      slots(replacementBetweenPolls, secondController),
    ]);
    await fixture.ecs.initialize();
    fixture.ecs.update(1 / 60);

    const inputState = fixture.ecs.getResource('inputState');
    expect(inputState.gamepads[0]?.id).toBe('identical controller id');
    expect(inputState.gamepads[1]?.id).toBe('identical controller id');
    expect(inputState.gamepads[0]?.isDown(0)).toBe(true);
    expect(inputState.gamepads[1]?.isDown(0)).toBe(false);
    expect(inputState.gamepads[0]).not.toBe(inputState.gamepads[1]);

    fixture.ecs.update(1 / 60);
    expect(inputState.gamepads[0]?.connected).toBe(true);
    expect(inputState.gamepads[0]?.id).toBe('identical controller id');
    expect(inputState.gamepads[0]?.isDown(0)).toBe(true);
    expect(inputState.gamepads[0]?.justPressed(0)).toBe(false);

    fixture.ecs.update(1 / 60);
    expect(inputState.gamepads[0]?.connected).toBe(false);
    fixture.ecs.update(1 / 60);
    expect(inputState.gamepads[0]?.connected).toBe(true);
    expect(inputState.gamepads[0]?.justPressed(0)).toBe(true);
  });

  test('claim-frame gating and held-button suppression work around deferred action-map rebinding', async () => {
    const fixture = createHandoffFixture([
      slots(gamepad('owner', [0]), gamepad('claimant', [15])),
      slots(gamepad('owner', []), gamepad('claimant', [15])),
      slots(gamepad('owner', []), gamepad('claimant', [])),
      slots(gamepad('owner', []), gamepad('claimant', [15])),
    ]);
    await fixture.ecs.initialize();
    fixture.ecs.update(1 / 60);

    expect(fixture.probe.owner).toBe(1);
    expect(fixture.probe.claimFrame).toBe(true);
    expect(fixture.probe.observedEat).toBe(true);
    expect(fixture.probe.deliveredEat).toBe(false);

    fixture.ecs.update(1 / 60);
    expect(fixture.probe.suppressedButtons).toEqual([15]);
    expect(fixture.probe.observedRight).toBe(false);
    expect(fixture.probe.deliveredRight).toBe(false);

    fixture.ecs.update(1 / 60);
    expect(fixture.probe.suppressedButtons).toEqual([]);
    expect(fixture.probe.deliveredRight).toBe(false);

    fixture.ecs.update(1 / 60);
    expect(fixture.probe.observedRight).toBe(true);
    expect(fixture.probe.deliveredRight).toBe(true);
  });
});
