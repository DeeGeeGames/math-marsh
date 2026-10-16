import { BEAT_SECONDS } from './score';
import { MAX_SECTIONS, MIN_SECTIONS, SECTION_STEPS, STEMS, mixText, moveSection, parseMixText, presetMix, resizeMix, setClip, setLevel } from './mixer';
import type { Mix, MixTrack } from './mixer';
import { createPlayback, introSeconds } from './playback';
import { savedMix } from './saved-arrangement';

if (!getComputedStyle(document.documentElement).getPropertyValue('--background').trim()) {
	document.documentElement.dataset.standalone = 'true';
}

const query = function<T extends Element>(selector: string, type: { new (...args: never[]): T }): T {
	const node = document.querySelector(selector);
	if (!(node instanceof type)) throw new Error(`Missing preview element: ${selector}`);
	return node;
};
const element = function<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	return node;
};
const button = function(text: string, action: () => void, label = text): HTMLButtonElement {
	const node = element('button', text);
	node.type = 'button';
	node.setAttribute('aria-label', label);
	node.addEventListener('click', action);
	return node;
};
const table = query('#timeline', HTMLTableElement);
const status = query('#status', HTMLElement);
const clock = query('#clock', HTMLElement);
const progress = query('#progress', HTMLProgressElement);
const name = query('#mix-name', HTMLInputElement);
const notes = query('#notes', HTMLTextAreaElement);
const text = query('#mix-text', HTMLTextAreaElement);
const shareStatus = query('#share-status', HTMLElement);
const tempo = query('#tempo', HTMLSelectElement);
const sectionPicker = query('#section-picker', HTMLSelectElement);
const duration = query('#duration', HTMLElement);
const STORAGE_KEY = 'math-marsh-music-mixer-v1';
const controllerChange = new WeakMap<HTMLElement, () => void>();
let mix = savedMix();
let selected = 0;
let lastSection: number | null = null;

const message = function(value: string): void { if (status.textContent !== value) status.textContent = value; };
const player = createPlayback(function(position): void {
	if (!position) {
		clock.textContent = '0:00';
		progress.value = 0;
		message('Stopped. Edit the timeline or play your mix.');
	} else {
		clock.textContent = `${Math.floor(position.elapsed / 60)}:${Math.floor(position.elapsed % 60).toString().padStart(2, '0')}`;
		progress.max = position.total;
		progress.value = position.position;
		message(`${position.label} · ${position.section === null ? 'Original opening' : `Section ${position.section + 1}`}`);
	}
	const section = position?.section ?? null;
	if (section !== lastSection) {
		lastSection = section;
		table.querySelectorAll<HTMLElement>('[data-section]').forEach(function(node): void {
			node.toggleAttribute('data-playing', section !== null && Number(node.dataset.section) === section);
		});
	}
}, message);

const save = function(): void {
	text.value = mixText(mix);
	try { localStorage.setItem(STORAGE_KEY, text.value); } catch { /* Copyable text works without browser storage. */ }
	shareStatus.textContent = 'Copy this text and paste it in our conversation to specify the exact mix.';
};
const change = function(next: Mix, redraw = true): void {
	player.stop();
	mix = next;
	selected = Math.min(selected, mix.sections - 1);
	save();
	if (redraw) render();
	message('Mix updated. Play to hear the changes.');
};
const sectionSeconds = function(): number { return SECTION_STEPS * BEAT_SECONDS * (mix.tempo === 'faster' ? 1 / 1.2 : 1); };

const render = function(): void {
	const focused = document.activeElement;
	const focusLabel = focused && table.contains(focused) ? focused.getAttribute('aria-label') : null;
	name.value = mix.name;
	notes.value = mix.notes;
	tempo.value = mix.tempo;
	const seconds = sectionSeconds();
	duration.textContent = `Opening ${(introSeconds * (mix.tempo === 'faster' ? 1 / 1.2 : 1)).toFixed(2)}s → ${mix.sections} sections × ${seconds.toFixed(2)}s → repeat section 1`;
	sectionPicker.replaceChildren(...Array.from({ length: mix.sections }, function(_, index): HTMLOptionElement {
		return new Option(`Section ${index + 1}`, String(index), false, index === selected);
	}));
	query('#earlier', HTMLButtonElement).disabled = selected === 0;
	query('#later', HTMLButtonElement).disabled = selected === mix.sections - 1;
	query('#duplicate', HTMLButtonElement).disabled = selected === 0;
	query('#add', HTMLButtonElement).disabled = mix.sections === MAX_SECTIONS;
	query('#remove', HTMLButtonElement).disabled = mix.sections === MIN_SECTIONS;
	table.replaceChildren();
	const head = element('thead');
	const row = element('tr');
	row.append(element('th', 'Layers'));
	Array.from({ length: mix.sections }, function(_, section): void {
		const cell = element('th');
		cell.scope = 'col'; cell.dataset.section = String(section);
		const play = button(`${section + 1}`, function(): void {
			selected = section; render(); void player.play(mix, section);
		}, `Play section ${section + 1}`);
		cell.append(play, element('small', `${((section + 1) * seconds).toFixed(2)}s`));
		row.append(cell);
	});
	row.append(element('th', 'Level'), element('th', 'Hear'));
	head.append(row); table.append(head);
	const baseline = element('tbody');
	const persistent = element('tr');
	persistent.append(element('th', 'Original background'));
	Array.from({ length: mix.sections }, function(_, section): void {
		const cell = element('td', 'ON');
		cell.className = 'baseline'; cell.dataset.section = String(section); persistent.append(cell);
	});
	persistent.append(element('td', '100%'), element('td', 'Always'));
	baseline.append(persistent); table.append(baseline);
	const groups = [
		{ source: 'bloom', label: 'From Gentle bloom' },
		{ source: 'groove', label: 'From Pond groove' },
		{ source: 'conversation', label: 'From Call & response' },
	] as const;
	groups.forEach(function(group): void {
		const body = element('tbody');
		const titleRow = element('tr');
		const groupTitle = element('th', group.label);
		groupTitle.colSpan = mix.sections + 3; groupTitle.className = 'group-title';
		titleRow.append(groupTitle); body.append(titleRow);
		STEMS.filter(function(stem): boolean { return stem.source === group.source; }).forEach(function(stem): void {
			const track = mix.tracks.find(function(value): boolean { return value.id === stem.id; });
			if (!track) throw new Error('Missing mix track');
			const trackRow = element('tr');
			const title = element('th', stem.name); title.scope = 'row'; trackRow.append(title);
			track.clips.forEach(function(pattern, section): void {
				const cell = element('td'); cell.dataset.section = String(section);
				const select = element('select');
				select.setAttribute('aria-label', `${stem.name}, section ${section + 1}`);
				select.title = `${stem.name}, section ${section + 1}`; select.dataset.on = String(pattern !== null);
				select.append(new Option('— Off', ''));
				stem.patterns.forEach(function(phrase): void { select.append(new Option(phrase.name, phrase.id)); });
				select.value = pattern ?? '';
				const applyClip = function(): void {
					const phrase = stem.patterns.find(function(value): boolean { return value.id === select.value; });
					change(setClip(mix, stem.id, section, phrase?.id ?? null), false);
					select.dataset.on = String(phrase !== undefined);
				};
				select.addEventListener('change', applyClip);
				controllerChange.set(select, applyClip);
				cell.append(select); trackRow.append(cell);
			});
			const levelCell = element('td');
			const level = element('input');
			level.type = 'number'; level.min = '0'; level.max = '150'; level.step = '1'; level.value = String(track.level);
			level.setAttribute('aria-label', `${stem.name} volume percent`);
			const applyLevel = function(): void {
				if (!level.checkValidity() || !Number.isInteger(level.valueAsNumber)) {
					level.reportValidity();
					level.value = String(mix.tracks.find(function(value): boolean { return value.id === stem.id; })?.level ?? 100);
					return;
				}
				change(setLevel(mix, stem.id, level.valueAsNumber), false);
			};
			level.addEventListener('change', applyLevel);
			controllerChange.set(level, applyLevel);
			levelCell.append(level);
			const hear = element('td');
			hear.append(button('▶', function(): void {
				const audition: Mix = { ...mix, tracks: mix.tracks.map(function(value): MixTrack {
					return { ...value, clips: value.clips.map(function(clip): typeof clip {
						return value.id === stem.id ? clip ?? stem.patterns[0]?.id ?? null : null;
					}) };
				}) };
				void player.play(audition, 0, `${stem.name} + background`);
			}, `Hear ${stem.name} with background`));
			trackRow.append(levelCell, hear); body.append(trackRow);
		});
		table.append(body);
	});
	lastSection = null;
	if (focusLabel) Array.from(table.querySelectorAll<HTMLElement>('[aria-label]')).find(function(node): boolean {
		return node.getAttribute('aria-label') === focusLabel;
	})?.focus();
};

try {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) mix = parseMixText(stored);
} catch { /* A stale or unavailable local draft must not block the mixer. */ }
render(); save();

query('#play', HTMLButtonElement).addEventListener('click', function(): void { void player.play(mix, 'start'); });
query('#entrance', HTMLButtonElement).addEventListener('click', function(): void { void player.play(mix, 'layers'); });
query('#seam', HTMLButtonElement).addEventListener('click', function(): void { void player.play(mix, 'seam'); });
query('#stop', HTMLButtonElement).addEventListener('click', function(): void { player.stop(); });
const volume = query('#volume', HTMLInputElement);
const applyVolume = function(): void { player.setVolume(volume.valueAsNumber); };
volume.addEventListener('input', applyVolume);
controllerChange.set(volume, applyVolume);
const applyTempo = function(): void { change({ ...mix, tempo: tempo.value === 'faster' ? 'faster' : 'normal' }); };
tempo.addEventListener('change', applyTempo);
controllerChange.set(tempo, applyTempo);
name.addEventListener('input', function(): void { mix = { ...mix, name: name.value.trim() || 'My mix' }; save(); });
notes.addEventListener('input', function(): void { mix = { ...mix, notes: notes.value }; save(); });
const applySection = function(): void { selected = Number(sectionPicker.value); render(); };
sectionPicker.addEventListener('change', applySection);
controllerChange.set(sectionPicker, applySection);
query('#earlier', HTMLButtonElement).addEventListener('click', function(): void {
	const next = moveSection(mix, selected, selected - 1); selected = Math.max(0, selected - 1); change(next);
});
query('#later', HTMLButtonElement).addEventListener('click', function(): void {
	const next = moveSection(mix, selected, selected + 1); selected = Math.min(mix.sections - 1, selected + 1); change(next);
});
query('#duplicate', HTMLButtonElement).addEventListener('click', function(): void {
	change({ ...mix, tracks: mix.tracks.map(function(track): MixTrack {
		return { ...track, clips: track.clips.map(function(clip, index): typeof clip { return index === selected ? track.clips[selected - 1] ?? null : clip; }) };
	}) });
});
query('#clear-section', HTMLButtonElement).addEventListener('click', function(): void {
	change({ ...mix, tracks: mix.tracks.map(function(track): MixTrack {
		return { ...track, clips: track.clips.map(function(clip, index): typeof clip { return index === selected ? null : clip; }) };
	}) });
});
query('#add', HTMLButtonElement).addEventListener('click', function(): void { change(resizeMix(mix, mix.sections + 1)); });
query('#remove', HTMLButtonElement).addEventListener('click', function(): void { change(resizeMix(mix, mix.sections - 1)); });
const preset = query('#preset', HTMLSelectElement);
query('#load-preset', HTMLButtonElement).addEventListener('click', function(): void {
	const value = preset.value;
	if (value === 'saved') { change(savedMix()); return; }
	if (value === 'bloom' || value === 'groove' || value === 'conversation' || value === 'original') change(presetMix(value));
});
query('#back-to-assets', HTMLAnchorElement).hidden = location.pathname !== '/music-options.html';
query('#copy', HTMLButtonElement).addEventListener('click', function(): void {
	text.value = mixText(mix); text.focus(); text.select();
	if (!navigator.clipboard) {
		shareStatus.textContent = 'Text selected. Copy it and paste it in our conversation.';
		return;
	}
	void navigator.clipboard.writeText(text.value).then(function(): void {
		shareStatus.textContent = 'Copied. Paste this text in our conversation to choose this exact arrangement.';
	}).catch(function(): void { shareStatus.textContent = 'Text selected. Use Copy, then paste it in our conversation.'; });
});
query('#restore', HTMLButtonElement).addEventListener('click', function(): void {
	try {
		change(parseMixText(text.value));
		shareStatus.textContent = 'Pasted arrangement loaded. Play to audition it.';
	} catch (error) { shareStatus.textContent = error instanceof Error ? error.message : 'Could not read the arrangement'; }
});
document.addEventListener('keydown', function(event): void { if (event.key === 'Escape') player.stop(); });
window.addEventListener('pagehide', player.dispose);

// Retain the isolated preview's controller support; gameplay input is unchanged.
let gamepadFrame = 0;
let previous: readonly boolean[] = [];
let lastDirection = 0;
const pollGamepad = function(): void {
	const pad = Array.from(navigator.getGamepads()).find(function(value): boolean { return value?.connected === true; });
	if (pad) {
		const pressed = pad.buttons.map(function(value): boolean { return value.pressed; });
		const vertical = pressed[13] ? 1 : pressed[12] ? -1 : 0;
		const horizontal = pressed[15] ? 1 : pressed[14] ? -1 : 0;
		const direction = vertical || horizontal * 2;
		const controls = Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,textarea,summary'));
		if (direction !== 0 && direction !== lastDirection) {
			const active = document.activeElement;
			if (horizontal !== 0 && active instanceof HTMLInputElement && (active.type === 'range' || active.type === 'number')) {
				active.stepUp(horizontal * (active.type === 'number' ? 5 : 1));
				controllerChange.get(active)?.();
			} else if (horizontal !== 0 && active instanceof HTMLSelectElement) {
				active.selectedIndex = (active.selectedIndex + horizontal + active.options.length) % active.options.length;
				controllerChange.get(active)?.();
			} else {
				const index = controls.findIndex(function(value): boolean { return value === active; });
				controls[(index + (vertical || horizontal) + controls.length) % controls.length]?.focus();
			}
		}
		if (pressed[0] && !previous[0]) {
			const active = document.activeElement;
			if (active instanceof HTMLSelectElement) {
				active.selectedIndex = (active.selectedIndex + 1) % active.options.length;
				controllerChange.get(active)?.();
			} else if (active instanceof HTMLButtonElement || active instanceof HTMLElement && active.tagName === 'SUMMARY') active.click();
		}
		if (pressed[1] && !previous[1]) player.stop();
		previous = pressed; lastDirection = direction;
	}
	gamepadFrame = requestAnimationFrame(pollGamepad);
};
const startGamepad = function(): void { if (gamepadFrame === 0) pollGamepad(); };
window.addEventListener('gamepadconnected', startGamepad);
window.addEventListener('pageshow', function(): void {
	if (Array.from(navigator.getGamepads()).some(function(value): boolean { return value?.connected === true; })) startGamepad();
});
window.addEventListener('pagehide', function(): void { cancelAnimationFrame(gamepadFrame); gamepadFrame = 0; previous = []; lastDirection = 0; });
console.info('Timeline mixer ready. Original background stays on; recipes use plain text.');
