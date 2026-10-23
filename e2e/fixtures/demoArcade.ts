// Uses the actual game bootstrap, completion systems, screens, and UI.
// Only process identity and completed-board inputs are supplied by the fixture.
let storeOpens = 0;
const role = new URLSearchParams(location.search).get('role');
window.mathMarshDesktop = {
  steamRole: role === 'paid' ? 'paid' : role === 'standalone' ? null : 'demo',
  openFullGame: async () => { storeOpens++; },
};
const track = { currentStep: 1, highestUnlockedStep: 1 };
localStorage.setItem('math-marsh.player-profiles', JSON.stringify({ version: 1, profiles: [{
  id: 'demo-player', name: 'Mira', learnerData: {
    mathProgress: { add: track, subtract: track, multiply: track, divide: track },
    onboarding: { basics: 'completed', operands: 'completed', operandAndResult: 'completed' },
    skitProgress: [],
  },
}] }));
localStorage.setItem('math-marsh.active-player-profile', 'demo-player');

const { initializeGame } = await import('../../src/ecs/bootstrap');
const { gameEngine: engine } = await import('../../src/ecs/Engine');
await initializeGame();
await engine.setScreen('menu', {});

const settle = async function(): Promise<void> { await new Promise(resolve => setTimeout(resolve, 0)); };
const fixture = {
  state: function() {
    return { screen: engine.getCurrentScreen(), role: engine.getResource('steamAppRole'),
      run: engine.getResource('demoArcadeRun'), level: engine.getResource('currentLevel'), storeOpens };
  },
  completePond: async function(): Promise<void> {
    if (engine.getCurrentScreen() !== 'playing') throw new Error('Not playing');
    engine.setResource('remainingTimeSeconds', 999);
    engine.setResource('equationMode', { ...engine.getResource('equationMode'), clearedThisLevel: 999, feedback: undefined });
    engine.update(0);
    await settle();
    if (engine.getCurrentScreen() !== 'levelComplete') throw new Error('Board did not complete');
    engine.updateScreenState('levelComplete', { startedAt: -10000 });
    engine.update(0);
    await settle();
    if (engine.getCurrentScreen() === 'skit') {
      engine.updateScreenState('skit', { elapsed: 999 });
      engine.update(0);
      await settle();
    }
  },
};
declare global { interface Window { demoArcadeFixture: typeof fixture; } }
window.demoArcadeFixture = fixture;
