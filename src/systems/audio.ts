import { loadSettings, updateSettings } from './save';

export type SoundName =
  | 'click'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'pulse'
  | 'mortar'
  | 'arc'
  | 'hit'
  | 'explode'
  | 'leak'
  | 'wave'
  | 'boss'
  | 'win'
  | 'lose'
  | 'error';

type ToneOptions = {
  frequency: number;
  endFrequency?: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
};

class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.5;
  private readonly lastPlayed = new Map<SoundName, number>();

  constructor() {
    const settings = loadSettings();
    this.muted = !settings.soundEnabled;
    this.volume = Math.max(0, Math.min(1, settings.volume));
  }

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) return;
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.7;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  getVolumeLabel(): string {
    return `音量：${Math.round(this.volume * 100)}%`;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    updateSettings({ volume: this.volume });
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume * 0.7, this.context.currentTime, 0.02);
    }
  }

  cycleVolume(): number {
    const levels = [1, 0.75, 0.5, 0.25, 0];
    const current = levels.findIndex((level) => Math.abs(level - this.volume) < 0.01);
    const next = levels[(current + 1) % levels.length] ?? 0.5;
    this.setVolume(next);
    if (!this.muted) this.play('click');
    return this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    updateSettings({ soundEnabled: !muted });
    if (!muted) this.unlock();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  play(sound: SoundName): void {
    if (this.muted) return;
    if (!this.context || !this.master) {
      // The first user gesture unlocks audio. Gameplay sounds before that are
      // silently dropped rather than throwing.
      return;
    }

    const now = this.context.currentTime;
    const last = this.lastPlayed.get(sound) ?? -1;
    if (now - last < 0.045) return;
    this.lastPlayed.set(sound, now);

    switch (sound) {
      case 'click':
        this.tone({ frequency: 720, endFrequency: 880, duration: 0.05, type: 'square', gain: 0.045 });
        break;
      case 'build':
        this.tone({ frequency: 220, endFrequency: 440, duration: 0.12, type: 'triangle', gain: 0.08 });
        this.tone({ frequency: 440, endFrequency: 660, duration: 0.1, type: 'sine', gain: 0.04, delay: 0.07 });
        break;
      case 'upgrade':
        this.tone({ frequency: 330, endFrequency: 880, duration: 0.2, type: 'triangle', gain: 0.07 });
        break;
      case 'sell':
        this.tone({ frequency: 520, endFrequency: 260, duration: 0.14, type: 'sine', gain: 0.06 });
        break;
      case 'pulse':
        this.tone({ frequency: 1150, endFrequency: 620, duration: 0.055, type: 'square', gain: 0.025 });
        break;
      case 'mortar':
        this.tone({ frequency: 120, endFrequency: 70, duration: 0.13, type: 'sawtooth', gain: 0.05 });
        break;
      case 'arc':
        this.tone({ frequency: 1500, endFrequency: 340, duration: 0.08, type: 'sawtooth', gain: 0.03 });
        break;
      case 'hit':
        this.tone({ frequency: 240, duration: 0.03, type: 'triangle', gain: 0.022 });
        break;
      case 'explode':
        this.noise(0.18, 0.09, 900);
        this.tone({ frequency: 95, endFrequency: 45, duration: 0.2, type: 'sine', gain: 0.07 });
        break;
      case 'leak':
        this.tone({ frequency: 180, endFrequency: 55, duration: 0.35, type: 'sawtooth', gain: 0.08 });
        break;
      case 'wave':
        this.tone({ frequency: 220, endFrequency: 330, duration: 0.22, type: 'triangle', gain: 0.055 });
        this.tone({ frequency: 440, endFrequency: 660, duration: 0.28, type: 'triangle', gain: 0.04, delay: 0.12 });
        break;
      case 'boss':
        this.tone({ frequency: 70, endFrequency: 38, duration: 0.7, type: 'sawtooth', gain: 0.07 });
        this.noise(0.5, 0.04, 320);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((frequency, index) => {
          this.tone({ frequency, duration: 0.3, type: 'triangle', gain: 0.06, delay: index * 0.13 });
        });
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((frequency, index) => {
          this.tone({ frequency, duration: 0.32, type: 'sawtooth', gain: 0.05, delay: index * 0.15 });
        });
        break;
      case 'error':
        this.tone({ frequency: 150, endFrequency: 120, duration: 0.08, type: 'square', gain: 0.045 });
        break;
    }
  }

  private tone(options: ToneOptions): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + (options.delay ?? 0);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const attackEnd = now + 0.008;
    const stopAt = now + options.duration;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(Math.max(1, options.frequency), now);
    if (options.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), stopAt);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(stopAt + 0.02);
  }

  private noise(duration: number, gainValue: number, filterFrequency: number): void {
    if (!this.context || !this.master) return;
    const sampleRate = this.context.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.value = gainValue;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}

export const audio = new AudioSystem();
