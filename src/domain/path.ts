import type { Vec2 } from '../types';

export interface PathData {
  points: Vec2[];
  segmentLengths: number[];
  cumulative: number[];
  totalLength: number;
}

export interface PathSample {
  x: number;
  y: number;
  angle: number;
}

export function buildPath(points: Vec2[]): PathData {
  if (points.length < 2) {
    throw new Error('A path needs at least two points');
  }

  const segmentLengths: number[] = [];
  const cumulative: number[] = [0];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    segmentLengths.push(length);
    totalLength += length;
    cumulative.push(totalLength);
  }

  return { points, segmentLengths, cumulative, totalLength };
}

/**
 * Samples a position and heading along the polyline. Writes into `out` to keep
 * the per-enemy update loop allocation-free.
 */
export function samplePath(path: PathData, distance: number, out: PathSample = { x: 0, y: 0, angle: 0 }): PathSample {
  const clamped = Math.max(0, Math.min(distance, path.totalLength));
  const lastSegment = path.segmentLengths.length - 1;

  let index = 0;
  while (index < lastSegment && clamped > path.cumulative[index + 1]!) {
    index++;
  }

  const from = path.points[index]!;
  const to = path.points[index + 1] ?? from;
  const segmentLength = path.segmentLengths[index] ?? 0;
  const segmentStart = path.cumulative[index] ?? 0;
  const t = segmentLength > 0 ? Math.max(0, Math.min(1, (clamped - segmentStart) / segmentLength)) : 0;

  out.x = from.x + (to.x - from.x) * t;
  out.y = from.y + (to.y - from.y) * t;
  out.angle = Math.atan2(to.y - from.y, to.x - from.x);
  return out;
}

export function pathProgress(path: PathData, distance: number): number {
  if (path.totalLength <= 0) return 0;
  return Math.max(0, Math.min(1, distance / path.totalLength));
}
