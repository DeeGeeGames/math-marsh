export type AudioScene = 'title' | 'game' | 'silent';

export type SoundEffect =
  | 'uiBack'
  | 'uiSelect'
  | 'move'
  | 'answerSelect'
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
  interval: number;
  master: GainNode;
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
};

const AUDIO_SETTINGS_KEY = 'math-game-audio-settings';
const NOTE_C4 = 261.63;
const MOVE_SOUND_SPACING_MS = 90;

const DEFAULT_SETTINGS: AudioSettings = {
  soundEffects: true,
  backgroundMusic: true,
} as const;

const TITLE_NOTES = [0, 4, 7, 12, 9, 7, 4, 2] as const;
const GAME_BASS_NOTES = [-12, -7, -5, -10] as const;
const GAME_MELODY_NOTES = [0, 3, 5, 7, 10, 7, 5, 3] as const;

const audioState: AudioState = {
  unlocked: false,
  settings: loadSettings(),
  scene: 'silent',
  lastMoveSoundAt: 0,
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
  window.clearInterval(music.interval);
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
  const bass = GAME_BASS_NOTES[Math.floor(step / 2) % GAME_BASS_NOTES.length];
  const melody = GAME_MELODY_NOTES[step % GAME_MELODY_NOTES.length];
  playTone(master, {
    frequency: frequency(bass),
    start: now,
    duration: 0.46,
    volume: 0.03,
    type: 'sine',
  });
  playTone(master, {
    frequency: frequency(melody + 12),
    start: now + 0.08,
    duration: 0.16,
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

const MUSIC_SCENES: Record<MusicScene, MusicSceneConfig> = {
  title: {
    intervalMs: 520,
    volume: 0.58,
    schedule: scheduleTitleMusic,
  },
  game: {
    intervalMs: 430,
    volume: 0.46,
    schedule: scheduleGameMusic,
  },
} as const;

function musicSceneConfig(scene: AudioScene): MusicSceneConfig | undefined {
  if (scene === 'silent') return undefined;
  return MUSIC_SCENES[scene];
}

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

  audioState.music = {
    scene,
    master,
    interval: window.setInterval(() => {
      config.schedule(master, step.value);
      step.value += 1;
    }, config.intervalMs),
  };
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
  startMusic(scene);
}

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
