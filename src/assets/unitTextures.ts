import type Phaser from 'phaser';
import type { UnitId } from '../types';

export const UNIT_SIZE: Record<UnitId, number> = { marine: 32, goliath: 46, tank: 58, battlecruiser: 88 };
export function unitTextureKey(scene: Phaser.Scene, id: UnitId): string {
  return scene.textures.exists(`sc-${id}`) ? `sc-${id}` : `unit-${id}`;
}
export function hasStarCraftUnit(scene: Phaser.Scene, id: UnitId): boolean {
  return scene.textures.exists(`sc-${id}`);
}
export function fitUnitIcon(image: Phaser.GameObjects.Image, size: number): void {
  image.setScale(size / Math.max(image.width, image.height));
}
export function directionFrame(angle: number): number {
  return ((Math.round((angle + Math.PI / 2) * 8 / Math.PI) % 16) + 16) % 16;
}
