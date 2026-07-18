import keyboardArrowDown from '../assets/button-prompts/keyboard/arrow_down.svg';
import keyboardArrowLeft from '../assets/button-prompts/keyboard/arrow_left.svg';
import keyboardArrowRight from '../assets/button-prompts/keyboard/arrow_right.svg';
import keyboardArrowUp from '../assets/button-prompts/keyboard/arrow_up.svg';
import keyboardEnter from '../assets/button-prompts/keyboard/enter.svg';
import keyboardEscape from '../assets/button-prompts/keyboard/escape.svg';
import playstationButtonCircle from '../assets/button-prompts/playstation/button_circle.svg';
import playstationButtonCross from '../assets/button-prompts/playstation/button_cross.svg';
import playstationButtonOptions from '../assets/button-prompts/playstation/button_options.svg';
import playstationDpadDown from '../assets/button-prompts/playstation/dpad_down.svg';
import playstationDpadLeft from '../assets/button-prompts/playstation/dpad_left.svg';
import playstationDpadRight from '../assets/button-prompts/playstation/dpad_right.svg';
import playstationDpadUp from '../assets/button-prompts/playstation/dpad_up.svg';
import steamdeckButtonA from '../assets/button-prompts/steamdeck/button_a.svg';
import steamdeckButtonB from '../assets/button-prompts/steamdeck/button_b.svg';
import steamdeckButtonOptions from '../assets/button-prompts/steamdeck/button_options.svg';
import steamdeckDpadDown from '../assets/button-prompts/steamdeck/dpad_down.svg';
import steamdeckDpadLeft from '../assets/button-prompts/steamdeck/dpad_left.svg';
import steamdeckDpadRight from '../assets/button-prompts/steamdeck/dpad_right.svg';
import steamdeckDpadUp from '../assets/button-prompts/steamdeck/dpad_up.svg';
import switchButtonA from '../assets/button-prompts/switch/button_a.svg';
import switchButtonB from '../assets/button-prompts/switch/button_b.svg';
import switchButtonPlus from '../assets/button-prompts/switch/button_plus.svg';
import switchDpadDown from '../assets/button-prompts/switch/dpad_down.svg';
import switchDpadLeft from '../assets/button-prompts/switch/dpad_left.svg';
import switchDpadRight from '../assets/button-prompts/switch/dpad_right.svg';
import switchDpadUp from '../assets/button-prompts/switch/dpad_up.svg';
import xboxButtonA from '../assets/button-prompts/xbox/button_a.svg';
import xboxButtonB from '../assets/button-prompts/xbox/button_b.svg';
import xboxButtonStart from '../assets/button-prompts/xbox/button_start.svg';
import xboxDpadDown from '../assets/button-prompts/xbox/dpad_down.svg';
import xboxDpadLeft from '../assets/button-prompts/xbox/dpad_left.svg';
import xboxDpadRight from '../assets/button-prompts/xbox/dpad_right.svg';
import xboxDpadUp from '../assets/button-prompts/xbox/dpad_up.svg';

export type InputPromptPlatform =
  | 'keyboard'
  | 'xbox'
  | 'playstation'
  | 'switch'
  | 'steamdeck'
  | 'generic';

export type InputPromptAction = 'navigate' | 'move' | 'select' | 'eat' | 'back' | 'skip' | 'pause';

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
  up: string;
  down: string;
  left: string;
  right: string;
  select: PromptGlyph;
  back: PromptGlyph;
  pause: PromptGlyph;
};

const dpadPrompts = (glyphs: Pick<ControllerPromptGlyphs, 'up' | 'down' | 'left' | 'right'>): PromptGlyph[] => [
  { src: glyphs.up, alt: 'D-pad' },
  { src: glyphs.down, alt: 'D-pad' },
  { src: glyphs.left, alt: 'D-pad' },
  { src: glyphs.right, alt: 'D-pad' },
];

const arrowKeyPrompts = (): PromptGlyph[] => [
  { src: keyboardArrowUp, alt: 'Arrow keys' },
  { src: keyboardArrowDown, alt: 'Arrow keys' },
  { src: keyboardArrowLeft, alt: 'Arrow keys' },
  { src: keyboardArrowRight, alt: 'Arrow keys' },
];

const controllerActionPrompts = (glyphs: ControllerPromptGlyphs): Record<InputPromptAction, PromptGlyph[]> => {
  const movement = dpadPrompts(glyphs);
  return {
    navigate: movement,
    move: movement,
    select: [glyphs.select],
    eat: [glyphs.select],
    back: [glyphs.back],
    skip: [glyphs.pause],
    pause: [glyphs.pause],
  };
};

const controllerPrompts = {
  xbox: controllerActionPrompts({
    up: xboxDpadUp,
    down: xboxDpadDown,
    left: xboxDpadLeft,
    right: xboxDpadRight,
    select: { src: xboxButtonA, alt: 'A button' },
    back: { src: xboxButtonB, alt: 'B button' },
    pause: { src: xboxButtonStart, alt: 'Start button' },
  }),
  playstation: controllerActionPrompts({
    up: playstationDpadUp,
    down: playstationDpadDown,
    left: playstationDpadLeft,
    right: playstationDpadRight,
    select: { src: playstationButtonCross, alt: 'Cross button' },
    back: { src: playstationButtonCircle, alt: 'Circle button' },
    pause: { src: playstationButtonOptions, alt: 'Options button' },
  }),
  switch: controllerActionPrompts({
    up: switchDpadUp,
    down: switchDpadDown,
    left: switchDpadLeft,
    right: switchDpadRight,
    select: { src: switchButtonB, alt: 'B button' },
    back: { src: switchButtonA, alt: 'A button' },
    pause: { src: switchButtonPlus, alt: 'Plus button' },
  }),
  steamdeck: controllerActionPrompts({
    up: steamdeckDpadUp,
    down: steamdeckDpadDown,
    left: steamdeckDpadLeft,
    right: steamdeckDpadRight,
    select: { src: steamdeckButtonA, alt: 'A button' },
    back: { src: steamdeckButtonB, alt: 'B button' },
    pause: { src: steamdeckButtonOptions, alt: 'Options button' },
  }),
} satisfies Record<Exclude<InputPromptPlatform, 'keyboard' | 'generic'>, Record<InputPromptAction, PromptGlyphSpec[]>>;

const buttonGlyphs = {
  keyboard: {
    navigate: arrowKeyPrompts(),
    move: [
      { text: 'WASD', alt: 'WASD keys' },
      ...arrowKeyPrompts(),
    ],
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
