import Phaser from 'phaser';
import { unitTextureKey, UNIT_SIZE, directionFrame } from '../assets/unitTextures';
import { COLORS, DEPTH } from '../game/constants';
import type { TowerConfig, UnitLevel } from '../types';

/**
 * Renders a deployed human unit. The body texture is drawn facing up and is
 * rotated toward the current target; the deployment ring stays level.
 */
export class TowerView {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly ringInner: Phaser.GameObjects.Image;
  private readonly ringOuter: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly accent: number;
  private readonly baseScale: number;
  private readonly directionalKey: string | null;
  private readonly flying: boolean;
  private readonly visualSize: number;
  private level: UnitLevel = 1;

  constructor(scene: Phaser.Scene, config: TowerConfig, x: number, y: number) {
    this.scene = scene;
    this.accent = config.accent;
    this.flying = config.id === 'battlecruiser';
    this.visualSize = UNIT_SIZE[config.id];
    const directionKey = `sc-${config.id}-directions`;
    this.directionalKey = scene.textures.exists(directionKey) ? directionKey : null;
    this.baseScale = UNIT_SIZE[config.id] / 88;
    this.container = scene.add.container(x, y);
    this.container.setDepth(DEPTH.towers + (this.flying ? 10 : 0));

    this.ringInner = scene.add.image(0, 0, 'ring');
    this.ringInner.setTint(config.accent);
    this.ringInner.setBlendMode(Phaser.BlendModes.ADD);
    this.ringInner.setScale(UNIT_SIZE[config.id] / 130);
    this.ringInner.setAlpha(0.28);
    this.container.add(this.ringInner);

    const shadow = scene.add.ellipse(3, 10, UNIT_SIZE[config.id] * 0.85, UNIT_SIZE[config.id] * 0.35, 0x010509, 0.6);
    this.container.add(shadow);
    this.body = scene.add.image(0, this.flying ? -10 : -3, this.directionalKey ?? unitTextureKey(scene, config.id));
    this.body.setScale(this.baseScale);
    this.container.add(this.body);

    if (this.flying) scene.tweens.add({ targets: this.body, y: -14, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.ringOuter = scene.add.image(0, 0, 'ring');
    this.ringOuter.setTint(config.accent);
    this.ringOuter.setBlendMode(Phaser.BlendModes.ADD);
    this.ringOuter.setScale(UNIT_SIZE[config.id] / 110);
    this.ringOuter.setAlpha(0);
    this.container.add(this.ringOuter);

    this.pips = scene.add.graphics();
    this.pips.setDepth(1);
    this.container.add(this.pips);
    this.drawPips();

    this.scene.tweens.add({
      targets: this.ringInner,
      alpha: 0.1,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  setLevel(level: UnitLevel): void {
    this.level = level;

    this.ringInner.setAlpha(level === 1 ? 0.22 : level === 2 ? 0.38 : 0.55);
    this.ringOuter.setAlpha(level === 3 ? 0.55 : 0);
    this.body.setScale(this.baseScale);
    this.body.setTint(level === 3 ? 0xffffff : 0xffffff);
    this.drawPips();
  }

  private drawPips(): void {
    this.pips.clear();
    const pipColor = this.level === 3 ? COLORS.amber : this.accent;
    for (let i = 0; i < this.level; i++) {
      this.pips.fillStyle(pipColor, 0.9);
      this.pips.fillCircle((i - (this.level - 1) / 2) * 8, -this.visualSize / 2 - (this.flying ? 18 : 8), 2.2);
    }
  }

  aimAt(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.container.y, targetX - this.container.x);
    if (this.directionalKey) this.body.setFrame(directionFrame(angle));
    else this.body.setRotation(angle + Math.PI / 2);
  }

  idleAim(): void {
    // Keep the last facing direction while idle.
  }

  recoil(): void {
    if (this.flying) return;
    this.scene.tweens.killTweensOf(this.body);
    this.scene.tweens.add({
      targets: this.body,
      y: this.body.y + 2.5,
      duration: 55,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  muzzle(x: number, y: number): void {
    this.scene.tweens.add({
      targets: this.body,
      duration: 40,
      x,
      y,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  upgradeFlash(): void {
    this.scene.tweens.add({
      targets: this.ringOuter,
      alpha: 0.9,
      scale: 1.1,
      duration: 130,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  auraPulse(): void {
    this.scene.tweens.add({
      targets: this.ringInner,
      scale: 1.05,
      alpha: 0.5,
      duration: 160,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  setSelected(selected: boolean): void {
    if (selected) {
      this.body.setTint(0xffffff);
      this.ringOuter.setAlpha(0.42);
    } else {
      this.body.clearTint();
      this.ringOuter.setAlpha(this.level === 3 ? 0.55 : 0);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }
}

export function accentForTower(config: TowerConfig): number {
  return config.accent;
}

export const TOWER_SELECT_COLOR = COLORS.cyan;
