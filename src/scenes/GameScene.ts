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
  WORLD_WIDTH,
  SKILL_COOLDOWN,
  SKILL_DAMAGE,
  SKILL_RADIUS,
  SKILL_TELEGRAPH,
  PRODUCTION_QUEUE_LIMIT,
  READY_UNIT_LIMIT,
  START_CRYSTALS,
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
  ProductionActive,
  ProductionSnapshot,
  ResultPayload,
  SkillStatus,
  Speed,
  TargetMode,
  TowerId,
  TowerLevel,
  TowerSelection,
  UnitId,
  WaveBannerPayload,
} from '../types';
import { buildPath, samplePath, type PathData } from '../domain/path';
import { pickTarget } from '../domain/targeting';
import { applyArmor } from '../domain/combat';
import { expandWave, type SpawnEvent } from '../domain/waves';
import { computeScore } from '../domain/score';
import { calculateSellValue } from '../domain/economy';
import { ENEMY_MAP } from '../data/enemies';
import { getWaveForIndex } from '../data/waves';
import { UNIT_MAP, getUnitStats } from '../data/towers';
import { LEVEL_ONE, gridToPixel, pathToPixels } from '../data/level01';
import { createBackground, type BackgroundLayers } from '../render/background';
import { drawStarport } from '../render/battlefield';
import { unitTextureKey, UNIT_SIZE } from '../assets/unitTextures';
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
  private crystals = START_CRYSTALS;
  private productionQueue: UnitId[] = [];
  private activeProduction: ProductionActive | null = null;
  private readyUnits: UnitId[] = [];
  private productionDirty = true;
  private lastProductionEmitAt = -1;
  private integrity = START_INTEGRITY;
  private kills = 0;
  private runTime = 0;
  private skillReadyAt = 0;
  private skillAiming = false;
  private deployTypeId: UnitId | null = null;
  private selectedTowerId: number | null = null;
  private hoveredPadIndex: number | null = null;
  private pathData!: PathData;
  private pathPixels: Array<{ x: number; y: number }> = [];
  private enemyById = new Map<number, EnemyRuntime>();
  private targetPool: import('../domain/targeting').TargetCandidate[] = [];
  private nextEnemyId = 1;
  private nextTowerId = 1;
  private nextProjectileId = 1;
  private cameraViewX = 0;
  private panStartScreenX = 0;
  private panLastScreenX = 0;
  private panMoved = false;
  private panCandidate = false;
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
    this.cameraViewX = 0;
    this.cameras.main.setZoom(RENDER_SCALE);
    this.applyCameraView();
    this.background = createBackground(this, WORLD_WIDTH);
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
    this.time.delayedCall(1100, () => {
      gameBus.emit('game:toast', {
        message: '按住战场左右拖动查看地图，A/D 也可平移',
        tone: 'info',
      });
    });

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
    if (this.activeProduction || this.productionDirty) this.emitProduction();
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
    this.crystals = START_CRYSTALS;
    this.productionQueue = [];
    this.activeProduction = null;
    this.readyUnits = [];
    this.productionDirty = true;
    this.lastProductionEmitAt = -1;
    this.integrity = START_INTEGRITY;
    this.kills = 0;
    this.runTime = 0;
    this.skillReadyAt = 0;
    this.skillAiming = false;
    this.panCandidate = false;
    this.panMoved = false;
    this.cameraViewX = 0;
    this.deployTypeId = null;
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

    drawStarport(this);
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
    this.ghostImage = this.add.image(0, 0, 'unit-ghost');
    this.ghostImage.setScale(0.9);
    this.ghostImage.setDepth(DEPTH.ghost);
    this.ghostImage.setVisible(false);
    this.ghostImage.setAlpha(0.7);
  }

  private bindEvents(): void {
    gameBus.on('ui:requestState', this.handleRequestState, this);
    gameBus.on('ui:startWave', this.handleStartWave, this);
    gameBus.on('ui:requestUnit', this.handleRequestUnit, this);
    gameBus.on('ui:beginDeploy', this.handleBeginDeploy, this);
    gameBus.on('ui:deployDrag', this.handleDeployDrag, this);
    gameBus.on('ui:deployAt', this.handleDeployAt, this);
    gameBus.on('ui:cancelDeploy', this.handleCancelDeploy, this);
    gameBus.on('ui:selectTower', this.handleSelectTower, this);
    gameBus.on('ui:upgradeTower', this.handleUpgrade, this);
    gameBus.on('ui:sellTower', this.handleSell, this);
    gameBus.on('ui:setTargetMode', this.handleSetTargetMode, this);
    gameBus.on('ui:toggleSkillAim', this.handleToggleSkillAim, this);
    gameBus.on('ui:cancelSkillAim', this.handleCancelSkillAim, this);
    gameBus.on('ui:togglePause', this.handleTogglePause, this);
    gameBus.on('ui:setSpeed', this.handleSetSpeed, this);
    gameBus.on('ui:setAutoNextWave', this.handleSetAutoNextWave, this);
    gameBus.on('ui:panCamera', this.handlePanCamera, this);
    gameBus.on('ui:restart', this.handleRestart, this);
    gameBus.on('ui:quitMenu', this.handleQuitMenu, this);
  }

  private bindInput(): void {
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.mouse?.disableContextMenu();
  }

  private handleShutdown(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    gameBus.offContext(this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointerup', this.handlePointerUp, this);
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

  private readonly handleRequestUnit = (payload: { unitId: UnitId }): void => {
    this.requestUnit(payload.unitId);
  };

  private readonly handleBeginDeploy = (payload: { unitId: UnitId }): void => {
    this.beginDeploy(payload.unitId);
  };

  private readonly handleDeployDrag = (payload: {
    active: boolean;
    unitId?: UnitId;
    pointerX?: number;
    pointerY?: number;
  }): void => {
    if (!payload.active) {
      this.cancelDeploy();
      return;
    }
    if (payload.unitId && this.readyUnits.includes(payload.unitId)) {
      this.deployTypeId = payload.unitId;
      this.refreshPads();
      this.emitMode();
    }
    if (typeof payload.pointerX === 'number' && typeof payload.pointerY === 'number') {
      const point = this.cameras.main.getWorldPoint(payload.pointerX, payload.pointerY);
      this.updateDeployGhost(point.x, point.y);
    }
  };

  private readonly handleDeployAt = (payload: {
    unitId: UnitId;
    pointerX: number;
    pointerY: number;
  }): void => {
    const point = this.cameras.main.getWorldPoint(payload.pointerX, payload.pointerY);
    this.deployAt(payload.unitId, point.x, point.y);
  };

  private readonly handleCancelDeploy = (): void => {
    this.cancelDeploy();
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
    if (this.deployTypeId) {
      const point = this.pointerToDesign(pointer);
      this.updateDeployGhost(point.x, point.y);
      return;
    }
    if (!this.panCandidate) return;
    if (!pointer.isDown) {
      this.panCandidate = false;
      this.panMoved = false;
      return;
    }
    if (!this.panMoved) {
      if (Math.abs(pointer.x - this.panStartScreenX) < 6) return;
      this.panMoved = true;
    }
    const delta = pointer.x - this.panLastScreenX;
    this.panLastScreenX = pointer.x;
    this.panCameraBy(-delta / RENDER_SCALE);
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

    if (this.deployTypeId) {
      this.deployAt(this.deployTypeId, point.x, point.y);
      return;
    }

    this.panCandidate = true;
    this.panMoved = false;
    this.panStartScreenX = pointer.x;
    this.panLastScreenX = pointer.x;
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.panCandidate) return;
    const wasPanning = this.panMoved;
    this.panCandidate = false;
    this.panMoved = false;
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (wasPanning) return;

    const point = this.pointerToDesign(pointer);
    if (point.y < BATTLE_TOP || point.y > BATTLE_BOTTOM) return;
    const tower = this.findTowerAt(point.x, point.y);
    this.selectTower(tower?.id ?? null);
  };

  private pointerToDesign(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: worldPoint.x, y: worldPoint.y };
  }

  private applyCameraView(): void {
    const maxViewX = Math.max(0, WORLD_WIDTH - GAME_WIDTH);
    this.cameraViewX = Math.max(0, Math.min(maxViewX, this.cameraViewX));
    const scrollX = this.cameraViewX - ((RENDER_SCALE - 1) * GAME_WIDTH) / 2;
    const scrollY = -((RENDER_SCALE - 1) * GAME_HEIGHT) / 2;
    this.cameras.main.setScroll(scrollX, scrollY);
    this.emitCameraView();
  }

  private panCameraBy(delta: number): void {
    const maxViewX = Math.max(0, WORLD_WIDTH - GAME_WIDTH);
    const next = Math.max(0, Math.min(maxViewX, this.cameraViewX + delta));
    if (Math.abs(next - this.cameraViewX) < 0.01) return;
    this.cameraViewX = next;
    this.applyCameraView();
  }

  private emitCameraView(): void {
    gameBus.emit('game:camera', {
      viewX: this.cameraViewX,
      worldWidth: WORLD_WIDTH,
      viewWidth: GAME_WIDTH,
    });
  }

  private readonly handlePanCamera = (payload: { delta: number }): void => {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    this.panCameraBy(payload.delta);
  };

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

  private updateDeployGhost(x: number, y: number): void {
    if (!this.deployTypeId) {
      this.hideDeployGhost();
      return;
    }
    const pad = this.findPadAt(x, y);
    if (!pad) {
      this.hoveredPadIndex = null;
      this.hideDeployGhost();
      return;
    }

    this.hoveredPadIndex = pad.index;
    this.refreshPads();

    const config = UNIT_MAP[this.deployTypeId];
    const stats = config.levels[0];
    const occupied = this.towers.some((tower) => tower.padIndex === pad.index);
    const color = occupied ? COLORS.red : config.accent;

    this.ghostImage.setTexture(unitTextureKey(this, this.deployTypeId));
    this.ghostImage.setScale(UNIT_SIZE[this.deployTypeId] / 88);
    this.ghostImage.setPosition(pad.x, pad.y);
    this.ghostImage.setTint(color);
    this.ghostImage.setVisible(true);
    this.ghostImage.setAlpha(occupied ? 0.35 : 0.7);
    this.drawRange(this.ghostRange, pad.x, pad.y, stats.range, color, occupied ? 0.05 : 0.08);
  }

  private hideDeployGhost(): void {
    this.hoveredPadIndex = null;
    this.ghostImage.setVisible(false);
    this.ghostRange.clear();
    this.refreshPads();
  }

  private cancelAllTemporaryModes(): void {
    if (this.deployTypeId) this.cancelDeploy();
    if (this.skillAiming) this.cancelSkillAim();
    if (this.selectedTowerId !== null) this.selectTower(null);
  }

  private refreshPads(): void {
    for (const pad of this.pads) {
      const occupied = this.towers.some((tower) => tower.padIndex === pad.index);
      pad.setOccupied(occupied);
      pad.setBuildHighlight(Boolean(this.deployTypeId) && !occupied);
      pad.setHover(this.hoveredPadIndex === pad.index && Boolean(this.deployTypeId));
    }
  }

  // ---------------------------------------------------------------------------
  // Manufacturing / deployment actions
  // ---------------------------------------------------------------------------

  private requestUnit(unitId: UnitId): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    const config = UNIT_MAP[unitId];
    if (this.crystals < config.cost) {
      this.showToast('水晶不足', 'error');
      audio.play('error');
      return;
    }
    if ((this.activeProduction ? 1 : 0) + this.productionQueue.length >= PRODUCTION_QUEUE_LIMIT) {
      this.showToast('生产队列已满', 'error');
      audio.play('error');
      return;
    }
    if (this.readyUnits.length >= READY_UNIT_LIMIT) {
      this.showToast('待部署区已满', 'error');
      audio.play('error');
      return;
    }

    this.crystals -= config.cost;
    this.productionQueue.push(unitId);
    this.startNextProduction();
    this.productionDirty = true;
    audio.play('build');
    this.emitHud(true);
    this.emitProduction(true);
  }

  private startNextProduction(): void {
    if (this.activeProduction || this.productionQueue.length === 0) return;
    if (this.readyUnits.length >= READY_UNIT_LIMIT) return;
    const typeId = this.productionQueue.shift()!;
    const config = UNIT_MAP[typeId];
    this.activeProduction = {
      typeId,
      remaining: config.buildTime,
      duration: config.buildTime,
    };
    this.productionDirty = true;
  }

  private updateProduction(dt: number): void {
    if (!this.activeProduction) {
      this.startNextProduction();
      return;
    }
    const active = this.activeProduction;
    active.remaining = Math.max(0, active.remaining - dt);
    if (active.remaining > 0) return;

    if (this.readyUnits.length < READY_UNIT_LIMIT) {
      this.readyUnits.push(active.typeId);
      this.activeProduction = null;
      this.productionDirty = true;
      audio.play('ready');
      this.startNextProduction();
    } else {
      this.productionDirty = true;
    }
  }

  private emitProduction(force = false): void {
    const now = performance.now();
    if (!force && !this.productionDirty && !this.activeProduction) return;
    if (!force && now - this.lastProductionEmitAt < 100) return;
    this.lastProductionEmitAt = now;
    this.productionDirty = false;
    const snapshot: ProductionSnapshot = {
      active: this.activeProduction ? { ...this.activeProduction } : null,
      queue: [...this.productionQueue],
      ready: [...this.readyUnits],
    };
    gameBus.emit('game:production', snapshot);
  }

  private beginDeploy(unitId: UnitId): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    if (!this.readyUnits.includes(unitId)) return;
    this.deployTypeId = unitId;
    this.skillAiming = false;
    this.hoveredPadIndex = null;
    this.selectTower(null, false);
    this.refreshPads();
    this.emitMode();
    this.emitSkillStatus();
    this.showToast('点击部署点完成部署，右键取消', 'info');
    audio.play('click');
  }

  private deployAt(unitId: UnitId, x: number, y: number): void {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    const readyIndex = this.readyUnits.indexOf(unitId);
    if (readyIndex < 0) {
      this.cancelDeploy();
      return;
    }
    const pad = this.findPadAt(x, y);
    if (!pad) {
      this.showToast('请把单位拖到部署点', 'error');
      audio.play('error');
      this.cancelDeploy();
      return;
    }
    if (this.towers.some((tower) => tower.padIndex === pad.index)) {
      this.showToast('该部署点已被占用', 'error');
      audio.play('error');
      this.cancelDeploy();
      return;
    }

    this.readyUnits.splice(readyIndex, 1);
    const config = UNIT_MAP[unitId];
    const view = new TowerView(this, config, pad.x, pad.y);
    const tower: TowerRuntime = {
      id: this.nextTowerId++,
      typeId: unitId,
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
    this.deployTypeId = null;
    this.hoveredPadIndex = null;
    this.hideDeployGhost();
    this.refreshPads();
    this.selectTower(tower.id, false);
    this.effects.ringPulse(pad.x, pad.y, config.accent, 0.2, 0.95, 320);
    this.effects.floatingText(pad.x, pad.y - 28, '已部署', '#8fffe0');
    audio.play('build');
    audio.playVoice(unitId, 'deploy');
    this.startNextProduction();
    this.productionDirty = true;
    this.emitProduction(true);
    this.emitHud(true);
    this.emitMode();
  }

  private cancelDeploy(): void {
    if (!this.deployTypeId) return;
    this.deployTypeId = null;
    this.hideDeployGhost();
    this.refreshPads();
    this.emitMode();
  }

  // ---------------------------------------------------------------------------
  // Unit actions
  // ---------------------------------------------------------------------------

  private selectTower(towerId: number | null, playVoice = true): void {
    const tower = towerId === null ? null : this.towers.find((item) => item.id === towerId) ?? null;
    this.selectedTowerId = tower?.id ?? null;
    for (const item of this.towers) {
      item.view.setSelected(item.id === this.selectedTowerId);
    }
    this.selectionRange.clear();
    if (tower) {
      const stats = getUnitStats(tower.typeId, tower.level);
      this.drawRange(this.selectionRange, tower.x, tower.y, stats.range, tower.config.accent, 0.055);
      audio.play('click');
      if (playVoice) {
        audio.playVoice(tower.typeId, 'select');
      }
    }
    this.emitSelection();
    this.emitMode();
  }

  private upgradeSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) return;
    if (tower.level >= 3) {
      this.showToast('该单位已满级', 'info');
      audio.play('error');
      return;
    }
    const cost = tower.config.upgradeCosts[tower.level - 1];
    if (this.crystals < cost) {
      this.showToast('水晶不足', 'error');
      audio.play('error');
      return;
    }
    this.crystals -= cost;
    tower.totalInvested += cost;
    tower.level = (tower.level + 1) as TowerLevel;
    tower.view.setLevel(tower.level);
    tower.view.upgradeFlash();
    this.effects.ringPulse(tower.x, tower.y, tower.config.accent, 0.25, 1.1, 360);
    this.effects.floatingText(tower.x, tower.y - 28, `-${cost}`, '#ff8a8f');
    audio.play('upgrade');
    audio.playVoice(tower.typeId, 'upgrade');
    this.selectTower(tower.id, false);
    this.emitHud(true);
  }

  private sellSelected(): void {
    const tower = this.getSelectedTower();
    if (!tower) return;
    const refund = calculateSellValue(tower.totalInvested);
    this.crystals += refund;
    const index = this.towers.findIndex((item) => item.id === tower.id);
    if (index >= 0) this.towers.splice(index, 1);
    tower.view.destroy();
    this.selectedTowerId = null;
    this.selectionRange.clear();
    this.refreshPads();
    this.effects.ringPulse(tower.x, tower.y, COLORS.amber, 0.2, 0.9, 300);
    this.effects.floatingText(tower.x, tower.y - 28, `+${refund}`, '#ffd278');
    audio.play('sell');
    audio.playVoice(tower.typeId, 'retreat');
    this.startNextProduction();
    this.productionDirty = true;
    this.emitProduction(true);
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
    if (this.deployTypeId) this.cancelDeploy();
    this.selectTower(null, false);
    this.skillAiming = true;
    this.hideDeployGhost();
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
    this.deployTypeId = null;
    this.skillAiming = false;
    this.hoveredPadIndex = null;
    this.hideDeployGhost();
    this.refreshPads();

    const isBoss = wave.groups.some((group) => group.enemyId === 'boss');
    const banner: WaveBannerPayload = {
      title: isBoss ? '最终波 · 雷兽' : `第 ${wave.index} 波`,
      subtitle: isBoss ? '击杀雷兽，守住星港' : this.endless ? '无尽虫潮，持续增援' : '虫群信号接近中',
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
      burnDps: 0,
      burnUntil: 0,
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

      if (enemy.burnUntil > this.runTime && enemy.burnDps > 0) {
        enemy.hp -= enemy.burnDps * dt;
        enemy.candidate.hp = enemy.hp;
        enemy.view.setHp(Math.max(0, enemy.hp / enemy.maxHp));
        if (enemy.hp <= 0) {
          this.queueDeath(enemy, false);
          continue;
        }
      } else if (enemy.burnUntil <= this.runTime) {
        enemy.burnDps = 0;
        enemy.burnUntil = 0;
        enemy.view.setBurning(false);
      }

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
      const stats = getUnitStats(tower.typeId, tower.level);
      tower.cooldown -= dt;

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
          this.fireUnit(tower, target, stats);
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

  private fireUnit(
    tower: TowerRuntime,
    target: EnemyRuntime,
    stats: ReturnType<typeof getUnitStats>,
  ): void {
    if (!target.alive) return;
    const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    this.effects.weaponFire(tower.x, tower.y, target.x, target.y, tower.typeId);

    if (tower.config.attackKind === 'artillery') {
      const startX = tower.x;
      const startY = tower.y;
      const endX = target.x;
      const endY = target.y;
      const distance = Math.max(30, Math.hypot(endX - startX, endY - startY));
      const duration = Math.max(0.35, distance / (stats.projectileSpeed ?? 400));
      const view = this.add.image(startX, startY, 'shell').setDepth(DEPTH.projectiles).setScale(1.2);
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
        splashRadius: stats.splashRadius ?? 70,
        view,
      };
      this.projectiles.push(projectile);
      this.effects.muzzle(tower.x, tower.y, angle, tower.config.accent);
      tower.view.recoil();
      audio.play('mortar');
      return;
    }

    if (tower.config.attackKind === 'projectile') {
      const x = tower.x + Math.cos(angle) * 24;
      const y = tower.y + Math.sin(angle) * 24;
      const view = this.add.image(x, y, 'bolt').setDepth(DEPTH.projectiles).setRotation(angle).setTint(tower.typeId === 'goliath' ? 0xffc76a : tower.typeId === 'battlecruiser' ? 0xff795c : 0xffe6ae);
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
      audio.play(tower.typeId === 'goliath' ? 'autocannon' : tower.typeId === 'battlecruiser' ? 'shipLaser' : 'pulse');
      return;
    }

    const coneRadians = ((stats.coneAngle ?? 100) * Math.PI) / 180;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (distance > stats.range) continue;
      const enemyAngle = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(enemyAngle - angle)) > coneRadians / 2) continue;
      this.damageEnemy(enemy, stats.damage, false, tower.config.accent);
      if (stats.burnDps && stats.burnDuration) {
        this.applyBurn(enemy, stats.burnDps, stats.burnDuration);
      }
    }

    this.effects.flameCone(tower.x, tower.y, angle, stats.range, coneRadians, tower.config.accent);
    this.effects.muzzle(tower.x, tower.y, angle, tower.config.accent);
    tower.view.recoil();
    audio.play('flame');
  }

  private applyBurn(enemy: EnemyRuntime, dps: number, duration: number): void {
    enemy.burnDps = Math.max(enemy.burnDps, dps);
    enemy.burnUntil = Math.max(enemy.burnUntil, this.runTime + duration);
    enemy.view.setBurning(true);
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
        this.crystals += enemy.config.reward;
        this.kills++;
        this.effects.explosion(
          x,
          y,
          enemy.config.color,
          enemy.config.isBoss ? 1.8 : enemy.config.isElite ? 1.2 : 0.55,
        );
        this.effects.floatingText(x, y - 22, `+${enemy.config.reward}`, '#ffd278');
        const scDeath = audio.playEnemyDeath(enemy.config.id);
        if (enemy.config.isBoss) {
          if (!scDeath) audio.play('explode');
          gameBus.emit('game:toast', { message: '雷兽已被击杀', tone: 'success' });
        } else if (enemy.config.isElite) {
          if (!scDeath) audio.play('explode');
        } else {
          if (!scDeath) audio.play('hit');
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
    this.crystals += bonus;
    this.effects.floatingText(640, 420, `+${bonus} 水晶`, '#ffd278');
    gameBus.emit('game:toast', { message: `第 ${this.currentWaveIndex} 波已清除  +${bonus} 水晶`, tone: 'success' });
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
    this.deployTypeId = null;
    this.hoveredPadIndex = null;
    this.hideDeployGhost();
    this.selectionRange.clear();
    this.selectedTowerId = null;
    for (const tower of this.towers) tower.view.setSelected(false);

    const waveReached = victory ? TOTAL_WAVES : Math.max(this.currentWaveIndex, this.wavesCleared);
    const score = computeScore({
      wavesCleared: victory ? TOTAL_WAVES : this.wavesCleared,
      kills: this.kills,
      integrity: this.integrity,
      crystals: this.crystals,
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
        subtitle: '星际塔防已崩溃',
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
      crystals: this.crystals,
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
    this.updateProduction(dt);
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
    this.panCandidate = false;
    this.panMoved = false;
    this.deployTypeId = null;
    this.hoveredPadIndex = null;
    this.hideDeployGhost();
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
      crystals: this.crystals,
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
      deployTypeId: this.deployTypeId,
      skillAiming: this.skillAiming,
      selectedUnitId: this.selectedTowerId,
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
    this.emitProduction(true);
    this.emitCameraView();
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
