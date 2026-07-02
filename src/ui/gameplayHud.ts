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
  score?: HTMLElement;
  lives?: HTMLElement;
  level?: HTMLElement;
  lastScore: number;
  lastLives: number;
  lastLevel: string;
} = {
  lastScore: NaN,
  lastLives: NaN,
  lastLevel: '',
};

export const bindGameplayHud = (root: ParentNode): void => {
  const scoreDisplay = $(root, '#score-display');
  const livesDisplay = $(root, '#lives-display');
  removeAnimationClassOnEnd(scoreDisplay, 'score-gain');
  removeAnimationClassOnEnd(livesDisplay, 'life-loss');
  gameplayHud.score = scoreDisplay;
  gameplayHud.lives = livesDisplay;
  gameplayHud.level = $(root, '#level-display');
};

export const updateGameplayHud = (
  score: number,
  lives: number,
  level: string,
): void => {
  if (gameplayHud.score && score !== gameplayHud.lastScore) {
    const scoreIncreased = Number.isFinite(gameplayHud.lastScore) && score > gameplayHud.lastScore;
    gameplayHud.score.textContent = `Score: ${score}`;
    gameplayHud.score.classList.toggle('score-gain', scoreIncreased);
    gameplayHud.lastScore = score;
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
