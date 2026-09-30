import type { SplashScreen } from '../../ecs/splashSequence';
import type { ScreenSpec } from '../screenTypes';
import ecspressoLogo from '../../assets/brand/ecspresso.svg';
import deegeeLogo from '../../assets/brand/deegee-games.svg';

const SPLASH_COPY = {
  studioSplash: { caption: 'A game by', name: 'DeeGee Games', detail: '', logo: deegeeLogo, width: 2984.97, height: 960 },
  engineSplash: { caption: 'Built with', name: 'ECSpresso', detail: 'Entity Component System', logo: ecspressoLogo, width: 2048, height: 1477 },
} as const;

export function createSplashScreenSpec(screen: SplashScreen): ScreenSpec {
  const copy = SPLASH_COPY[screen];
  return {
    id: screen,
    className: 'splash-screen absolute inset-0 flex flex-col items-center justify-center',
    html: `
      <div class="splash-card" aria-live="polite">
        <p class="splash-caption">${copy.caption}</p>
        <img class="splash-logo" src="${copy.logo}" alt="${copy.name}" width="${copy.width}" height="${copy.height}">
        ${copy.detail ? `<p class="splash-detail">${copy.detail}</p>` : ''}
      </div>
    `,
    promptPlacement: 'viewport',
  };
}

export function updateSplashOpacity(screen: SplashScreen, opacity: number): void {
  const card = document.getElementById(screen)?.querySelector<HTMLElement>('.splash-card');
  if (card) card.style.opacity = String(opacity);
}
