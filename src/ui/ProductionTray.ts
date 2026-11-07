import Phaser from 'phaser';
import { fitUnitIcon, unitTextureKey } from '../assets/unitTextures';
import {
  COLORS,
  CSS_COLORS,
  FONT_FAMILY,
  FONT_MONO,
  PRODUCTION_QUEUE_LIMIT,
  READY_UNIT_LIMIT,
} from '../game/constants';
import { UNIT_MAP } from '../data/towers';
import type { ProductionSnapshot, UnitId } from '../types';

export interface ProductionTrayCallbacks {
  isDeployAllowed: () => boolean;
  onDrag: (unitId: UnitId, pointerX: number, pointerY: number) => void;
  onDrop: (unitId: UnitId, pointerX: number, pointerY: number) => void;
  onBeginDeploy: (unitId: UnitId) => void;
}

interface ReadySlot {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
}

interface DragState {
  unitId: UnitId;
  slotIndex: number;
  startX: number;
  startY: number;
  dragging: boolean;
  ghost: Phaser.GameObjects.Image | null;
}

const PANEL_WIDTH = 192;
const SLOT_SIZE = 44;

/**
 * Compact bottom-bar production panel. The left side shows the active
 * production and queue count; the bottom row shows three draggable ready units.
 */
export class ProductionTray {
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly callbacks: ProductionTrayCallbacks;
  private readonly activeIcon: Phaser.GameObjects.Image;
  private readonly activeName: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly queueText: Phaser.GameObjects.Text;
  private readonly readyLabel: Phaser.GameObjects.Text;
  private readonly slots: ReadySlot[] = [];
  private readonly slotTypes: Array<UnitId | null> = [null, null, null];
  private snapshot: ProductionSnapshot = { active: null, queue: [], ready: [] };
  private drag: DragState | null = null;

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.drag) return;
    const dx = pointer.x - this.drag.startX;
    const dy = pointer.y - this.drag.startY;
    if (!this.drag.dragging && Math.hypot(dx, dy) < 6) return;
    if (!this.drag.dragging) {
      this.drag.dragging = true;
      this.drag.ghost?.setVisible(true);
    }
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.drag.ghost?.setPosition(point.x, point.y);
    this.callbacks.onDrag(this.drag.unitId, pointer.x, pointer.y);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    drag.ghost?.destroy();
    this.slots[drag.slotIndex]?.icon.setAlpha(1);
    if (drag.dragging) {
      this.callbacks.onDrop(drag.unitId, pointer.x, pointer.y);
    } else {
      this.callbacks.onBeginDeploy(drag.unitId);
    }
  };

  constructor(scene: Phaser.Scene, x: number, y: number, callbacks: ProductionTrayCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = scene.add.container(x, y).setDepth(10);

    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.panelLight, 0.94);
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, 112, 8);
    bg.lineStyle(1, COLORS.lineBright, 0.7);
    bg.strokeRoundedRect(0.5, 0.5, PANEL_WIDTH - 1, 111, 8);
    this.container.add(bg);

    this.container.add(
      scene.add.text(10, 7, '生产 / 部署', {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: CSS_COLORS.cyan,
        fontStyle: 'bold',
      }),
    );
    this.readyLabel = scene.add.text(182, 7, `待部署 0/${READY_UNIT_LIMIT}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: CSS_COLORS.cyan,
    });
    this.readyLabel.setOrigin(1, 0);
    this.container.add(this.readyLabel);

    this.activeIcon = scene.add.image(18, 36, unitTextureKey(scene, 'marine'));
    this.activeIcon.setScale(0.36);
    this.activeIcon.setVisible(false);
    this.container.add(this.activeIcon);

    this.activeName = scene.add.text(34, 24, '空闲', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });
    this.container.add(this.activeName);

    this.progress = scene.add.graphics();
    this.container.add(this.progress);

    this.queueText = scene.add.text(34, 49, `队列 0/${PRODUCTION_QUEUE_LIMIT}`, {
      fontFamily: FONT_MONO,
      fontSize: '8px',
      color: CSS_COLORS.dim,
    });
    this.container.add(this.queueText);

    for (let i = 0; i < READY_UNIT_LIMIT; i++) {
      const slot = scene.add.container(12 + i * 57, 62);
      const slotBg = scene.add.graphics();
      slotBg.fillStyle(0x071322, 0.9);
      slotBg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 5);
      slotBg.lineStyle(1, COLORS.line, 0.8);
      slotBg.strokeRoundedRect(0.5, 0.5, SLOT_SIZE - 1, SLOT_SIZE - 1, 5);
      slot.add(slotBg);
      const icon = scene.add.image(SLOT_SIZE / 2, SLOT_SIZE / 2, unitTextureKey(scene, 'marine'));
      icon.setScale(0.38);
      icon.setVisible(false);
      slot.add(icon);
      const hit = scene.add.rectangle(SLOT_SIZE / 2, SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      slot.add(hit);
      hit.on('pointerdown', () => this.beginDrag(i));
      this.container.add(slot);
      this.slots.push({ container: slot, bg: slotBg, icon, hit });
    }
  }

  update(snapshot: ProductionSnapshot): void {
    this.snapshot = snapshot;

    this.progress.clear();
    const active = snapshot.active;
    if (active) {
      this.activeIcon.setTexture(unitTextureKey(this.scene, active.typeId));
      fitUnitIcon(this.activeIcon, 25);
      this.activeIcon.setVisible(true);
      this.activeName.setText(
        `${UNIT_MAP[active.typeId].name} · ${Math.max(0, active.remaining).toFixed(1)}s`,
      );
      this.activeName.setColor(CSS_COLORS.text);
      const ratio = active.duration > 0 ? 1 - active.remaining / active.duration : 1;
      this.progress.fillStyle(0x071322, 1);
      this.progress.fillRoundedRect(34, 42, 146, 4, 2);
      this.progress.fillStyle(COLORS.cyan, 0.85);
      this.progress.fillRoundedRect(34, 31, Math.max(0, Math.min(1, ratio)) * 116, 4, 2);
    } else {
      this.activeIcon.setVisible(false);
      this.activeName.setText('空闲');
      this.activeName.setColor(CSS_COLORS.muted);
      this.progress.clear();
    }
    this.queueText.setText(`队列 ${(active ? 1 : 0) + snapshot.queue.length}/${PRODUCTION_QUEUE_LIMIT}`);
    this.readyLabel.setText(`待部署 ${snapshot.ready.length}/${READY_UNIT_LIMIT}`);

    for (let i = 0; i < this.slots.length; i++) {
      const typeId = snapshot.ready[i] ?? null;
      if (this.slotTypes[i] === typeId) continue;
      this.slotTypes[i] = typeId;
      const slot = this.slots[i]!;
      if (typeId) {
        slot.icon.setTexture(unitTextureKey(this.scene, typeId));
        fitUnitIcon(slot.icon, typeId === 'battlecruiser' ? 36 : 29);
        slot.icon.setVisible(true);
        slot.hit.setInteractive({ useHandCursor: true });
        slot.bg.clear();
        slot.bg.fillStyle(COLORS.panelHover, 0.95);
        slot.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 5);
        slot.bg.lineStyle(1.5, UNIT_MAP[typeId].accent, 0.85);
        slot.bg.strokeRoundedRect(0.5, 0.5, SLOT_SIZE - 1, SLOT_SIZE - 1, 5);
      } else {
        slot.icon.setVisible(false);
        slot.hit.disableInteractive();
        slot.bg.clear();
        slot.bg.fillStyle(0x071322, 0.9);
        slot.bg.fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 5);
        slot.bg.lineStyle(1, COLORS.line, 0.8);
        slot.bg.strokeRoundedRect(0.5, 0.5, SLOT_SIZE - 1, SLOT_SIZE - 1, 5);
      }
    }
  }

  private beginDrag(index: number): void {
    if (!this.callbacks.isDeployAllowed()) return;
    const unitId = this.snapshot.ready[index];
    if (!unitId || this.drag) return;
    const pointer = this.scene.input.activePointer;
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const ghost = this.scene.add.image(point.x, point.y, unitTextureKey(this.scene, unitId));
    fitUnitIcon(ghost, 42);
    ghost.setDepth(300);
    ghost.setAlpha(0.9);
    ghost.setVisible(false);
    this.drag = {
      unitId,
      slotIndex: index,
      startX: pointer.x,
      startY: pointer.y,
      dragging: false,
      ghost,
    };
    this.slots[index]?.icon.setAlpha(0.35);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerup', this.handlePointerUp);
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.drag?.ghost?.destroy();
    this.drag = null;
    this.container.destroy(true);
  }
}
