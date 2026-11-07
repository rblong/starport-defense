import { loadSettings, updateSettings } from './save';
import type { EnemyId, UnitId } from '../types';

export type SoundName =
  | 'click'
  | 'uiHover'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'pulse'
  | 'flame'
  | 'mortar'
  | 'arc'
  | 'hit'
  | 'explode'
  | 'leak'
  | 'wave'
  | 'boss'
  | 'win'
  | 'lose'
  | 'ready'
  | 'radio'
  | 'autocannon'
  | 'shipLaser'
  | 'error';

export type VoiceEvent = 'select' | 'deploy' | 'upgrade' | 'retreat';

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
  private musicEnabled = true;
  private musicUnlocked = false;
  private musicFailed = false;
  private music: HTMLAudioElement | null = null;
  private volume = 0.5;
  private musicVolume = 0.5;
  private readonly lastPlayed = new Map<SoundName, number>();
  private readonly voiceElements = new Map<string, HTMLAudioElement>();
  private readonly lastVoicePlayed = new Map<string, number>();
  private starCraftPack = false;
  private readonly starCraftAudio = new Set<string>();
  private readonly externalPools = new Map<string, HTMLAudioElement[]>();
  private readonly externalGains = new Map<HTMLAudioElement, number>();
  private readonly lastExternalPlayed = new Map<string, number>();
  private readonly activeExternal = new Set<HTMLAudioElement>();

  constructor() {
    const settings = loadSettings();
    this.muted = !settings.soundEnabled;
    this.musicEnabled = settings.musicEnabled;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.syncMusic());
    this.volume = Math.max(0, Math.min(1, settings.volume));
    this.musicVolume = settings.musicVolume;
  }

  unlock(): void {
    this.musicUnlocked = true;
    this.syncMusic();
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
      this.master.gain.value = this.muted ? 0 : this.volume * 0.7;
      this.master.connect(this.context.destination);
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  getMusicLabel(): string { return `背景音乐：${this.musicEnabled ? '开' : '关'}`; }

  getMusicStatus(): string {
    if (!this.musicEnabled) return '背景音乐已关闭';
    if (this.muted) return '总静音已开启';
    if (this.musicVolume <= 0) return '音乐音量为零';
    if (!this.musicUnlocked) return '点击画面或按键，启用背景音乐';
    if (this.musicFailed) return '音乐未能播放 · 点击画面重试';
    return this.music && !this.music.paused && this.music.readyState >= 2 ? '背景音乐播放中' : '背景音乐加载中…';
  }

  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    updateSettings({ musicEnabled: this.musicEnabled });
    if (this.musicEnabled) {
      if (this.musicVolume <= 0) this.setMusicVolume(0.5);
      if (this.muted) this.setMuted(false);
    }
    this.syncMusic();
    return this.musicEnabled;
  }

  private syncMusic(): void {
    if (!this.musicUnlocked) return;
    if (!this.music) {
      this.music = new Audio(`${import.meta.env.BASE_URL}audio/music/terran-orbit.wav`);
      this.music.loop = true;
      this.music.preload = 'auto';
    }
    this.music.volume = this.muted ? 0 : this.musicVolume;
    if (this.muted || !this.musicEnabled || this.musicVolume <= 0 || document.hidden) {
      this.music.pause();
    } else if (this.music.paused) {
      void this.music.play().then(() => { this.musicFailed = false; }).catch(() => {
        this.musicFailed = true;
      });
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  getVolumeLabel(): string {
    return `音效音量：${Math.round(this.volume * 100)}%`;
  }

  getMusicVolumeLabel(): string { return `音乐音量：${Math.round(this.musicVolume * 100)}%`; }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    updateSettings({ musicVolume: this.musicVolume });
    this.syncMusic();
  }

  cycleMusicVolume(): void {
    const levels = [1, 0.75, 0.5, 0.25, 0];
    const current = levels.findIndex(level => Math.abs(level - this.musicVolume) < 0.01);
    this.setMusicVolume(levels[(current + 1) % levels.length] ?? 0.5);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    updateSettings({ volume: this.volume });
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.7, this.context.currentTime, 0.02);
    }
    this.applyVoiceVolume();
    this.applyExternalVolume();
    this.syncMusic();
    if (this.volume <= 0) {
      this.stopVoices();
      this.stopExternalAudio();
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
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume * 0.7, this.context.currentTime, 0.02);
    }
    if (muted) {
      this.stopVoices();
      this.stopExternalAudio();
    }
    this.applyVoiceVolume();
    this.applyExternalVolume();
    this.syncMusic();
  }

  setStarCraftPack(available: boolean, audioNames: string[]): void {
    this.starCraftPack = available;
    this.starCraftAudio.clear();
    for (const name of audioNames) this.starCraftAudio.add(name);
    this.stopExternalAudio();
    this.externalPools.clear();
    this.externalGains.clear();
    if (!available) return;
    for (const name of audioNames) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < 2; i++) {
        const element = new Audio(this.starCraftAudioUrl(name));
        element.preload = 'auto';
        element.volume = this.muted ? 0 : this.volume * 0.5;
        this.externalGains.set(element, 0.5);
        pool.push(element);
      }
      this.externalPools.set(name, pool);
    }
  }

  playEnemyDeath(enemyId: EnemyId): boolean {
    if (!this.starCraftPack) return false;
    const name =
      enemyId === 'boss'
        ? 'Ultralisk.death'
        : enemyId === 'brute' || enemyId === 'elite' || enemyId === 'splitter'
          ? 'Hydralisk.death'
          : 'Zergling.death';
    return this.playExternal(name, 0.32, 90);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playVoice(unitId: UnitId, event: VoiceEvent): void {
    if (this.muted || this.volume <= 0) return;
    const key = `${unitId}-${event}`;
    const now = performance.now();
    if (now - (this.lastVoicePlayed.get(key) ?? -Infinity) < 1500) return;
    this.lastVoicePlayed.set(key, now);
    const wav = () => this.playVoiceFile(key, event === 'select' && unitId !== 'marine' ? 'marine-select' : undefined);
    if (this.starCraftPack && event === 'select') {
      const names: Record<UnitId, string> = { marine: 'Marine.selected', tank: 'Tank.selected', goliath: 'Goliath.selected', battlecruiser: 'BattleCruiser.selected' };
      const marine = () => {
        if (!this.playExternal('Marine.selected', 0.9, 1500, wav)) wav();
      };
      if (this.playExternal(names[unitId], 0.9, 1500, unitId === 'marine' ? wav : marine)) return;
      if (unitId !== 'marine' && this.playExternal('Marine.selected', 0.9, 1500, wav)) return;
    }
    wav();
  }

  private playVoiceFile(key: string, fallback?: string): void {
    if (this.muted || this.volume <= 0) return;
    this.play('radio');
    let element = this.voiceElements.get(key);
    if (!element) {
      element = new Audio(`${import.meta.env.BASE_URL}audio/voice/${key}.wav`);
      element.preload = 'auto'; this.voiceElements.set(key, element);
    }
    element.volume = this.volume * 0.9; element.currentTime = 0;
    void element.play().catch(() => {
      if (this.muted || this.volume <= 0) return;
      if (fallback) this.playVoiceFile(fallback);
      else this.play('radio');
    });
  }

  private starCraftAudioUrl(name: string): string {
    return `${import.meta.env.BASE_URL}assets/sc-local/audio/${name}.wav`;
  }

  private playExternal(name: string, gain: number, throttleMs: number, onFailure?: () => void): boolean {
    if (!this.starCraftPack || this.muted || this.volume <= 0) return false;
    if (!this.starCraftAudio.has(name)) return false;
    const now = performance.now();
    const last = this.lastExternalPlayed.get(name) ?? -1;
    if (now - last < throttleMs) return true;
    this.lastExternalPlayed.set(name, now);

    const pool = this.externalPools.get(name);
    if (!pool) return false;
    const element = pool.find((item) => item.paused || item.ended);
    if (!element) return true;

    this.externalGains.set(element, gain);
    element.volume = this.volume * gain;
    element.currentTime = 0;
    this.activeExternal.add(element);
    element.onended = () => {
      this.activeExternal.delete(element);
    };
    void element.play().catch(() => {
      this.activeExternal.delete(element);
      if (!this.muted && this.volume > 0) onFailure?.();
    });
    return true;
  }

  private applyExternalVolume(): void {
    for (const pool of this.externalPools.values()) {
      for (const element of pool) {
        const gain = this.externalGains.get(element) ?? 0.5;
        element.volume = this.muted ? 0 : this.volume * gain;
      }
    }
  }

  private stopExternalAudio(): void {
    for (const pool of this.externalPools.values()) {
      for (const element of pool) {
        element.pause();
        element.currentTime = 0;
      }
    }
    this.activeExternal.clear();
  }

  private playStarCraftSfx(sound: SoundName): boolean {
    switch (sound) {
      case 'click':
        return this.playExternal('Button', 0.28, 100);
      case 'build':
        return this.playExternal('Button', 0.3, 100);
      case 'upgrade':
        return this.playExternal('upgrade.Terran', 0.32, 300);
      case 'pulse':
        return this.playExternal('Marine.attack', 0.24, 260);
      case 'mortar':
        return this.playExternal('Tank.attack2', 0.3, 380);
      case 'explode':
        return this.playExternal('TerranBuilding.death', 0.22, 350);
      case 'leak':
        return this.playExternal('TerranBuilding.death', 0.28, 300);
      case 'win':
        return this.playExternal('YouWin', 0.4, 1000);
      case 'lose':
        return this.playExternal('YouLose', 0.4, 1000);
      default:
        return false;
    }
  }

  private applyVoiceVolume(): void {
    const target = this.muted ? 0 : this.volume * 0.9;
    for (const element of this.voiceElements.values()) {
      element.volume = target;
    }
  }

  private stopVoices(): void {
    for (const element of this.voiceElements.values()) {
      element.pause();
      element.currentTime = 0;
    }
  }

  play(sound: SoundName): void {
    if (this.muted) return;
    if (this.starCraftPack && this.playStarCraftSfx(sound)) return;
    if (!this.context || !this.master) {
      // The first user gesture unlocks audio. Gameplay sounds before that are
      // silently dropped rather than throwing.
      return;
    }

    const now = this.context.currentTime;
    const last = this.lastPlayed.get(sound) ?? -1;
    if (now - last < (sound === 'uiHover' ? 0.12 : 0.045)) return;
    this.lastPlayed.set(sound, now);

    switch (sound) {
      case 'uiHover':
        this.tone({ frequency: 1450, endFrequency: 1750, duration: 0.025, type: 'sine', gain: 0.022 });
        break;
      case 'autocannon':
        this.noise(0.07, 0.045, 2000);
        this.tone({ frequency: 210, endFrequency: 65, duration: 0.09, type: 'sawtooth', gain: 0.045 });
        this.tone({ frequency: 180, endFrequency: 55, duration: 0.09, type: 'sawtooth', gain: 0.035, delay: 0.07 });
        break;
      case 'shipLaser':
        this.tone({ frequency: 900, endFrequency: 2100, duration: 0.13, type: 'sine', gain: 0.035 });
        this.tone({ frequency: 1700, endFrequency: 500, duration: 0.13, type: 'triangle', gain: 0.022, delay: 0.06 });
        break;
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
      case 'flame':
        this.noise(0.2, 0.075, 1600);
        this.tone({ frequency: 150, endFrequency: 60, duration: 0.24, type: 'sawtooth', gain: 0.035 });
        break;
      case 'ready':
        this.tone({ frequency: 660, endFrequency: 990, duration: 0.12, type: 'triangle', gain: 0.05 });
        this.tone({ frequency: 990, duration: 0.08, type: 'sine', gain: 0.03, delay: 0.1 });
        break;
      case 'radio':
        this.noise(0.08, 0.025, 2600);
        this.tone({ frequency: 1200, endFrequency: 900, duration: 0.045, type: 'square', gain: 0.022 });
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
