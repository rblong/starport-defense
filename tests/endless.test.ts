import { describe, expect, it } from 'vitest';
import { ENEMY_MAP } from '../src/data/enemies';
import { WAVES, getWaveForIndex } from '../src/data/waves';
import { expandWave } from '../src/domain/waves';

describe('endless waves', () => {
  it('keeps the campaign waves at indices 1-12', () => {
    for (let index = 1; index <= WAVES.length; index++) {
      expect(getWaveForIndex(index)).toBe(WAVES[index - 1]);
    }
    expect(getWaveForIndex(0)).toBeUndefined();
    expect(getWaveForIndex(1.5)).toBeUndefined();
  });

  it('generates playable waves past the campaign', () => {
    for (let index = 13; index <= 24; index++) {
      const wave = getWaveForIndex(index);
      expect(wave).toBeDefined();
      expect(wave!.index).toBe(index);
      expect(wave!.groups.length).toBeGreaterThan(0);
      expect(wave!.hpScale).toBeGreaterThan(1.5);
      expect(expandWave(wave!).length).toBeGreaterThan(0);
      for (const group of wave!.groups) {
        expect(ENEMY_MAP[group.enemyId]).toBeDefined();
        expect(group.count).toBeGreaterThan(0);
        expect(group.count).toBeLessThanOrEqual(40);
        expect(group.interval).toBeGreaterThan(0);
      }
    }
  });

  it('scales endless difficulty monotonically', () => {
    const first = getWaveForIndex(13)!;
    const later = getWaveForIndex(25)!;
    expect(later.hpScale).toBeGreaterThan(first.hpScale);
    const firstUnits = expandWave(first).length;
    const laterUnits = expandWave(later).length;
    expect(laterUnits).toBeGreaterThanOrEqual(firstUnits);
  });
});
