import Phaser from 'phaser';
import { COLORS, DEPTH } from '../game/constants';
import type { TowerConfig, TowerLevel } from '../types';

export class TowerView {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly ringInner: Phaser.GameObjects.Image;
  private readonly ringOuter: Phaser.GameObjects.Image;
  private readonly accent: number;

  constructor(scene: Phaser.Scene, config: TowerConfig, x: number, y: number) {
    this.scene = scene;
    this.accent = config.accent;
    this.container = scene.add.container(x, y);
    this.container.setDepth(DEPTH.towers);

    this.ringInner = scene.add.image(0, 0, 'ring');
    this.ringInner.setTint(config.accent);
    this.ringInner.setBlendMode(Phaser.BlendModes.ADD);
    this.ringInner.setScale(0.52);
    this.ringInner.setAlpha(0.28);
    this.container.add(this.ringInner);

    this.base = scene.add.image(0, 0, `tower-${config.id}-base`);
    this.container.add(this.base);

    this.ringOuter = scene.add.image(0, 0, 'ring');
    this.ringOuter.setTint(config.accent);
    this.ringOuter.setBlendMode(Phaser.BlendModes.ADD);
    this.ringOuter.setScale(0.68);
    this.ringOuter.setAlpha(0);
    this.container.add(this.ringOuter);

    this.head = scene.add.image(0, -3, `tower-${config.id}-head`);
    this.container.add(this.head);

    this.scene.tweens.add({
      targets: this.ringInner,
      alpha: 0.1,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  setLevel(level: TowerLevel): void {
    this.ringInner.setScale(level === 1 ? 0.52 : level === 2 ? 0.6 : 0.68);
    this.ringInner.setAlpha(level === 1 ? 0.22 : level === 2 ? 0.38 : 0.55);
    this.ringOuter.setAlpha(level === 3 ? 0.55 : 0);
    if (level === 3) {
      this.base.setTint(0xffffff);
    }
    this.head.setScale(level === 3 ? 1.06 : 1);
  }

  aimAt(targetX: number, targetY: number): void {
    const angle = Math.atan2(targetY - this.container.y, targetX - this.container.x);
    this.head.setRotation(angle + Math.PI / 2);
  }

  idleAim(): void {
    this.head.setRotation(0);
  }

  recoil(): void {
    this.scene.tweens.add({
      targets: this.head,
      scaleX: 0.88,
      scaleY: 0.88,
      duration: 60,
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
      this.base.setTint(0xffffff);
      this.ringOuter.setAlpha(0.42);
    } else {
      this.base.clearTint();
      this.ringOuter.setAlpha(0);
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
