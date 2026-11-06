import Phaser from 'phaser';
import {
  COLORS,
  CSS_COLORS,
  DEPTH,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_SCALE,
} from '../game/constants';
import { createMenuBackdrop, type BackgroundLayers } from '../render/background';
import { Button } from '../ui/Button';
import { sharpenSceneText } from '../ui/sharpenText';
import { audio } from '../systems/audio';
import { loadProgress, loadSettings, updateSettings } from '../systems/save';

export class MenuScene extends Phaser.Scene {
  private backdrop!: BackgroundLayers;
  private reducedMotion = false;
  private helpModal!: Phaser.GameObjects.Container;
  private helpOpen = false;
  private soundButton!: Button;
  private motionButton!: Button;
  private volumeButton!: Button;
  private soundLabel = '音效：开';
  private motionLabel = '动态效果：标准';
  private volumeLabel = '音量：50%';

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.helpOpen = false;
    this.input.topOnly = true;
    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setScroll(
      -((RENDER_SCALE - 1) * GAME_WIDTH) / 2,
      -((RENDER_SCALE - 1) * GAME_HEIGHT) / 2,
    );
    const settings = loadSettings();
    this.reducedMotion = settings.reducedMotion;
    this.backdrop = createMenuBackdrop(this);

    // Title composition ------------------------------------------------------
    const titleGlow = this.add.image(GAME_WIDTH / 2, 208, 'glow');
    titleGlow.setDepth(-5);
    titleGlow.setTint(COLORS.cyan);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    titleGlow.setScale(3.4, 1.2);
    titleGlow.setAlpha(0.24);

    const overline = this.add.text(GAME_WIDTH / 2, 112, 'NEXUS-7  //  ORBITAL DEFENSE PROTOCOL', {
      fontFamily: '"Cascadia Mono", "Consolas", monospace',
      fontSize: '13px',
      color: CSS_COLORS.cyan,
      letterSpacing: 5,
    });
    overline.setOrigin(0.5);
    overline.setAlpha(0.85);

    const title = this.add.text(GAME_WIDTH / 2, 186, '星 港 防 线', {
      fontFamily: FONT_FAMILY,
      fontSize: '72px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
      letterSpacing: 10,
      stroke: '#0a2b3b',
      strokeThickness: 8,
    });
    title.setOrigin(0.5);
    title.setShadow(0, 0, '#39e7ff', 24, true, true);

    const english = this.add.text(GAME_WIDTH / 2, 268, 'S T A R P O R T   D E F E N S E', {
      fontFamily: '"Cascadia Mono", "Consolas", monospace',
      fontSize: '14px',
      color: CSS_COLORS.muted,
      letterSpacing: 7,
    });
    english.setOrigin(0.5);

    const rule = this.add.graphics().setDepth(1);
    rule.lineStyle(1, COLORS.cyan, 0.6);
    rule.beginPath();
    rule.moveTo(430, 306);
    rule.lineTo(850, 306);
    rule.strokePath();
    rule.fillStyle(COLORS.cyan, 0.9);
    rule.fillCircle(640, 306, 3);

    const tagline = this.add.text(GAME_WIDTH / 2, 330, '在 12 波虫群中守住星港跃迁核心', {
      fontFamily: FONT_FAMILY,
      fontSize: '17px',
      color: CSS_COLORS.muted,
      letterSpacing: 2,
    });
    tagline.setOrigin(0.5);

    // Best score panel -------------------------------------------------------
    const progress = loadProgress();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.75);
    panel.fillRoundedRect(926, 86, 300, 88, 10);
    panel.lineStyle(1, COLORS.lineBright, 0.65);
    panel.strokeRoundedRect(926.5, 86.5, 299, 87, 10);

    this.add.text(950, 102, '作战记录', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.cyan,
      letterSpacing: 2,
    });
    this.add.text(950, 126, `最佳评分  ${progress.bestScore.toLocaleString('zh-CN')}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    this.add.text(950, 150, `最高波次  ${progress.bestWave} / 12      ${progress.cleared ? '已通关' : '未通关'}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    });

    // Actions ----------------------------------------------------------------
    const startButton = new Button(this, {
      x: 490,
      y: 394,
      width: 300,
      height: 66,
      label: '开始行动',
      subLabel: 'ENTER THE STARPORT',
      fontSize: 21,
      subFontSize: 10,
      accent: COLORS.cyan,
      onClick: () => {
        audio.unlock();
        audio.play('click');
        this.scene.start('GameScene');
      },
    });
    startButton.container.setDepth(2);

    const helpButton = new Button(this, {
      x: 490,
      y: 478,
      width: 146,
      height: 50,
      label: '玩法说明',
      fontSize: 16,
      accent: COLORS.cyanDim,
      onClick: () => {
        audio.play('click');
        this.toggleHelp(true);
      },
    });
    helpButton.container.setDepth(2);

    this.soundLabel = audio.isMuted() ? '音效：关' : '音效：开';
    this.soundButton = new Button(this, {
      x: 644,
      y: 478,
      width: 146,
      height: 50,
      label: this.soundLabel,
      fontSize: 15,
      accent: COLORS.amber,
      onClick: () => {
        const muted = audio.toggleMuted();
        this.soundLabel = muted ? '音效：关' : '音效：开';
        this.soundButton.setLabel(this.soundLabel);
        if (!muted) audio.play('click');
      },
    });
    this.soundButton.container.setDepth(2);

    this.motionLabel = this.reducedMotion ? '动态效果：减少' : '动态效果：标准';
    this.motionButton = new Button(this, {
      x: 490,
      y: 544,
      width: 146,
      height: 40,
      label: this.motionLabel,
      fontSize: 12,
      accent: COLORS.cyanDim,
      onClick: () => {
        this.reducedMotion = !this.reducedMotion;
        updateSettings({ reducedMotion: this.reducedMotion });
        this.motionLabel = this.reducedMotion ? '动态效果：减少' : '动态效果：标准';
        this.motionButton.setLabel(this.motionLabel);
        audio.play('click');
      },
    });
    this.motionButton.container.setDepth(2);

    this.volumeLabel = audio.getVolumeLabel();
    this.volumeButton = new Button(this, {
      x: 644,
      y: 544,
      width: 146,
      height: 40,
      label: this.volumeLabel,
      fontSize: 13,
      accent: COLORS.amber,
      onClick: () => {
        audio.cycleVolume();
        this.volumeLabel = audio.getVolumeLabel();
        this.volumeButton.setLabel(this.volumeLabel);
      },
    });
    this.volumeButton.container.setDepth(2);

    this.add
      .text(GAME_WIDTH / 2, 658, '提示：先建塔，再点击「开始第 1 波」。准备阶段不限时。', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 24, 'v1.0.0 · PHASER 4.2.1 · WEBGL2', {
        fontFamily: '"Cascadia Mono", "Consolas", monospace',
        fontSize: '10px',
        color: '#4c6880',
        letterSpacing: 1,
      })
      .setOrigin(1, 0.5);

    this.createHelpModal();
    sharpenSceneText(this);

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.helpOpen) {
        audio.unlock();
        audio.play('click');
        this.scene.start('GameScene');
      }
    });
  }

  update(_time: number, delta: number): void {
    this.backdrop?.update(delta, this.reducedMotion);
  }

  private createHelpModal(): void {
    this.helpModal = this.add.container(0, 0).setDepth(DEPTH.modal).setVisible(false);

    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02040a, 0.82);
    shade.setInteractive();
    this.helpModal.add(shade);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(252, 92, 776, 500, 14);
    panel.lineStyle(1.5, COLORS.cyan, 0.6);
    panel.strokeRoundedRect(252.5, 92.5, 775, 499, 14);
    this.helpModal.add(panel);

    const title = this.add.text(640, 124, '作战手册', {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
      letterSpacing: 3,
    });
    title.setOrigin(0.5);
    this.helpModal.add(title);

    const body = [
      '【目标】守住地图右侧的跃迁核心，抵挡 12 波异星虫群，最终击毁虚空母舰。',
      '',
      '【建造】点击底部塔卡或按 1–4 选塔，再点击战场上的六边形建造位。',
      '　　　　波次进行中也可以建造、升级和卖出。',
      '【升级】点击已建塔，在底部面板升级到 3 级，或按 70% 返还卖出；可切换索敌优先级。',
      '【克制】装甲虫有高额护甲，优先使用高单发或范围伤害；霜冻发生器能减速，电弧线圈擅长清理密集虫群。',
      '【轨道轰炸】按 Q 或点击技能按钮，再点击战场位置。0.4 秒预警后降下 200 点无视护甲的范围伤害，冷却 30 秒。',
      '【节奏】准备阶段不限时，点击「开始第 N 波」才出兵。敌人漏到核心会扣除完整度，完整度归零则失败。',
      '【设置】主菜单与暂停面板可调整音效、音量和动态效果。',
      '',
      '快捷键：1–4 选塔   U 升级   S 卖出   F 切换 1x/2x   Space/Esc 暂停   Esc 取消当前操作',
    ].join('\n');

    const bodyText = this.add.text(294, 166, body, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.muted,
      lineSpacing: 7,
      wordWrap: { width: 700 },
    });
    this.helpModal.add(bodyText);

    const footer = this.add.text(640, 468, '——  守住星港，指挥官  ——', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.cyanDim,
      letterSpacing: 2,
    });
    footer.setOrigin(0.5);
    this.helpModal.add(footer);

    const closeButton = new Button(this, {
      x: 520,
      y: 518,
      width: 240,
      height: 46,
      label: '关闭手册',
      fontSize: 16,
      accent: COLORS.cyan,
      onClick: () => {
        audio.play('click');
        this.toggleHelp(false);
      },
    });
    this.helpModal.add(closeButton.container);
  }

  private toggleHelp(open: boolean): void {
    this.helpOpen = open;
    this.helpModal.setVisible(open);
  }
}
