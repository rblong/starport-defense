import Phaser from 'phaser';
import { generateTextures } from '../render/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    try {
      generateTextures(this);
    } catch (error) {
      console.error('[Starport] texture generation failed', error);
      const fatal = document.getElementById('fatal-message');
      if (fatal) fatal.style.display = 'flex';
      return;
    }

    const bootMessage = document.getElementById('boot-message');
    if (bootMessage) {
      bootMessage.style.opacity = '0';
      window.setTimeout(() => bootMessage.remove(), 420);
    }

    this.scene.start('MenuScene');
  }
}
