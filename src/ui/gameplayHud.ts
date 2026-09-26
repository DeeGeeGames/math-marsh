import { $ } from './dom';
import { formatRemainingTime } from '../ecs/runTime';

const gameplayHud: {
  time?: HTMLElement;
  level?: HTMLElement;
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
};

export const updateGameplayHud = (
  remainingSeconds: number,
  level: string,
): void => {
  const time = formatRemainingTime(remainingSeconds);
  if (gameplayHud.time && time !== gameplayHud.lastTime) {
    gameplayHud.time.textContent = `Time left: ${time}`;
    gameplayHud.lastTime = time;
  }
  if (gameplayHud.level && level !== gameplayHud.lastLevel) {
    gameplayHud.level.textContent = level;
    gameplayHud.lastLevel = level;
  }
};
