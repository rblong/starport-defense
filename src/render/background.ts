import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants';

export interface BackgroundLayers {
  update(delta: number, reducedMotion: boolean): void;
  destroy(): void;
}

export function createBackground(scene: Phaser.Scene): BackgroundLayers {
  const nebula = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'nebula');
  nebula.setDepth(-10);
  nebula.setAlpha(0.9);

  const far = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'starfield');
  far.setDepth(-9);
  far.setAlpha(0.46);
  far.setTileScale(1.6, 1.6);

  const near = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'starfield');
  near.setDepth(-8);
  near.setAlpha(0.72);
  near.setTileScale(1, 1);

  const vignette = scene.add.graphics().setDepth(90);
  vignette.fillStyle(0x02040a, 0.35);
  vignette.fillRect(0, 0, GAME_WIDTH, 90);
  vignette.fillRect(0, GAME_HEIGHT - 100, GAME_WIDTH, 100);
  vignette.fillStyle(0x02040a, 0.14);
  vignette.fillRect(0, 0, 120, GAME_HEIGHT);
  vignette.fillRect(GAME_WIDTH - 120, 0, 120, GAME_HEIGHT);

  let farOffset = 0;
  let nearOffset = 0;

  return {
    update(delta: number, reducedMotion: boolean) {
      if (reducedMotion) return;
      farOffset += delta * 0.0012;
      nearOffset += delta * 0.003;
      far.tilePositionX = farOffset;
      far.tilePositionY = farOffset * 0.35;
      near.tilePositionX = nearOffset;
      near.tilePositionY = -nearOffset * 0.2;
    },
    destroy() {
      nebula.destroy();
      far.destroy();
      near.destroy();
      vignette.destroy();
    },
  };
}

export function createMenuBackdrop(scene: Phaser.Scene): BackgroundLayers {
  const nebula = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'nebula');
  nebula.setDepth(-10);
  nebula.setAlpha(0.9);

  const stars = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'starfield');
  stars.setDepth(-9);
  stars.setAlpha(0.8);

  const core = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'core');
  core.setDepth(-8);
  core.setScale(1.55);
  core.setAlpha(0.22);
  core.setBlendMode(Phaser.BlendModes.ADD);

  const glow = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'glow');
  glow.setDepth(-7);
  glow.setScale(4.2);
  glow.setTint(0x1c5c8f);
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.setAlpha(0.55);

  let offset = 0;
  return {
    update(delta: number, reducedMotion: boolean) {
      if (!reducedMotion) {
        offset += delta * 0.002;
        stars.tilePositionX = offset;
        stars.tilePositionY = offset * 0.25;
        core.rotation += delta * 0.00005;
      }
    },
    destroy() {
      nebula.destroy();
      stars.destroy();
      core.destroy();
      glow.destroy();
    },
  };
}
