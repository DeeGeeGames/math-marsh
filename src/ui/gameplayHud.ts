import { $ } from './dom';

const removeAnimationClassOnEnd = (
  element: HTMLElement,
  className: string,
): void => {
  element.addEventListener('animationend', () => {
    element.classList.remove(className);
  });
};

const gameplayHud: {
  time?: HTMLElement;
  lives?: HTMLElement;
  level?: HTMLElement;
  lastTime: string;
  lastLives: number;
  lastLevel: string;
} = {
  lastTime: '',
  lastLives: NaN,
  lastLevel: '',
};

export const formatElapsedTime = (elapsedSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const bindGameplayHud = (root: ParentNode): void => {
  const timeDisplay = $(root, '#time-display');
  const livesDisplay = $(root, '#lives-display');
  removeAnimationClassOnEnd(livesDisplay, 'life-loss');
  gameplayHud.time = timeDisplay;
  gameplayHud.lives = livesDisplay;
  gameplayHud.level = $(root, '#level-display');
};

export const updateGameplayHud = (
  elapsedSeconds: number,
  lives: number,
  level: string,
): void => {
  const time = formatElapsedTime(elapsedSeconds);
  if (gameplayHud.time && time !== gameplayHud.lastTime) {
    gameplayHud.time.textContent = `Time: ${time}`;
    gameplayHud.lastTime = time;
  }
  if (gameplayHud.lives && lives !== gameplayHud.lastLives) {
    const lifeLost = Number.isFinite(gameplayHud.lastLives) && lives < gameplayHud.lastLives;
    gameplayHud.lives.textContent = `Lives: ${lives}`;
    gameplayHud.lives.classList.toggle('life-loss', lifeLost);
    gameplayHud.lastLives = lives;
  }
  if (gameplayHud.level && level !== gameplayHud.lastLevel) {
    gameplayHud.level.textContent = level;
    gameplayHud.lastLevel = level;
  }
};
