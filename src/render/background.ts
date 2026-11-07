import Phaser from 'phaser';
import { createOrbitalMenu } from './orbitalMenu';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants';

export interface BackgroundLayers {
  update(delta: number, reducedMotion: boolean): void;
  destroy(): void;
}

export function createBackground(scene: Phaser.Scene, worldWidth = GAME_WIDTH): BackgroundLayers {
  const nebulae = [worldWidth * 0.25, worldWidth * 0.75].map((x) => {
    const nebula = scene.add.image(x, GAME_HEIGHT / 2, 'nebula');
    nebula.setDepth(-10);
    nebula.setAlpha(0.85);
    return nebula;
  });

  const far = scene.add.tileSprite(worldWidth / 2, GAME_HEIGHT / 2, worldWidth, GAME_HEIGHT, 'starfield');
  far.setDepth(-9);
  far.setAlpha(0.46);
  far.setTileScale(1.6, 1.6);

  const near = scene.add.tileSprite(worldWidth / 2, GAME_HEIGHT / 2, worldWidth, GAME_HEIGHT, 'starfield');
  near.setDepth(-8);
  near.setAlpha(0.72);
  near.setTileScale(1, 1);

  const vignette = scene.add.graphics().setDepth(90);
  vignette.fillStyle(0x02040a, 0.35);
  vignette.fillRect(0, 0, worldWidth, 90);
  vignette.fillRect(0, GAME_HEIGHT - 100, worldWidth, 100);
  vignette.fillStyle(0x02040a, 0.14);
  vignette.fillRect(0, 0, 120, GAME_HEIGHT);
  vignette.fillRect(worldWidth - 120, 0, 120, GAME_HEIGHT);

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
      for (const nebula of nebulae) nebula.destroy();
      far.destroy();
      near.destroy();
      vignette.destroy();
    },
  };
}

export function createMenuBackdrop(scene: Phaser.Scene): BackgroundLayers {
  if (scene.textures.exists('battlecruiser-hero') && scene.textures.exists('earth-map')) return createOrbitalMenu(scene);
  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'terran-menu').setDepth(-10);
  image.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
  const shade = scene.add.graphics().setDepth(-8);
  shade.fillStyle(0x03080c, 0.5); shade.fillRect(0,0,480,GAME_HEIGHT);
  shade.fillStyle(0x050b10, 0.25); shade.fillRect(480,0,100,GAME_HEIGHT);
  // A subdued metal frame keeps menu controls visually grounded.
  shade.fillStyle(0x202b31, 0.7); shade.fillRect(60,78,400,574);
  shade.fillStyle(0x0a1116, 0.87); shade.fillRect(64,82,392,566);
  shade.lineStyle(1,0x596a6c,0.65); shade.strokeRect(60,78,400,574);
  for (const x of [69,450]) for(const y of [88,642]) {
    shade.fillStyle(0x87958b); shade.fillCircle(x,y,2.5);
    shade.lineStyle(1,0x0b1319); shade.lineBetween(x-2,y,x+2,y);
  }
  const stars = scene.add.tileSprite(GAME_WIDTH/2,GAME_HEIGHT/2,GAME_WIDTH,GAME_HEIGHT,'starfield').setDepth(-9).setAlpha(0.09);
  let offset=0;
  return { update(delta,reducedMotion) { if(!reducedMotion) { offset+=delta*0.0004;stars.tilePositionX=offset; } }, destroy() {image.destroy();shade.destroy();stars.destroy();} };
}
