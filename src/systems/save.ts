import type { ProgressData, SettingsData } from '../types';

const SETTINGS_KEY = 'starport-defense:v1:settings';
const PROGRESS_KEY = 'starport-defense:v1:progress';

const DEFAULT_SETTINGS: SettingsData = {
  version: 1,
  soundEnabled: true,
  reducedMotion: false,
  defaultSpeed: 1,
  volume: 0.5,
};

const DEFAULT_PROGRESS: ProgressData = {
  version: 1,
  bestScore: 0,
  cleared: false,
  bestWave: 0,
  totalKills: 0,
};

let memorySettings = { ...DEFAULT_SETTINGS };
let memoryProgress = { ...DEFAULT_PROGRESS };
let storageCheck: Storage | null | undefined;

function getStorage(): Storage | null {
  if (storageCheck !== undefined) return storageCheck;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      storageCheck = null;
      return storageCheck;
    }
    const storage = window.localStorage;
    const probe = '__starport_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    storageCheck = storage;
  } catch {
    storageCheck = null;
  }
  return storageCheck;
}

function readJson<T>(key: string): Partial<T> | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<T>;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota). The game still works
    // for this session; only persistence is lost.
  }
}

function normalizeSettings(value: Partial<SettingsData> | null): SettingsData {
  const volume =
    typeof value?.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, Math.min(1, value.volume))
      : DEFAULT_SETTINGS.volume;
  const defaultSpeed =
    value?.defaultSpeed === 2 ||
    value?.defaultSpeed === 3 ||
    value?.defaultSpeed === 4 ||
    value?.defaultSpeed === 5
      ? value.defaultSpeed
      : 1;
  return {
    version: 1,
    soundEnabled: typeof value?.soundEnabled === 'boolean' ? value.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    reducedMotion: typeof value?.reducedMotion === 'boolean' ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    defaultSpeed,
    volume,
  };
}

function normalizeProgress(value: Partial<ProgressData> | null): ProgressData {
  const safeNumber = (candidate: unknown, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
      ? Math.floor(candidate)
      : fallback;

  return {
    version: 1,
    bestScore: safeNumber(value?.bestScore, DEFAULT_PROGRESS.bestScore),
    cleared: value?.cleared === true,
    bestWave: safeNumber(value?.bestWave, DEFAULT_PROGRESS.bestWave),
    totalKills: safeNumber(value?.totalKills, DEFAULT_PROGRESS.totalKills),
  };
}

export function loadSettings(): SettingsData {
  const storage = getStorage();
  if (!storage) {
    memorySettings = normalizeSettings(memorySettings);
    return { ...memorySettings };
  }
  const settings = normalizeSettings(readJson<SettingsData>(SETTINGS_KEY));
  memorySettings = settings;
  return { ...settings };
}

export function saveSettings(settings: SettingsData): void {
  memorySettings = normalizeSettings(settings);
  writeJson(SETTINGS_KEY, memorySettings);
}

export function updateSettings(patch: Partial<Omit<SettingsData, 'version'>>): SettingsData {
  const next = normalizeSettings({ ...loadSettings(), ...patch });
  saveSettings(next);
  return next;
}

export function loadProgress(): ProgressData {
  const storage = getStorage();
  if (!storage) {
    memoryProgress = normalizeProgress(memoryProgress);
    return { ...memoryProgress };
  }
  const progress = normalizeProgress(readJson<ProgressData>(PROGRESS_KEY));
  memoryProgress = progress;
  return { ...progress };
}

export interface RecordedRun {
  bestScore: number;
  isNewBest: boolean;
}

export function recordRun(score: number, cleared: boolean, waveReached: number, kills: number): RecordedRun {
  const current = loadProgress();
  const isNewBest = score > current.bestScore;
  const next: ProgressData = {
    version: 1,
    bestScore: Math.max(current.bestScore, score),
    cleared: current.cleared || cleared,
    bestWave: Math.max(current.bestWave, waveReached),
    totalKills: current.totalKills + Math.max(0, Math.floor(kills)),
  };
  memoryProgress = next;
  writeJson(PROGRESS_KEY, next);
  return { bestScore: next.bestScore, isNewBest };
}

/** Exposed for tests without touching real localStorage. */
export const __storageDefaults = {
  settings: DEFAULT_SETTINGS,
  progress: DEFAULT_PROGRESS,
  memorySettings: () => memorySettings,
  memoryProgress: () => memoryProgress,
};
