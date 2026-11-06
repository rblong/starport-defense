import { describe, expect, it } from 'vitest';
import {
  applyArmor,
  chainDamage,
  effectiveSlow,
  shouldApplySlow,
} from '../src/domain/combat';

describe('combat rules', () => {
  it('applies flat armour but never goes below one damage', () => {
    expect(applyArmor(20, 4)).toBe(16);
    expect(applyArmor(3, 10)).toBe(1);
    expect(applyArmor(0, 10)).toBe(0);
  });

  it('can ignore armour for orbital damage', () => {
    expect(applyArmor(200, 10, true)).toBe(200);
  });

  it('falls off chain damage per jump', () => {
    expect(chainDamage(100, 0, 0.65)).toBe(100);
    expect(chainDamage(100, 1, 0.65)).toBeCloseTo(65);
    expect(chainDamage(100, 2, 0.65)).toBeCloseTo(42.25);
  });

  it('lets bosses resist slows', () => {
    expect(effectiveSlow(0.4, 0)).toBe(0.4);
    expect(effectiveSlow(0.4, 0.5)).toBe(0.2);
    expect(effectiveSlow(1, 0)).toBe(0.9);
  });

  it('keeps the strongest slow and refreshes only valid ones', () => {
    expect(shouldApplySlow(0.3, 0.4, 10, 5)).toBe(false);
    expect(shouldApplySlow(0.45, 0.4, 10, 5)).toBe(true);
    expect(shouldApplySlow(0.2, 0.4, 3, 5)).toBe(true);
  });
});
