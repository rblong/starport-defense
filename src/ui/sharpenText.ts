import Phaser from 'phaser';
import { RENDER_SCALE } from '../game/constants';

/**
 * The scenes are laid out in 1280x720 logical units but the camera renders at
 * RENDER_SCALE. Text textures need an equal resolution bump or they will look
 * soft when the camera zooms/upscales them.
 */
export function sharpenTextTree(gameObject: Phaser.GameObjects.GameObject): void {
  if (gameObject instanceof Phaser.GameObjects.Text) {
    gameObject.setResolution(RENDER_SCALE);
    return;
  }
  if (gameObject instanceof Phaser.GameObjects.Container) {
    for (const child of gameObject.list) {
      sharpenTextTree(child);
    }
  }
}

export function sharpenSceneText(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    sharpenTextTree(child);
  }
}
