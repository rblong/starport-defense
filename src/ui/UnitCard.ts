import Phaser from 'phaser';
import { fitUnitIcon, unitTextureKey } from '../assets/unitTextures';
import { COLORS, CSS_COLORS, FONT_FAMILY, FONT_MONO } from '../game/constants';
import type { UnitConfig, UnitId } from '../types';

/**
 * Manufacturing card. Clicking it spends crystals and queues the unit; the
 * actual deployment happens from the ready tray after production completes.
 */
export class UnitCard {
  readonly container: Phaser.GameObjects.Container;
  readonly unit: UnitConfig;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly buildText: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly width: number;
  private readonly height: number;
  private readonly onClick: (unitId: UnitId) => void;
  private affordable = true;
  private enabled = true;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    unit: UnitConfig,
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: (unitId: UnitId) => void,
  ) {
    this.unit = unit;
    this.width = width;
    this.height = height;
    this.onClick = onClick;

    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.icon = scene.add.image(width / 2, 34, unitTextureKey(scene, unit.id));
    fitUnitIcon(this.icon, unit.id === 'battlecruiser' ? 58 : unit.id === 'tank' ? 48 : unit.id === 'goliath' ? 40 : 31);
    this.container.add(this.icon);

    this.nameText = scene.add.text(10, 61, unit.name, {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.container.add(this.nameText);

    const crystal = scene.add.image(14, 89, 'icon-crystal').setScale(0.3).setAlpha(0.85);
    this.container.add(crystal);
    this.costText = scene.add.text(25, 81, `${unit.cost}`, {
      fontFamily: FONT_MONO,
      fontSize: '13px',
      color: CSS_COLORS.amber,
      fontStyle: 'bold',
    });
    this.container.add(this.costText);

    this.buildText = scene.add.text(width - 8, 84, `${unit.buildTime}s`, {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: CSS_COLORS.muted,
    });
    this.buildText.setOrigin(1, 0);
    this.container.add(this.buildText);

    const hotkey = scene.add.text(9, 7, unit.hotkey, {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color: CSS_COLORS.cyan,
      backgroundColor: '#071526',
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    });
    this.container.add(hotkey);

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
      this.onClick(this.unit.id);
    });

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
    const accent = this.unit.accent;
    const fill = this.hovered && this.enabled ? COLORS.panelHover : COLORS.panelLight;
    const border = this.affordable ? COLORS.lineBright : COLORS.redDark;
    this.bg.clear();
    this.bg.fillStyle(fill, 0.94);
    this.bg.fillRoundedRect(0, 0, this.width, this.height, 4);
    this.bg.fillStyle(0x1e2b36, 1); this.bg.fillRect(4, 4, this.width - 8, 52);
    this.bg.lineStyle(1, 0x3a4d59, 0.6);
    this.bg.lineBetween(8, 76, this.width - 8, 76);
    this.bg.lineStyle(1, accent, 0.16);
    this.bg.strokeCircle(this.width / 2, 32, 21);
    this.bg.lineBetween(this.width / 2 - 28, 32, this.width / 2 + 28, 32);
    this.bg.lineStyle(1, border, 0.8);
    this.bg.strokeRoundedRect(0.5, 0.5, this.width - 1, this.height - 1, 4);
    this.bg.lineStyle(2, accent, this.affordable ? 0.8 : 0.25);
    this.bg.beginPath();
    this.bg.moveTo(8, 1.5);
    this.bg.lineTo(36, 1.5);
    this.bg.strokePath();
    this.nameText.setAlpha(this.affordable ? 1 : 0.55);
    this.costText.setColor(this.affordable ? CSS_COLORS.amber : CSS_COLORS.red);
    this.costText.setAlpha(this.affordable ? 1 : 0.7);
    this.icon.setAlpha(this.affordable ? 1 : 0.5);
  }
}
