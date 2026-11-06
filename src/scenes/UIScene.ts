import Phaser from 'phaser';
import {
  COLORS,
  CSS_COLORS,
  FONT_FAMILY,
  FONT_MONO,
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_HEIGHT,
  RENDER_SCALE,
  SPEED_LEVELS,
  START_CREDITS,
  START_INTEGRITY,
  TOTAL_WAVES,
  BUILD_BAR_Y,
  SKILL_COOLDOWN,
  waveClearBonus,
} from '../game/constants';
import { gameBus } from '../events';
import type {
  HudSnapshot,
  ModeSnapshot,
  ResultPayload,
  SkillStatus,
  TargetMode,
  TowerId,
  TowerSelection,
  WaveBannerPayload,
} from '../types';
import { TOWER_MAP, getTowerStats } from '../data/towers';
import { getWaveForIndex } from '../data/waves';
import { Button } from '../ui/Button';
import { TowerCard } from '../ui/TowerCard';
import { sharpenSceneText } from '../ui/sharpenText';
import { audio } from '../systems/audio';

const TARGET_LABELS: Record<TargetMode, string> = {
  first: '最前',
  strongest: '最强',
  nearest: '最近',
};

export class UIScene extends Phaser.Scene {
  private hud: HudSnapshot = {
    integrity: START_INTEGRITY,
    maxIntegrity: START_INTEGRITY,
    credits: START_CREDITS,
    wave: 1,
    totalWaves: TOTAL_WAVES,
    endless: false,
    kills: 0,
    enemiesRemaining: 0,
    speed: 1,
    paused: false,
    phase: 'prepare',
  };
  private mode: ModeSnapshot = {
    phase: 'prepare',
    paused: false,
    speed: 1,
    buildTowerId: null,
    skillAiming: false,
    selectedTowerId: null,
  };
  private selection: TowerSelection | null = null;
  private skill: SkillStatus = { ratio: 0, ready: true, aiming: false };
  private bossState: { visible: boolean; name: string; ratio: number } | null = null;
  private result: ResultPayload | null = null;

  private integrityText!: Phaser.GameObjects.Text;
  private creditsText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private enemiesText!: Phaser.GameObjects.Text;
  private waveStatusText!: Phaser.GameObjects.Text;

  private speedButton!: Button;
  private soundButton!: Button;
  private pauseButton!: Button;
  private skillButton!: Button;
  private startWaveButton!: Button;
  private skillCooldownBar!: Phaser.GameObjects.Graphics;
  private cards: TowerCard[] = [];

  private wavePreview!: Phaser.GameObjects.Container;
  private wavePreviewIcons!: Phaser.GameObjects.Container;
  private wavePreviewBonus!: Phaser.GameObjects.Text;
  private previewWave: number | null = null;

  private selectionPanel!: Phaser.GameObjects.Container;
  private selectionHint!: Phaser.GameObjects.Text;
  private selectionName!: Phaser.GameObjects.Text;
  private selectionStats!: Phaser.GameObjects.Text;
  private selectionAbility!: Phaser.GameObjects.Text;
  private upgradeButton!: Button;
  private sellButton!: Button;
  private targetButton!: Button;
  private selectionDetails!: Phaser.GameObjects.Container;

  private bossBar!: Phaser.GameObjects.Container;
  private bossFill!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;

  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSubtitle!: Phaser.GameObjects.Text;
  private bannerRule!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private damageOverlay!: Phaser.GameObjects.Rectangle;

  private pauseModal!: Phaser.GameObjects.Container;
  private pauseSoundButton!: Button;
  private pauseVolumeButton!: Button;
  private pauseSoundLabel = '音效：开';
  private resultModal!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultSubtitle!: Phaser.GameObjects.Text;
  private resultScore!: Phaser.GameObjects.Text;
  private resultStats!: Phaser.GameObjects.Text;
  private resultBest!: Phaser.GameObjects.Text;

  private pauseVisible = false;
  private resultVisible = false;
  private selectionDetailsVisible = false;
  private portraitPauseShown = false;

  private readonly handleViewportResize = (): void => {
    if (window.innerHeight > window.innerWidth) {
      if (
        !this.portraitPauseShown &&
        !this.pauseVisible &&
        !this.resultVisible &&
        (this.mode.phase === 'prepare' || this.mode.phase === 'wave')
      ) {
        this.portraitPauseShown = true;
        gameBus.emit('ui:togglePause', {});
      }
    } else {
      this.portraitPauseShown = false;
    }
  };

  private readonly handleHud = (hud: HudSnapshot): void => {
    this.hud = hud;
    this.refreshHud();
  };

  private readonly handleMode = (mode: ModeSnapshot): void => {
    this.mode = mode;
    this.refreshMode();
  };

  private readonly handleSelection = (selection: TowerSelection | null): void => {
    this.selection = selection;
    this.refreshSelection();
  };

  private readonly handleSkill = (skill: SkillStatus): void => {
    this.skill = skill;
    this.refreshSkill();
  };

  private readonly handleWaveBanner = (banner: WaveBannerPayload): void => {
    this.showWaveBanner(banner);
  };

  private readonly handleToast = (toast: { message: string; tone: 'info' | 'error' | 'success' }): void => {
    this.showToast(toast.message, toast.tone);
  };

  private readonly handleResult = (result: ResultPayload): void => {
    this.showResult(result);
  };

  private readonly handleDamageFlash = (): void => {
    this.flashDamage();
  };

  private readonly handleBoss = (boss: { visible: boolean; name: string; ratio: number } | null): void => {
    this.bossState = boss;
    this.refreshBossBar();
  };

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.children.removeAll(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.topOnly = true;
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setScroll(
      -((RENDER_SCALE - 1) * GAME_WIDTH) / 2,
      -((RENDER_SCALE - 1) * GAME_HEIGHT) / 2,
    );

    this.hud = {
      integrity: START_INTEGRITY,
      maxIntegrity: START_INTEGRITY,
      credits: START_CREDITS,
      wave: 1,
      totalWaves: TOTAL_WAVES,
      endless: false,
      kills: 0,
      enemiesRemaining: 0,
      speed: 1,
      paused: false,
      phase: 'prepare',
    };
    this.mode = {
      phase: 'prepare',
      paused: false,
      speed: 1,
      buildTowerId: null,
      skillAiming: false,
      selectedTowerId: null,
    };
    this.selection = null;
    this.skill = { ratio: 0, ready: true, aiming: false };
    this.bossState = null;
    this.result = null;
    this.pauseVisible = false;
    this.resultVisible = false;
    this.cards = [];
    this.previewWave = null;
    this.portraitPauseShown = false;

    this.buildHud();
    this.buildCommandBar();
    this.buildWavePreview();
    this.buildSelectionPanel();
    this.buildBossBar();
    this.buildBanner();
    this.buildToast();
    this.buildDamageOverlay();
    this.buildPauseModal();
    this.buildResultModal();
    this.bindEvents();
    this.bindKeyboard();
    window.addEventListener('resize', this.handleViewportResize);
    sharpenSceneText(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    gameBus.emit('ui:requestState', {});
    this.handleViewportResize();
  }

  private bindEvents(): void {
    gameBus.on('game:hud', this.handleHud, this);
    gameBus.on('game:mode', this.handleMode, this);
    gameBus.on('game:selection', this.handleSelection, this);
    gameBus.on('game:skill', this.handleSkill, this);
    gameBus.on('game:waveBanner', this.handleWaveBanner, this);
    gameBus.on('game:toast', this.handleToast, this);
    gameBus.on('game:result', this.handleResult, this);
    gameBus.on('game:damageFlash', this.handleDamageFlash, this);
    gameBus.on('game:boss', this.handleBoss, this);
  }

  private readonly domKeyHandler = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };

  private bindKeyboard(): void {
    window.addEventListener('keydown', this.domKeyHandler, { capture: true });
  }

  private handleShutdown(): void {
    gameBus.offContext(this);
    window.removeEventListener('keydown', this.domKeyHandler, { capture: true });
    window.removeEventListener('resize', this.handleViewportResize);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;

    if (this.resultVisible) {
      if (event.key === 'Enter' || event.key.toLowerCase() === 'r') {
        event.preventDefault();
        gameBus.emit('ui:restart', {});
      }
      return;
    }

    if (this.pauseVisible) {
      if (event.key === 'Escape' || event.code === 'Space') {
        event.preventDefault();
        gameBus.emit('ui:togglePause', {});
      } else if (event.key.toLowerCase() === 'r') {
        gameBus.emit('ui:restart', {});
      }
      return;
    }

    if (event.key === 'Escape') {
      if (this.mode.skillAiming) {
        gameBus.emit('ui:cancelSkillAim', {});
      } else if (this.mode.buildTowerId) {
        gameBus.emit('ui:cancelBuild', {});
      } else if (this.selection) {
        gameBus.emit('ui:selectTower', { towerId: null });
      } else if (this.mode.phase === 'prepare' || this.mode.phase === 'wave') {
        gameBus.emit('ui:togglePause', {});
      }
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      gameBus.emit('ui:togglePause', {});
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.mode.phase === 'prepare') gameBus.emit('ui:startWave', {});
      return;
    }

    if (['1', '2', '3', '4'].includes(event.key)) {
      const towerIds: TowerId[] = ['pulse', 'mortar', 'cryo', 'arc'];
      const towerId = towerIds[Number(event.key) - 1];
      if (towerId) gameBus.emit('ui:selectBuild', { towerId });
      return;
    }

    if (event.key.toLowerCase() === 'q') {
      gameBus.emit('ui:toggleSkillAim', {});
      return;
    }
    if (event.key.toLowerCase() === 'u' && this.selection) {
      gameBus.emit('ui:upgradeTower', {});
      return;
    }
    if (event.key.toLowerCase() === 's' && this.selection) {
      gameBus.emit('ui:sellTower', {});
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      this.cycleSpeed();
    }
  };

  private cycleSpeed(): void {
    const currentIndex = SPEED_LEVELS.indexOf(this.mode.speed);
    const nextSpeed = SPEED_LEVELS[(currentIndex + 1) % SPEED_LEVELS.length] ?? 1;
    gameBus.emit('ui:setSpeed', { speed: nextSpeed });
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private buildHud(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.void, 0.96);
    bg.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    bg.fillStyle(COLORS.panel, 0.7);
    bg.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT - 1);
    bg.lineStyle(1, COLORS.lineBright, 0.7);
    bg.beginPath();
    bg.moveTo(0, HUD_HEIGHT - 0.5);
    bg.lineTo(GAME_WIDTH, HUD_HEIGHT - 0.5);
    bg.strokePath();
    bg.lineStyle(2, COLORS.cyan, 0.55);
    bg.beginPath();
    bg.moveTo(0, HUD_HEIGHT - 1.5);
    bg.lineTo(210, HUD_HEIGHT - 1.5);
    bg.strokePath();

    this.add.image(28, 32, 'icon-shield').setScale(0.72);
    this.integrityText = this.add.text(50, 20, `${START_INTEGRITY}`, {
      fontFamily: FONT_MONO,
      fontSize: '20px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.add.text(50, 43, '核心完整度', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });

    this.add.image(180, 32, 'icon-credit').setScale(0.72);
    this.creditsText = this.add.text(202, 20, `${START_CREDITS}`, {
      fontFamily: FONT_MONO,
      fontSize: '20px',
      color: CSS_COLORS.amber,
      fontStyle: 'bold',
    });
    this.add.text(202, 43, '信用点', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });

    this.add.image(334, 32, 'icon-wave').setScale(0.72);
    this.waveText = this.add.text(356, 20, `1 / ${TOTAL_WAVES}`, {
      fontFamily: FONT_MONO,
      fontSize: '20px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.add.text(356, 43, '波次', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });

    this.add.text(510, 15, '击杀', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });
    this.killsText = this.add.text(510, 31, '0', {
      fontFamily: FONT_MONO,
      fontSize: '18px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });

    this.add.text(610, 15, '场上 / 待生成', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });
    this.enemiesText = this.add.text(610, 31, '0', {
      fontFamily: FONT_MONO,
      fontSize: '18px',
      color: CSS_COLORS.magenta,
      fontStyle: 'bold',
    });

    this.waveStatusText = this.add.text(720, 23, '准备阶段', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.cyan,
      backgroundColor: '#0a1929',
      padding: { left: 10, right: 10, top: 4, bottom: 4 },
    });

    this.speedButton = new Button(this, {
      x: 1008,
      y: 12,
      width: 64,
      height: 40,
      label: '1x',
      fontSize: 15,
      accent: COLORS.cyan,
      onClick: () => this.cycleSpeed(),
    });
    this.speedButton.container.setDepth(10);

    this.soundButton = new Button(this, {
      x: 1080,
      y: 12,
      width: 74,
      height: 40,
      label: '音效',
      fontSize: 13,
      accent: COLORS.amber,
      onClick: () => this.toggleSound(),
    });
    this.soundButton.container.setDepth(10);

    this.pauseButton = new Button(this, {
      x: 1162,
      y: 12,
      width: 64,
      height: 40,
      label: '暂停',
      fontSize: 13,
      accent: COLORS.cyanDim,
      onClick: () => gameBus.emit('ui:togglePause', {}),
    });
    this.pauseButton.container.setDepth(10);
    this.refreshSoundLabels();
  }

  private buildCommandBar(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.void, 0.97);
    bg.fillRect(0, BUILD_BAR_Y, GAME_WIDTH, GAME_HEIGHT - BUILD_BAR_Y);
    bg.lineStyle(1, COLORS.lineBright, 0.75);
    bg.beginPath();
    bg.moveTo(0, BUILD_BAR_Y + 0.5);
    bg.lineTo(GAME_WIDTH, BUILD_BAR_Y + 0.5);
    bg.strokePath();
    bg.lineStyle(1, COLORS.cyan, 0.15);
    bg.beginPath();
    bg.moveTo(0, BUILD_BAR_Y + 4);
    bg.lineTo(GAME_WIDTH, BUILD_BAR_Y + 4);
    bg.strokePath();

    const cardWidth = 140;
    const cardHeight = 72;
    this.cards = (['pulse', 'mortar', 'cryo', 'arc'] as TowerId[]).map((towerId, index) => {
      const card = new TowerCard(
        this,
        TOWER_MAP[towerId],
        16 + index * 148,
        636,
        cardWidth,
        cardHeight,
        (selectedId) => gameBus.emit('ui:selectBuild', { towerId: selectedId }),
      );
      card.container.setDepth(10);
      return card;
    });

    this.skillButton = new Button(this, {
      x: 616,
      y: 636,
      width: 126,
      height: 72,
      label: '轨道轰炸',
      subLabel: 'Q · 准备就绪',
      fontSize: 15,
      subFontSize: 10,
      accent: COLORS.amber,
      onClick: () => gameBus.emit('ui:toggleSkillAim', {}),
    });
    this.skillButton.container.setDepth(10);

    this.skillCooldownBar = this.add.graphics().setDepth(11);

    this.startWaveButton = new Button(this, {
      x: 754,
      y: 636,
      width: 170,
      height: 72,
      label: '开始第 1 波',
      subLabel: 'ENTER',
      fontSize: 15,
      subFontSize: 10,
      accent: COLORS.cyan,
      onClick: () => gameBus.emit('ui:startWave', {}),
    });
    this.startWaveButton.container.setDepth(10);
  }

  private buildWavePreview(): void {
    this.wavePreview = this.add.container(640, 596).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panel, 0.92);
    bg.fillRoundedRect(-300, -18, 600, 36, 8);
    bg.lineStyle(1, COLORS.lineBright, 0.55);
    bg.strokeRoundedRect(-300.5, -18.5, 599, 35, 8);
    this.wavePreview.add(bg);

    const title = this.add.text(-286, 0, '下一波', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.cyan,
      fontStyle: 'bold',
    });
    title.setOrigin(0, 0.5);
    this.wavePreview.add(title);

    this.wavePreviewIcons = this.add.container(-178, 0);
    this.wavePreview.add(this.wavePreviewIcons);

    this.wavePreviewBonus = this.add.text(286, 0, '', {
      fontFamily: FONT_MONO,
      fontSize: '11px',
      color: CSS_COLORS.amber,
    });
    this.wavePreviewBonus.setOrigin(1, 0.5);
    this.wavePreview.add(this.wavePreviewBonus);
  }

  private refreshWavePreview(): void {
    if (!this.wavePreview) return;
    const shouldShow =
      this.mode.phase === 'prepare' &&
      !this.resultVisible &&
      !this.pauseVisible &&
      this.hud.wave >= 1;
    if (!shouldShow) {
      this.wavePreview.setVisible(false);
      return;
    }

    if (this.previewWave !== this.hud.wave) {
      const wave = getWaveForIndex(this.hud.wave);
      if (!wave) {
        this.wavePreview.setVisible(false);
        return;
      }
      this.wavePreviewIcons.removeAll(true);
      let x = 0;
      for (const group of wave.groups) {
        const icon = this.add.image(x, 0, `enemy-${group.enemyId}`);
        const scale = group.enemyId === 'boss' ? 0.18 : 0.3;
        icon.setScale(scale);
        this.wavePreviewIcons.add(icon);
        const count = this.add.text(x + (group.enemyId === 'boss' ? 30 : 24), 0, `×${group.count}`, {
          fontFamily: FONT_MONO,
          fontSize: '12px',
          color: CSS_COLORS.text,
        });
        count.setOrigin(0, 0.5);
        count.setResolution(RENDER_SCALE);
        this.wavePreviewIcons.add(count);
        x += 66;
      }
      this.wavePreviewBonus.setText(`清波 +${waveClearBonus(this.hud.wave)}`);
      this.previewWave = this.hud.wave;
    }
    this.wavePreview.setVisible(true);
  }

  private buildSelectionPanel(): void {
    this.selectionPanel = this.add.container(940, 632);
    this.selectionPanel.setDepth(10);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panelLight, 0.96);
    bg.fillRoundedRect(0, 0, 324, 80, 8);
    bg.lineStyle(1, COLORS.lineBright, 0.75);
    bg.strokeRoundedRect(0.5, 0.5, 323, 79, 8);
    this.selectionPanel.add(bg);

    this.selectionHint = this.add.text(162, 40, '点击已建塔查看升级 / 卖出', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.muted,
      align: 'center',
    });
    this.selectionHint.setOrigin(0.5);
    this.selectionPanel.add(this.selectionHint);

    this.selectionDetails = this.add.container(0, 0);
    this.selectionPanel.add(this.selectionDetails);

    this.selectionName = this.add.text(10, 7, '防御塔', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.selectionDetails.add(this.selectionName);

    this.selectionStats = this.add.text(10, 27, '', {
      fontFamily: FONT_MONO,
      fontSize: '10px',
      color: CSS_COLORS.muted,
    });
    this.selectionDetails.add(this.selectionStats);

    this.selectionAbility = this.add.text(10, 46, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: CSS_COLORS.cyanDim,
    });
    this.selectionDetails.add(this.selectionAbility);

    this.upgradeButton = new Button(this, {
      x: 174,
      y: 7,
      width: 70,
      height: 26,
      label: '升级',
      fontSize: 11,
      accent: COLORS.cyan,
      onClick: () => gameBus.emit('ui:upgradeTower', {}),
    });
    this.selectionDetails.add(this.upgradeButton.container);

    this.sellButton = new Button(this, {
      x: 248,
      y: 7,
      width: 70,
      height: 26,
      label: '卖出',
      fontSize: 11,
      accent: COLORS.amber,
      onClick: () => gameBus.emit('ui:sellTower', {}),
    });
    this.selectionDetails.add(this.sellButton.container);

    this.targetButton = new Button(this, {
      x: 174,
      y: 40,
      width: 144,
      height: 26,
      label: '目标：最前',
      fontSize: 10,
      accent: COLORS.magenta,
      onClick: () => {
        if (!this.selection) return;
        const order: TargetMode[] = ['first', 'strongest', 'nearest'];
        const next = order[(order.indexOf(this.selection.targetMode) + 1) % order.length]!;
        gameBus.emit('ui:setTargetMode', { mode: next });
      },
    });
    this.selectionDetails.add(this.targetButton.container);

    this.selectionHint.setVisible(true);
    this.selectionDetails.setVisible(false);
  }

  private buildBossBar(): void {
    this.bossBar = this.add.container(640, 82).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x120610, 0.92);
    bg.fillRoundedRect(-300, -16, 600, 44, 6);
    bg.lineStyle(1, COLORS.red, 0.6);
    bg.strokeRoundedRect(-300, -16, 600, 44, 6);
    this.bossBar.add(bg);

    this.bossName = this.add.text(-286, -10, '虚空母舰', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.bossBar.add(this.bossName);

    this.bossFill = this.add.graphics();
    this.bossBar.add(this.bossFill);
  }

  private buildBanner(): void {
    this.bannerContainer = this.add.container(640, 156).setAlpha(0);
    this.bannerRule = this.add.graphics();
    this.bannerRule.lineStyle(1, COLORS.cyan, 0.7);
    this.bannerRule.beginPath();
    this.bannerRule.moveTo(-230, 44);
    this.bannerRule.lineTo(230, 44);
    this.bannerRule.strokePath();
    this.bannerContainer.add(this.bannerRule);

    this.bannerTitle = this.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
      align: 'center',
      stroke: '#050814',
      strokeThickness: 6,
    });
    this.bannerTitle.setOrigin(0.5);
    this.bannerContainer.add(this.bannerTitle);

    this.bannerSubtitle = this.add.text(0, 46, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.cyan,
      align: 'center',
    });
    this.bannerSubtitle.setOrigin(0.5);
    this.bannerContainer.add(this.bannerSubtitle);
  }

  private buildToast(): void {
    this.toastText = this.add.text(640, 556, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.text,
      backgroundColor: '#0b1224',
      padding: { left: 14, right: 14, top: 7, bottom: 7 },
      align: 'center',
    });
    this.toastText.setOrigin(0.5);
    this.toastText.setAlpha(0);
  }

  private buildDamageOverlay(): void {
    this.damageOverlay = this.add.rectangle(640, 360, 1280, 720, 0xff304a, 0);
    this.damageOverlay.setAlpha(0);
  }

  private buildPauseModal(): void {
    this.pauseModal = this.add.container(0, 0).setDepth(200).setVisible(false);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x02040a, 0.8);
    shade.setInteractive();
    this.pauseModal.add(shade);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(400, 166, 480, 388, 14);
    panel.lineStyle(1.5, COLORS.cyan, 0.55);
    panel.strokeRoundedRect(400.5, 166.5, 479, 387, 14);
    this.pauseModal.add(panel);

    const title = this.add.text(640, 208, '已暂停', {
      fontFamily: FONT_FAMILY,
      fontSize: '30px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
      letterSpacing: 4,
    });
    title.setOrigin(0.5);
    this.pauseModal.add(title);

    const subtitle = this.add.text(640, 250, '量子链路暂时冻结', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.muted,
    });
    subtitle.setOrigin(0.5);
    this.pauseModal.add(subtitle);

    const stats = this.add.text(640, 280, '', {
      fontFamily: FONT_MONO,
      fontSize: '12px',
      color: CSS_COLORS.cyanDim,
      align: 'center',
    });
    stats.setOrigin(0.5);
    stats.setName('pauseStats');
    this.pauseModal.add(stats);

    const continueButton = new Button(this, {
      x: 490,
      y: 314,
      width: 300,
      height: 44,
      label: '继续行动',
      fontSize: 16,
      accent: COLORS.cyan,
      onClick: () => gameBus.emit('ui:togglePause', {}),
    });
    this.pauseModal.add(continueButton.container);

    const restartButton = new Button(this, {
      x: 490,
      y: 360,
      width: 300,
      height: 42,
      label: '重新开始',
      fontSize: 15,
      accent: COLORS.amber,
      onClick: () => gameBus.emit('ui:restart', {}),
    });
    this.pauseModal.add(restartButton.container);

    this.pauseSoundLabel = audio.isMuted() ? '音效：关' : '音效：开';
    this.pauseSoundButton = new Button(this, {
      x: 490,
      y: 408,
      width: 300,
      height: 42,
      label: this.pauseSoundLabel,
      fontSize: 15,
      accent: COLORS.cyanDim,
      onClick: () => this.toggleSound(),
    });
    this.pauseModal.add(this.pauseSoundButton.container);

    this.pauseVolumeButton = new Button(this, {
      x: 490,
      y: 456,
      width: 300,
      height: 42,
      label: audio.getVolumeLabel(),
      fontSize: 15,
      accent: COLORS.amber,
      onClick: () => {
        audio.cycleVolume();
        this.refreshSoundLabels();
      },
    });
    this.pauseModal.add(this.pauseVolumeButton.container);

    const menuButton = new Button(this, {
      x: 490,
      y: 504,
      width: 300,
      height: 42,
      label: '返回主菜单',
      fontSize: 15,
      accent: COLORS.dim,
      onClick: () => gameBus.emit('ui:quitMenu', {}),
    });
    this.pauseModal.add(menuButton.container);
  }

  private buildResultModal(): void {
    this.resultModal = this.add.container(0, 0).setDepth(210).setVisible(false);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x02040a, 0.85);
    shade.setInteractive();
    this.resultModal.add(shade);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(320, 112, 640, 448, 16);
    panel.lineStyle(1.5, COLORS.cyan, 0.55);
    panel.strokeRoundedRect(320.5, 112.5, 639, 447, 16);
    this.resultModal.add(panel);

    this.resultTitle = this.add.text(640, 164, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
      letterSpacing: 6,
    });
    this.resultTitle.setOrigin(0.5);
    this.resultModal.add(this.resultTitle);

    this.resultSubtitle = this.add.text(640, 218, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.muted,
      align: 'center',
    });
    this.resultSubtitle.setOrigin(0.5);
    this.resultModal.add(this.resultSubtitle);

    this.resultScore = this.add.text(640, 262, '', {
      fontFamily: FONT_MONO,
      fontSize: '26px',
      color: CSS_COLORS.amber,
      fontStyle: 'bold',
      align: 'center',
    });
    this.resultScore.setOrigin(0.5);
    this.resultModal.add(this.resultScore);

    this.resultStats = this.add.text(640, 306, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: CSS_COLORS.muted,
      align: 'center',
      lineSpacing: 6,
    });
    this.resultStats.setOrigin(0.5, 0);
    this.resultModal.add(this.resultStats);

    this.resultBest = this.add.text(640, 412, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.cyan,
      align: 'center',
    });
    this.resultBest.setOrigin(0.5);
    this.resultModal.add(this.resultBest);

    const retryButton = new Button(this, {
      x: 390,
      y: 466,
      width: 230,
      height: 52,
      label: '再来一局',
      fontSize: 17,
      accent: COLORS.cyan,
      onClick: () => gameBus.emit('ui:restart', {}),
    });
    this.resultModal.add(retryButton.container);

    const menuButton = new Button(this, {
      x: 660,
      y: 466,
      width: 230,
      height: 52,
      label: '返回主菜单',
      fontSize: 16,
      accent: COLORS.cyanDim,
      onClick: () => gameBus.emit('ui:quitMenu', {}),
    });
    this.resultModal.add(menuButton.container);
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  private refreshHud(): void {
    this.integrityText.setText(`${this.hud.integrity}`);
    this.integrityText.setColor(this.hud.integrity <= 6 ? CSS_COLORS.red : CSS_COLORS.text);
    this.creditsText.setText(`${this.hud.credits}`);
    this.waveText.setText(
      this.hud.endless ? `${this.hud.wave} / ∞` : `${this.hud.wave} / ${this.hud.totalWaves}`,
    );
    this.killsText.setText(`${this.hud.kills}`);
    this.enemiesText.setText(`${this.hud.enemiesRemaining}`);
    this.speedButton.setLabel(`${this.hud.speed}x`);
    this.cards.forEach((card) => {
      card.setAffordable(this.hud.credits >= card.tower.cost);
    });

    const modePrefix = this.hud.endless ? '无尽 · ' : '';
    if (this.mode.phase === 'prepare') {
      this.startWaveButton.setEnabled(!this.pauseVisible && !this.resultVisible);
      this.startWaveButton.setLabel(`开始第 ${this.hud.wave} 波`, 'ENTER');
      this.waveStatusText.setText(`${modePrefix}准备阶段`).setColor(CSS_COLORS.cyan);
    } else if (this.mode.phase === 'wave') {
      this.startWaveButton.setEnabled(false);
      this.startWaveButton.setLabel(`第 ${this.hud.wave} 波`, `剩余 ${this.hud.enemiesRemaining}`);
      this.waveStatusText.setText(`${modePrefix}交战中`).setColor(CSS_COLORS.magenta);
    } else {
      this.startWaveButton.setEnabled(false);
      this.startWaveButton.setLabel(this.hud.phase === 'victory' ? '防线稳定' : '防线失守', '');
      this.waveStatusText.setText(this.hud.phase === 'victory' ? '胜利' : '失败');
    }

    this.refreshSelection();
    this.updatePauseStats();
    this.refreshWavePreview();
  }

  private refreshMode(): void {
    this.speedButton.setLabel(`${this.mode.speed}x`);
    this.speedButton.setEnabled(this.mode.phase !== 'victory' && this.mode.phase !== 'defeat');
    this.pauseButton.setEnabled(this.mode.phase === 'prepare' || this.mode.phase === 'wave');
    this.cards.forEach((card) => {
      card.setSelected(this.mode.buildTowerId === card.tower.id);
      card.setEnabled(this.mode.phase !== 'victory' && this.mode.phase !== 'defeat' && !this.mode.paused);
    });
    this.skillButton.setActive(this.mode.skillAiming);
    this.refreshSkill();
    this.refreshSelection();
    this.updatePauseVisibility();
    // Pause state affects the start-wave button and selection actions even
    // though those values live in the HUD snapshot.
    this.refreshHud();
  }

  private refreshSelection(): void {
    const hasSelection = this.selection !== null;
    this.selectionHint.setVisible(!hasSelection);
    this.selectionDetails.setVisible(hasSelection);
    this.selectionDetailsVisible = hasSelection;
    if (!this.selection) return;

    const config = TOWER_MAP[this.selection.typeId];
    const stats = getTowerStats(this.selection.typeId, this.selection.level);
    this.selectionName.setText(`${config.name}  Lv.${this.selection.level}`);
    this.selectionStats.setText(
      `伤害 ${Math.round(stats.damage)}   射程 ${Math.round(stats.range)}   间隔 ${stats.cooldown.toFixed(2)}s`,
    );
    const ability =
      this.selection.typeId === 'cryo'
        ? `减速 ${Math.round((stats.slowFactor ?? 0) * 100)}% / ${stats.slowDuration ?? 0}s`
        : this.selection.typeId === 'arc'
          ? `连锁 ${stats.chainCount ?? 0} 目标 · 每跳 ×${stats.chainFalloff ?? 0.65}`
          : this.selection.typeId === 'mortar'
            ? `范围 ${stats.splashRadius ?? 0}px`
            : '单体追踪 · 稳定输出';
    this.selectionAbility.setText(ability);

    const upgradeCost = this.selection.upgradeCost;
    const canUpgrade =
      upgradeCost !== null &&
      this.hud.credits >= upgradeCost &&
      !this.mode.paused &&
      this.mode.phase !== 'victory' &&
      this.mode.phase !== 'defeat';
    this.upgradeButton.setEnabled(canUpgrade);
    this.upgradeButton.setLabel(upgradeCost === null ? '已满级' : `升级 ${upgradeCost}`);
    this.sellButton.setEnabled(!this.mode.paused && this.mode.phase !== 'victory' && this.mode.phase !== 'defeat');
    this.sellButton.setLabel(`卖出 ${this.selection.sellValue}`);
    this.targetButton.setEnabled(!this.mode.paused && this.mode.phase !== 'victory' && this.mode.phase !== 'defeat');
    this.targetButton.setLabel(`目标：${TARGET_LABELS[this.selection.targetMode]}`);
  }

  private refreshSkill(): void {
    if (!this.skillButton) return;
    const active = this.mode.phase === 'prepare' || this.mode.phase === 'wave';
    if (this.skill.aiming) {
      this.skillButton.setEnabled(!this.mode.paused && active);
      this.skillButton.setActive(true);
      this.skillButton.setLabel('选择落点', '点击战场释放');
    } else if (this.skill.ready) {
      this.skillButton.setActive(false);
      this.skillButton.setEnabled(!this.mode.paused && active && !this.resultVisible);
      this.skillButton.setLabel('轨道轰炸', 'Q · 准备就绪');
    } else {
      this.skillButton.setActive(false);
      this.skillButton.setEnabled(false);
      const seconds = Math.ceil(this.skill.ratio * SKILL_COOLDOWN);
      this.skillButton.setLabel('轨道轰炸', `冷却 ${seconds}s`);
    }
    this.drawSkillCooldownBar();
  }

  private drawSkillCooldownBar(): void {
    if (!this.skillCooldownBar) return;
    this.skillCooldownBar.clear();
    this.skillCooldownBar.fillStyle(COLORS.void, 0.9);
    this.skillCooldownBar.fillRect(616, 708, 126, 3);
    const ready = this.skill.ready || this.skill.aiming;
    const ratio = ready ? 1 : 1 - this.skill.ratio;
    if (ratio > 0) {
      this.skillCooldownBar.fillStyle(ready ? COLORS.amber : COLORS.cyanDim, 0.95);
      this.skillCooldownBar.fillRect(616, 708, 126 * Math.max(0, Math.min(1, ratio)), 3);
    }
  }

  private refreshBossBar(): void {
    if (!this.bossState || !this.bossState.visible) {
      this.bossBar.setVisible(false);
      return;
    }
    this.bossBar.setVisible(true);
    this.bossName.setText(this.bossState.name);
    this.bossFill.clear();
    this.bossFill.fillStyle(0x2a0b18, 0.9);
    this.bossFill.fillRoundedRect(-300, 10, 600, 12, 3);
    this.bossFill.fillStyle(COLORS.red, 0.95);
    this.bossFill.fillRoundedRect(-300, 10, 600 * Math.max(0, Math.min(1, this.bossState.ratio)), 12, 3);
  }

  private updatePauseVisibility(): void {
    if (this.resultVisible) return;
    this.pauseVisible = this.mode.paused;
    this.pauseModal.setVisible(this.pauseVisible);
    if (this.pauseVisible) {
      this.updatePauseStats();
      this.refreshSoundLabels();
    }
    this.pauseButton.setEnabled(
      this.mode.phase === 'prepare' || this.mode.phase === 'wave',
    );
  }

  private updatePauseStats(): void {
    const stats = this.pauseModal.getByName('pauseStats') as Phaser.GameObjects.Text | null;
    if (stats) {
      stats.setText(
        `完整度 ${this.hud.integrity}/${this.hud.maxIntegrity}   信用点 ${this.hud.credits}   波次 ${this.hud.wave}/${this.hud.totalWaves}`,
      );
    }
  }

  private refreshSoundLabels(): void {
    const label = audio.isMuted() ? '音效：关' : '音效：开';
    this.pauseSoundLabel = label;
    this.pauseSoundButton?.setLabel(label);
    this.soundButton?.setLabel(label);
    this.pauseVolumeButton?.setLabel(audio.getVolumeLabel());
  }

  private toggleSound(): void {
    const muted = audio.toggleMuted();
    if (!muted) audio.play('click');
    this.refreshSoundLabels();
  }

  // ---------------------------------------------------------------------------
  // Banners / feedback
  // ---------------------------------------------------------------------------

  private showWaveBanner(banner: WaveBannerPayload): void {
    if (!this.bannerContainer) return;
    this.tweens.killTweensOf(this.bannerContainer);
    this.bannerContainer.setAlpha(1).setY(156);
    this.bannerTitle.setText(banner.title);
    this.bannerSubtitle.setText(banner.subtitle);
    const color =
      banner.tone === 'boss'
        ? CSS_COLORS.magenta
        : banner.tone === 'defeat'
          ? CSS_COLORS.red
          : banner.tone === 'victory'
            ? CSS_COLORS.green
            : CSS_COLORS.cyan;
    this.bannerSubtitle.setColor(color);
    this.bannerTitle.setColor(banner.tone === 'defeat' ? CSS_COLORS.red : CSS_COLORS.text);
    this.bannerRule.clear();
    this.bannerRule.lineStyle(1, color === CSS_COLORS.red ? COLORS.red : COLORS.cyan, 0.7);
    this.bannerRule.beginPath();
    this.bannerRule.moveTo(-230, 44);
    this.bannerRule.lineTo(230, 44);
    this.bannerRule.strokePath();
    this.tweens.add({
      targets: this.bannerContainer,
      alpha: 0,
      y: 136,
      delay: 1600,
      duration: 500,
      ease: 'Cubic.In',
    });
  }

  private showToast(message: string, tone: 'info' | 'error' | 'success'): void {
    if (!this.toastText) return;
    this.tweens.killTweensOf(this.toastText);
    const color = tone === 'error' ? CSS_COLORS.red : tone === 'success' ? CSS_COLORS.green : CSS_COLORS.text;
    this.toastText.setText(message);
    this.toastText.setColor(color);
    this.toastText.setAlpha(1);
    this.toastText.setY(556);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      y: 536,
      delay: 1800,
      duration: 450,
      ease: 'Cubic.In',
    });
  }

  private flashDamage(): void {
    if (!this.damageOverlay) return;
    this.tweens.killTweensOf(this.damageOverlay);
    this.damageOverlay.setAlpha(0.16);
    this.tweens.add({
      targets: this.damageOverlay,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.Out',
    });
  }

  private showResult(result: ResultPayload): void {
    this.result = result;
    this.resultVisible = true;
    this.pauseVisible = false;
    this.pauseModal.setVisible(false);
    this.bossBar.setVisible(false);
    this.bannerContainer.setAlpha(0);
    this.wavePreview.setVisible(false);
    this.resultModal.setVisible(true);
    this.resultTitle.setText(result.victory ? '防线稳定' : result.endless ? '无尽终结' : '核心失守');
    this.resultTitle.setColor(result.victory ? CSS_COLORS.cyan : CSS_COLORS.red);
    this.resultSubtitle.setText(
      result.victory
        ? 'NEXUS-7 跃迁核心保持完整，虫群已被击退。'
        : result.endless
          ? `你守到了第 ${result.waveReached} 波。无尽虫潮仍在继续。`
          : '星港防线被突破。调整构筑，再来一次。',
    );
    this.resultScore.setText(`评分  ${result.score.toLocaleString('zh-CN')}`);
    this.resultStats.setText(
      `到达波次   ${result.waveReached} / ${result.endless ? '∞' : TOTAL_WAVES}\n击杀数量   ${result.kills}\n剩余完整度 ${result.integrity}\n剩余信用点 ${result.credits}`,
    );
    this.resultBest.setText(
      result.isNewBest
        ? `★ 新纪录！历史最佳 ${result.bestScore.toLocaleString('zh-CN')}`
        : `历史最佳  ${result.bestScore.toLocaleString('zh-CN')}`,
    );
    this.skillButton.setEnabled(false);
    this.startWaveButton.setEnabled(false);
    this.pauseButton.setEnabled(false);
    this.speedButton.setEnabled(false);
    this.cards.forEach((card) => card.setEnabled(false));
    this.selectionDetails.setVisible(false);
  }
}
