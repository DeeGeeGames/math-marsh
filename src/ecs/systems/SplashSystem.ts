import { splashAdvancePressed } from '../splashInput';
import type { GameSystemRegistrar } from '../Engine';
import { advanceSplash, splashFinished, splashOpacity, SPLASH_SCREENS } from '../splashSequence';
import { updateSplashOpacity } from '../../ui/screens/splashScreen';

export function addSplashSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('splashSystem')
    .inScreens([...SPLASH_SCREENS])
    .withResources(['inputState'])
    .setProcess(({ ecs, dt, resources: { inputState } }) => {
      const screen = ecs.getCurrentScreen();
      if (screen !== 'studioSplash' && screen !== 'engineSplash') return;
      const state = ecs.getScreenState(screen);
      if (state.transitionStarted) return;
      const skipRequested = state.skipRequested
        || splashAdvancePressed(inputState);
      const next = advanceSplash({ ...state, skipRequested }, dt);
      ecs.updateScreenState(screen, next);
      updateSplashOpacity(screen, splashOpacity(next));
      if (!splashFinished(next)) return;
      ecs.updateScreenState(screen, { transitionStarted: true });
      void ecs.setScreen(screen === 'studioSplash' ? 'engineSplash' : 'menu', {});
    });
}
