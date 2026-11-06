import { describe, expect, it } from 'vitest';
import { WAVES } from '../src/data/waves';
import { TOWERS } from '../src/data/towers';
import { ENEMIES, ENEMY_MAP } from '../src/data/enemies';
import { LEVEL_ONE, isOnPath } from '../src/data/level01';
import { expandWave, countWaveUnits } from '../src/domain/waves';
import { TOTAL_WAVES } from '../src/game/constants';

describe('game configuration', () => {
  it('has exactly twelve sequential waves', () => {
    expect(WAVES).toHaveLength(TOTAL_WAVES);
    WAVES.forEach((wave, index) => expect(wave.index).toBe(index + 1));
  });

  it('only references known enemy ids', () => {
    for (const wave of WAVES) {
      for (const group of wave.groups) {
        expect(ENEMY_MAP[group.enemyId]).toBeDefined();
        expect(group.count).toBeGreaterThan(0);
        expect(group.interval).toBeGreaterThan(0);
        expect(group.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ends with the boss wave and includes every enemy type', () => {
    expect(WAVES[WAVES.length - 1]?.groups.some((g) => g.enemyId === 'boss')).toBe(true);
    const used = new Set(WAVES.flatMap((wave) => wave.groups.map((group) => group.enemyId)));
    expect(used).toContain('scout');
    expect(used).toContain('runner');
    expect(used).toContain('brute');
    expect(used).toContain('splitter');
    expect(used).toContain('elite');
    expect(used).toContain('boss');
  });

  it('has three meaningful levels for every tower', () => {
    expect(TOWERS).toHaveLength(4);
    for (const tower of TOWERS) {
      expect(tower.levels).toHaveLength(3);
      expect(tower.levels[1]!.damage).toBeGreaterThan(tower.levels[0]!.damage);
      expect(tower.levels[2]!.damage).toBeGreaterThan(tower.levels[1]!.damage);
      expect(tower.upgradeCosts[0]).toBeGreaterThan(0);
      expect(tower.upgradeCosts[1]).toBeGreaterThan(tower.upgradeCosts[0]);
    }
  });

  it('has valid enemy stats', () => {
    expect(ENEMIES.length).toBeGreaterThanOrEqual(7);
    for (const enemy of ENEMIES) {
      expect(enemy.maxHp).toBeGreaterThan(0);
      expect(enemy.speed).toBeGreaterThan(0);
      expect(enemy.reward).toBeGreaterThanOrEqual(0);
      expect(enemy.leakDamage).toBeGreaterThan(0);
    }
    expect(ENEMY_MAP.boss.isBoss).toBe(true);
  });

  it('has sixteen pads away from the path', () => {
    expect(LEVEL_ONE.pads).toHaveLength(16);
    const seen = new Set<string>();
    for (const pad of LEVEL_ONE.pads) {
      expect(pad.col).toBeGreaterThanOrEqual(0);
      expect(pad.col).toBeLessThan(LEVEL_ONE.cols);
      expect(pad.row).toBeGreaterThanOrEqual(0);
      expect(pad.row).toBeLessThan(LEVEL_ONE.rows);
      expect(isOnPath(pad)).toBe(false);
      const key = `${pad.col},${pad.row}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('starts and ends the path at the expected map edges', () => {
    const first = LEVEL_ONE.path[0]!;
    const last = LEVEL_ONE.path[LEVEL_ONE.path.length - 1]!;
    expect(first.col).toBeLessThan(0);
    expect(last).toEqual(LEVEL_ONE.core);
  });

  it('expands waves deterministically in spawn order', () => {
    const wave = WAVES[10]!;
    const events = expandWave(wave);
    expect(events).toHaveLength(countWaveUnits(wave));
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.at).toBeGreaterThanOrEqual(events[i - 1]!.at);
    }
    expect(countWaveUnits(WAVES[0]!)).toBe(8);
  });
});
