import Phaser from 'phaser';
import { DEPTH } from '../game/constants';

export class PadView {
  readonly image: Phaser.GameObjects.Image;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  private readonly classic: boolean;
  private highlighted = false;
  private hovered = false;

  constructor(scene: Phaser.Scene, index: number, x: number, y: number) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.classic = scene.textures.exists('sc-terrain-classic');
    if (this.classic && !scene.textures.exists('field-position')) {
      for (const active of [false, true]) {
        const g=scene.add.graphics();g.lineStyle(active ? 1.5 : 1, active ? 0x8ee8d2 : 0xccc5a2, 1);
        const a=active ? 12 : 18,b=64-a,length=7;
        for(const [px,py,sx,sy] of [[a,a,1,1],[b,a,-1,1],[a,b,1,-1],[b,b,-1,-1]]) {
          g.lineBetween(px!,py!+sy!*length,px!,py!);g.lineBetween(px!,py!,px!+sx!*length,py!);
        }
        g.generateTexture(active ? 'field-position-active' : 'field-position',64,64);g.destroy();
      }
    }
    this.image = scene.add.image(x, y, this.classic ? 'field-position' : 'pad');
    this.image.setDepth(DEPTH.pads);
    this.image.setAlpha(this.classic ? 0.42 : 0.72);
  }

  setBuildHighlight(active: boolean): void {
    this.highlighted=active;
    this.refresh();
  }

  setHover(hovered: boolean): void {
    this.hovered=hovered;
    this.refresh();
  }

  private refresh(): void {
    const active=this.highlighted || this.hovered;
    this.image.setTexture(this.classic ? (active ? 'field-position-active' : 'field-position') : (active ? 'pad-hover' : 'pad'));
    this.image.setAlpha(active ? 1 : this.classic ? 0.42 : 0.72);
    this.image.setScale(this.hovered ? 1.04 : 1);
  }

  setOccupied(occupied: boolean): void {
    this.image.setVisible(!occupied);
  }
}
