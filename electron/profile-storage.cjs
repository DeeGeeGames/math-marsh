const fs = require('node:fs');
const { join, dirname } = require('node:path');
const { PROFILE_STORAGE_KEYS } = require('./profile-storage-keys.cjs');

const MAX_SAVE_BYTES = 1024 * 1024;
const isRecord = function (value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const validValues = function (value) {
	return isRecord(value) && Object.values(value).every(function (item) {
		return typeof item === 'string';
	});
};
const readJson = function (file, io) {
	try {
		if (io.statSync(file).size > MAX_SAVE_BYTES) throw new Error('Save file exceeds size limit');
		return JSON.parse(io.readFileSync(file, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return undefined;
		throw error;
	}
};
const atomicWrite = function (file, value, io) {
	const text = JSON.stringify(value);
	if (Buffer.byteLength(text, 'utf8') > MAX_SAVE_BYTES) throw new Error('Save file exceeds size limit');
	io.mkdirSync(dirname(file), { recursive: true });
	const temporary = `${file}.tmp`;
	let descriptor;
	try {
		descriptor = io.openSync(temporary, 'w', 0o600);
		io.writeFileSync(descriptor, text, 'utf8');
		io.fsyncSync(descriptor);
		io.closeSync(descriptor);
		descriptor = undefined;
		io.renameSync(temporary, file);
	} finally {
		if (descriptor !== undefined) io.closeSync(descriptor);
		try { io.unlinkSync(temporary); } catch { /* Rename normally removed it. */ }
	}
};

// Steam syncs progress.json before launch and after exit. Never sync Chromium's
// storage database, migration ownership, temporary files, or device settings.
const validateEnvelope = function (saved) {
	if (!isRecord(saved) || saved.version !== 1 || !validValues(saved.values)
		|| (Object.hasOwn(saved, 'saveOwner') && saved.saveOwner !== 'demo' && saved.saveOwner !== 'paid')) {
		throw new Error('Unsupported or invalid Steam save; original file preserved');
	}
	const profiles = saved.values['math-marsh.player-profiles'];
	if (profiles !== undefined) {
		const store = JSON.parse(profiles);
		if (!isRecord(store) || store.version !== 1 || !Array.isArray(store.profiles)) {
			throw new Error('Unsupported profile store; original file preserved');
		}
	}
	return saved;
};
const createProfileStorage = function ({ appData, userData, steamId, role = 'paid', io = fs }) {
	if (typeof steamId !== 'string' || !/^[1-9]\d{16}$/.test(steamId)) throw new Error('Steam user identity unavailable');
	if (role !== 'paid' && role !== 'demo') throw new Error('Steam app identity unavailable');
	const file = join(appData, 'math-marsh', 'steam-saves', steamId, 'progress.json');
	const ownerFile = join(userData, 'steam-save-migration.json');
	let envelope;
	let loadedFile = false;
	let needsMigration = false;
	let ready = false;
	const readCurrent = function () {
		const saved = readJson(file, io);
		if (saved === undefined) {
			if (loadedFile) throw new Error('Steam save disappeared; original session preserved');
			return undefined;
		}
		validateEnvelope(saved);
		loadedFile = true;
		return saved;
	};
	const isReadOnly = function (saved) {
		return role === 'demo' && saved !== undefined && saved.saveOwner !== 'demo';
	};
	const refresh = function () {
		const saved = readCurrent();
		if (saved !== undefined) {
			if (role === 'paid' && saved.saveOwner === 'demo') {
				// Promotion changes only ownership. Never decode and reconstruct profiles.
				const promoted = { ...saved, saveOwner: 'paid' };
				atomicWrite(file, promoted, io);
				envelope = promoted;
			} else envelope = saved;
			needsMigration = false;
		}
		return envelope;
	};
	const initialize = function () {
		if (ready) return;
		const saved = refresh();
		if (isReadOnly(saved)) { ready = true; return; }
		const owner = readJson(ownerFile, io);
		if (owner !== undefined && (!isRecord(owner) || owner.version !== 1 || typeof owner.steamId !== 'string'
			|| !/^[1-9]\d{16}$/.test(owner.steamId) || typeof owner.imported !== 'boolean')) {
			throw new Error('Invalid save migration ownership; original files preserved');
		}
		// Migration ownership is local to this app's Chromium profile, never synced.
		if (owner === undefined || (owner.steamId === steamId && !owner.imported && saved !== undefined)) {
			// Recheck immediately before every mutation, including initialization.
			refresh();
			atomicWrite(ownerFile, { version: 1, steamId, imported: envelope !== undefined }, io);
		}
		needsMigration = envelope === undefined && (owner === undefined || (owner.steamId === steamId && !owner.imported));
		ready = true;
	};
	return {
		status: function () {
			initialize();
			refresh();
			return isReadOnly(envelope) ? 'read-only' : needsMigration ? 'migration' : 'ready';
		},
		migrate: function (legacy) {
			initialize();
			refresh();
			if (isReadOnly(envelope)) throw new Error('Steam save is read-only');
			if (!needsMigration) return;
			if (!validValues(legacy) || Object.keys(legacy).some(function (key) { return !PROFILE_STORAGE_KEYS.includes(key); })) throw new Error('Invalid legacy save data');
			const next = { version: 1, saveOwner: role, values: { ...legacy } };
			validateEnvelope(next);
			atomicWrite(file, next, io);
			loadedFile = true;
			envelope = next;
			refresh();
			atomicWrite(ownerFile, { version: 1, steamId, imported: true }, io);
			needsMigration = false;
		},
		getItem: function (key) {
			initialize();
			refresh();
			if (needsMigration || !PROFILE_STORAGE_KEYS.includes(key)) throw new Error('Profile storage not ready');
			return envelope?.values[key] ?? null;
		},
		setItem: function (key, value) {
			initialize();
			refresh();
			if (isReadOnly(envelope)) throw new Error('Steam save is read-only');
			if (needsMigration || !PROFILE_STORAGE_KEYS.includes(key) || typeof value !== 'string') throw new Error('Invalid profile write');
			const next = { ...(envelope ?? { version: 1, saveOwner: role }), values: { ...envelope?.values, [key]: value } };
			validateEnvelope(next);
			atomicWrite(file, next, io);
			loadedFile = true;
			envelope = next;
		},
	};
};

module.exports = { createProfileStorage, MAX_SAVE_BYTES };
