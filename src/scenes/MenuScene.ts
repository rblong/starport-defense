import Phaser from 'phaser';
import {
  COLORS,
  CSS_COLORS,
  DEPTH,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_SCALE,
  TOTAL_WAVES,
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
  private musicButton!: Button;
  private volumeButton!: Button;
  private autoNextButton!: Button;
  private soundLabel = '音效：开';
  private motionLabel = '动态效果：标准';
  private volumeLabel = '音量：50%';
  private autoNextEnabled = false;

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
    this.autoNextEnabled = settings.autoNextWave;
    this.backdrop = createMenuBackdrop(this);

    // Armoured human fleet command panel.
    const overline = this.add.text(260,116,'TERRAN EXPEDITIONARY COMMAND', {fontFamily:'Consolas, monospace',fontSize:'10px',color:'#b8a678',letterSpacing:2}).setOrigin(0.5);
    overline.setAlpha(0.9);
    this.add.text(260,177,'星际塔防', {fontFamily:FONT_FAMILY,fontSize:'58px',fontStyle:'bold',color:'#e0ddc8',stroke:'#171e21',strokeThickness:5,letterSpacing:5}).setOrigin(0.5).setShadow(2,4,'#000000',3,true,true);
    this.add.text(260,230,'INTERSTELLAR DEFENSE', {fontFamily:'Consolas, monospace',fontSize:'11px',color:'#99aaa6',letterSpacing:3}).setOrigin(0.5);
    const rule = this.add.graphics();rule.lineStyle(1,0xa99465,0.6);rule.lineBetween(110,262,410,262);
    this.add.text(260,286,'人类远征舰队 · NEXUS–7 防御协议',{fontFamily:FONT_FAMILY,fontSize:'12px',color:'#a8b9b1'}).setOrigin(0.5);

    // Best score panel -------------------------------------------------------
    const progress = loadProgress();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.75);
    panel.fillRoundedRect(926, 546, 300, 88, 10);
    panel.lineStyle(1, COLORS.lineBright, 0.65);
    panel.strokeRoundedRect(926.5, 546.5, 299, 87, 10);

    this.add.text(950, 562, '作战记录', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: CSS_COLORS.cyan,
      letterSpacing: 2,
    });
    this.add.text(950, 586, `最佳评分  ${progress.bestScore.toLocaleString('zh-CN')}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: CSS_COLORS.text,
      fontStyle: 'bold',
    });
    const bestWaveLabel =
      progress.bestWave > TOTAL_WAVES
        ? `最高波次  无尽 ${progress.bestWave} 波`
        : `最高波次  ${progress.bestWave} / ${TOTAL_WAVES}`;
    this.add.text(950, 610, `${bestWaveLabel}      ${progress.cleared ? '已通关' : '未通关'}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: CSS_COLORS.muted,
    });

    // Actions ----------------------------------------------------------------
    const standardButton = new Button(this, {
      x: 110,
      y: 330,
      width: 146,
      height: 66,
      label: '标准模式',
      subLabel: '12 波战役',
      fontSize: 18,
      subFontSize: 9,
      accent: COLORS.cyan,
      onClick: () => this.startGame(false),
    });
    standardButton.container.setDepth(2);

    const endlessButton = new Button(this, {
      x: 264,
      y: 330,
      width: 146,
      height: 66,
      label: '无尽模式',
      subLabel: '∞ 波挑战',
      fontSize: 18,
      subFontSize: 9,
      accent: COLORS.magenta,
      onClick: () => this.startGame(true),
    });
    endlessButton.container.setDepth(2);

    const helpButton = new Button(this, {
      x: 110,
      y: 412,
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
      x: 264,
      y: 412,
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
      x: 110,
      y: 474,
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
      x: 264,
      y: 474,
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

    this.autoNextButton = new Button(this, {
      x: 110,
      y: 526,
      width: 300,
      height: 36,
      label: this.autoNextLabel(),
      fontSize: 13,
      accent: COLORS.magenta,
      onClick: () => {
        this.autoNextEnabled = !this.autoNextEnabled;
        updateSettings({ autoNextWave: this.autoNextEnabled });
        this.autoNextButton.setLabel(this.autoNextLabel());
        audio.play('click');
      },
    });
    this.autoNextButton.container.setDepth(2);
    this.musicButton = new Button(this, { x: 110, y: 574, width: 300, height: 32,
      label: audio.getMusicLabel(), fontSize: 12, accent: COLORS.green,
      onClick: () => { audio.toggleMusic(); this.musicButton.setLabel(audio.getMusicLabel()); } });
    this.musicButton.container.setDepth(2);


    this.add
      .text(260, 623, 'ENTER 标准战役  /  E 无尽防守', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 24, 'v2.0.0 · PHASER 4.2.1 · WEBGL2', {
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
        this.startGame(false);
      }
    });
    this.input.keyboard?.on('keydown-E', () => {
      if (!this.helpOpen) {
        this.startGame(true);
      }
    });
  }

  private startGame(endless: boolean): void {
    audio.unlock();
    audio.play('click');
    this.scene.start('GameScene', { endless });
  }

  private autoNextLabel(): string {
    return this.autoNextEnabled ? '自动下一波：开' : '自动下一波：关';
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
      '【目标】守住地图右侧的指挥中心，抵挡 12 波虫族，最终击杀雷兽。',
      '',
      '【制造】点击底部制造卡或按 1 / 2 / 3 / 4 申请制造，消耗水晶进入生产队列。',
      '【部署】制造完成后，拖动待部署单位到六边形部署点；也可点击单位再点击部署点。',
      '【视角】按住战场左右拖动查看更宽的地图；A / D 或 ← / → 也可平移。',
      '【兵种】Marine：快速点射；Goliath：双管火力；坦克：范围重炮；战列巡航舰：舰载激光炮远程支援。',
      '【升级】点击已部署单位，在底部面板升级到 3 级，或撤离返还 60% 已投入水晶。',
      '【水晶】击杀敌人与清波获得水晶；水晶不足时无法申请制造。',
      '【轨道轰炸】按 Q 或点击技能按钮，再点击战场位置。0.4 秒预警后降下 200 点无视护甲的范围伤害，冷却 30 秒。',
      '【节奏】准备阶段不限时，点击「开始第 N 波」才出兵。敌人漏到指挥中心会扣除完整度，完整度归零则失败。',
      '【设置】主菜单与暂停面板可调整音效、音量、动态效果和自动下一波。',
      '',
      '快捷键：1/2/3/4 制造   U 升级   S 撤离   Q 技能   F 切换 1x–5x   Space/Esc 暂停   Esc 取消操作',
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
