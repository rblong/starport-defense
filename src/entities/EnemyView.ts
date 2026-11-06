import Phaser from 'phaser';
import { DEPTH } from '../game/constants';
import type { EnemyConfig } from '../types';

const VISUAL_SCALE: Record<string, number> = {
  scout: 0.5,
  runner: 0.44,
  brute: 0.56,
  splitter: 0.52,
  shard: 0.4,
  elite: 0.58,
  boss: 0.62,
};

export class EnemyView {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly hpBar: Phaser.GameObjects.Graphics | null;
  private readonly aura: Phaser.GameObjects.Image | null;
  private readonly config: EnemyConfig;
  private lastRatio = 1;
  private flashUntil = 0;
  private slowed = false;
  private dead = false;

  constructor(scene: Phaser.Scene, config: EnemyConfig, x: number, y: number) {
    this.scene = scene;
    this.config = config;
    const scale = VISUAL_SCALE[config.id] ?? 0.5;
    this.container = scene.add.container(x, y);
    this.container.setDepth(DEPTH.enemies + (config.isBoss ? 5 : config.isElite ? 2 : 0));

    if (config.isBoss || config.isElite) {
      this.aura = scene.add.image(0, 0, 'glow');
      this.aura.setTint(config.isBoss ? 0xff3d9a : 0xffc857);
      this.aura.setBlendMode(Phaser.BlendModes.ADD);
      this.aura.setScale(config.isBoss ? 1.05 : 0.55);
      this.aura.setAlpha(config.isBoss ? 0.35 : 0.22);
      this.container.add(this.aura);
    } else {
      this.aura = null;
    }

    this.sprite = scene.add.image(0, 0, `enemy-${config.id}`);
    this.sprite.setScale(scale);
    this.container.add(this.sprite);

    if (config.showHealthBar) {
      this.hpBar = scene.add.graphics();
      this.hpBar.setPosition(0, -config.size * 0.95 - 10);
      this.container.add(this.hpBar);
      this.drawHpBar(1);
    } else {
      this.hpBar = null;
    }

    if (config.isBoss) {
      this.container.setSize(190, 190);
    }
  }

  setTransform(x: number, y: number, angle: number): void {
    if (this.dead) return;
    this.container.setPosition(x, y);
    this.sprite.setRotation(angle);
  }

  setHp(ratio: number): void {
    if (this.dead) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    if (Math.abs(clamped - this.lastRatio) < 0.004) return;
    this.lastRatio = clamped;
    this.drawHpBar(clamped);
  }

  setSlowed(slowed: boolean): void {
    if (this.dead || this.slowed === slowed) return;
    this.slowed = slowed;
    this.applyTint();
  }

  flash(): void {
    if (this.dead) return;
    this.flashUntil = this.scene.time.now + 70;
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead && this.scene.time.now >= this.flashUntil - 10) this.applyTint();
    });
  }

  private applyTint(): void {
    if (this.slowed) {
      this.sprite.setTint(0x9ffcff);
    } else {
      this.sprite.clearTint();
    }
  }

  private drawHpBar(ratio: number): void {
    if (!this.hpBar) return;
    const width = this.config.isBoss ? 88 : 42;
    const height = this.config.isBoss ? 7 : 4;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x02040a, 0.8);
    this.hpBar.fillRoundedRect(-width / 2, 0, width, height, 2);
    const color = ratio > 0.55 ? 0x66ffb2 : ratio > 0.25 ? 0xffc857 : 0xff5a6a;
    this.hpBar.fillStyle(color, 0.95);
    this.hpBar.fillRoundedRect(-width / 2 + 1, 1, Math.max(0, (width - 2) * ratio), height - 2, 1);
  }

  destroy(): void {
    this.dead = true;
    this.container.destroy(true);
  }
}
