import type { EnemyId, WaveConfig } from '../types';

function group(enemyId: EnemyId, count: number, interval: number, delay = 0) {
  return { enemyId, count, interval, delay };
}

/**
 * 12 waves. hpScale only applies to non-boss enemies; boss HP is fixed.
 * The wave table is intentionally data-only so combat/balance tuning does not
 * touch scene code.
 */
export const WAVES: WaveConfig[] = [
  {
    index: 1,
    hpScale: 1,
    groups: [group('scout', 8, 0.9)],
  },
  {
    index: 2,
    hpScale: 1,
    groups: [group('scout', 10, 0.8), group('runner', 4, 0.6, 2)],
  },
  {
    index: 3,
    hpScale: 1,
    groups: [group('runner', 10, 0.55), group('brute', 2, 2.5, 3)],
  },
  {
    index: 4,
    hpScale: 1,
    groups: [group('scout', 12, 0.6), group('splitter', 4, 1.6, 1.5)],
  },
  {
    index: 5,
    hpScale: 1.1,
    groups: [group('brute', 4, 2.4), group('runner', 12, 0.45, 2)],
  },
  {
    index: 6,
    hpScale: 1.1,
    groups: [group('elite', 1, 1), group('scout', 10, 0.7, 1)],
  },
  {
    index: 7,
    hpScale: 1.15,
    groups: [group('splitter', 8, 1.2), group('runner', 12, 0.4, 2)],
  },
  {
    index: 8,
    hpScale: 1.2,
    groups: [group('brute', 6, 2.0), group('scout', 14, 0.5, 1.5)],
  },
  {
    index: 9,
    hpScale: 1.3,
    groups: [group('runner', 20, 0.3), group('splitter', 6, 1.2, 2)],
  },
  {
    index: 10,
    hpScale: 1.35,
    groups: [group('brute', 8, 1.8), group('splitter', 8, 1.0, 1.5)],
  },
  {
    index: 11,
    hpScale: 1.45,
    groups: [
      group('scout', 16, 0.5),
      group('runner', 16, 0.35, 2),
      group('brute', 4, 2.0, 2),
      group('splitter', 6, 1.2, 2),
    ],
  },
  {
    index: 12,
    hpScale: 1.5,
    groups: [
      group('boss', 1, 1),
      group('brute', 6, 2.2, 8),
      group('runner', 12, 0.5, 6),
    ],
  },
];

export const WAVE_MAP = new Map(WAVES.map((wave) => [wave.index, wave]));
