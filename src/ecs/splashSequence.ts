export const SPLASH_SCREENS = ['studioSplash', 'engineSplash'] as const;
export type SplashScreen = (typeof SPLASH_SCREENS)[number];

const FADE_SECONDS = 1;
const CARD_SECONDS = 4;

function skipFadeSeconds(skipAt: number): number {
  return Math.max(Math.min(skipAt / FADE_SECONDS, 1) * FADE_SECONDS / 2, 0.15);
}

export type SplashState = {
  elapsed: number;
  skipRequested: boolean;
  skipAt: number | null;
  transitionStarted: boolean;
};

export function initialSplashState(): SplashState {
  return { elapsed: 0, skipRequested: false, skipAt: null, transitionStarted: false };
}

function cardOpacity(elapsed: number): number {
  return Math.max(0, Math.min(1, elapsed / FADE_SECONDS, (CARD_SECONDS - elapsed) / FADE_SECONDS));
}

export function advanceSplash(state: SplashState, dt: number): SplashState {
  return {
    ...state,
    elapsed: state.elapsed + dt,
    skipAt: state.skipAt ?? (state.skipRequested && state.elapsed < CARD_SECONDS - FADE_SECONDS ? state.elapsed : null),
  };
}

export function splashOpacity(state: SplashState): number {
  if (state.skipAt === null) return cardOpacity(state.elapsed);
  return cardOpacity(state.skipAt) * Math.max(0, 1 - (state.elapsed - state.skipAt) / skipFadeSeconds(state.skipAt));
}

export function splashFinished(state: SplashState): boolean {
  if (state.skipAt === null) return state.elapsed >= CARD_SECONDS;
  return state.elapsed - state.skipAt >= skipFadeSeconds(state.skipAt);
}
