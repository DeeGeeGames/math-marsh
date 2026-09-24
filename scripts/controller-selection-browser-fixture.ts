import { chromium } from 'playwright';
import type { GamepadLike } from 'ecspresso/plugins/input/input';

type Observation = {
  visibleButtons: string[];
  focusedButton: string | null;
  promptPlatform: string | null;
  promptGlyphSources: Array<string | null>;
  gamepads: Array<{ slot: number; id: string; mapping: string; buttonCount: number }>;
};

type FixturePad = GamepadLike & { index: number; mapping: 'standard' };

const BASE_URL = 'http://localhost:3000';
const FIXTURE_PAD_ID = 'Browser fixture Xbox compatible pad';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.addInitScript(() => {
  const pads: Array<FixturePad | null> = Array.from({ length: 4 }, () => null);
  const setPad = function setPad(slot: number, id: string, pressedButtons: readonly number[]): void {
    pads[slot] = {
      index: slot,
      id,
      connected: true,
      mapping: 'standard',
      buttons: Array.from({ length: 17 }, (_, button) => {
        const pressed = pressedButtons.includes(button);
        return { pressed, value: pressed ? 1 : 0 };
      }),
      axes: [0, 0, 0, 0],
    };
  };

  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => pads,
  });
  Object.defineProperty(window, '__setControllerFixturePad', { value: setPad });
});

await page.goto(BASE_URL);
  await page.waitForTimeout(300);

const observe = async function observe(): Promise<Observation> {
  return page.evaluate(() => ({
    visibleButtons: Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .filter(button => button.getClientRects().length > 0)
      .map(button => button.innerText.trim()),
    focusedButton: document.activeElement instanceof HTMLButtonElement
      ? document.activeElement.innerText.trim()
      : null,
    promptPlatform: document.querySelector<HTMLElement>('[data-input-prompt-platform]')
      ?.dataset.inputPromptPlatform ?? null,
    promptGlyphSources: Array.from(document.querySelectorAll<HTMLImageElement>('.input-prompt-glyph'))
      .map(glyph => glyph.getAttribute('src')),
    gamepads: Array.from(navigator.getGamepads())
      .flatMap((gamepad, slot) => gamepad?.connected
        ? [{ slot, id: gamepad.id, mapping: gamepad.mapping, buttonCount: gamepad.buttons.length }]
        : []),
  }));
};

const setPad = async function setPad(slot: number, pressedButtons: readonly number[]): Promise<void> {
  await page.evaluate(({ padSlot, id, buttons }) => {
    const setFixturePad = Reflect.get(window, '__setControllerFixturePad');
    if (typeof setFixturePad !== 'function') throw new Error('Controller fixture was not installed');
    setFixturePad(padSlot, id, buttons);
  }, { padSlot: slot, id: FIXTURE_PAD_ID, buttons: pressedButtons });
  await page.waitForTimeout(120);
};

try {
  const initialMenu = await observe();

  await setPad(0, [15]);
  const slotZeroMenuNavigation = await observe();
  await page.reload();
  await page.waitForTimeout(300);

  await setPad(1, []);
  const slotOneConnected = await observe();

  await setPad(1, [15]);
  const slotOneMenuNavigation = await observe();

  await setPad(1, [0]);
  const slotOneMenuActivation = await observe();

  await setPad(1, []);
  await setPad(0, [0]);
  const slotZeroMenuActivation = await observe();

  if (!initialMenu.visibleButtons.includes('Start Game')) {
    throw new Error('Expected the initial screen to show Start Game');
  }
  if (slotZeroMenuNavigation.focusedButton === initialMenu.focusedButton) {
    throw new Error('Expected slot 0 D-pad Right to move menu focus');
  }
  if (!slotOneConnected.visibleButtons.includes('Start Game')) {
    throw new Error('An idle slot 1 unexpectedly changed the active screen');
  }
  if (slotOneConnected.focusedButton !== initialMenu.focusedButton) {
    throw new Error('Slot 1 unexpectedly changed menu focus');
  }
  if (slotOneConnected.promptPlatform !== 'xbox') {
    throw new Error('Expected an idle slot 1 connection to select the Xbox prompt family');
  }
  if (slotOneMenuNavigation.focusedButton !== initialMenu.focusedButton) {
    throw new Error('Slot 1 unexpectedly navigated menu focus');
  }
  if (!slotOneMenuActivation.visibleButtons.includes('Start Game')) {
    throw new Error('Slot 1 unexpectedly activated the focused Start Game button');
  }
  if (slotOneMenuActivation.focusedButton !== initialMenu.focusedButton) {
    throw new Error('Slot 1 unexpectedly changed menu focus');
  }
  if (slotZeroMenuActivation.visibleButtons.includes('Start Game')) {
    throw new Error('Expected slot 0 A to enter the mode selection screen');
  }

  await setPad(0, []);
  await page.getByRole('button', { name: /Addition/ }).click();
  await page.getByRole('button', { name: 'Easy' }).click();
  await page.getByRole('button', { name: 'Skip and Play' }).click();
  await page.waitForTimeout(250);
  const gameplay = await observe();

  await setPad(1, [9]);
  const slotOneGameplayPause = await observe();

  await setPad(1, []);
  await setPad(0, [9]);
  const slotZeroGameplayPause = await observe();

  if (slotOneGameplayPause.visibleButtons.some(button => button.includes('Resume Game'))) {
    throw new Error('Slot 1 unexpectedly paused gameplay');
  }
  if (!slotZeroGameplayPause.visibleButtons.some(button => button.includes('Resume Game'))) {
    throw new Error('Expected slot 0 Start to pause gameplay');
  }

  process.stdout.write(JSON.stringify({
    fixture: 'browser simulation; synthetic Gamepad API; not Steam hardware evidence',
    browser: browser.version(),
    viewport: { width: 1280, height: 800 },
    results: {
      initialMenu,
      slotZeroMenuNavigation,
      slotOneConnected,
      slotOneMenuNavigation,
      slotOneMenuActivation,
      slotZeroMenuActivation,
      gameplay,
      slotOneGameplayPause,
      slotZeroGameplayPause,
    },
  }, null, 2) + '\n');
} finally {
  await browser.close();
}
