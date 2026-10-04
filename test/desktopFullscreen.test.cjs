const { test } = require('bun:test');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const code = readFileSync(require('node:path').join(__dirname, '../electron/preload.cjs'), 'utf8');
const check = async function check(stored, storageUnavailable = false) {
	let active = false, startup, api;
	const handlers = new Map();
	const writes = [];
	runInNewContext(code, {
		require: () => ({
			contextBridge: {exposeInMainWorld: (_, value) => { api = value; }},
			ipcRenderer: {
				on: (name, handler) => handlers.set(name, handler),
				invoke: async name => {
					if (name === 'desktop:toggle-fullscreen') active = !active;
					return active;
				},
			},
		}),
		localStorage: {
			getItem: () => { if (storageUnavailable) throw Error('blocked'); return stored; },
			setItem: (key, value) => { if (storageUnavailable) throw Error('blocked'); writes.push([key,value]); },
		},
		window: {addEventListener: (_, handler) => { startup = handler; }},
	});
	await startup();
	assert.equal(api.fullscreen.isActive(), stored === '1' && !storageUnavailable);
	assert.equal(writes.length, 0);
	await api.fullscreen.toggle();
	assert.equal(api.fullscreen.isActive(), active);
	if (!storageUnavailable) assert.deepEqual(writes.at(-1), ['fullscreen-enabled', active ? '1' : '0']);
	handlers.get('desktop:fullscreen-changed')({}, false);
	assert.equal(api.fullscreen.isActive(), false);
	if (!storageUnavailable) assert.deepEqual(writes.at(-1), ['fullscreen-enabled','0']);
};
for (const stored of ['1', '0', null, 'invalid']) {
	test(`desktop fullscreen restores ${String(stored)} and saves toggle/native changes`, async () => {
		await check(stored);
	});
}
test('desktop fullscreen remains usable when storage is unavailable', async () => {
	await check('1', true);
});
