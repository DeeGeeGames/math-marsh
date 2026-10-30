import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';

const { createInputDiagnostics, normalizeRendererInputDiagnostic } = createRequire(import.meta.url)('./input-diagnostics.cjs');

const rendererSnapshot = function () {
	return { screen: 'menu', ownerId: null, ownerSlot: null, waitingForNeutral: false, blockFrame: false,
		pageFocused: true, pageHidden: false, activeActions: [],
		controllers: [{ slot: 0, id: 'steam:controller', connected: true, pressed: [0], axes: [0, 0] }] };
};

describe('opt-in controller diagnostics', function () {
	test('disabled by default, deduplicates steady input, and emits an idle heartbeat', function () {
		expect(createInputDiagnostics({ environment: {} })).toBeNull();
		expect(createInputDiagnostics({ environment: { MATH_MARSH_INPUT_DIAGNOSTICS: 'true' } })).toBeNull();
		let clock = 100;
		const lines = [];
		const diagnostic = createInputDiagnostics({ environment: { MATH_MARSH_INPUT_DIAGNOSTICS: '1' },
			now: function () { return clock; }, emit: function (line) { lines.push(line); } });
		diagnostic.record('native', { pressed: false });
		clock = 116;
		diagnostic.record('native', { pressed: false });
		expect(lines).toHaveLength(1);
		diagnostic.record('native', { pressed: true });
		expect(lines).toHaveLength(2);
		clock = 1116;
		diagnostic.record('native', { pressed: true });
		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines[2].slice('[controller-input] '.length))).toEqual({
			elapsedMs: 1016, stage: 'native', data: { pressed: true },
		});
	});

	test('output is capped and broken output or unserializable data cannot throw into input', function () {
		const lines = [];
		const diagnostic = createInputDiagnostics({ environment: { MATH_MARSH_INPUT_DIAGNOSTICS: '1' },
			emit: function (line) { lines.push(line); } });
		const data = 'x'.repeat(100_000);
		for (let index = 0; index < 100; index++) diagnostic.record('native', { index, data });
		expect(lines.length).toBeLessThan(50);
		expect(lines.at(-1)).toContain('Output limit reached');
		const broken = createInputDiagnostics({ environment: { MATH_MARSH_INPUT_DIAGNOSTICS: '1' },
			emit: function () { throw new Error('closed output'); } });
		expect(() => broken.record('native', { handle: 42n })).not.toThrow();
		expect(() => broken.record('native', {})).not.toThrow();
	});

	test('renderer input is bounded and whitelisted without retaining arbitrary fields', function () {
		const snapshot = rendererSnapshot();
		expect(normalizeRendererInputDiagnostic({ ...snapshot, profileName: 'must not log', glyph: 'must not log' })).toEqual(snapshot);
		for (const invalid of [null, [], { ...snapshot, ownerSlot: 4 }, { ...snapshot, screen: 'x'.repeat(257) },
			{ ...snapshot, activeActions: ['unknown'] }, { ...snapshot, controllers: [{ ...snapshot.controllers[0], axes: [NaN] }] },
			{ ...snapshot, controllers: [{ ...snapshot.controllers[0], pressed: [17] }] },
			{ ...snapshot, controllers: Array.from({ length: 5 }, () => snapshot.controllers[0]) }]) {
			expect(normalizeRendererInputDiagnostic(invalid)).toBeNull();
		}
		const normalized = normalizeRendererInputDiagnostic(snapshot);
		snapshot.controllers[0].pressed.push(1);
		expect(normalized.controllers[0].pressed).toEqual([0]);
	});
});
