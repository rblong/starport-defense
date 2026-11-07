import { SELL_REFUND_RATE } from '../game/constants';

export function canAfford(crystals: number, cost: number): boolean {
  return cost >= 0 && crystals >= cost;
}

/** Returns 60% of the crystals invested in a unit when it is retreated. */
export function calculateSellValue(totalInvested: number, rate = SELL_REFUND_RATE): number {
  if (totalInvested <= 0) return 0;
  return Math.floor(totalInvested * rate);
}

export const calculateRetreatValue = calculateSellValue;

export function clampCredits(credits: number): number {
  return Math.max(0, Math.floor(credits));
}

/** Wave clear reward shared by the simulation and tests. */
export function clearBonusForWave(wave: number): number {
  return 20 + 5 * Math.max(1, Math.floor(wave));
}
