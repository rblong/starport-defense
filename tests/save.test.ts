import { beforeEach, describe, expect, it } from 'vitest';
import { loadProgress, loadSettings, recordRun, updateSettings } from '../src/systems/save';

describe('save fallback and progress', () => {
  beforeEach(() => {
    // Node has no localStorage, so this exercises the in-memory fallback.
    expect(typeof window).toBe('undefined');
  });

  it('falls back to defaults without throwing in a storage-less environment', () => {
    const settings = loadSettings();
    expect(settings.version).toBe(1);
    expect(settings.soundEnabled).toBe(true);
    expect(settings.reducedMotion).toBe(false);
    expect(settings.defaultSpeed).toBe(1);
    expect(settings.volume).toBe(0.5);
    expect(settings.autoNextWave).toBe(false);
  });

  it('keeps settings in memory when storage is unavailable', () => {
    const next = updateSettings({
      soundEnabled: false,
      reducedMotion: true,
      defaultSpeed: 5,
      volume: 0.25,
      autoNextWave: true,
    });
    expect(next.soundEnabled).toBe(false);
    expect(next.reducedMotion).toBe(true);
    expect(next.defaultSpeed).toBe(5);
    expect(next.volume).toBe(0.25);
    expect(next.autoNextWave).toBe(true);
    expect(loadSettings().soundEnabled).toBe(false);
    expect(loadSettings().defaultSpeed).toBe(5);
    expect(loadSettings().volume).toBe(0.25);
    expect(loadSettings().autoNextWave).toBe(true);
    // Restore defaults for any subsequent test in this worker.
    updateSettings({
      soundEnabled: true,
      reducedMotion: false,
      defaultSpeed: 1,
      volume: 0.5,
      autoNextWave: false,
    });
  });

  it('persists independent audio levels and clamps invalid music volume', () => {
    updateSettings({ volume: 0, musicVolume: 0.75 });
    expect(loadSettings().volume).toBe(0);
    expect(loadSettings().musicVolume).toBe(0.75);
    updateSettings({ volume: 1 });
    expect(loadSettings().musicVolume).toBe(0.75);
    expect(updateSettings({ musicVolume: 2 }).musicVolume).toBe(1);
    expect(updateSettings({ musicVolume: Number.NaN }).musicVolume).toBe(0.5);
    updateSettings({ volume: 0.5, musicVolume: 0.5 });
  });

  it('keeps the best score and accumulated kills', () => {
    const first = recordRun(1200, false, 5, 20);
    expect(first.bestScore).toBeGreaterThanOrEqual(1200);
    expect(first.isNewBest).toBe(true);

    const second = recordRun(800, false, 4, 10);
    expect(second.isNewBest).toBe(false);
    expect(second.bestScore).toBeGreaterThanOrEqual(1200);

    const third = recordRun(3000, true, 12, 40);
    expect(third.isNewBest).toBe(true);
    expect(third.bestScore).toBe(3000);
    const progress = loadProgress();
    expect(progress.cleared).toBe(true);
    expect(progress.bestWave).toBe(12);
    expect(progress.totalKills).toBeGreaterThanOrEqual(40);
  });
});
