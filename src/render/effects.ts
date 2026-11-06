import Phaser from 'phaser';
import { CSS_COLORS, FONT_FAMILY, RENDER_SCALE } from '../game/constants';
import { gameBus } from '../events';

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
    this.sparkBurst(x, y, color, Math.round(12 * scale), 190 * scale);
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

  floatingText(x: number, y: number, text: string, color: string = CSS_COLORS.amber): void {
    const label = this.scene.add.text(x, y, text, {
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
