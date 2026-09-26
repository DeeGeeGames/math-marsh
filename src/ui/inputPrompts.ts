import keyboardEnter from '../assets/button-prompts/keyboard/enter.svg';
import keyboardEscape from '../assets/button-prompts/keyboard/escape.svg';
import playstationButtonCircle from '../assets/button-prompts/playstation/button_circle.svg';
import playstationButtonCross from '../assets/button-prompts/playstation/button_cross.svg';
import playstationButtonOptions from '../assets/button-prompts/playstation/button_options.svg';
import steamdeckButtonA from '../assets/button-prompts/steamdeck/button_a.svg';
import steamdeckButtonB from '../assets/button-prompts/steamdeck/button_b.svg';
import steamdeckButtonOptions from '../assets/button-prompts/steamdeck/button_options.svg';
import switchButtonA from '../assets/button-prompts/switch/button_a.svg';
import switchButtonB from '../assets/button-prompts/switch/button_b.svg';
import switchButtonPlus from '../assets/button-prompts/switch/button_plus.svg';
import xboxButtonA from '../assets/button-prompts/xbox/button_a.svg';
import xboxButtonB from '../assets/button-prompts/xbox/button_b.svg';
import xboxButtonStart from '../assets/button-prompts/xbox/button_start.svg';

export type InputPromptPlatform =
  | 'keyboard'
  | 'xbox'
  | 'playstation'
  | 'switch'
  | 'steamdeck'
  | 'generic';

export type InputPromptAction = 'select' | 'eat' | 'back' | 'skip' | 'pause';

export interface InputPromptState {
  platform: InputPromptPlatform;
  gamepadAxesActive: boolean[];
}

export interface InputPromptItem {
  action: InputPromptAction;
  label: string;
}

type PromptGlyph = {
  src: string;
  alt: string;
};

type TextGlyph = {
  text: string;
  alt: string;
};

type PromptGlyphSpec = PromptGlyph | TextGlyph;

type ControllerPromptGlyphs = {
  select: PromptGlyph;
  back: PromptGlyph;
  pause: PromptGlyph;
};

const controllerActionPrompts = (glyphs: ControllerPromptGlyphs): Record<InputPromptAction, PromptGlyph[]> => {
  return {
    select: [glyphs.select],
    eat: [glyphs.select],
    back: [glyphs.back],
    skip: [glyphs.pause],
    pause: [glyphs.pause],
  };
};

const controllerPrompts = {
  xbox: controllerActionPrompts({
    select: { src: xboxButtonA, alt: 'A button' },
    back: { src: xboxButtonB, alt: 'B button' },
    pause: { src: xboxButtonStart, alt: 'Start button' },
  }),
  playstation: controllerActionPrompts({
    select: { src: playstationButtonCross, alt: 'Cross button' },
    back: { src: playstationButtonCircle, alt: 'Circle button' },
    pause: { src: playstationButtonOptions, alt: 'Options button' },
  }),
  switch: controllerActionPrompts({
    select: { src: switchButtonB, alt: 'B button' },
    back: { src: switchButtonA, alt: 'A button' },
    pause: { src: switchButtonPlus, alt: 'Plus button' },
  }),
  steamdeck: controllerActionPrompts({
    select: { src: steamdeckButtonA, alt: 'A button' },
    back: { src: steamdeckButtonB, alt: 'B button' },
    pause: { src: steamdeckButtonOptions, alt: 'Options button' },
  }),
} satisfies Record<Exclude<InputPromptPlatform, 'keyboard' | 'generic'>, Record<InputPromptAction, PromptGlyphSpec[]>>;

const buttonGlyphs = {
  keyboard: {
    select: [{ src: keyboardEnter, alt: 'Enter key' }],
    eat: [{ text: 'Space', alt: 'Space key' }, { src: keyboardEnter, alt: 'Enter key' }],
    back: [{ src: keyboardEscape, alt: 'Escape key' }],
    skip: [{ text: 'Tab', alt: 'Tab key' }],
    pause: [{ src: keyboardEscape, alt: 'Escape key' }],
  },
  generic: controllerPrompts.xbox,
  ...controllerPrompts,
} satisfies Record<InputPromptPlatform, Record<InputPromptAction, PromptGlyphSpec[]>>;

export const detectInputPromptPlatform = (gamepadId: string): InputPromptPlatform => {
  const id = gamepadId.toLowerCase();
  if (id.includes('steamdeck') || id.includes('steam deck') || id.includes('valve') || id.includes('28de')) return 'steamdeck';
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('054c') || id.includes('ps3') || id.includes('ps4') || id.includes('ps5')) return 'playstation';
  if (id.includes('nintendo') || id.includes('switch') || id.includes('joy-con') || id.includes('joycon') || id.includes('057e')) return 'switch';
  if (id.includes('xbox') || id.includes('xinput') || id.includes('045e')) return 'xbox';
  return 'generic';
};

const createGlyphElement = (glyph: PromptGlyphSpec): HTMLElement => {
  if ('src' in glyph) {
    const img = document.createElement('img');
    img.className = 'input-prompt-glyph';
    img.src = glyph.src;
    img.alt = glyph.alt;
    return img;
  }

  const keycap = document.createElement('span');
  keycap.className = 'input-prompt-keycap';
  keycap.textContent = glyph.text;
  keycap.setAttribute('aria-label', glyph.alt);
  return keycap;
};

const createPromptElement = (platform: InputPromptPlatform, prompt: InputPromptItem): HTMLElement => {
  const item = document.createElement('span');
  item.className = 'input-prompt';
  item.dataset.promptAction = prompt.action;

  const glyphs = document.createElement('span');
  glyphs.className = 'input-prompt-glyphs';
  buttonGlyphs[platform][prompt.action].map(createGlyphElement).forEach(glyph => glyphs.appendChild(glyph));

  const label = document.createElement('span');
  label.className = 'input-prompt-label';
  label.textContent = prompt.label;

  item.append(glyphs, label);
  return item;
};

export const renderInputPromptBar = (
  platform: InputPromptPlatform,
  prompts: InputPromptItem[],
): HTMLElement => {
  const bar = document.createElement('div');
  bar.className = 'input-prompts-bar';
  bar.dataset.inputPromptPlatform = platform;
  prompts.map(prompt => createPromptElement(platform, prompt)).forEach(prompt => bar.appendChild(prompt));
  return bar;
};
