import { $ } from './dom';
import { formatRemainingTime } from '../ecs/runTime';
import type { PondPhase } from '../ecs/pondTheme';

const gameplayHud: {
  time?: HTMLElement;
  level?: HTMLElement;
  container?: HTMLElement;
  lastTime: string;
  lastLevel: string;
} = {
  lastTime: '',
  lastLevel: '',
};

export const bindGameplayHud = (root: ParentNode): void => {
  const timeDisplay = $(root, '#time-display');
  gameplayHud.time = timeDisplay;
  gameplayHud.level = $(root, '#level-display');
  gameplayHud.container = $(document, '#game-container');
  gameplayHud.lastTime = '';
  gameplayHud.lastLevel = '';
};

export const updateGameplayHud = (
  remainingSeconds: number,
  level: string,
  phase: PondPhase,
): void => {
  if (gameplayHud.container && gameplayHud.container.dataset.pondPhase !== phase) {
    gameplayHud.container.dataset.pondPhase = phase;
  }
  const time = formatRemainingTime(remainingSeconds);
  if (gameplayHud.time && time !== gameplayHud.lastTime) {
    gameplayHud.time.textContent = `Time left: ${time}`;
    gameplayHud.lastTime = time;
  }
  if (gameplayHud.level && level !== gameplayHud.lastLevel) {
    gameplayHud.level.replaceChildren(...level.split(' - ').map(part => {
      const line = document.createElement('span');
      line.textContent = part;
      return line;
    }));
    gameplayHud.level.setAttribute('aria-label', level);
    gameplayHud.lastLevel = level;
  }
};
