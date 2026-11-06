import Phaser from 'phaser';
import { COLORS, CSS_COLORS, FONT_FAMILY } from '../game/constants';
import type { TowerConfig } from '../types';
import { audio } from '../systems/audio';

export class TowerCard {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly hotkeyText: Phaser.GameObjects.Text;
  private readonly width: number;
  private readonly height: number;
  readonly tower: TowerConfig;
  private readonly onClick: (towerId: TowerConfig['id']) => void;
  private selected = false;
  private affordable = true;
  private enabled = true;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    tower: TowerConfig,
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: (towerId: TowerConfig['id']) => void,
  ) {
    this.tower = tower;
    this.width = width;
    this.height = height;
    this.onClick = onClick;

    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    const icon = scene.add.image(31, height / 2 + 2, `tower-${tower.id}-base`);
    icon.setScale(0.82);
    this.container.add(icon);

    this.nameText = scene.add.text(58, 13, tower.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.container.add(this.nameText);

    this.costText = scene.add.text(74, 38, `${tower.cost}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.amber,
      fontStyle: 'bold',
    });
    this.container.add(this.costText);

    const creditIcon = scene.add.image(62, 45, 'icon-credit').setScale(0.45).setAlpha(0.8);
    this.container.add(creditIcon);

    this.hotkeyText = scene.add.text(10, 7, tower.hotkey, {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color: CSS_COLORS.cyan,
      backgroundColor: '#071526',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    });
    this.container.add(this.hotkeyText);

    this.hit = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    this.hit.setInteractive({ useHandCursor: true });
    this.container.add(this.hit);
    this.hit.on('pointerover', () => {
      if (!this.enabled) return;
      this.hovered = true;
      this.redraw();
    });
    this.hit.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
    this.hit.on('pointerdown', () => {
      if (!this.enabled) return;
      audio.play('click');
      this.onClick(this.tower.id);
    });

    this.redraw();
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.redraw();
  }

  setAffordable(affordable: boolean): void {
    this.affordable = affordable;
    this.redraw();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.hit.setInteractive({ useHandCursor: true });
    } else {
      this.hovered = false;
      this.hit.disableInteractive();
    }
    this.container.setAlpha(enabled ? 1 : 0.45);
    this.redraw();
  }

  private redraw(): void {
    const accent = this.tower.accent;
    const fill = this.selected
      ? 0x152a3d
      : this.hovered && this.enabled
        ? COLORS.panelHover
        : COLORS.panelLight;
    const border = this.selected ? accent : this.affordable ? COLORS.lineBright : COLORS.redDark;
    this.bg.clear();
    this.bg.fillStyle(fill, 0.94);
    this.bg.fillRoundedRect(0, 0, this.width, this.height, 8);
    this.bg.lineStyle(this.selected ? 2 : 1, border, this.selected ? 0.95 : 0.7);
    this.bg.strokeRoundedRect(0.5, 0.5, this.width - 1, this.height - 1, 8);
    this.bg.lineStyle(2, accent, this.affordable ? 0.75 : 0.2);
    this.bg.beginPath();
    this.bg.moveTo(8, 1.5);
    this.bg.lineTo(28, 1.5);
    this.bg.strokePath();
    this.nameText.setAlpha(this.affordable ? 1 : 0.55);
    this.costText.setColor(this.affordable ? CSS_COLORS.amber : CSS_COLORS.red);
    this.costText.setAlpha(this.affordable ? 1 : 0.7);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
