import { createAudioPreview, setAudioScene, setAudioSettings, setGameMusicTime } from '../../src/audio/audio';

const preview = createAudioPreview();
const actions = [
	['Play gameplay', function(): void { preview.playMusic('game', false); }],
	['Low time', function(): void { setGameMusicTime(29); }],
	['Recover time', function(): void { setGameMusicTime(60); }],
	['Title', function(): void { setAudioScene('title'); }],
	['Mute', function(): void { setAudioSettings({ soundEffects: true, backgroundMusic: false }); }],
	['Unmute', function(): void { setAudioSettings({ soundEffects: true, backgroundMusic: true }); }],
] as const;
actions.forEach(function([label, action]): void {
	const button = document.createElement('button');
	button.textContent = label;
	button.addEventListener('click', action);
	document.body.append(button);
});
window.addEventListener('pagehide', preview.dispose);
