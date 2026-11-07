import Phaser from 'phaser';
import { CSS_COLORS, FONT_FAMILY, RENDER_SCALE } from '../game/constants';
import { gameBus } from '../events';
import type { UnitId } from '../types';

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export class Effects {
  private reducedMotion: boolean;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  setReducedMotionFromSettings(value: boolean): void {
    this.reducedMotion = value;
  }

  sparkBurst(x: number, y: number, color: number, count = 8, speed = 150): void {
    const total = this.reducedMotion ? Math.max(3, Math.floor(count / 2)) : count;
    for (let i = 0; i < total; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = speed * (0.35 + Math.random() * 0.9);
      const size = 0.3 + Math.random() * 0.9;
      const spark = this.scene.add.image(x, y, 'spark');
      spark.setDepth(52);
      spark.setTint(color);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setScale(size);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: size * 0.25,
        duration: 240 + Math.random() * 260,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  explosion(x: number, y: number, color: number, scale = 1): void {
    if (this.scene.textures.exists('sc-explosion') && this.scene.anims.exists('sc-explode')) {
      const sprite = this.scene.add.sprite(x, y, 'sc-explosion');
      sprite.setDepth(48);
      sprite.setScale(0.42 * scale);
      sprite.setRotation(Math.random() * Math.PI * 2);
      sprite.play('sc-explode');
      sprite.once('animationcomplete', () => sprite.destroy());
    } else {
      const flash = this.scene.add.image(x, y, 'glow');
      flash.setDepth(51);
      flash.setTint(color);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.setScale(0.35 * scale);
      flash.setAlpha(0.9);
      this.scene.tweens.add({
        targets: flash,
        scale: 1.15 * scale,
        alpha: 0,
        duration: 380,
        ease: 'Cubic.Out',
        onComplete: () => flash.destroy(),
      });
    }

    this.sparkBurst(x, y, color, Math.round(12 * scale), 190 * scale);

    const ring = this.scene.add.image(x, y, 'ring');
    ring.setDepth(51);
    ring.setTint(color);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(0.2 * scale);
    ring.setAlpha(0.8);
    this.scene.tweens.add({
      targets: ring,
      scale: 0.85 * scale,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    if (!this.reducedMotion && scale >= 0.85) {
      this.scene.cameras.main.shake(100, 0.0025);
    }
  }

  muzzle(x: number, y: number, angle: number, color: number): void {
    const flash = this.scene.add.image(x, y, 'spark');
    flash.setDepth(49);
    flash.setTint(color);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(1.3);
    const dx = Math.cos(angle) * 13;
    const dy = Math.sin(angle) * 13;
    flash.setPosition(x + dx, y + dy);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.1,
      alpha: 0,
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  weaponFire(x: number, y: number, tx: number, ty: number, unit: UnitId): void {
    const angle = Math.atan2(ty - y, tx - x);
    const heavy = unit === 'tank';
    const color = unit === 'battlecruiser' ? 0xff795c : heavy ? 0xffb45c : 0xffdf94;
    const offset = heavy ? 30 : unit === 'goliath' ? 22 : 15;
    const mx = x + Math.cos(angle) * offset, my = y + Math.sin(angle) * offset;
    const bloom = this.scene.add.image(mx, my, 'glow').setTint(color).setAlpha(0.85)
      .setDepth(51).setBlendMode(Phaser.BlendModes.ADD).setScale(heavy ? 0.5 : 0.2);
    this.scene.tweens.add({ targets: bloom, alpha: 0, scale: heavy ? 0.8 : 0.35,
      duration: heavy ? 160 : 90, onComplete: () => bloom.destroy() });
    if (unit !== 'battlecruiser') {
      const flash = this.scene.add.graphics().setPosition(mx, my).setRotation(angle).setDepth(52);
      flash.fillStyle(color, 0.8);
      flash.fillTriangle(-4, -6, heavy ? 30 : 18, 0, -4, 6);
      flash.fillStyle(0xfff6d7); flash.fillTriangle(-2, -3, heavy ? 18 : 11, 0, -2, 3);
      this.scene.tweens.add({ targets: flash, alpha: 0, scaleX: 0.3, duration: 100, onComplete: () => flash.destroy() });
    }
    if (heavy) {
      this.sparkBurst(mx, my, 0xffd592, this.reducedMotion ? 3 : 7, 38);
    } else if (unit !== 'battlecruiser') {
      const tracer = this.scene.add.graphics().setDepth(44);
      const a = Math.atan2(ty - my, tx - mx), dx = Math.cos(a), dy = Math.sin(a);
      for (const side of unit === 'goliath' ? [-5, 5] : [0]) {
        tracer.lineStyle(3, color, 0.17);
        tracer.lineBetween(mx - dy * side, my + dx * side, tx - dy * side, ty + dx * side);
        tracer.lineStyle(0.9, 0xffe8bd, 0.9);
        tracer.lineBetween(mx - dy * side, my + dx * side, tx - dy * side, ty + dx * side);
      }
      this.scene.tweens.add({ targets: tracer, alpha: 0, duration: 95, onComplete: () => tracer.destroy() });
    } else {
      const beam = this.scene.add.graphics().setDepth(46);
      beam.lineStyle(7, 0xff4938, 0.16); beam.lineBetween(mx, my, tx, ty);
      beam.lineStyle(2.5, 0xff7960, 0.95); beam.lineBetween(mx, my, tx, ty);
      beam.lineStyle(0.8, 0xffedd4, 1); beam.lineBetween(mx, my, tx, ty);
      this.scene.tweens.add({ targets: beam, alpha: 0, duration: 150, onComplete: () => beam.destroy() });
    }
  }

  impact(x: number, y: number, color: number): void {
    const flash = this.scene.add.image(x, y, 'spark');
    flash.setDepth(49);
    flash.setTint(color);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setScale(0.8);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.1,
      alpha: 0,
      duration: 110,
      onComplete: () => flash.destroy(),
    });
  }

  ringPulse(x: number, y: number, color: number, startScale = 0.3, endScale = 1.4, duration = 380): void {
    const ring = this.scene.add.image(x, y, 'ring');
    ring.setDepth(50);
    ring.setTint(color);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(startScale);
    ring.setAlpha(0.75);
    this.scene.tweens.add({
      targets: ring,
      scale: endScale,
      alpha: 0,
      duration,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
  }

  orbitTelegraph(x: number, y: number): void {
    const ring = this.scene.add.image(x, y, 'ring');
    ring.setDepth(48);
    ring.setTint(0xffc857);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(0.55);
    ring.setAlpha(0.65);
    this.scene.tweens.add({
      targets: ring,
      scale: 0.7,
      alpha: 0.95,
      duration: 400,
      ease: 'Sine.InOut',
      onComplete: () => ring.destroy(),
    });
    const marker = this.scene.add.image(x, y, 'dot-amber');
    marker.setDepth(49);
    marker.setBlendMode(Phaser.BlendModes.ADD);
    marker.setScale(0.7);
    marker.setAlpha(0.7);
    this.scene.tweens.add({
      targets: marker,
      scale: 0.3,
      alpha: 0.2,
      duration: 400,
      onComplete: () => marker.destroy(),
    });
  }

  orbitalImpact(x: number, y: number): void {
    this.ringPulse(x, y, 0xffc857, 0.4, 2.3, 520);
    this.sparkBurst(x, y, 0xffc857, 24, 260);
    const beam = this.scene.add.image(x, y - 330, 'glow');
    beam.setDepth(53);
    beam.setTint(0xfff0b0);
    beam.setBlendMode(Phaser.BlendModes.ADD);
    beam.setScale(0.5, 4.5);
    beam.setAlpha(0.85);
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 260,
      onComplete: () => beam.destroy(),
    });
    if (!this.reducedMotion) this.scene.cameras.main.shake(180, 0.006);
  }

  flameCone(
    x: number,
    y: number,
    angle: number,
    range: number,
    coneRadians: number,
    color: number,
  ): void {
    const graphics = this.scene.add.graphics().setDepth(45);
    const segments = 14;
    graphics.fillStyle(color, 0.24);
    graphics.beginPath();
    graphics.moveTo(x, y);
    for (let i = 0; i <= segments; i++) {
      const a = angle - coneRadians / 2 + (coneRadians * i) / segments;
      graphics.lineTo(x + Math.cos(a) * range, y + Math.sin(a) * range);
    }
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, color, 0.85);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x + Math.cos(angle) * range, y + Math.sin(angle) * range);
    graphics.strokePath();
    graphics.lineStyle(1, 0xffe7a0, 0.45);
    for (let i = 1; i <= 3; i++) {
      const a = angle + (Math.random() - 0.5) * coneRadians;
      graphics.beginPath();
      graphics.moveTo(x + Math.cos(a) * range * 0.2, y + Math.sin(a) * range * 0.2);
      graphics.lineTo(x + Math.cos(a) * range * 0.9, y + Math.sin(a) * range * 0.9);
      graphics.strokePath();
    }

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => graphics.destroy(),
    });
    this.sparkBurst(x + Math.cos(angle) * range * 0.6, y + Math.sin(angle) * range * 0.6, color, 8, 110);
  }

  floatingText(x: number, y: number, text: string, color: string = CSS_COLORS.amber): void {    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color,
      fontStyle: 'bold',
      stroke: '#050814',
      strokeThickness: 4,
    });
    label.setOrigin(0.5);
    label.setDepth(60);
    label.setResolution(RENDER_SCALE);
    this.scene.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  leakFlash(x: number, y: number, damage: number): void {
    this.scene.cameras.main.flash(90, 255, 42, 72, false);
    if (!this.reducedMotion) this.scene.cameras.main.shake(160, 0.005);
    this.sparkBurst(x, y, 0xff5a6a, 14, 180);
    gameBus.emit('game:damageFlash', { damage });
  }

  bossSpawn(x: number, y: number): void {
    this.ringPulse(x, y, 0xff3d9a, 0.4, 3.5, 900);
    this.sparkBurst(x, y, 0xff3d9a, 20, 220);
    if (!this.reducedMotion) this.scene.cameras.main.shake(260, 0.0035);
  }

  hitSpark(x: number, y: number, color: number): void {
    this.impact(x, y, color);
  }

  static colorToCss(color: number): string {
    return cssColor(color);
  }
}
