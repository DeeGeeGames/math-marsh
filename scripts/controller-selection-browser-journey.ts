import type { controllerFixture } from './controller-selection-browser-fixture';

type Fixture = typeof controllerFixture;

export const runControllerJourney = async function (fixture: Fixture) {
  const observations: Array<ReturnType<Fixture['observe']> & { label: string; focusedText: string | null }> = [];
  const wait = function (milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  };
  const assert = function (condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
  };
  const record = function (label: string) {
    const observation = { ...fixture.observe(), label, focusedText: document.activeElement?.textContent?.trim() ?? null };
    observations.push(observation);
    return observation;
  };
  const setPad = async function (slot: number, buttons: readonly number[] = [], axes: readonly number[] = [0, 0], id = 'Browser fixture Xbox controller'): Promise<void> {
    fixture.setPad(slot, buttons, axes, id);
    await wait(80);
  };
  const pulse = async function (slot: number, button: number): Promise<void> {
    await setPad(slot, [button]);
    await setPad(slot);
  };
  const screen = function (expected: string): void {
    assert(fixture.observe().screen === expected, `Expected ${expected}, found ${fixture.observe().screen}`);
  };
  const recover = async function (from: number, to: number, expected: string): Promise<void> {
    fixture.disconnect(from);
    await wait(100);
    screen('controllerRecovery');
    const frozen = record(`${expected}: disconnected`);
    await wait(200);
    assert(fixture.observe().clock === frozen.clock, 'Clock advanced during recovery');
    assert(fixture.observe().time === frozen.time, 'Run time changed during recovery');
    await setPad(to, [0, 9], [1, 0]);
    screen('controllerRecovery');
    await setPad(to, [], [1, 0]);
    assert(fixture.observe().selection.waitingForNeutral, 'Held stick was not suppressed');
    await setPad(to);
    await pulse(to, 0);
    screen(expected);
    record(`${expected}: recovered`);
  };

  try {
    for (let attempt = 0; attempt < 120 && fixture.observe().screen !== 'menu'; attempt += 1) await wait(100);
    screen('menu');
    record('fresh menu');
    await setPad(1, [], [1, 0]);
    assert(fixture.observe().selection.owner === null, 'Stick claimed an unowned controller');
    await setPad(1, [0, 15], [1, 0]);
    screen('menu');
    record('slot 1 claim consumed with held buttons and axis');
    await setPad(1);
    await setPad(2, [0, 9, 15], [1, 0], 'PlayStation fixture nonowner');
    assert(fixture.observe().selection.owner?.slot === 1, 'Nonowner stole ownership');
    assert(fixture.observe().platform === 'xbox', 'Nonowner changed glyphs');
    screen('menu');
    await setPad(2);
    await pulse(1, 0);
    screen('modeSelect');
    await pulse(1, 0);
    await pulse(1, 13);
    await pulse(1, 13);
    assert(document.activeElement?.id === 'easy-difficulty', 'Difficulty navigation failed');
    await pulse(1, 0);
    screen('tutorialOffer');
    record('tutorial offer via slot 1');
    await pulse(1, 0);
    screen('tutorial');
    const tutorial = record('tutorial via slot 1');
    await recover(1, 2, 'tutorial');
    const resumedTutorial = fixture.observe().tutorial;
    assert(tutorial.tutorial.active && resumedTutorial.active
      && tutorial.tutorial.stepIndex === resumedTutorial.stepIndex, 'Acquisition advanced tutorial');
    await pulse(2, 9);
    screen('playing');
    const beforeMove = record('gameplay');
    await setPad(2, [], [1, 0]);
    await setPad(2);
    const afterMove = record('owner stick movement');
    assert(afterMove.position?.x !== beforeMove.position?.x, 'Owner stick did not move player');
    await recover(2, 3, 'playing');
    await pulse(2, 9);
    screen('playing');
    await pulse(3, 9);
    screen('paused');
    await recover(3, 1, 'paused');
    assert(document.activeElement?.id === 'resume-btn', 'Pause UI was not restored');
    await pulse(1, 13);
    await pulse(1, 0);
    screen('settings');
    await recover(1, 2, 'settings');
    const settings = document.querySelector<HTMLElement>('#settings-screen');
    assert(settings !== null && settings.getClientRects().length > 0, 'Settings UI was not restored');
    assert(document.activeElement?.id !== 'controller-continue-btn', 'Recovery focus remained after settings resume');
    await pulse(2, 1);
    screen('paused');
    await pulse(2, 0);
    screen('playing');

    // Dedicated state fixture tests the real levelComplete lifecycle and timer.
    await fixture.startCelebration();
    fixture.disconnect(2);
    await wait(100);
    screen('controllerRecovery');
    const celebration = record('levelComplete: disconnected');
    await wait(1800);
    screen('controllerRecovery');
    assert(fixture.observe().clock === celebration.clock, 'Celebration recovery clock advanced');
    await setPad(3, [9]);
    await setPad(3);
    await pulse(3, 0);
    screen('levelComplete');
    record('levelComplete: restored remaining celebration');
    await wait(1700);
    if (fixture.observe().screen === 'tutorial') await pulse(3, 9);
    screen('playing');
    fixture.expireRun();
    await wait(1400);
    screen('gameOver');
    record('normal death-delay results');
    await pulse(3, 0);
    screen('playing');
    assert(fixture.observe().equationsSolved === 0, 'Retry inherited previous totals');
    record('controller retry');
    await pulse(3, 9);
    for (let index = 0; index < 3; index += 1) await pulse(3, 13);
    await pulse(3, 0);
    screen('menu');
    for (let index = 0; index < 3; index += 1) await pulse(3, 13);
    await pulse(3, 0);
    assert(fixture.observe().quitRequests === 1, 'Desktop quit action was not invoked');
    assert(fixture.observe().errors.length === 0, 'Browser errors occurred');
    record('desktop quit mock invoked');
    return { passed: true, observations };
  } catch (error) {
    return { passed: false, error: String(error), observations, final: fixture.observe() };
  }
};
