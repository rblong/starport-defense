import Phaser from 'phaser';
import {
  BATTLE_BOTTOM,
  BATTLE_TOP,
  AUTO_NEXT_DELAY,
  COLORS,
  DEPTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_FRAME_DELTA,
  MAX_STEPS_PER_FRAME,
  RENDER_SCALE,
  SKILL_COOLDOWN,
  SKILL_DAMAGE,
  SKILL_RADIUS,
  SKILL_TELEGRAPH,
  START_CREDITS,
  START_INTEGRITY,
  STEP_SEC,
  TOTAL_WAVES,
  waveClearBonus,
} from '../game/constants';
import { gameBus } from '../events';
import type {
  EnemyId,
  HudSnapshot,
  ModeSnapshot,
  ResultPayload,
  SkillStatus,
  Speed,
  TargetMode,
  TowerId,
  TowerLevel,
  TowerSelection,
  WaveBannerPayload,
} from '../types';
import { buildPath, samplePath, type PathData } from '../domain/path';
import { pickTarget } from '../domain/targeting';
import { applyArmor, chainDamage, effectiveSlow, shouldApplySlow } from '../domain/combat';
import { expandWave, type SpawnEvent } from '../domain/waves';
import { computeScore } from '../domain/score';
import { calculateSellValue } from '../domain/economy';
import { ENEMY_MAP } from '../data/enemies';
import { getWaveForIndex } from '../data/waves';
import { TOWER_MAP, getTowerStats } from '../data/towers';
import { LEVEL_ONE, gridToPixel, pathToPixels } from '../data/level01';
import { createBackground, type BackgroundLayers } from '../render/background';
import { Effects } from '../render/effects';
import { EnemyView } from '../entities/EnemyView';
import { TowerView } from '../entities/TowerView';
import { CoreView } from '../entities/CoreView';
import { PadView } from '../entities/PadView';
import { sharpenSceneText } from '../ui/sharpenText';
import { audio } from '../systems/audio';
import { loadSettings, recordRun } from '../systems/save';
import type {
  BoltProjectile,
  EnemyRuntime,
  PendingImpact,
  ShellProjectile,
  SpawnSpec,
  TowerRuntime,
  ProjectileRuntime,
} from '../game/runtime';

interface BuildCandidate {
  towerId: TowerId;
  pad: PadView;
  valid: boolean;
}

export class GameScene extends Phaser.Scene {
  private background!: BackgroundLayers;
  private effects!: Effects;
  private coreView!: CoreView;
  private pads: PadView[] = [];
  private towers: TowerRuntime[] = [];
  private enemies: EnemyRuntime[] = [];
  private deathQueue: EnemyRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private pendingImpacts: PendingImpact[] = [];
  private pendingSpawns: SpawnEvent[] = [];
  private spawnCursor = 0;
  private waveElapsed = 0;
  private waveActive = false;
  private currentWaveIndex = 0;
  private wavesCleared = 0;
  private endless = false;
  private autoNextWave = false;
  private autoNextRemaining = 0;
  private lastAutoNextEmitAt = -1;
  private phase: 'prepare' | 'wave' | 'victory' | 'defeat' = 'prepare';
  private paused = false;
  private speed: Speed = 1;
  private credits = START_CREDITS;
  private integrity = START_INTEGRITY;
  private kills = 0;
  private runTime = 0;
  private skillReadyAt = 0;
  private skillAiming = false;
  private buildTowerId: TowerId | null = null;
  private selectedTowerId: number | null = null;
  private hoveredPadIndex: number | null = null;
  private pathData!: PathData;
  private pathPixels: Array<{ x: number; y: number }> = [];
  private enemyById = new Map<number, EnemyRuntime>();
  private targetPool: import('../domain/targeting').TargetCandidate[] = [];
  private nextEnemyId = 1;
  private nextTowerId = 1;
  private nextProjectileId = 1;
  private accumulator = 0;
  private hudDirty = true;
  private reducedMotion = false;
  private restarting = false;
  private lastSkillEmitAt = -1;
  private lastSkillReady = true;
  private lastSkillAiming = false;
  private ghostImage!: Phaser.GameObjects.Image;
  private ghostRange!: Phaser.GameObjects.Graphics;
  private selectionRange!: Phaser.GameObjects.Graphics;

  private readonly visibilityHandler = (): void => {
    if (document.visibilityState === 'hidden' && !this.paused && (this.phase === 'prepare' || this.phase === 'wave')) {
      this.pauseGame();
    }
  };

  constructor() {
    super('GameScene');
  }

  init(data?: { endless?: boolean }): void {
    this.endless = data?.endless === true;
  }

  create(): void {
    this.children.removeAll(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.resetRuntimeState();

    const settings = loadSettings();
    this.speed = settings.defaultSpeed;
    this.reducedMotion = settings.reducedMotion;
    this.autoNextWave = settings.autoNextWave;
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setScroll(
      -((RENDER_SCALE - 1) * GAME_WIDTH) / 2,
      -((RENDER_SCALE - 1) * GAME_HEIGHT) / 2,
    );
    this.background = createBackground(this);
    this.effects = new Effects(this, this.reducedMotion);

    this.drawBattlefield();
    this.createPads();
    this.createCore();
    this.createGhostAndRanges();
    this.bindEvents();
    this.bindInput();
    sharpenSceneText(this);

    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    if (this.scene.isActive('UIScene') || this.scene.isPaused('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.launch('UIScene');

    // Ensure the UI receives a complete initial snapshot even if it requests
    // state before the scene launch has fully completed.
    this.time.delayedCall(0, () => this.emitAllState());

    if (import.meta.env.DEV) {
      (window as unknown as { __starportScene?: GameScene }).__starportScene = this;
    }
  }

  update(_time: number, delta: number): void {
    this.background?.update(delta, this.reducedMotion);

    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') {
      return;
    }

    this.tickAutoNext(delta);
    this.accumulator += (Math.min(delta, MAX_FRAME_DELTA * 1000) / 1000) * this.speed;
    let steps = 0;
    while (this.accumulator >= STEP_SEC && steps < MAX_STEPS_PER_FRAME) {
      this.stepSimulation(STEP_SEC);
      this.accumulator -= STEP_SEC;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.emitSkillStatus();
    if (this.hudDirty) this.emitHud();
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private resetRuntimeState(): void {
    this.pads = [];
    this.towers = [];
    this.enemies = [];
    this.deathQueue = [];
    this.projectiles = [];
    this.pendingImpacts = [];
    this.pendingSpawns = [];
    this.spawnCursor = 0;
    this.waveElapsed = 0;
    this.waveActive = false;
    this.currentWaveIndex = 0;
    this.wavesCleared = 0;
    this.phase = 'prepare';
    this.paused = false;
    this.speed = 1;
    this.credits = START_CREDITS;
    this.integrity = START_INTEGRITY;
    this.kills = 0;
    this.runTime = 0;
    this.skillReadyAt = 0;
    this.skillAiming = false;
    this.buildTowerId = null;
    this.selectedTowerId = null;
    this.hoveredPadIndex = null;
    this.enemyById = new Map();
    this.targetPool = [];
    this.nextEnemyId = 1;
    this.nextTowerId = 1;
    this.nextProjectileId = 1;
    this.accumulator = 0;
    this.hudDirty = true;
    this.restarting = false;
    this.autoNextRemaining = 0;
    this.lastAutoNextEmitAt = -1;
    this.lastSkillEmitAt = -1;
    this.lastSkillReady = true;
    this.lastSkillAiming = false;
  }

  private drawBattlefield(): void {
    this.pathPixels = pathToPixels(LEVEL_ONE);
    this.pathData = buildPath(this.pathPixels);

    const grid = this.add.graphics().setDepth(DEPTH.path - 1);
    grid.lineStyle(1, COLORS.cyan, 0.035);
    for (let col = 0; col <= LEVEL_ONE.cols; col++) {
      const x = LEVEL_ONE.origin.x + col * LEVEL_ONE.tileSize;
      grid.beginPath();
      grid.moveTo(x, BATTLE_TOP);
      grid.lineTo(x, BATTLE_BOTTOM);
      grid.strokePath();
    }
    for (let row = 0; row <= LEVEL_ONE.rows; row++) {
      const y = LEVEL_ONE.origin.y + row * LEVEL_ONE.tileSize;
      grid.beginPath();
      grid.moveTo(LEVEL_ONE.origin.x, y);
      grid.lineTo(LEVEL_ONE.origin.x + LEVEL_ONE.cols * LEVEL_ONE.tileSize, y);
      grid.strokePath();
    }

    const path = this.add.graphics().setDepth(DEPTH.path);
    const drawPath = (width: number, color: number, alpha: number) => {
      path.lineStyle(width, color, alpha);
      path.beginPath();
      path.moveTo(this.pathPixels[0]!.x, this.pathPixels[0]!.y);
      for (let i = 1; i < this.pathPixels.length; i++) {
        path.lineTo(this.pathPixels[i]!.x, this.pathPixels[i]!.y);
      }
      path.strokePath();
    };

    drawPath(58, 0x01040a, 0.9);
    drawPath(48, 0x0a1a2f, 1);
    drawPath(2, COLORS.cyan, 0.18);
    drawPath(1, COLORS.cyan, 0.08);

    // Energy nodes along the lane for a little life.
    const dots = this.add.graphics().setDepth(DEPTH.path + 1);
    for (let distance = 24; distance < this.pathData.totalLength; distance += 34) {
      const p = samplePath(this.pathData, distance);
      dots.fillStyle(COLORS.cyan, 0.12);
      dots.fillCircle(p.x, p.y, 1.6);
    }

    // A subtle warning strip at the right edge where the core sits.
    const corePos = gridToPixel(LEVEL_ONE.core);
    const edge = this.add.graphics().setDepth(DEPTH.path + 1);
    edge.lineStyle(1, COLORS.cyan, 0.15);
    edge.strokeCircle(corePos.x, corePos.y, 76);

    const label = this.add.text(LEVEL_ONE.origin.x + 8, BATTLE_TOP + 9, 'NEXUS-7 // 星港防线', {
      fontFamily: '"Cascadia Mono", "Consolas", monospace',
      fontSize: '12px',
      color: '#5b84a8',
      letterSpacing: 2,
    });
    label.setDepth(DEPTH.path + 2);
    label.setAlpha(0.7);
  }

  private createPads(): void {
    this.pads = LEVEL_ONE.pads.map((pos, index) => {
      const pixel = gridToPixel(pos);
      return new PadView(this, index, pixel.x, pixel.y);
    });
    this.refreshPads();
  }

  private createCore(): void {
    const pos = gridToPixel(LEVEL_ONE.core);
    this.coreView = new CoreView(this, pos.x, pos.y);
  }

  private createGhostAndRanges(): void {
    this.selectionRange = this.add.graphics().setDepth(DEPTH.ghost - 2);
    this.ghostRange = this.add.graphics().setDepth(DEPTH.ghost - 1);
    this.ghostImage = this.add.image(0, 0, 'tower-ghost');
    this.ghostImage.setDepth(DEPTH.ghost);
    this.ghostImage.setVisible(false);
    this.ghostImage.setAlpha(0.7);
  }

  private bindEvents(): void {
    gameBus.on('ui:requestState', this.handleRequestState, this);
    gameBus.on('ui:startWave', this.handleStartWave, this);
    gameBus.on('ui:selectBuild', this.handleSelectBuild, this);
    gameBus.on('ui:cancelBuild', this.handleCancelBuild, this);
    gameBus.on('ui:selectTower', this.handleSelectTower, this);
    gameBus.on('ui:upgradeTower', this.handleUpgrade, this);
    gameBus.on('ui:sellTower', this.handleSell, this);
    gameBus.on('ui:setTargetMode', this.handleSetTargetMode, this);
    gameBus.on('ui:toggleSkillAim', this.handleToggleSkillAim, this);
    gameBus.on('ui:cancelSkillAim', this.handleCancelSkillAim, this);
    gameBus.on('ui:togglePause', this.handleTogglePause, this);
    gameBus.on('ui:setSpeed', this.handleSetSpeed, this);
    gameBus.on('ui:setAutoNextWave', this.handleSetAutoNextWave, this);
    gameBus.on('ui:restart', this.handleRestart, this);
    gameBus.on('ui:quitMenu', this.handleQuitMenu, this);
  }

  private bindInput(): void {
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.mouse?.disableContextMenu();
  }

  private handleShutdown(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    gameBus.offContext(this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private readonly handleRequestState = (): void => {
    this.emitAllState();
  };

  private readonly handleStartWave = (): void => {
    this.startWave();
  };

  private readonly handleSelectBuild = (payload: { towerId: TowerId }): void => {
    this.selectBuild(payload.towerId);
  };

  private readonly handleCancelBuild = (): void => {
    this.cancelBuildMode();
  };

  private readonly handleSelectTower = (payload: { towerId: number | null }): void => {
    if (payload.towerId === null) {
      this.selectTower(null);
    } else {
      this.selectTower(payload.towerId);
    }
  };

  private readonly handleUpgrade = (): void => {
    this.upgradeSelected();
  };

  private readonly handleSell = (): void => {
    this.sellSelected();
  };

  private readonly handleSetTargetMode = (payload: { mode: TargetMode }): void => {
    this.setTargetMode(payload.mode);
  };

  private readonly handleToggleSkillAim = (): void => {
    this.toggleSkillAim();
  };

  private readonly handleCancelSkillAim = (): void => {
    this.cancelSkillAim();
  };

  private readonly handleTogglePause = (): void => {
    if (this.paused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  };

  private readonly handleSetSpeed = (payload: { speed: Speed }): void => {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    this.speed = payload.speed;
    audio.play('click');
    this.emitHud(true);
    this.emitMode();
  };

  private readonly handleSetAutoNextWave = (payload: { enabled: boolean }): void => {
    this.autoNextWave = payload.enabled;
    if (!payload.enabled) {
      this.cancelAutoNext();
      return;
    }
    if (this.phase === 'prepare' && this.wavesCleared > 0) {
      this.scheduleAutoNext();
    } else {
      this.emitAutoNextStatus(true);
    }
  };

  private readonly handleRestart = (): void => {
    if (this.restarting) return;
    this.restarting = true;
    this.paused = false;
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.stop('UIScene');
    this.scene.restart({ endless: this.endless });
  };

  private readonly handleQuitMenu = (): void => {
    if (this.restarting) return;
    this.restarting = true;
    this.paused = false;
    if (this.scene.isPaused()) this.scene.resume();
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  };

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (!this.buildTowerId) {
      this.hideBuildGhost();
      return;
    }
    const point = this.pointerToDesign(pointer);
    this.updateBuildGhost(point.x, point.y);
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (pointer.rightButtonDown()) {
      this.cancelAllTemporaryModes();
      return;
    }

    const point = this.pointerToDesign(pointer);
    if (point.y < BATTLE_TOP || point.y > BATTLE_BOTTOM) return;

    if (this.skillAiming) {
      this.castSkill(point.x, point.y);
      return;
    }

    if (this.buildTowerId) {
      const pad = this.findPadAt(point.x, point.y);
      if (pad) {
        this.tryBuild(pad);
      } else {
        this.showToast('请点击可建造位', 'info');
      }
      return;
    }

    const tower = this.findTowerAt(point.x, point.y);
    this.selectTower(tower?.id ?? null);
  };

  private pointerToDesign(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: worldPoint.x, y: worldPoint.y };
  }

  private findPadAt(x: number, y: number): PadView | null {
    let closest: PadView | null = null;
    let bestDistance = 44;
    for (const pad of this.pads) {
      const distance = Math.hypot(pad.x - x, pad.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = pad;
      }
    }
    return closest;
  }

  private findTowerAt(x: number, y: number): TowerRuntime | null {
    let closest: TowerRuntime | null = null;
    let bestDistance = 32;
    for (const tower of this.towers) {
      const distance = Math.hypot(tower.x - x, tower.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = tower;
      }
    }
    return closest;
  }

  private updateBuildGhost(x: number, y: number): void {
    if (!this.buildTowerId) {
      this.hideBuildGhost();
      return;
    }
    const pad = this.findPadAt(x, y);
    if (!pad) {
      this.hoveredPadIndex = null;
      this.hideBuildGhost();
      this.refreshPads();
      return;
    }

    this.hoveredPadIndex = pad.index;
    this.refreshPads();

    const config = TOWER_MAP[this.buildTowerId];
    const stats = config.levels[0];
    const occupied = this.towers.some((tower) => tower.padIndex === pad.index);
    const valid = !occupied && this.credits >= config.cost;
    const color = valid ? config.accent : COLORS.red;

    this.ghostImage.setPosition(pad.x, pad.y);
    this.ghostImage.setTint(color);
    this.ghostImage.setVisible(true);
    this.ghostImage.setAlpha(0.7);
    this.drawRange(this.ghostRange, pad.x, pad.y, stats.range, color, valid ? 0.08 : 0.06);
  }

  private hideBuildGhost(): void {
    this.hoveredPadIndex = null;
    this.ghostImage.setVisible(false);
    this.ghostRange.clear();
    this.refreshPads();
  }

  private cancelAllTemporaryModes(): void {
    if (this.buildTowerId) this.cancelBuildMode();
    if (this.skillAiming) this.cancelSkillAim();
    if (this.selectedTowerId !== null) this.selectTower(null);
  }

  // ---------------------------------------------------------------------------
  // Build / tower actions
  // ---------------------------------------------------------------------------

  private selectBuild(towerId: TowerId): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.buildTowerId === towerId) {
      this.cancelBuildMode();
      return;
    }
    const config = TOWER_MAP[towerId];
    if (this.credits < config.cost) {
      this.showToast('信用点不足', 'error');
      audio.play('error');
      return;
    }
    this.buildTowerId = towerId;
    this.skillAiming = false;
    this.selectTower(null);
    this.refreshPads();
    this.emitMode();
    this.emitSkillStatus();
    audio.play('click');
  }

  private cancelBuildMode(): void {
    if (!this.buildTowerId) return;
    this.buildTowerId = null;
    this.hideBuildGhost();
    this.refreshPads();
    this.emitMode();
  }

  private refreshPads(): void {
    for (const pad of this.pads) {
      const occupied = this.towers.some((tower) => tower.padIndex === pad.index);
      pad.setOccupied(occupied);
      pad.setBuildHighlight(Boolean(this.buildTowerId) && !occupied);
      pad.setHover(this.hoveredPadIndex === pad.index && Boolean(this.buildTowerId));
    }
  }

  private tryBuild(pad: PadView): void {
    const towerId = this.buildTowerId;
    if (!towerId) return;
    if (this.towers.some((tower) => tower.padIndex === pad.index)) {
      this.showToast('该建造位已被占用', 'error');
      audio.play('error');
      return;
    }
    const config = TOWER_MAP[towerId];
    if (this.credits < config.cost) {
      this.showToast('信用点不足', 'error');
      audio.play('error');
      return;
    }

    this.credits -= config.cost;
    const view = new TowerView(this, config, pad.x, pad.y);
    const tower: TowerRuntime = {
      id: this.nextTowerId++,
      typeId: towerId,
      config,
      level: 1,
      padIndex: pad.index,
      x: pad.x,
      y: pad.y,
      cooldown: 0,
      targetId: null,
      totalInvested: config.cost,
      targetMode: 'first',
      view,
    };
    this.towers.push(tower);
    this.buildTowerId = null;
    this.hoveredPadIndex = null;
    this.hideBuildGhost();
    this.refreshPads();
    this.selectTower(tower.id);
    this.effects.ringPulse(pad.x, pad.y, config.accent, 0.2, 0.95, 320);
    this.effects.floatingText(pad.x, pad.y - 28, `-${config.cost}`, '#ff8a8f');
    audio.play('build');
    this.emitHud(true);
  }

  private selectTower(towerId: number | null): void {
    const tower = towerId === null ? null : this.towers.find((item) => item.id === towerId) ?? null;
    this.selectedTowerId = tower?.id ?? null;
    for (const item of this.towers) {
      item.view.setSelected(item.id === this.selectedTowerId);
    }
    this.selectionRange.clear();
    if (tower) {
      const stats = getTowerStats(tower.typeId, tower.level);
      this.drawRange(this.selectionRange, tower.x, tower.y, stats.range, tower.config.accent, 0.055);
      audio.play('click');
    }
    this.emitSelection();
    this.emitMode();
  }

  private upgradeSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) return;
    if (tower.level >= 3) {
      this.showToast('该防御塔已满级', 'info');
      audio.play('error');
      return;
    }
    const cost = tower.config.upgradeCosts[tower.level - 1];
    if (this.credits < cost) {
      this.showToast('信用点不足', 'error');
      audio.play('error');
      return;
    }
    this.credits -= cost;
    tower.totalInvested += cost;
    tower.level = (tower.level + 1) as TowerLevel;
    tower.view.setLevel(tower.level);
    tower.view.upgradeFlash();
    this.effects.ringPulse(tower.x, tower.y, tower.config.accent, 0.25, 1.1, 360);
    this.effects.floatingText(tower.x, tower.y - 28, `-${cost}`, '#ff8a8f');
    audio.play('upgrade');
    this.selectTower(tower.id);
    this.emitHud(true);
  }

  private sellSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) return;
    const refund = calculateSellValue(tower.totalInvested);
    this.credits += refund;
    const index = this.towers.findIndex((item) => item.id === tower.id);
    if (index >= 0) this.towers.splice(index, 1);
    tower.view.destroy();
    this.selectedTowerId = null;
    this.selectionRange.clear();
    this.refreshPads();
    this.effects.ringPulse(tower.x, tower.y, COLORS.amber, 0.2, 0.9, 300);
    this.effects.floatingText(tower.x, tower.y - 28, `+${refund}`, '#ffd278');
    audio.play('sell');
    this.emitSelection();
    this.emitMode();
    this.emitHud(true);
  }

  private setTargetMode(mode: TargetMode): void {
    const tower = this.getSelectedTower();
    if (!tower) return;
    tower.targetMode = mode;
    audio.play('click');
    this.emitSelection();
  }

  private getSelectedTower(): TowerRuntime | null {
    if (this.selectedTowerId === null) return null;
    return this.towers.find((tower) => tower.id === this.selectedTowerId) ?? null;
  }

  private cancelSkillAim(): void {
    if (!this.skillAiming) return;
    this.skillAiming = false;
    this.emitMode();
    this.emitSkillStatus();
  }

  private toggleSkillAim(): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (this.skillAiming) {
      this.cancelSkillAim();
      return;
    }
    if (this.runTime < this.skillReadyAt) {
      this.showToast('轨道轰炸冷却中', 'error');
      audio.play('error');
      return;
    }
    if (this.buildTowerId) this.cancelBuildMode();
    this.selectTower(null);
    this.skillAiming = true;
    this.hideBuildGhost();
    this.emitMode();
    this.emitSkillStatus();
    audio.play('click');
  }

  private castSkill(x: number, y: number): void {
    if (!this.skillAiming || this.runTime < this.skillReadyAt) return;
    this.skillAiming = false;
    this.skillReadyAt = this.runTime + SKILL_COOLDOWN;
    this.pendingImpacts.push({
      at: this.runTime + SKILL_TELEGRAPH,
      x,
      y,
      damage: SKILL_DAMAGE,
      radius: SKILL_RADIUS,
      ignoreArmor: true,
      source: 'orbital',
    });
    this.effects.orbitTelegraph(x, y);
    audio.play('click');
    this.emitMode();
    this.emitSkillStatus();
  }

  // ---------------------------------------------------------------------------
  // Wave / run flow
  // ---------------------------------------------------------------------------

  private startWave(): void {
    if (this.paused || this.phase !== 'prepare') return;
    this.cancelAutoNext();
    const wave = getWaveForIndex(this.wavesCleared + 1);
    if (!wave) return;

    this.currentWaveIndex = wave.index;
    this.waveActive = true;
    this.phase = 'wave';
    this.waveElapsed = 0;
    this.spawnCursor = 0;
    this.pendingSpawns = expandWave(wave);
    this.buildTowerId = null;
    this.skillAiming = false;
    this.hoveredPadIndex = null;
    this.hideBuildGhost();
    this.refreshPads();

    const isBoss = wave.groups.some((group) => group.enemyId === 'boss');
    const banner: WaveBannerPayload = {
      title: isBoss ? '最终波 · 虚空母舰' : `第 ${wave.index} 波`,
      subtitle: isBoss ? '击毁母舰，守住星港' : this.endless ? '无尽虫潮，持续增援' : '虫群信号接近中',
      tone: isBoss ? 'boss' : 'wave',
    };
    gameBus.emit('game:waveBanner', banner);
    audio.play('wave');
    this.emitHud(true);
    this.emitMode();
    this.emitSelection();
  }

  private spawnDueEnemies(dt: number): void {
    if (!this.waveActive) return;
    this.waveElapsed += dt;
    while (
      this.spawnCursor < this.pendingSpawns.length &&
      this.pendingSpawns[this.spawnCursor]!.at <= this.waveElapsed
    ) {
      const spawn = this.pendingSpawns[this.spawnCursor]!;
      this.spawnEnemy(spawn.enemyId, spawn.hpScale);
      this.spawnCursor++;
    }
  }

  private spawnEnemy(enemyId: EnemyId, hpScale: number, distance = 0): EnemyRuntime {
    const config = ENEMY_MAP[enemyId];
    const maxHp = config.isBoss ? config.maxHp : Math.max(1, Math.round(config.maxHp * hpScale));
    const sample = samplePath(this.pathData, distance);
    const view = new EnemyView(this, config, sample.x, sample.y);
    const enemy: EnemyRuntime = {
      id: this.nextEnemyId++,
      config,
      hp: maxHp,
      maxHp,
      distance,
      speed: config.speed,
      slowFactor: 0,
      slowUntil: 0,
      alive: true,
      deathQueued: false,
      leaked: false,
      enraged: false,
      x: sample.x,
      y: sample.y,
      angle: sample.angle,
      sample,
      candidate: {
        id: this.nextEnemyId,
        x: sample.x,
        y: sample.y,
        progress: distance,
        hp: maxHp,
      },
      view,
    };
    // The candidate id must match the enemy id.
    enemy.candidate.id = enemy.id;
    this.enemies.push(enemy);
    this.enemyById.set(enemy.id, enemy);
    view.setTransform(sample.x, sample.y, sample.angle);
    view.setHp(1);
    this.hudDirty = true;

    if (config.isBoss) {
      audio.play('boss');
      this.effects.bossSpawn(960, 300);
      this.emitBossStatus();
    }
    return enemy;
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      if (this.runTime >= enemy.slowUntil && enemy.slowFactor > 0) {
        enemy.slowFactor = 0;
        enemy.view.setSlowed(false);
      }

      if (enemy.config.isBoss && !enemy.enraged && enemy.hp <= enemy.maxHp * 0.5) {
        enemy.enraged = true;
        this.effects.ringPulse(enemy.x, enemy.y, COLORS.magenta, 0.4, 2.2, 700);
        gameBus.emit('game:toast', { message: '母舰进入狂暴状态', tone: 'error' });
      }

      const bossSpeed = enemy.config.isBoss && enemy.enraged ? 1.25 : 1;
      const effectiveSpeed = enemy.speed * bossSpeed * (1 - enemy.slowFactor);
      enemy.distance += effectiveSpeed * dt;
      samplePath(this.pathData, enemy.distance, enemy.sample);
      enemy.x = enemy.sample.x;
      enemy.y = enemy.sample.y;
      enemy.angle = enemy.sample.angle;
      enemy.view.setTransform(enemy.x, enemy.y, enemy.angle);

      if (enemy.distance >= this.pathData.totalLength) {
        enemy.view.setSlowed(false);
        this.queueDeath(enemy, true);
      }
    }
  }

  private processPendingImpacts(): void {
    if (this.pendingImpacts.length === 0) return;
    const due: PendingImpact[] = [];
    for (let i = this.pendingImpacts.length - 1; i >= 0; i--) {
      if (this.pendingImpacts[i]!.at <= this.runTime) {
        due.push(this.pendingImpacts[i]!);
        this.pendingImpacts.splice(i, 1);
      }
    }
    for (const impact of due) {
      this.effects.orbitalImpact(impact.x, impact.y);
      audio.play('explode');
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - impact.x, enemy.y - impact.y) <= impact.radius) {
          this.damageEnemy(enemy, impact.damage, impact.ignoreArmor, COLORS.amber);
        }
      }
    }
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      const stats = getTowerStats(tower.typeId, tower.level);
      tower.cooldown -= dt;

      if (tower.typeId === 'cryo') {
        if (tower.cooldown > 0) continue;
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) > stats.range) continue;
          hitAny = true;
          this.damageEnemy(enemy, stats.damage, false, tower.config.accent);
          if (stats.slowFactor && stats.slowDuration) {
            const slow = effectiveSlow(stats.slowFactor, enemy.config.slowResist);
            if (shouldApplySlow(slow, enemy.slowFactor, enemy.slowUntil, this.runTime)) {
              enemy.slowFactor = slow;
              enemy.slowUntil = this.runTime + stats.slowDuration;
              enemy.view.setSlowed(true);
            }
          }
        }
        if (hitAny) {
          tower.view.auraPulse();
          this.effects.ringPulse(tower.x, tower.y, tower.config.accent, 0.25, stats.range / 64, 450);
          audio.play('arc');
          tower.cooldown = stats.cooldown;
        } else {
          tower.cooldown = 0;
        }
        continue;
      }

      let target = tower.targetId === null ? null : this.enemyById.get(tower.targetId) ?? null;
      if (target && (!target.alive || Math.hypot(target.x - tower.x, target.y - tower.y) > stats.range)) {
        target = null;
      }

      if (tower.cooldown <= 0) {
        this.targetPool.length = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          enemy.candidate.x = enemy.x;
          enemy.candidate.y = enemy.y;
          enemy.candidate.progress = enemy.distance;
          enemy.candidate.hp = enemy.hp;
          this.targetPool.push(enemy.candidate);
        }
        const picked = pickTarget(tower.x, tower.y, stats.range, this.targetPool, tower.targetMode);
        tower.targetId = picked?.id ?? null;
        target = picked ? this.enemyById.get(picked.id) ?? null : null;
        if (target) {
          this.fireTower(tower, target, stats);
          tower.cooldown = stats.cooldown;
        }
      }

      if (target) {
        tower.view.aimAt(target.x, target.y);
      } else {
        tower.view.idleAim();
      }
    }
  }

  private fireTower(
    tower: TowerRuntime,
    target: EnemyRuntime,
    stats: ReturnType<typeof getTowerStats>,
  ): void {
    if (!target.alive) return;
    if (tower.typeId === 'pulse') {
      const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      const x = tower.x + Math.cos(angle) * 22;
      const y = tower.y + Math.sin(angle) * 22;
      const view = this.add.image(x, y, 'bolt').setDepth(DEPTH.projectiles).setRotation(angle);
      const projectile: BoltProjectile = {
        kind: 'bolt',
        id: this.nextProjectileId++,
        x,
        y,
        damage: stats.damage,
        color: tower.config.accent,
        targetId: target.id,
        speed: stats.projectileSpeed ?? 900,
        view,
      };
      this.projectiles.push(projectile);
      this.effects.muzzle(tower.x, tower.y, angle, tower.config.accent);
      tower.view.recoil();
      audio.play('pulse');
      return;
    }

    if (tower.typeId === 'mortar') {
      const startX = tower.x;
      const startY = tower.y;
      const endX = target.x;
      const endY = target.y;
      const distance = Math.max(30, Math.hypot(endX - startX, endY - startY));
      const duration = Math.max(0.35, distance / (stats.projectileSpeed ?? 380));
      const view = this.add.image(startX, startY, 'shell').setDepth(DEPTH.projectiles);
      const projectile: ShellProjectile = {
        kind: 'shell',
        id: this.nextProjectileId++,
        x: startX,
        y: startY,
        damage: stats.damage,
        color: tower.config.accent,
        startX,
        startY,
        endX,
        endY,
        elapsed: 0,
        duration,
        splashRadius: stats.splashRadius ?? 60,
        view,
      };
      this.projectiles.push(projectile);
      const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      this.effects.muzzle(tower.x, tower.y, angle, tower.config.accent);
      tower.view.recoil();
      audio.play('mortar');
      return;
    }

    if (tower.typeId === 'arc') {
      this.fireArc(tower, target, stats);
    }
  }

  private fireArc(
    tower: TowerRuntime,
    primary: EnemyRuntime,
    stats: ReturnType<typeof getTowerStats>,
  ): void {
    const count = stats.chainCount ?? 3;
    const radius = stats.chainRadius ?? 110;
    const falloff = stats.chainFalloff ?? 0.65;
    const hitIds = new Set<number>();
    const points: Array<{ x: number; y: number }> = [{ x: tower.x, y: tower.y }];
    let current: EnemyRuntime | null = primary;

    for (let jump = 0; jump < count && current; jump++) {
      hitIds.add(current.id);
      this.damageEnemy(current, chainDamage(stats.damage, jump, falloff), false, tower.config.accent);
      points.push({ x: current.x, y: current.y });
      this.effects.hitSpark(current.x, current.y, tower.config.accent);
      current = this.findChainTarget(current, radius, hitIds);
    }

    if (points.length > 1) {
      const graphics = this.add.graphics().setDepth(DEPTH.projectiles + 2);
      graphics.lineStyle(6, tower.config.accent, 0.18);
      this.strokeLightning(graphics, points);
      graphics.lineStyle(2, COLORS.white, 0.9);
      this.strokeLightning(graphics, points);
      this.tweens.add({ targets: graphics, alpha: 0, duration: 220, onComplete: () => graphics.destroy() });
    }

    tower.view.recoil();
    audio.play('arc');
  }

  private findChainTarget(from: EnemyRuntime, radius: number, hitIds: Set<number>): EnemyRuntime | null {
    let closest: EnemyRuntime | null = null;
    let bestDistance = radius;
    for (const enemy of this.enemies) {
      if (!enemy.alive || hitIds.has(enemy.id)) continue;
      const distance = Math.hypot(enemy.x - from.x, enemy.y - from.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = enemy;
      }
    }
    return closest;
  }

  private strokeLightning(graphics: Phaser.GameObjects.Graphics, points: Array<{ x: number; y: number }>): void {
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]!;
      const to = points[i]!;
      const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 18;
      const midY = (from.y + to.y) / 2 + (Math.random() - 0.5) * 18;
      graphics.lineTo(midX, midY);
      graphics.lineTo(to.x, to.y);
    }
    graphics.strokePath();
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]!;
      if (projectile.kind === 'bolt') {
        const target = this.enemyById.get(projectile.targetId);
        if (!target || !target.alive) {
          projectile.view.destroy();
          this.projectiles.splice(i, 1);
          continue;
        }
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        const distance = Math.hypot(dx, dy);
        const step = projectile.speed * dt;
        if (distance <= step + 8) {
          this.damageEnemy(target, projectile.damage, false, projectile.color);
          this.effects.impact(target.x, target.y, projectile.color);
          projectile.view.destroy();
          this.projectiles.splice(i, 1);
        } else {
          projectile.x += (dx / distance) * step;
          projectile.y += (dy / distance) * step;
          projectile.view.setPosition(projectile.x, projectile.y);
          projectile.view.setRotation(Math.atan2(dy, dx));
        }
      } else {
        projectile.elapsed += dt;
        const t = Math.min(1, projectile.elapsed / projectile.duration);
        const x = projectile.startX + (projectile.endX - projectile.startX) * t;
        const y =
          projectile.startY + (projectile.endY - projectile.startY) * t - Math.sin(Math.PI * t) * 82;
        projectile.x = x;
        projectile.y = y;
        projectile.view.setPosition(x, y);
        projectile.view.setScale(0.65 + t * 0.35);
        if (t >= 1) {
          this.effects.explosion(projectile.endX, projectile.endY, projectile.color, 0.9);
          audio.play('explode');
          for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            if (Math.hypot(enemy.x - projectile.endX, enemy.y - projectile.endY) <= projectile.splashRadius) {
              this.damageEnemy(enemy, projectile.damage, false, projectile.color);
            }
          }
          projectile.view.destroy();
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private damageEnemy(enemy: EnemyRuntime, rawDamage: number, ignoreArmor: boolean, color: number): void {
    if (!enemy.alive) return;
    const damage = applyArmor(rawDamage, enemy.config.armor, ignoreArmor);
    enemy.hp -= damage;
    enemy.candidate.hp = enemy.hp;
    enemy.view.setHp(enemy.hp / enemy.maxHp);
    enemy.view.flash();
    this.effects.hitSpark(enemy.x, enemy.y, color);
    if (enemy.config.isBoss) this.emitBossStatus();
    if (enemy.hp <= 0) {
      this.queueDeath(enemy, false);
    }
  }

  private queueDeath(enemy: EnemyRuntime, leaked: boolean): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.leaked = leaked;
    enemy.deathQueued = true;
    this.deathQueue.push(enemy);
    this.hudDirty = true;
  }

  private processDeaths(): void {
    if (this.deathQueue.length === 0) return;
    const deaths = this.deathQueue;
    this.deathQueue = [];
    const splits: Array<{ distance: number; enemyId: EnemyId; count: number }> = [];
    let defeat = false;

    for (const enemy of deaths) {
      this.enemyById.delete(enemy.id);
      const { x, y } = enemy;
      enemy.view.destroy();

      if (enemy.leaked) {
        this.integrity = Math.max(0, this.integrity - enemy.config.leakDamage);
        this.effects.leakFlash(x, y, enemy.config.leakDamage);
        this.coreView.damageFlash();
        audio.play('leak');
        gameBus.emit('game:toast', {
          message: `核心受损 -${enemy.config.leakDamage}`,
          tone: 'error',
        });
        if (this.integrity <= 0) defeat = true;
      } else {
        this.credits += enemy.config.reward;
        this.kills++;
        this.effects.explosion(
          x,
          y,
          enemy.config.color,
          enemy.config.isBoss ? 1.8 : enemy.config.isElite ? 1.2 : 0.55,
        );
        this.effects.floatingText(x, y - 22, `+${enemy.config.reward}`, '#ffd278');
        if (enemy.config.isBoss) {
          audio.play('explode');
          gameBus.emit('game:toast', { message: '虚空母舰已摧毁', tone: 'success' });
        } else if (enemy.config.isElite) {
          audio.play('explode');
        } else {
          audio.play('hit');
        }
        if (enemy.config.splitInto) {
          splits.push({
            distance: enemy.distance,
            enemyId: enemy.config.splitInto.enemyId,
            count: enemy.config.splitInto.count,
          });
        }
      }
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    for (const split of splits) {
      for (let i = 0; i < split.count; i++) {
        this.spawnEnemy(split.enemyId, 1, split.distance + 4);
      }
    }

    if (defeat) {
      this.integrity = 0;
      this.endRun(false);
      return;
    }

    if (this.phase === 'wave' && this.waveActive) {
      this.checkWaveComplete();
    }
    this.emitBossStatus();
    this.hudDirty = true;
  }

  private checkWaveComplete(): void {
    if (!this.waveActive || this.phase !== 'wave') return;
    if (this.spawnCursor < this.pendingSpawns.length) return;
    if (this.enemies.length > 0) return;
    this.completeWave();
  }

  private completeWave(): void {
    if (!this.waveActive) return;
    this.waveActive = false;
    this.wavesCleared = Math.max(this.wavesCleared, this.currentWaveIndex);
    const bonus = waveClearBonus(this.currentWaveIndex);
    this.credits += bonus;
    this.effects.floatingText(640, 420, `+${bonus} 信用点`, '#ffd278');
    gameBus.emit('game:toast', { message: `第 ${this.currentWaveIndex} 波已清除  +${bonus} 信用点`, tone: 'success' });
    audio.play('wave');

    if (!this.endless && this.currentWaveIndex >= TOTAL_WAVES) {
      this.endRun(true);
      return;
    }

    this.phase = 'prepare';
    this.pendingSpawns = [];
    this.spawnCursor = 0;
    this.emitHud(true);
    this.emitMode();
    this.emitSelection();
    this.emitBossStatus();
    this.effects.ringPulse(gridToPixel(LEVEL_ONE.core).x, gridToPixel(LEVEL_ONE.core).y, COLORS.cyan, 0.4, 2.2, 800);
    this.scheduleAutoNext();
  }

  private tickAutoNext(delta: number): void {
    if (this.phase !== 'prepare' || this.autoNextRemaining <= 0) return;
    this.autoNextRemaining = Math.max(0, this.autoNextRemaining - Math.min(delta, 250) / 1000);
    this.emitAutoNextStatus();
    if (this.autoNextRemaining <= 0) {
      this.startWave();
    }
  }

  private scheduleAutoNext(): void {
    if (!this.autoNextWave || this.phase !== 'prepare' || this.wavesCleared <= 0) return;
    this.autoNextRemaining = AUTO_NEXT_DELAY;
    this.lastAutoNextEmitAt = -1;
    this.emitAutoNextStatus(true);
  }

  private cancelAutoNext(): void {
    if (this.autoNextRemaining <= 0) return;
    this.autoNextRemaining = 0;
    this.emitAutoNextStatus(true);
  }

  private emitAutoNextStatus(force = false): void {
    const now = performance.now();
    if (!force && this.autoNextRemaining > 0 && now - this.lastAutoNextEmitAt < 100) return;
    this.lastAutoNextEmitAt = now;
    gameBus.emit('game:autoNext', {
      active: this.autoNextRemaining > 0,
      remaining: this.autoNextRemaining,
    });
  }

  private endRun(victory: boolean): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.cancelAutoNext();
    this.phase = victory ? 'victory' : 'defeat';
    this.waveActive = false;
    this.paused = false;
    this.skillAiming = false;
    this.buildTowerId = null;
    this.hoveredPadIndex = null;
    this.hideBuildGhost();
    this.selectionRange.clear();
    this.selectedTowerId = null;
    for (const tower of this.towers) tower.view.setSelected(false);

    const waveReached = victory ? TOTAL_WAVES : Math.max(this.currentWaveIndex, this.wavesCleared);
    const score = computeScore({
      wavesCleared: victory ? TOTAL_WAVES : this.wavesCleared,
      kills: this.kills,
      integrity: this.integrity,
      credits: this.credits,
      victory,
    });
    const record = recordRun(score, victory, waveReached, this.kills);

    const corePos = gridToPixel(LEVEL_ONE.core);
    if (victory) {
      this.effects.ringPulse(corePos.x, corePos.y, COLORS.cyan, 0.5, 3.2, 1200);
      this.effects.sparkBurst(corePos.x, corePos.y, COLORS.cyan, 24, 200);
      audio.play('win');
      gameBus.emit('game:waveBanner', {
        title: '星港已守住',
        subtitle: 'NEXUS-7 跃迁核心稳定',
        tone: 'victory',
      });
    } else {
      this.effects.explosion(corePos.x, corePos.y, COLORS.red, 2);
      this.effects.leakFlash(corePos.x, corePos.y, 1);
      audio.play('lose');
      gameBus.emit('game:waveBanner', {
        title: '核心失守',
        subtitle: '星港防线已崩溃',
        tone: 'defeat',
      });
    }

    this.emitHud(true);
    this.emitMode();
    this.emitSelection();
    this.emitSkillStatus();
    this.emitBossStatus();

    const result: ResultPayload = {
      victory,
      endless: this.endless,
      waveReached,
      wavesCleared: victory ? TOTAL_WAVES : this.wavesCleared,
      kills: this.kills,
      integrity: this.integrity,
      credits: this.credits,
      score,
      bestScore: record.bestScore,
      isNewBest: record.isNewBest,
    };
    gameBus.emit('game:result', result);
  }

  private stepSimulation(dt: number): void {
    this.runTime += dt;

    this.processPendingImpacts();
    this.spawnDueEnemies(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.processDeaths();

    if (this.phase !== 'wave' || !this.waveActive) return;
    this.checkWaveComplete();
  }

  // ---------------------------------------------------------------------------
  // Pause
  // ---------------------------------------------------------------------------

  private pauseGame(): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    this.paused = true;
    this.skillAiming = false;
    this.buildTowerId = null;
    this.hoveredPadIndex = null;
    this.hideBuildGhost();
    this.refreshPads();
    this.emitHud(true);
    this.emitMode();
    this.emitSkillStatus();
    this.scene.pause();
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.accumulator = 0;
    this.scene.resume();
    this.emitHud(true);
    this.emitMode();
    this.emitSkillStatus();
  }

  // ---------------------------------------------------------------------------
  // UI snapshots
  // ---------------------------------------------------------------------------

  private getDisplayWave(): number {
    if (this.phase === 'prepare') return this.wavesCleared + 1;
    if (this.currentWaveIndex > 0) return this.currentWaveIndex;
    return this.wavesCleared + 1;
  }

  private getEnemiesRemaining(): number {
    return Math.max(0, this.pendingSpawns.length - this.spawnCursor) + this.enemies.length;
  }

  private emitHud(force = false): void {
    if (!force && !this.hudDirty) return;
    const snapshot: HudSnapshot = {
      integrity: this.integrity,
      maxIntegrity: START_INTEGRITY,
      credits: this.credits,
      wave: this.getDisplayWave(),
      totalWaves: TOTAL_WAVES,
      endless: this.endless,
      kills: this.kills,
      enemiesRemaining: this.getEnemiesRemaining(),
      speed: this.speed,
      paused: this.paused,
      phase: this.phase,
    };
    gameBus.emit('game:hud', snapshot);
    this.hudDirty = false;
  }

  private emitMode(): void {
    const mode: ModeSnapshot = {
      phase: this.phase,
      paused: this.paused,
      speed: this.speed,
      buildTowerId: this.buildTowerId,
      skillAiming: this.skillAiming,
      selectedTowerId: this.selectedTowerId,
    };
    gameBus.emit('game:mode', mode);
  }

  private emitSelection(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      gameBus.emit('game:selection', null);
      return;
    }
    const upgradeCost =
      tower.level < 3 ? tower.config.upgradeCosts[tower.level - 1] : null;
    const selection: TowerSelection = {
      towerId: tower.id,
      typeId: tower.typeId,
      level: tower.level,
      targetMode: tower.targetMode,
      upgradeCost,
      sellValue: calculateSellValue(tower.totalInvested),
      totalInvested: tower.totalInvested,
    };
    gameBus.emit('game:selection', selection);
  }

  private emitSkillStatus(force = false): void {
    const remaining = Math.max(0, this.skillReadyAt - this.runTime);
    const ratio = Math.min(1, remaining / SKILL_COOLDOWN);
    const ready = remaining <= 0;
    const now = performance.now();
    if (
      !force &&
      this.lastSkillEmitAt >= 0 &&
      now - this.lastSkillEmitAt < 100 &&
      ready === this.lastSkillReady &&
      this.skillAiming === this.lastSkillAiming
    ) {
      return;
    }
    this.lastSkillEmitAt = now;
    this.lastSkillReady = ready;
    this.lastSkillAiming = this.skillAiming;
    const status: SkillStatus = {
      ratio,
      ready,
      aiming: this.skillAiming,
    };
    gameBus.emit('game:skill', status);
  }

  private emitBossStatus(): void {
    const boss = this.enemies.find((enemy) => enemy.alive && enemy.config.isBoss);
    if (!boss) {
      gameBus.emit('game:boss', null);
      return;
    }
    gameBus.emit('game:boss', {
      visible: true,
      name: boss.config.name,
      ratio: Math.max(0, boss.hp / boss.maxHp),
    });
  }

  private emitAllState(): void {
    this.emitHud(true);
    this.emitMode();
    this.emitSelection();
    this.emitSkillStatus(true);
    this.emitAutoNextStatus(true);
    this.emitBossStatus();
  }

  private drawRange(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    range: number,
    color: number,
    fillAlpha: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(color, fillAlpha);
    graphics.fillCircle(x, y, range);
    graphics.lineStyle(1.5, color, 0.65);
    graphics.strokeCircle(x, y, range);
    graphics.lineStyle(1, color, 0.2);
    graphics.strokeCircle(x, y, range * 0.55);
  }

  private showToast(message: string, tone: 'info' | 'error' | 'success' = 'info'): void {
    gameBus.emit('game:toast', { message, tone });
  }
}
