import type { TargetMode } from '../types';

export interface TargetCandidate {
  id: number;
  x: number;
  y: number;
  progress: number;
  hp: number;
}

/**
 * Picks a target in range. Ties resolve to the lower id so combat is stable
 * even when two enemies occupy the same path distance.
 */
export function pickTarget(
  towerX: number,
  towerY: number,
  range: number,
  candidates: readonly TargetCandidate[],
  mode: TargetMode,
): TargetCandidate | null {
  const rangeSq = range * range;
  let best: TargetCandidate | null = null;

  for (const candidate of candidates) {
    const dx = candidate.x - towerX;
    const dy = candidate.y - towerY;
    const distSq = dx * dx + dy * dy;
    if (distSq > rangeSq) continue;

    if (!best) {
      best = candidate;
      continue;
    }

    switch (mode) {
      case 'first':
        if (
          candidate.progress > best.progress ||
          (candidate.progress === best.progress && candidate.id < best.id)
        ) {
          best = candidate;
        }
        break;
      case 'strongest':
        if (candidate.hp > best.hp || (candidate.hp === best.hp && candidate.id < best.id)) {
          best = candidate;
        }
        break;
      case 'nearest': {
        const bestDx = best.x - towerX;
        const bestDy = best.y - towerY;
        const bestDistSq = bestDx * bestDx + bestDy * bestDy;
        if (distSq < bestDistSq || (distSq === bestDistSq && candidate.id < best.id)) {
          best = candidate;
        }
        break;
      }
    }
  }

  return best;
}
