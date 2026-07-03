import { initializeGame } from './ecs/bootstrap';

const renderInApp = (html: string): HTMLDivElement => {
  const appElement = document.querySelector<HTMLDivElement>('#app');
  if (!appElement) throw new Error('#app element not found');
  appElement.className = 'w-screen h-dvh flex items-center justify-center app-background';
  appElement.innerHTML = html;
  return appElement;
};

const main = async (): Promise<void> => {
  try {
    const appElement = renderInApp(`
      <div class="flex items-center justify-center w-full h-full text-white text-center">
        <div class="flex flex-col items-center space-y-4 p-8">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          <div class="loading-label text-xl md:text-2xl font-bold">Loading Math Marsh...</div>
        </div>
      </div>
    `);

    await initializeGame();

    appElement.remove();
  } catch (error) {
    console.error('Failed to start Math Marsh:', error);
    renderInApp(`
      <div class="flex items-center justify-center w-full h-full p-4">
        <div class="error-panel p-6 md:p-8 rounded-lg max-w-md w-full text-center">
          <div class="text-6xl mb-4">⚠️</div>
          <h2 class="text-xl md:text-2xl font-bold mb-4">Failed to Load Game</h2>
          <p class="mb-2 text-sm md:text-base">An error occurred while loading Math Marsh.</p>
          <p class="text-sm md:text-base mb-6">Please refresh the page to try again.</p>
          <button
            onclick="window.location.reload()"
            class="error-action px-6 py-3 rounded-lg font-semibold transition-colors duration-200 w-full md:w-auto"
          >
            Refresh Page
          </button>
        </div>
      </div>
    `);
  }
};

main();
