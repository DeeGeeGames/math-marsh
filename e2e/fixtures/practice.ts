import { initializeGame } from '../../src/ecs/bootstrap';
import { gameEngine as engine } from '../../src/ecs/Engine';
import { finishPractice, submitPracticeAttempt } from '../../src/ecs/practiceLifecycle';
import { currentPracticeFact, PRACTICE_SESSION_LENGTH, type PracticeSelection } from '../../src/ecs/practiceSession';

await initializeGame();
await engine.setScreen('menu', {});

// Exercise the real session, profile persistence, results, and navigation.
// Supply correct submissions directly; answer collection is covered separately.
const fixture = {
	selection: function(): PracticeSelection | undefined { return engine.getResource('practiceSession')?.selection; },
	completeSession: function(): void {
		if (engine.getCurrentScreen() !== 'playing') throw new Error('Not practicing');
		for (let index = 0; index < PRACTICE_SESSION_LENGTH; index++) {
			const session = engine.getResource('practiceSession');
			if (!session || session.outcome !== 'active') throw new Error('No active Practice session');
			submitPracticeAttempt(engine, { factId: currentPracticeFact(session).id, correct: true });
		}
		finishPractice(engine);
	},
};

declare global { interface Window { practiceFixture: typeof fixture; } }
window.practiceFixture = fixture;
