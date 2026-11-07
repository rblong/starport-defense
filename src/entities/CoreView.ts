import Phaser from 'phaser';
import { COLORS, DEPTH } from '../game/constants';

export class CoreView {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly core: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly ringOuter: Phaser.GameObjects.Image;
  private damageFlashUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    this.container.setDepth(DEPTH.core);

    this.glow = scene.add.image(0, 0, 'glow');
    this.glow.setTint(COLORS.cyan);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setScale(1.2);
    this.glow.setAlpha(0.5);
    this.container.add(this.glow);

    this.ring = scene.add.image(0, 0, 'ring');
    this.ring.setTint(COLORS.cyan);
    this.ring.setBlendMode(Phaser.BlendModes.ADD);
    this.ring.setScale(1.08);
    this.ring.setAlpha(0.18);
    this.container.add(this.ring);

    this.ringOuter = scene.add.image(0, 0, 'ring');
    this.ringOuter.setTint(COLORS.cyanDim);
    this.ringOuter.setBlendMode(Phaser.BlendModes.ADD);
    this.ringOuter.setScale(1.55);
    this.ringOuter.setAlpha(0.09);
    this.container.add(this.ringOuter);

    this.core = scene.add.image(0, 0, scene.textures.exists('sc-command-center') ? 'sc-command-center' : 'core');
    this.container.add(this.core);
    const label = scene.add.text(0, 70, 'COMMAND / 指挥中心', { fontFamily: 'Consolas, Microsoft YaHei, monospace', fontSize: '10px', color: '#b1c9c9', backgroundColor: '#14232b', padding: {left: 6, right: 6, top: 3, bottom: 3} }).setOrigin(0.5, 0);
    this.container.add(label);

    scene.tweens.add({
      targets: this.core,
      scale: 1.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    scene.tweens.add({
      targets: this.ring,
      rotation: Math.PI * 2,
      duration: 16000,
      repeat: -1,
    });
    scene.tweens.add({
      targets: this.ringOuter,
      rotation: -Math.PI * 2,
      duration: 26000,
      repeat: -1,
    });
    scene.tweens.add({
      targets: this.glow,
      alpha: 0.23,
      scale: 2.05,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  damageFlash(): void {
    this.damageFlashUntil = this.scene.time.now + 140;
    this.core.setTint(0xff6b7a);
    this.ring.setTint(0xff5a6a);
    this.scene.time.delayedCall(150, () => {
      if (this.scene.time.now >= this.damageFlashUntil - 10) {
        this.core.clearTint();
        this.ring.setTint(COLORS.cyan);
      }
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
