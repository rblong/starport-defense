import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/domain/score';
import { calculateSellValue, clearBonusForWave, canAfford } from '../src/domain/economy';

describe('score and economy', () => {
  it('computes the documented score formula', () => {
    expect(
      computeScore({ wavesCleared: 12, kills: 100, integrity: 10, crystals: 50, victory: true }),
    ).toBe(12 * 100 + 100 * 10 + 10 * 50 + 50 * 2 + 1000);
  });

  it('does not add a victory bonus on defeat', () => {
    expect(
      computeScore({ wavesCleared: 5, kills: 20, integrity: 0, crystals: 0, victory: false }),
    ).toBe(500 + 200);
  });

  it('rounds retreat refunds down at 60%', () => {
    expect(calculateSellValue(100)).toBe(60);
    expect(calculateSellValue(101)).toBe(60);
    expect(calculateSellValue(0)).toBe(0);
  });

  it('computes clear bonuses and affordability', () => {
    expect(clearBonusForWave(1)).toBe(25);
    expect(clearBonusForWave(12)).toBe(80);
    expect(canAfford(100, 100)).toBe(true);
    expect(canAfford(99, 100)).toBe(false);
  });
});
