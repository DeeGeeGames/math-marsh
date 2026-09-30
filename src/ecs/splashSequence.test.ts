import { describe, expect, test } from 'bun:test';
import { advanceSplash, initialSplashState, splashFinished, splashOpacity } from './splashSequence';

describe('launch splash timing', () => {
  test('fades in, holds, then fades out before advancing', () => {
    const initial = initialSplashState();
    expect(splashOpacity(initial)).toBe(0);
    expect(splashOpacity(advanceSplash(initial, 0.5))).toBeCloseTo(0.5);
    expect(splashOpacity(advanceSplash(initial, 2))).toBe(1);
    expect(splashOpacity(advanceSplash(initial, 3.5))).toBeCloseTo(0.5);
    expect(splashFinished(advanceSplash(initial, 3.99))).toBe(false);
    expect(splashFinished(advanceSplash(initial, 4))).toBe(true);
    expect(splashOpacity(advanceSplash(initial, 5))).toBe(0);
  });

  test('skipping during fade-in fades from the current opacity and finishes early', () => {
    const fadingIn = advanceSplash(initialSplashState(), 0.5);
    const skipped = advanceSplash({ ...fadingIn, skipRequested: true }, 0.125);
    expect(splashOpacity(skipped)).toBeCloseTo(0.25);
    expect(splashFinished(skipped)).toBe(false);
    const finished = advanceSplash(skipped, 0.15);
    expect(finished.skipAt).toBe(fadingIn.elapsed);
    expect(splashFinished(finished)).toBe(true);
    expect(splashOpacity(finished)).toBe(0);
  });

  test('a zero delta keeps the intro frozen, including a pending skip', () => {
    const held = advanceSplash(initialSplashState(), 1);
    const skipped = advanceSplash({ ...held, skipRequested: true }, 0);
    expect(splashOpacity(skipped)).toBe(1);
    expect(advanceSplash(skipped, 0)).toEqual(skipped);
    expect(splashFinished(skipped)).toBe(false);
  });

  test('repeated input leaves the active fade-out unchanged', () => {
    const held = advanceSplash(initialSplashState(), 2);
    const skipped = advanceSplash({ ...held, skipRequested: true }, 0.1);
    const repeated = advanceSplash({ ...skipped, skipRequested: true }, 0.1);
    expect(repeated.skipAt).toBe(2);
    expect(splashOpacity(repeated)).toBeCloseTo(0.6);
    expect(splashFinished(advanceSplash(repeated, 0.31))).toBe(true);
  });

  test('input during the automatic fade-out does not restart it', () => {
    const fadingOut = advanceSplash(initialSplashState(), 3.5);
    const pressed = advanceSplash({ ...fadingOut, skipRequested: true }, 0.25);
    expect(pressed.skipAt).toBeNull();
    expect(splashOpacity(pressed)).toBeCloseTo(0.25);
    expect(splashFinished(advanceSplash(pressed, 0.25))).toBe(true);
  });
});
