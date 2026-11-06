import { describe, expect, it } from 'vitest';
import { buildPath, pathProgress, samplePath } from '../src/domain/path';

describe('path', () => {
  const path = buildPath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);

  it('computes segment lengths and total length', () => {
    expect(path.segmentLengths).toEqual([100, 100]);
    expect(path.totalLength).toBe(200);
    expect(pathProgress(path, 50)).toBeCloseTo(0.25);
  });

  it('samples positions at the start, midpoints and corners', () => {
    expect(samplePath(path, 0)).toMatchObject({ x: 0, y: 0, angle: 0 });
    expect(samplePath(path, 50)).toMatchObject({ x: 50, y: 0, angle: 0 });
    expect(samplePath(path, 100)).toMatchObject({ x: 100, y: 0, angle: 0 });
    const corner = samplePath(path, 150);
    expect(corner.x).toBeCloseTo(100);
    expect(corner.y).toBeCloseTo(50);
    expect(corner.angle).toBeCloseTo(Math.PI / 2);
  });

  it('clamps out-of-range distances', () => {
    expect(samplePath(path, -20)).toMatchObject({ x: 0, y: 0 });
    const end = samplePath(path, 9999);
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(100);
  });

  it('rejects degenerate paths', () => {
    expect(() => buildPath([{ x: 1, y: 2 }])).toThrow();
  });
});
