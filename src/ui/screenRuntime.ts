import { render } from 'lit-html';
import {
  renderInputPromptBar,
  type InputPromptPlatform,
  type NativePromptBindings,
} from './inputPrompts';
import {
  findSpatialTargetIndex,
  type FocusDirection,
  type SpatialRect,
} from './spatialNavigation';
import {
  DEFAULT_FOCUS_SELECTOR,
  type ScreenSpec,
  type UIScreen,
} from './screenTypes';

type PromptSpec = Pick<ScreenSpec, 'prompts' | 'promptPlacement'>;

type ScreenRuntime = {
  activateFocus: () => void;
  focus: (selector: string) => boolean;
  navigateFocus: (direction: FocusDirection) => void;
  presentScreen: (screen: UIScreen, options?: ScreenPresentationOptions) => HTMLElement;
  revealLevelSelection: () => boolean;
  setPromptOverride: (screen: UIScreen, spec: PromptSpec | undefined) => void;
  triggerCancel: () => void;
  updateInputPromptPlatform: (platform: InputPromptPlatform, nativeBindings?: NativePromptBindings) => void;
};

export type ScreenPresentationOptions = Readonly<{
  retainGameplay?: boolean;
  retainMenu?: boolean;
  initialFocusSelector?: string;
}>;

function createGameContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'game-container';
  container.className = 'w-screen h-dvh relative overflow-hidden flex flex-col items-center justify-center font-sans app-background';
  document.body.appendChild(container);
  container.addEventListener('pointerdown', () => {
    delete document.documentElement.dataset.focusNavigation;
  }, { capture: true });
  return container;
}

const enableNavigationFocus = function(): void {
  document.documentElement.dataset.focusNavigation = 'true';
};

function spatialRect(element: HTMLElement): SpatialRect {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return { left, right, top, bottom };
}

export function createScreenRuntime(
  screenSpecs: Readonly<Record<UIScreen, ScreenSpec>>,
): ScreenRuntime {
  const container = createGameContainer();
  const screenElements = new Map<UIScreen, HTMLElement>();
  const promptOverrides = new Map<UIScreen, PromptSpec>();
  const state: { currentPromptPlatform: InputPromptPlatform; currentScreen: UIScreen; nativeBindings: NativePromptBindings | undefined } = {
    nativeBindings: undefined,
    currentPromptPlatform: 'keyboard' as InputPromptPlatform,
    currentScreen: 'menu' as UIScreen,
  };

  function promptSpecForScreen(screen: UIScreen): PromptSpec {
    return promptOverrides.get(screen) ?? screenSpecs[screen];
  }

  function renderPromptSlot(root: HTMLElement, spec: PromptSpec): void {
    const slot = root.querySelector<HTMLElement>('[data-input-prompts]');
    if (!slot || !spec.prompts) return;
    slot.classList.add(`input-prompts-slot--${spec.promptPlacement}`);
    slot.dataset.inputPromptPlacement = spec.promptPlacement;
    slot.replaceChildren(renderInputPromptBar(state.currentPromptPlatform, spec.prompts, state.nativeBindings));
  }

  function createScreen(screen: UIScreen): HTMLElement {
    const spec = screenSpecs[screen];
    const root = document.createElement('div');
    root.id = spec.id;
    root.className = spec.className;
    if (typeof spec.html === 'string') root.innerHTML = spec.html;
    else render(spec.html, root);
    renderPromptSlot(root, promptSpecForScreen(screen));
    spec.wire?.(root);
    container.appendChild(root);
    screenElements.set(screen, root);
    return root;
  }

  function getFocusables(screen: UIScreen): HTMLElement[] {
    const root = screenElements.get(screen);
    if (!root) return [];
    const selector = screenSpecs[screen].focusSelector ?? DEFAULT_FOCUS_SELECTOR;
    return Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
  }

  function focusElement(element: HTMLElement | undefined): void {
    if (!element) return;
    element.focus();
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function focusFirstOn(screen: UIScreen, preferredSelector?: string): void {
    const focusables = getFocusables(screen);
    const initialFocusSelector = preferredSelector ?? screenSpecs[screen].initialFocusSelector;
    const preferred = initialFocusSelector
      ? focusables.find(element => element.matches(initialFocusSelector))
      : undefined;
    focusElement(preferred ?? focusables[0]);
  }

  function presentScreen(
    screen: UIScreen,
    options: ScreenPresentationOptions = {},
  ): HTMLElement {
    const root = screenElements.get(screen) ?? createScreen(screen);
    screenSpecs[screen].onShow?.(root);
    renderPromptSlot(root, promptSpecForScreen(screen));
    screenElements.forEach((element, candidate) => {
      const retained = Boolean((options.retainGameplay && candidate === 'playing')
        || (options.retainMenu && candidate === 'menu'));
      element.style.display = candidate === screen || retained
        ? 'flex'
        : 'none';
      element.inert = retained;
    });
    state.currentScreen = screen;
    if (screen !== 'playing' && !options.retainGameplay) delete container.dataset.pondPhase;
    if (screen !== 'playing') {
      focusFirstOn(screen, options.initialFocusSelector);
      return root;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return root;
  }

  function setPromptOverride(screen: UIScreen, spec: PromptSpec | undefined): void {
    if (spec) promptOverrides.set(screen, spec);
    else promptOverrides.delete(screen);
    const root = screenElements.get(screen);
    if (root) renderPromptSlot(root, promptSpecForScreen(screen));
  }

  function updateInputPromptPlatform(platform: InputPromptPlatform, nativeBindings?: NativePromptBindings): void {
    state.nativeBindings = nativeBindings;
    state.currentPromptPlatform = platform;
    container.dataset.inputPlatform = platform;
    screenElements.forEach((root, screen) => {
      renderPromptSlot(root, promptSpecForScreen(screen));
    });
  }

  function focusedIndex(focusables: HTMLElement[]): number {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return -1;
    return focusables.indexOf(active);
  }

  function navigateFocus(direction: FocusDirection): void {
    const focusables = getFocusables(state.currentScreen);
    if (focusables.length === 0) return;
    enableNavigationFocus();
    const current = focusedIndex(focusables);
    if (current < 0) {
      focusElement(focusables[0]);
      return;
    }
    const target = findSpatialTargetIndex(focusables.map(spatialRect), current, direction);
    if (target === null) return;
    focusElement(focusables[target]);
  }

  function activateFocus(): void {
    const focusables = getFocusables(state.currentScreen);
    const current = focusedIndex(focusables);
    const target = current >= 0 ? focusables[current] : focusables[0];
    if (target) enableNavigationFocus();
    target?.click();
  }

  function focus(selector: string): boolean {
    const root = screenElements.get(state.currentScreen);
    const element = root?.querySelector<HTMLElement>(selector);
    if (!element || element.getClientRects().length === 0) return false;
    focusElement(element);
    return true;
  }

  function triggerCancel(): void {
    const onCancel = screenSpecs[state.currentScreen].onCancel;
    if (!onCancel) return;
    enableNavigationFocus();
    onCancel();
  }

  function revealLevelSelection(): boolean {
    if (state.currentScreen !== 'modeSelect') return false;
    const root = screenElements.get(state.currentScreen);
    const handler = screenSpecs[state.currentScreen].onLevelSelectionUnlocked;
    if (!root || !handler) return false;
    handler(root);
    return true;
  }

  return {
    activateFocus,
    focus,
    navigateFocus,
    presentScreen,
    revealLevelSelection,
    setPromptOverride,
    triggerCancel,
    updateInputPromptPlatform,
  };
}
