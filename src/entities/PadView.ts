import Phaser from 'phaser';
import { DEPTH } from '../game/constants';

export class PadView {
  readonly image: Phaser.GameObjects.Image;
  readonly index: number;
  readonly x: number;
  readonly y: number;

  constructor(scene: Phaser.Scene, index: number, x: number, y: number) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.image = scene.add.image(x, y, 'pad');
    this.image.setDepth(DEPTH.pads);
    this.image.setAlpha(0.72);
  }

  setBuildHighlight(active: boolean): void {
    this.image.setTexture(active ? 'pad-hover' : 'pad');
    this.image.setAlpha(active ? 1 : 0.72);
  }

  setHover(hovered: boolean): void {
    if (hovered) {
      this.image.setAlpha(1);
      this.image.setScale(1.06);
    } else {
      this.image.setAlpha(0.72);
      this.image.setScale(1);
    }
  }

  setOccupied(occupied: boolean): void {
    this.image.setVisible(!occupied);
  }
}
