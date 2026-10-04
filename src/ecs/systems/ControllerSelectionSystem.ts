import type { GameEngine, GameSystemRegistrar } from '../Engine';
import { advanceControllerSelection, controllerActionMap } from '../controllerSelection';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { pauseGameplayClocks } from '../gameplayClockLifecycle';

const RUN_SCREENS = ['playing', 'tutorial', 'levelComplete', 'skit'] as const;

export function addControllerSelectionSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('controllerSelectionSystem')
    .inPhase('preUpdate')
    .setPriority(SYSTEM_PRIORITIES.CONTROLLER_SELECTION)
    .withResources(['inputState', 'controllerSelection'])
    .setProcess(({ ecs, resources: { inputState, controllerSelection } }) => {
      const { selection, disconnected, rebind } = advanceControllerSelection(controllerSelection, inputState.gamepads);
      ecs.setResource('controllerSelection', selection);
      if (rebind) inputState.setActionMap(controllerActionMap(selection));
      if (!disconnected || ecs.isScreenActive('controllerRecovery')) return;
      if (!RUN_SCREENS.some(screen => ecs.isScreenActive(screen))) return;

      // Screen pushes are asynchronous. Freeze before clocks and simulation run
      // later in this frame, then let screen gates own the recovery overlay.
      ecs.disableSystemGroup('gameplay');
      pauseGameplayClocks(ecs);
      void ecs.pushScreen('controllerRecovery', {});
    });
}

export function registerControllerRecoveryLifecycle(ecs: GameEngine): void {
  let interruptedCelebrationMs = 0;
  ecs.onScreenExit('controllerRecovery', ({ ecs: world }) => {
    const recovery = world.getScreenState('controllerRecovery');
    interruptedCelebrationMs = performance.now() - recovery.startedAt;
    world.enableSystemGroup('gameplay');
  });
  ecs.onScreenResume('levelComplete', ({ ecs: world }) => {
    world.updateScreenState('levelComplete', state => ({ startedAt: state.startedAt + interruptedCelebrationMs }));
    interruptedCelebrationMs = 0;
  });
}
