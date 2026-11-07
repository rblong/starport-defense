import Phaser from 'phaser';
import { WORLD_WIDTH, BATTLE_TOP, BATTLE_BOTTOM, GAME_WIDTH, FONT_MONO } from '../game/constants';
import { LEVEL_ONE, pathToPixels, gridToPixel } from '../data/level01';
import { gameBus } from '../events';

export class TacticalMap {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private viewX = 0;
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(10);
    scene.add.text(24, 599, 'SECTOR 07 / 战术地图', { fontFamily: FONT_MONO, fontSize: '9px', color: '#a4bac1' }).setDepth(11);
    const hit = scene.add.rectangle(94, 657, 148, 84, 0, 0).setDepth(12).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const p = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const targetX = Math.max(0, Math.min(WORLD_WIDTH - GAME_WIDTH, (p.x - 20) / 148 * WORLD_WIDTH - GAME_WIDTH / 2));
      gameBus.emit('ui:panCamera', { delta: targetX - this.viewX });
    });
    this.update(0);
  }
  update(viewX: number): void {
    this.viewX = viewX;
    const g = this.graphics; g.clear();
    g.fillStyle(0x0a141e); g.fillRoundedRect(16, 594, 156, 112, 4);
    g.lineStyle(1, 0x344956); g.strokeRoundedRect(16, 594, 156, 112, 4);
    const px = (x: number) => 22 + x / WORLD_WIDTH * 144;
    const py = (y: number) => 621 + (y - BATTLE_TOP) / (BATTLE_BOTTOM - BATTLE_TOP) * 72;
    g.lineStyle(3, 0x486473);
    const route = pathToPixels(LEVEL_ONE);
    for (let i = 1; i < route.length; i++) g.lineBetween(px(route[i - 1]!.x), py(route[i - 1]!.y), px(route[i]!.x), py(route[i]!.y));
    g.fillStyle(0x75b9b3, 0.8);
    for (const pos of LEVEL_ONE.pads) { const p = gridToPixel(pos); g.fillRect(px(p.x) - 1, py(p.y) - 1, 2, 2); }
    g.fillStyle(0x8fe9e1, 0.08); g.fillRect(px(viewX), 619, 144 * GAME_WIDTH / WORLD_WIDTH, 78);
    g.lineStyle(1, 0x93c5c8, 0.8); g.strokeRect(px(viewX), 619, 144 * GAME_WIDTH / WORLD_WIDTH, 78);
  }
}
