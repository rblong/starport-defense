export const MIN_DAMAGE = 1;

/** Flat armour mitigation with a minimum damage floor. */
export function applyArmor(rawDamage: number, armor: number, ignoreArmor = false): number {
  if (rawDamage <= 0) return 0;
  if (ignoreArmor) return rawDamage;
  return Math.max(MIN_DAMAGE, rawDamage - Math.max(0, armor));
}

/** Chain lightning loses damage after each jump. */
export function chainDamage(baseDamage: number, jumpIndex: number, falloff: number): number {
  return baseDamage * Math.pow(Math.max(0, Math.min(1, falloff)), Math.max(0, jumpIndex));
}

/** Bosses resist a percentage of all slows. */
export function effectiveSlow(slowFactor: number, slowResist: number): number {
  return Math.max(0, Math.min(0.9, slowFactor * (1 - Math.max(0, Math.min(1, slowResist)))));
}

/**
 * Only the strongest slow is kept. A weaker slow does not replace an active,
 * stronger one, but an expired effect can always be replaced.
 */
export function shouldApplySlow(
  incomingFactor: number,
  currentFactor: number,
  currentExpiresAt: number,
  now: number,
): boolean {
  return now >= currentExpiresAt || incomingFactor >= currentFactor;
}
