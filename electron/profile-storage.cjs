const fs = require('node:fs');
const { join, dirname } = require('node:path');
const { PROFILE_STORAGE_KEYS } = require('./profile-storage-keys.cjs');

const MAX_SAVE_BYTES = 1024 * 1024;
const isRecord = function (value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const validValues = function (value) {
	return isRecord(value) && Object.entries(value).every(function ([key, item]) {
		return PROFILE_STORAGE_KEYS.includes(key) && typeof item === 'string';
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
const createProfileStorage = function ({ userData, steamId, io = fs }) {
	if (typeof steamId !== 'string' || !/^[1-9]\d{16}$/.test(steamId)) throw new Error('Steam user identity unavailable');
	const file = join(userData, 'steam-saves', steamId, 'progress.json');
	const ownerFile = join(userData, 'steam-save-migration.json');
	let values;
	let needsMigration = false;
	let ready = false;
	const initialize = function () {
		if (ready) return;
		const saved = readJson(file, io);
		if (saved !== undefined && (!isRecord(saved) || saved.version !== 1 || !validValues(saved.values))) {
			throw new Error('Unsupported or invalid Steam save; original file preserved');
		}
		const owner = readJson(ownerFile, io);
		if (owner !== undefined && (!isRecord(owner) || owner.version !== 1 || typeof owner.steamId !== 'string'
			|| !/^[1-9]\d{16}$/.test(owner.steamId) || typeof owner.imported !== 'boolean')) {
			throw new Error('Invalid save migration ownership; original files preserved');
		}
		// Claim before importing. A failed import can retry for this account,
		// while another account can never inherit the same legacy profiles.
		if (owner === undefined || (owner.steamId === steamId && !owner.imported && saved !== undefined)) {
			atomicWrite(ownerFile, { version: 1, steamId, imported: saved !== undefined }, io);
		}
		needsMigration = saved === undefined && (owner === undefined || (owner.steamId === steamId && !owner.imported));
		values = saved?.values ?? {};
		ready = true;
	};
	return {
		status: function () {
			initialize();
			return needsMigration ? 'migration' : 'ready';
		},
		migrate: function (legacy) {
			initialize();
			if (!needsMigration) return;
			if (!validValues(legacy)) throw new Error('Invalid legacy save data');
			atomicWrite(file, { version: 1, values: legacy }, io);
			atomicWrite(ownerFile, { version: 1, steamId, imported: true }, io);
			values = { ...legacy };
			needsMigration = false;
		},
		getItem: function (key) {
			initialize();
			if (needsMigration || !PROFILE_STORAGE_KEYS.includes(key)) throw new Error('Profile storage not ready');
			return values[key] ?? null;
		},
		setItem: function (key, value) {
			initialize();
			if (needsMigration || !PROFILE_STORAGE_KEYS.includes(key) || typeof value !== 'string') throw new Error('Invalid profile write');
			const next = { ...values, [key]: value };
			atomicWrite(file, { version: 1, values: next }, io);
			values = next;
		},
	};
};

module.exports = { createProfileStorage, MAX_SAVE_BYTES };
