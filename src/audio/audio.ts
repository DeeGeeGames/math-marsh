import { LOW_TIME_SECONDS } from '../ecs/runTime';

export type AudioScene = 'title' | 'game' | 'cutscene' | 'silent';

export type SoundEffect =
  | 'uiBack'
  | 'uiSelect'
  | 'move'
  | 'answerSelect'
  | 'answerDeselect'
  | 'correct'
  | 'incorrect'
  | 'damage'
  | 'web'
  | 'frogTongue'
  | 'levelComplete'
  | 'gameOver';

type AudioSettings = {
  soundEffects: boolean;
  backgroundMusic: boolean;
};

type MusicLoop = {
  scene: AudioScene;
  timeout: number;
  master: GainNode;
  warningPending: boolean;
};

type MusicScene = Exclude<AudioScene, 'silent'>;

type MusicSceneConfig = {
  intervalMs: number;
  volume: number;
  schedule: (master: GainNode, step: number) => void;
};

type NoteSequenceOptions = {
  step: number;
  duration: number;
  volume: number;
  type: OscillatorType;
};

type AudioState = {
  context?: AudioContext;
  unlocked: boolean;
  settings: AudioSettings;
  scene: AudioScene;
  music?: MusicLoop;
  lastMoveSoundAt: number;
  lowTime: boolean;
};

const AUDIO_SETTINGS_KEY = 'math-marsh-audio-settings';
const NOTE_C4 = 261.63;
const MOVE_SOUND_SPACING_MS = 90;
const GAME_NORMAL_INTERVAL_MS = 430;
const GAME_URGENT_INTERVAL_MS = GAME_NORMAL_INTERVAL_MS / 1.2;
const LOW_TIME_BRIDGE_MS = 650;
const LOW_TIME_WARNING_NOTES = [7, 7, 6, 6, 0] as const;

const DEFAULT_SETTINGS: AudioSettings = {
  soundEffects: true,
  backgroundMusic: true,
} as const;

const TITLE_NOTES = [0, 4, 7, 12, 9, 7, 4, 2] as const;
const GAME_BASS_NOTES = [-12, -7, -5, -10] as const;
const GAME_MELODY_NOTES = [0, 3, 5, 7, 10, 7, 5, 3] as const;
// Bright C, F, C, G phrases with a bouncing bass and offbeat chords.
const CUTSCENE_CHORDS = [
  [-24, 0, 4, 7],
  [-19, 0, 5, 9],
  [-24, 0, 4, 7],
  [-17, -1, 2, 7],
] as const;
const CUTSCENE_MELODY = [
  12, null, 16, 19, 21, null, 19, 16,
  14, 16, 19, null, 16, null, 12, null,
  17, null, 21, 24, 21, null, 19, 17,
  16, 17, 21, null, 17, null, 12, null,
  16, null, 19, 24, 21, 19, 16, null,
  19, null, 16, 14, 12, null, 16, null,
  14, null, 19, 23, 21, null, 19, 17,
  16, 14, 11, null, 7, null, 14, 11,
] as const;

const audioState: AudioState = {
  unlocked: false,
  settings: loadSettings(),
  scene: 'silent',
  lastMoveSoundAt: 0,
  lowTime: false,
};

function loadSettings(): AudioSettings {
  try {
    const stored = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(stored);
    if (!isAudioSettings(parsed)) return DEFAULT_SETTINGS;
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function isAudioSettings(value: unknown): value is AudioSettings {
  if (typeof value !== 'object' || value === null) return false;
  if (!('soundEffects' in value) || !('backgroundMusic' in value)) return false;
  return typeof value.soundEffects === 'boolean'
    && typeof value.backgroundMusic === 'boolean';
}

function saveSettings(settings: AudioSettings): void {
  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
}

function getContext(): AudioContext {
  if (audioState.context) return audioState.context;
  const context = new AudioContext();
  audioState.context = context;
  return context;
}

function resumeAudioContext(): void {
  const context = getContext();
  if (context.state === 'running') return;
  void context.resume();
}

function frequency(semitonesFromC4: number): number {
  return NOTE_C4 * 2 ** (semitonesFromC4 / 12);
}

function createGain(context: AudioContext, value: number, destination: AudioNode = context.destination): GainNode {
  const gain = context.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function envelope(
  gain: GainNode,
  time: number,
  shape: {
    attack: number;
    decay: number;
    peak: number;
    sustain?: number;
    releaseAt?: number;
  },
): void {
  const sustain = shape.sustain ?? 0.0001;
  const releaseAt = shape.releaseAt ?? shape.attack + shape.decay;
  gain.gain.cancelScheduledValues(time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(shape.peak, time + shape.attack);
  gain.gain.exponentialRampToValueAtTime(sustain, time + releaseAt);
}

function playTone(
  destination: AudioNode,
  options: {
    frequency: number;
    start: number;
    duration: number;
    volume: number;
    type?: OscillatorType;
    detune?: number;
  },
): void {
  const context = getContext();
  const oscillator = context.createOscillator();
  const gain = createGain(context, 0.0001, destination);
  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(options.frequency, options.start);
  oscillator.detune.setValueAtTime(options.detune ?? 0, options.start);
  oscillator.connect(gain);
  envelope(gain, options.start, {
    attack: Math.min(0.018, options.duration * 0.25),
    decay: Math.max(0.04, options.duration),
    peak: options.volume,
  });
  oscillator.start(options.start);
  oscillator.stop(options.start + options.duration + 0.04);
}

function playNoise(
  destination: AudioNode,
  options: {
    start: number;
    duration: number;
    volume: number;
    filterFrequency: number;
    filterType?: BiquadFilterType;
  },
): void {
  const context = getContext();
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * options.duration), context.sampleRate);
  const channel = buffer.getChannelData(0);
  channel.set(Float32Array.from(channel, () => Math.random() * 2 - 1));

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = createGain(context, 0.0001, destination);
  filter.type = options.filterType ?? 'lowpass';
  filter.frequency.setValueAtTime(options.filterFrequency, options.start);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  envelope(gain, options.start, {
    attack: 0.006,
    decay: options.duration,
    peak: options.volume,
  });
  source.start(options.start);
}

function stopMusic(): void {
  const music = audioState.music;
  if (!music) return;

  const context = getContext();
  window.clearTimeout(music.timeout);
  music.master.gain.cancelScheduledValues(context.currentTime);
  music.master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
  window.setTimeout(() => music.master.disconnect(), 250);
  delete audioState.music;
}

function scheduleTitleMusic(master: GainNode, step: number): void {
  const context = getContext();
  const now = context.currentTime + 0.02;
  const note = TITLE_NOTES[step % TITLE_NOTES.length];
  const harmony = TITLE_NOTES[(step + 2) % TITLE_NOTES.length];
  playTone(master, {
    frequency: frequency(note),
    start: now,
    duration: 0.36,
    volume: 0.035,
    type: 'triangle',
  });
  playTone(master, {
    frequency: frequency(harmony - 12),
    start: now,
    duration: 0.48,
    volume: 0.022,
    type: 'sine',
  });
}

function scheduleGameMusic(master: GainNode, step: number): void {
  const context = getContext();
  const now = context.currentTime + 0.02;
  const durationScale = gameMusicIntervalMs() / GAME_NORMAL_INTERVAL_MS;
  const bass = GAME_BASS_NOTES[Math.floor(step / 2) % GAME_BASS_NOTES.length];
  const melody = GAME_MELODY_NOTES[step % GAME_MELODY_NOTES.length];
  playTone(master, {
    frequency: frequency(bass),
    start: now,
    duration: 0.46 * durationScale,
    volume: 0.03,
    type: 'sine',
  });
  playTone(master, {
    frequency: frequency(melody + 12),
    start: now + 0.08 * durationScale,
    duration: 0.16 * durationScale,
    volume: 0.018,
    type: 'triangle',
  });
  if (step % 2 === 0) {
    playNoise(master, {
      start: now,
      duration: 0.055,
      volume: 0.012,
      filterFrequency: 900,
      filterType: 'bandpass',
    });
  }
}

const scheduleCutsceneMusic = function(master: GainNode, step: number): void {
  const now = getContext().currentTime + 0.02;
  const phraseStep = step % 16;
  const chord = CUTSCENE_CHORDS[Math.floor(step / 16) % CUTSCENE_CHORDS.length];

  if (phraseStep % 4 === 0) {
    playTone(master, {
      frequency: frequency(chord[0] + (phraseStep % 8 === 0 ? 0 : 7)),
      start: now,
      duration: 0.25,
      volume: 0.03,
      type: 'sine',
    });
  }
  if (phraseStep % 4 === 2) {
    chord.slice(1).forEach(note => {
      playTone(master, {
        frequency: frequency(note),
        start: now,
        duration: 0.16,
        volume: 0.01,
        type: 'triangle',
      });
    });
  }

  const melody = CUTSCENE_MELODY[step % CUTSCENE_MELODY.length];
  if (melody === null) return;
  playTone(master, {
    frequency: frequency(melody),
    start: now + (step % 2 === 0 ? 0 : 0.035),
    duration: 0.23,
    volume: 0.022,
    type: 'triangle',
  });
};

const MUSIC_SCENES: Record<MusicScene, MusicSceneConfig> = {
  title: {
    intervalMs: 520,
    volume: 0.58,
    schedule: scheduleTitleMusic,
  },
  game: {
    intervalMs: GAME_NORMAL_INTERVAL_MS,
    volume: 0.46,
    schedule: scheduleGameMusic,
  },
  cutscene: {
    intervalMs: 320,
    volume: 0.46,
    schedule: scheduleCutsceneMusic,
  },
} as const;

function musicSceneConfig(scene: AudioScene): MusicSceneConfig | undefined {
  if (scene === 'silent') return undefined;
  return MUSIC_SCENES[scene];
}

const gameMusicIntervalMs = function(): number {
  return audioState.lowTime ? GAME_URGENT_INTERVAL_MS : GAME_NORMAL_INTERVAL_MS;
};

const scheduleLowTimeWarning = function(master: GainNode): void {
  const now = getContext().currentTime + 0.02;
  LOW_TIME_WARNING_NOTES.forEach(function(note, index): void {
    playTone(master, {
      frequency: frequency(note),
      start: now + index * 0.1,
      duration: index === LOW_TIME_WARNING_NOTES.length - 1 ? 0.14 : 0.055,
      volume: 0.025,
      type: 'square',
    });
  });
};

function startMusic(scene: AudioScene): void {
  const config = musicSceneConfig(scene);
  if (!audioState.settings.backgroundMusic || !audioState.unlocked || !config) {
    stopMusic();
    return;
  }

  if (audioState.music?.scene === scene) return;
  stopMusic();
  resumeAudioContext();

  const context = getContext();
  const master = createGain(context, config.volume);
  const step = { value: 0 };
  config.schedule(master, step.value);
  step.value += 1;

  const music: MusicLoop = {
    scene,
    master,
    timeout: 0,
    warningPending: false,
  };
  // Read the current tempo after each beat so changes keep the melody's place.
  const scheduleNextBeat = function(delayMs?: number): void {
    const intervalMs = delayMs ?? (scene === 'game' ? gameMusicIntervalMs() : config.intervalMs);
    music.timeout = window.setTimeout(function(): void {
      if (music.warningPending) {
        music.warningPending = false;
        scheduleLowTimeWarning(master);
        scheduleNextBeat(LOW_TIME_BRIDGE_MS);
        return;
      }
      config.schedule(master, step.value);
      step.value += 1;
      scheduleNextBeat();
    }, intervalMs);
  };
  audioState.music = music;
  scheduleNextBeat();
}

function playNoteSequence(
  master: GainNode,
  now: number,
  notes: readonly number[],
  options: NoteSequenceOptions,
): void {
  notes.forEach((note, index) => {
    playTone(master, {
      frequency: frequency(note),
      start: now + index * options.step,
      duration: options.duration,
      volume: options.volume,
      type: options.type,
    });
  });
}

function playEffectBody(effect: SoundEffect, context: AudioContext): void {
  const master = createGain(context, 1);
  const now = context.currentTime + 0.01;
  const effects: Record<SoundEffect, () => void> = {
    uiBack: () => playTone(master, { frequency: frequency(2), start: now, duration: 0.09, volume: 0.055, type: 'triangle' }),
    uiSelect: () => {
      playTone(master, { frequency: frequency(7), start: now, duration: 0.07, volume: 0.045, type: 'triangle' });
      playTone(master, { frequency: frequency(12), start: now + 0.055, duration: 0.08, volume: 0.04, type: 'triangle' });
    },
    move: () => playTone(master, { frequency: frequency(0), start: now, duration: 0.045, volume: 0.026, type: 'sine' }),
    answerSelect: () => playTone(master, { frequency: frequency(9), start: now, duration: 0.1, volume: 0.05, type: 'triangle' }),
    answerDeselect: () => playNoteSequence(master, now, [9, 2, -3], { step: 0.045, duration: 0.08, volume: 0.035, type: 'triangle' }),
    correct: () => playNoteSequence(master, now, [0, 4, 7, 12], { step: 0.055, duration: 0.16, volume: 0.055, type: 'triangle' }),
    incorrect: () => {
      playTone(master, { frequency: frequency(-5), start: now, duration: 0.22, volume: 0.055, type: 'sawtooth', detune: -12 });
      playTone(master, { frequency: frequency(-6), start: now, duration: 0.2, volume: 0.035, type: 'square', detune: 18 });
    },
    damage: () => {
      playNoise(master, { start: now, duration: 0.2, volume: 0.09, filterFrequency: 520 });
      playTone(master, { frequency: frequency(-12), start: now, duration: 0.22, volume: 0.06, type: 'sawtooth' });
    },
    web: () => {
      playNoise(master, { start: now, duration: 0.18, volume: 0.04, filterFrequency: 2_100, filterType: 'highpass' });
      playTone(master, { frequency: frequency(3), start: now + 0.02, duration: 0.18, volume: 0.035, type: 'triangle' });
    },
    frogTongue: () => {
      playTone(master, { frequency: frequency(-7), start: now, duration: 0.11, volume: 0.045, type: 'sawtooth' });
      playTone(master, { frequency: frequency(5), start: now + 0.08, duration: 0.12, volume: 0.05, type: 'triangle' });
    },
    levelComplete: () => playNoteSequence(master, now, [0, 4, 7, 12, 16], { step: 0.07, duration: 0.22, volume: 0.055, type: 'triangle' }),
    gameOver: () => playNoteSequence(master, now, [0, -3, -7, -12], { step: 0.13, duration: 0.28, volume: 0.055, type: 'sine' }),
  };

  effects[effect]();
  window.setTimeout(() => master.disconnect(), 1_000);
}

export function getAudioSettings(): AudioSettings {
  return audioState.settings;
}

export function setAudioSettings(settings: AudioSettings): void {
  audioState.settings = settings;
  saveSettings(settings);
  if (!settings.backgroundMusic) {
    stopMusic();
    return;
  }
  startMusic(audioState.scene);
}

export function setAudioScene(scene: AudioScene): void {
  audioState.scene = scene;
  if (scene !== 'game') audioState.lowTime = false;
  startMusic(scene);
}

export const setGameMusicTime = function(remainingSeconds: number): void {
  const lowTime = remainingSeconds <= LOW_TIME_SECONDS;
  const music = audioState.music;
  if (music?.scene === 'game') {
    if (!lowTime) music.warningPending = false;
    else if (!audioState.lowTime && remainingSeconds > 0) music.warningPending = true;
  }
  audioState.lowTime = lowTime;
};

export function unlockAudio(): void {
  audioState.unlocked = true;
  resumeAudioContext();
  startMusic(audioState.scene);
}

export function playSound(effect: SoundEffect): void {
  if (!audioState.settings.soundEffects) return;
  if (effect === 'move') {
    const now = performance.now();
    if (now - audioState.lastMoveSoundAt < MOVE_SOUND_SPACING_MS) return;
    audioState.lastMoveSoundAt = now;
  }

  audioState.unlocked = true;
  const context = getContext();
  resumeAudioContext();
  playEffectBody(effect, context);
}

// Used only by the standalone development entry point. Settings remain in memory.
export const createAudioPreview = function(): {
  playMusic: (scene: AudioScene, lowTime: boolean) => void;
  playEffect: (effect: SoundEffect) => void;
  stop: () => void;
  dispose: () => void;
} {
  audioState.settings = { soundEffects: true, backgroundMusic: true };
  const stop = function(): void {
    setAudioScene('silent');
    const context = audioState.context;
    delete audioState.context;
    audioState.unlocked = false;
    if (context) void context.close();
  };
  return {
    playMusic: function(scene, lowTime): void {
      setAudioScene('silent');
      unlockAudio();
      setAudioScene(scene);
      if (lowTime) setGameMusicTime(LOW_TIME_SECONDS);
    },
    playEffect: function(effect): void { playSound(effect); },
    stop,
    dispose: stop,
  };
};
