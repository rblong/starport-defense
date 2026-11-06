import Phaser from 'phaser';
import { COLORS, CSS_COLORS, FONT_FAMILY } from '../game/constants';
import { audio } from '../systems/audio';

export interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  subLabel?: string;
  accent?: number;
  fontSize?: number;
  subFontSize?: number;
  onClick: () => void;
  enabled?: boolean;
}

export class Button {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly hitRect: Phaser.GameObjects.Rectangle;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly subText: Phaser.GameObjects.Text | null;
  private readonly width: number;
  private readonly height: number;
  private accent: number;
  private enabled: boolean;
  private hovered = false;
  private active = false;
  private enabledApplied = false;
  private currentLabel: string;
  private currentSubLabel: string | undefined;
  private onClick: () => void;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    this.scene = scene;
    this.width = options.width;
    this.height = options.height;
    this.accent = options.accent ?? COLORS.cyan;
    this.enabled = options.enabled ?? true;
    this.onClick = options.onClick;
    this.currentLabel = options.label;
    this.currentSubLabel = options.subLabel;

    this.container = scene.add.container(options.x, options.y);
    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.labelText = scene.add.text(options.width / 2, options.height / 2, options.label, {
      fontFamily: FONT_FAMILY,
      fontSize: `${options.fontSize ?? 17}px`,
      color: CSS_COLORS.text,
      align: 'center',
      fontStyle: 'bold',
    });
    this.labelText.setOrigin(0.5);
    this.container.add(this.labelText);

    if (options.subLabel) {
      this.subText = scene.add.text(options.width / 2, options.height / 2 + 15, options.subLabel, {
        fontFamily: FONT_FAMILY,
        fontSize: `${options.subFontSize ?? 11}px`,
        color: CSS_COLORS.muted,
        align: 'center',
      });
      this.subText.setOrigin(0.5);
      this.container.add(this.subText);
      this.labelText.setY(options.height / 2 - 8);
    } else {
      this.subText = null;
    }

    this.hitRect = scene.add.rectangle(options.width / 2, options.height / 2, options.width, options.height, 0x000000, 0);
    this.hitRect.setInteractive({ useHandCursor: true });
    this.container.add(this.hitRect);

    this.hitRect.on('pointerover', () => {
      if (!this.enabled) return;
      this.hovered = true;
      this.redraw();
    });
    this.hitRect.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
    this.hitRect.on('pointerdown', () => {
      if (!this.enabled) return;
      audio.play('click');
      this.onClick();
    });

    this.redraw();
    this.setEnabled(this.enabled);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabledApplied && this.enabled === enabled) return;
    this.enabledApplied = true;
    this.enabled = enabled;
    if (enabled) {
      this.hitRect.setInteractive({ useHandCursor: true });
    } else {
      this.hovered = false;
      this.hitRect.disableInteractive();
    }
    this.container.setAlpha(enabled ? 1 : 0.45);
    this.redraw();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.redraw();
  }

  setLabel(label: string, subLabel?: string): void {
    const nextSub = subLabel === undefined ? this.currentSubLabel : subLabel;
    if (label === this.currentLabel && nextSub === this.currentSubLabel) return;
    this.currentLabel = label;
    this.currentSubLabel = nextSub;
    this.labelText.setText(label);
    if (this.subText && nextSub !== undefined) {
      this.subText.setText(nextSub);
    }
  }

  setSubLabel(subLabel: string): void {
    if (!this.subText || this.currentSubLabel === subLabel) return;
    this.currentSubLabel = subLabel;
    this.subText.setText(subLabel);
  }

  setAccent(accent: number): void {
    if (this.accent === accent) return;
    this.accent = accent;
    this.redraw();
  }

  setOnClick(onClick: () => void): void {
    this.onClick = onClick;
  }

  private redraw(): void {
    const color = this.enabled ? this.accent : COLORS.dim;
    const borderAlpha = this.enabled ? (this.hovered || this.active ? 0.95 : 0.4) : 0.25;
    const fill = this.active
      ? 0x162b3f
      : this.hovered && this.enabled
        ? COLORS.panelHover
        : COLORS.panelLight;

    this.bg.clear();
    this.bg.fillStyle(fill, 0.94);
    this.bg.fillRoundedRect(0, 0, this.width, this.height, 8);
    this.bg.lineStyle(this.active ? 2 : 1, color, borderAlpha);
    this.bg.strokeRoundedRect(0.5, 0.5, this.width - 1, this.height - 1, 8);
    // A tiny corner accent makes the buttons feel part of the HUD.
    this.bg.lineStyle(2, color, this.enabled ? 0.7 : 0.2);
    this.bg.beginPath();
    this.bg.moveTo(8, 1.5);
    this.bg.lineTo(28, 1.5);
    this.bg.strokePath();
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
