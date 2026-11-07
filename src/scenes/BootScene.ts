import Phaser from 'phaser';
import { loadLocalAssetPack } from '../assets/localPack';
import { generateTextures } from '../render/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('terran-menu', `${import.meta.env.BASE_URL}assets/art/terran-battlecruiser-menu.png`);
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

    void this.startAfterLocalAssets();
  }

  private async startAfterLocalAssets(): Promise<void> {
    await loadLocalAssetPack(this);
    const bootMessage = document.getElementById('boot-message');
    if (bootMessage) {
      bootMessage.style.opacity = '0';
      window.setTimeout(() => bootMessage.remove(), 420);
    }
    this.scene.start('MenuScene');
  }
}
