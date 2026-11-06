import { describe, expect, it } from 'vitest';
import { pickTarget, type TargetCandidate } from '../src/domain/targeting';

const candidates: TargetCandidate[] = [
  { id: 1, x: 50, y: 0, progress: 10, hp: 100 },
  { id: 2, x: 80, y: 0, progress: 60, hp: 40 },
  { id: 3, x: 300, y: 0, progress: 90, hp: 500 },
  { id: 4, x: 70, y: 0, progress: 20, hp: 500 },
];

describe('targeting', () => {
  it('filters by range', () => {
    const target = pickTarget(0, 0, 100, candidates, 'first');
    expect(target?.id).toBe(2);
  });

  it('targets the furthest along the path', () => {
    expect(pickTarget(0, 0, 120, candidates, 'first')?.id).toBe(2);
  });

  it('targets the strongest in range', () => {
    expect(pickTarget(0, 0, 120, candidates, 'strongest')?.id).toBe(4);
  });

  it('targets the nearest by distance', () => {
    expect(pickTarget(0, 0, 120, candidates, 'nearest')?.id).toBe(1);
  });

  it('tie-breaks by id for deterministic combat', () => {
    const tie = [
      { id: 9, x: 20, y: 0, progress: 50, hp: 20 },
      { id: 3, x: 20, y: 0, progress: 50, hp: 20 },
    ];
    expect(pickTarget(0, 0, 100, tie, 'first')?.id).toBe(3);
    expect(pickTarget(0, 0, 100, tie, 'strongest')?.id).toBe(3);
    expect(pickTarget(0, 0, 100, tie, 'nearest')?.id).toBe(3);
  });

  it('returns null when no target is in range', () => {
    expect(pickTarget(500, 500, 50, candidates, 'first')).toBeNull();
  });
});
