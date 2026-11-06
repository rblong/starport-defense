import type { WaveConfig } from '../types';
import type { EnemyId } from '../types';

export interface SpawnEvent {
  enemyId: EnemyId;
  at: number;
  hpScale: number;
  groupIndex: number;
  unitIndex: number;
}

/** Expands grouped wave data into a deterministic, time-ordered spawn queue. */
export function expandWave(wave: WaveConfig): SpawnEvent[] {
  const events: SpawnEvent[] = [];

  wave.groups.forEach((group, groupIndex) => {
    for (let unitIndex = 0; unitIndex < group.count; unitIndex++) {
      events.push({
        enemyId: group.enemyId,
        at: group.delay + unitIndex * group.interval,
        hpScale: wave.hpScale,
        groupIndex,
        unitIndex,
      });
    }
  });

  events.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex;
    return a.unitIndex - b.unitIndex;
  });

  return events;
}

export function countWaveUnits(wave: WaveConfig): number {
  return wave.groups.reduce((total, group) => total + group.count, 0);
}

export function isBossWave(wave: WaveConfig): boolean {
  return wave.groups.some((group) => group.enemyId === 'boss');
}

export function waveDuration(wave: WaveConfig): number {
  return wave.groups.reduce(
    (maxDuration, group) => Math.max(maxDuration, group.delay + Math.max(0, group.count - 1) * group.interval),
    0,
  );
}
