import { render } from 'lit-html';
import {
  renderInputPromptBar,
  type InputPromptPlatform,
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
  navigateFocus: (direction: FocusDirection) => void;
  presentScreen: (screen: UIScreen, retainGameplay?: boolean) => HTMLElement;
  setPromptOverride: (screen: UIScreen, spec: PromptSpec | undefined) => void;
  triggerCancel: () => void;
  updateInputPromptPlatform: (platform: InputPromptPlatform) => void;
};

function createGameContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'game-container';
  container.className = 'w-screen h-dvh relative overflow-hidden flex flex-col items-center justify-center font-sans app-background';
  document.body.appendChild(container);
  return container;
}

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
  const state = {
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
    slot.replaceChildren(renderInputPromptBar(state.currentPromptPlatform, spec.prompts));
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

  function focusFirstOn(screen: UIScreen): void {
    const [first] = getFocusables(screen);
    focusElement(first);
  }

  function presentScreen(
    screen: UIScreen,
    retainGameplay = false,
  ): HTMLElement {
    const root = screenElements.get(screen) ?? createScreen(screen);
    screenElements.forEach((element, candidate) => {
      const retained = retainGameplay && candidate === 'playing';
      element.style.display = candidate === screen || retained
        ? 'flex'
        : 'none';
      element.inert = retained;
    });
    state.currentScreen = screen;
    if (screen !== 'playing' && !retainGameplay) delete container.dataset.pondPhase;
    if (screen !== 'playing') {
      focusFirstOn(screen);
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

  function updateInputPromptPlatform(platform: InputPromptPlatform): void {
    state.currentPromptPlatform = platform;
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
    target?.click();
  }

  function triggerCancel(): void {
    screenSpecs[state.currentScreen].onCancel?.();
  }

  return {
    activateFocus,
    navigateFocus,
    presentScreen,
    setPromptOverride,
    triggerCancel,
    updateInputPromptPlatform,
  };
}
