import Phaser from 'phaser';
import { enemySpriteScale, enemyTextureKey } from '../assets/enemyTextures';
import { directionFrame } from '../assets/unitTextures';
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
  private burning = false;
  private dead = false;
  private readonly walkKey: string | null;
  private readonly walkFrames: number;
  private travelled = 0;
  private previousX: number;
  private previousY: number;
  private readonly legs: Phaser.GameObjects.Graphics | null;


  constructor(scene: Phaser.Scene, config: EnemyConfig, x: number, y: number) {
    this.scene = scene;
    this.config = config;
    this.previousX = x; this.previousY = y;
    const baseKey = enemyTextureKey(scene, config.id);
    this.walkKey = scene.textures.exists(`${baseKey}-walk`) ? `${baseKey}-walk` : null;
    this.walkFrames = config.isBoss ? 9 : 7;
    const sizes: Record<string, number> = { scout: 28, runner: 25, shard: 18, brute: 40, splitter: 48, elite: 48, boss: 95 };
    const scale = this.walkKey ? (sizes[config.id] ?? 32) / 88 : enemySpriteScale(scene, config.id, VISUAL_SCALE[config.id] ?? 0.5);
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

    const shadow = scene.add.ellipse(2, 7, (sizes[config.id] ?? 32) * 0.8, 12, 0x010409, 0.5);
    this.container.add(shadow);
    this.legs = this.walkKey ? null : scene.add.graphics();
    if (this.legs) this.container.add(this.legs);
    this.sprite = scene.add.image(0, 0, this.walkKey ?? baseKey);
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
    const distance = Math.hypot(x - this.previousX, y - this.previousY);
    this.previousX = x; this.previousY = y;
    this.travelled += distance;
    const step = Math.floor(this.travelled / (this.config.isBoss ? 7 : 4)) % this.walkFrames;
    if (this.walkKey) {
      this.sprite.setFrame(directionFrame(angle) * this.walkFrames + step);
      this.sprite.setRotation(0);
    } else {
      this.sprite.setRotation(angle);
      const phase = this.travelled * 0.3;
      this.sprite.setPosition(0, Math.sin(phase * 2) * 1.3);
      const legs = this.legs!;
      legs.clear(); legs.lineStyle(2, this.config.color, 0.7);
      for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
        const along = (i - 1) * 9 + Math.sin(phase + i * 2 + side) * 4;
        const c = Math.cos(angle), s = Math.sin(angle);
        legs.lineBetween(x - this.container.x + along*c - side*5*s, along*s + side*5*c, along*c - side*17*s, along*s + side*17*c);
      }
    }
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

  setBurning(burning: boolean): void {
    if (this.dead || this.burning === burning) return;
    this.burning = burning;
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
    if (this.burning) {
      this.sprite.setTint(0xffb066);
    } else if (this.slowed) {
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
