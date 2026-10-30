import { describe, expect, test } from 'bun:test';
import { advanceInputPromptPresentation, detectInputPromptPlatform, inputPromptGlyphs, type InputPromptState, type NativePromptBindings } from './inputPrompts';

const state = function (): InputPromptState {
  return { platform: 'keyboard', gamepadAxesActive: [] };
};
const activity = function (nativeBindings: NativePromptBindings, controller = true): { keyboard: boolean; controller: boolean; ownerId: string; platform: 'generic'; nativeBindings: NativePromptBindings } {
  return { keyboard: false, controller, ownerId: 'steam:123:1', platform: 'generic' as const, nativeBindings };
};

describe('native input prompts', () => {
  test('select and eat use the actual eat origin; Skip and Pause have independent labels and absent bindings remain unbound', () => {
    const bindings: NativePromptBindings = {
      eat: [{ label: 'Right Trackpad Click', glyph: 'data:image/png;base64,cG5n' }],
      skip: [{ label: 'L4' }],
      pause: [{ label: 'Menu' }],
    };
    expect(inputPromptGlyphs('generic', 'select', bindings)).toEqual([{ src: 'data:image/png;base64,cG5n', alt: 'Right Trackpad Click' }]);
    expect(inputPromptGlyphs('generic', 'eat', bindings)).toEqual(inputPromptGlyphs('generic', 'select', bindings));
    expect(inputPromptGlyphs('generic', 'skip', bindings)).toEqual([{ text: 'L4', alt: 'L4' }]);
    expect(inputPromptGlyphs('generic', 'pause', bindings)).toEqual([{ text: 'Menu', alt: 'Menu' }]);
    expect(inputPromptGlyphs('generic', 'back', bindings)).toEqual([{ text: 'Unbound', alt: 'Unbound' }]);
    expect(inputPromptGlyphs('generic', 'eat', { eat: [] })).toEqual([{ text: 'Unbound', alt: 'Unbound' }]);
  });

  test('refreshes same-controller rebindings while idle, without rerendering identical snapshots', () => {
    const prompt = state();
    const original: NativePromptBindings = { eat: [{ label: 'A' }] };
    expect(advanceInputPromptPresentation(prompt, activity(original))).toEqual({ platform: 'generic', nativeBindings: original });
    expect(advanceInputPromptPresentation(prompt, activity({ eat: [{ label: 'A' }] }, false))).toBeUndefined();
    const rebound: NativePromptBindings = { eat: [{ label: 'X' }] };
    const presentation = advanceInputPromptPresentation(prompt, activity(rebound, false));
    expect(presentation).toEqual({ platform: 'generic', nativeBindings: rebound });
    expect(inputPromptGlyphs('generic', 'select', presentation?.nativeBindings)).toEqual([{ text: 'X', alt: 'X' }]);
  });

  test('keyboard and pointer activity clear native bindings until the owner acts again', () => {
    const prompt = state();
    const bindings: NativePromptBindings = { eat: [{ label: 'L4' }] };
    advanceInputPromptPresentation(prompt, activity(bindings));
    expect(advanceInputPromptPresentation(prompt, { ...activity(bindings), keyboard: true })).toEqual({ platform: 'keyboard' });
    expect(prompt.nativeSignature).toBeUndefined();
    expect(advanceInputPromptPresentation(prompt, activity({ eat: [{ label: 'R4' }] }, false))).toBeUndefined();
    expect(inputPromptGlyphs('keyboard', 'select')[0]).toMatchObject({ alt: 'Enter key' });
    expect(advanceInputPromptPresentation(prompt, activity(bindings))).toEqual({ platform: 'generic', nativeBindings: bindings });
  });

  test('a conventional controller clears native origins even when its family is generic; disconnection returns keyboard prompts', () => {
    const prompt = state();
    advanceInputPromptPresentation(prompt, activity({ eat: [{ label: 'L4' }] }));
    expect(advanceInputPromptPresentation(prompt, {
      keyboard: false, controller: true, ownerId: 'desktop:1', platform: 'generic',
    })).toEqual({ platform: 'generic' });
    expect(prompt.nativeSignature).toBeUndefined();
    expect(inputPromptGlyphs('generic', 'select')[0]).toMatchObject({ alt: 'A button' });
    advanceInputPromptPresentation(prompt, activity({}));
    expect(advanceInputPromptPresentation(prompt, {
      keyboard: false, controller: false, ownerId: null, platform: 'generic',
    })).toEqual({ platform: 'keyboard' });
  });
});

describe('controller prompt family fallback', () => {
  test('a selected family overrides masked and ambiguous IDs, without changing native origins', () => {
    for (const id of ['Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'Unknown Controller', '']) {
      const prompt = state();
      const detected = detectInputPromptPlatform(id);
      const presentation = advanceInputPromptPresentation(prompt, {
        keyboard: false, controller: true, ownerId: id, platform: detected, preference: 'playstation',
      });
      expect(presentation?.platform).toBe('playstation');
      expect(inputPromptGlyphs(presentation?.platform ?? 'generic', 'select')[0]?.alt).toBe('Cross button');
    }
    const native = { eat: [{ label: 'L4' }] };
    expect(advanceInputPromptPresentation(state(), { ...activity(native), preference: 'switch' }))
      .toEqual({ platform: 'generic', nativeBindings: native });
  });

  test('updates a fallback while idle, preserves keyboard use, and follows replacement owners in Auto', () => {
    const prompt = state();
    const pad = { keyboard: false, controller: true, ownerId: 'masked-xbox', platform: 'xbox' as const };
    advanceInputPromptPresentation(prompt, pad);
    expect(advanceInputPromptPresentation(prompt, { ...pad, controller: false, preference: 'switch' }))
      .toEqual({ platform: 'switch' });
    expect(inputPromptGlyphs('switch', 'select')[0]?.alt).toBe('B button');
    expect(inputPromptGlyphs('switch', 'back')[0]?.alt).toBe('A button');
    expect(inputPromptGlyphs('switch', 'skip')).toEqual(inputPromptGlyphs('switch', 'pause'));
    expect(advanceInputPromptPresentation(prompt, { ...pad, keyboard: true })).toEqual({ platform: 'keyboard' });
    expect(advanceInputPromptPresentation(prompt, { ...pad, controller: false, preference: 'switch' })).toBeUndefined();
    expect(advanceInputPromptPresentation(prompt, { ...pad, ownerId: 'new-ps', platform: 'playstation', preference: 'auto' }))
      .toEqual({ platform: 'playstation' });
    expect(advanceInputPromptPresentation(prompt, { ...pad, ownerId: null, controller: false }))
      .toEqual({ platform: 'keyboard' });
  });
});
