import type Phaser from 'phaser';
import type { EnemyId } from '../types';

const ZERG_TEXTURE: Partial<Record<EnemyId, string>> = {
  scout: 'sc-enemy-zergling',
  runner: 'sc-enemy-zergling',
  shard: 'sc-enemy-zergling',
  brute: 'sc-enemy-hydralisk',
  elite: 'sc-enemy-hydralisk',
  splitter: 'sc-enemy-lurker',
  boss: 'sc-enemy-ultralisk',
};

const LOCAL_SCALE: Record<EnemyId, number> = {
  scout: 0.78,
  runner: 0.68,
  shard: 0.5,
  brute: 0.86,
  splitter: 0.9,
  elite: 1.0,
  boss: 1.55,
};

const PREVIEW_SCALE: Record<EnemyId, number> = {
  scout: 0.3,
  runner: 0.27,
  shard: 0.22,
  brute: 0.34,
  splitter: 0.36,
  elite: 0.34,
  boss: 0.28,
};

export function hasZergEnemyTexture(scene: Phaser.Scene, enemyId: EnemyId): boolean {
  const key = ZERG_TEXTURE[enemyId];
  return Boolean(key && scene.textures.exists(key));
}

/** Use the optional local Zerg frame when present; otherwise procedural art. */
export function enemyTextureKey(scene: Phaser.Scene, enemyId: EnemyId): string {
  const key = ZERG_TEXTURE[enemyId];
  return key && scene.textures.exists(key) ? key : `enemy-${enemyId}`;
}

export function enemySpriteScale(scene: Phaser.Scene, enemyId: EnemyId, fallback: number): number {
  return hasZergEnemyTexture(scene, enemyId) ? LOCAL_SCALE[enemyId] : fallback;
}

export function enemyPreviewScale(scene: Phaser.Scene, enemyId: EnemyId): number {
  return hasZergEnemyTexture(scene, enemyId) ? PREVIEW_SCALE[enemyId] : enemyId === 'boss' ? 0.18 : 0.3;
}
