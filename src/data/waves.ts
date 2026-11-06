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

/**
 * Returns a configured campaign wave, or a procedurally scaled endless wave
 * after wave 12. The generated waves stay data-shaped so GameScene's spawn
 * pipeline is unchanged.
 */
export function getWaveForIndex(index: number): WaveConfig | undefined {
  if (!Number.isInteger(index) || index < 1) return undefined;
  if (index <= WAVES.length) return WAVES[index - 1];
  return generateEndlessWave(index);
}

function generateEndlessWave(index: number): WaveConfig {
  const cycle = (index - WAVES.length - 1) % 4;
  const tier = Math.floor((index - WAVES.length - 1) / 4);
  const hpScale = Math.min(12, 1.55 + (index - WAVES.length) * 0.07);
  const groups: WaveConfig['groups'] = [];
  const add = (enemyId: EnemyId, count: number, interval: number, delay = 0): void => {
    groups.push({
      enemyId,
      count: Math.max(1, Math.min(40, count)),
      interval,
      delay,
    });
  };

  // Four rotating compositions keep endless runs varied without introducing
  // new unit types or assets.
  switch (cycle) {
    case 0:
      add('scout', 18 + tier * 2, 0.45);
      add('runner', 10 + tier * 2, 0.3, 0.8);
      add('brute', 5 + tier, 1.8, 1.2);
      break;
    case 1:
      add('brute', 8 + tier, 1.8);
      add('elite', 2 + Math.floor(tier / 2), 2.4, 1.5);
      add('scout', 12 + tier, 0.5);
      break;
    case 2:
      add('splitter', 10 + tier, 1.0);
      add('runner', 20 + tier * 2, 0.28, 1.4);
      add('scout', 10 + tier, 0.45);
      break;
    default:
      add('elite', 3 + tier, 2.0);
      add('brute', 10 + tier, 1.6, 1.0);
      add('runner', 14 + tier * 2, 0.3, 2.0);
      add('scout', 16 + tier, 0.4);
      break;
  }

  return { index, hpScale, groups };
}

