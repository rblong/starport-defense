# 需求：星际争霸素材本地接入（动效 / 音效 / 图形动画）

需求编号：`REQ-20261107-03`
日期：2026-11-07
状态：已实现，浏览器已验证；素材仅作为本地可选包，未提交到仓库。
关联：`artifacts/starcraft1/`（Codex 整理）、`docs/05-level-system-research.md`

## 1. 目标

将 Codex 已整理的《星际争霸 1》人族/虫族素材接入当前游戏，用于强化：

- 单位选中/攻击/升级等**音效**
- 机枪兵、攻城坦克的**图形外观**
- 虫族击杀与爆炸的**图形动画效果**

同时保留无素材时的原创程序化画面/合成音效作为 fallback。

## 2. 版权与分发边界（强制）

`artifacts/starcraft1/` 中的图像和音频权利归 Blizzard 等权利人所有；社区仓库代码许可不等于游戏素材授权。

因此本轮遵循：

1. 素材只作为**本地可选素材包**使用，源目录 `artifacts/starcraft1/` 与暂存目录
   `public/assets/sc-local/` 均加入 `.gitignore`，不提交、不随公开仓库分发。
2. 代码只接入**运行时加载与 fallback**；仓库中不包含暴雪图片/音频本体。
3. 本地部署/试玩由用户自行确认素材使用权限；公开部署前应移除素材包或替换为已授权资源。
4. 不复制《星际争霸》原版代码、地图或过场内容。

## 3. 接入范围

### 3.1 音效

优先接入以下 Codex 已整理文件（映射为本地包内的稳定文件名）：

| 游戏事件 | 素材 |
| --- | --- |
| 按钮点击 | `audio/interface/Button.wav` |
| 机枪兵选中 | `audio/terran/Marine.selected.wav` |
| 机枪兵攻击 | `audio/terran/Marine.attack.wav`（截取短片段） |
| 坦克选中 | `audio/terran/Tank.selected.wav` |
| 坦克攻击 | `audio/terran/Tank.attack2.wav` / `Tank.attack.wav`（截取短片段） |
| 升级 | `audio/interface/upgrade.Terran.wav`（截取短片段） |
| 虫族普通击杀 | `audio/zerg/Zergling.death.wav` |
| 虫族重型击杀 | `audio/zerg/Hydralisk.death.wav` |
| Boss/大型击杀 | `audio/zerg/Ultralisk.death.wav` |
| 大型爆炸/漏怪 | `audio/interface/TerranBuilding.death.wav`（截取短片段） |
| 胜利 / 失败 | `audio/interface/YouWin.wav` / `YouLose.wav` |

要求：

- 音频仍受现有静音、音量控制；静音时正在播放的 Web Audio 声音立即静音/停止。
- 高频攻击声限流，避免叠加爆音。
- 素材缺失或解码失败时自动回退到现有合成音效。
- 喷火兵没有对应素材，继续使用项目内 TTS/合成音效。

### 3.2 单位图形

- 机枪兵：从 `images/terran/Marine.png` 选取一个清晰帧，裁切并居中到 96×96，
  作为 `sc-marine` 纹理；存在时替换程序化机枪兵外观。
- 攻城坦克：从 `images/terran/Tank.png` 选取一个清晰帧，裁切并居中到 96×96，
  作为 `sc-tank` 纹理。
- 喷火兵无对应素材，保留程序化图形。
- 使用 nearest-neighbor 纹理过滤，保留像素风。
- 单位仍保留现有部署环、选中环、等级标记、瞄准旋转、后坐力与枪口效果。

### 3.3 图形动画效果

- 从 `images/effects-ui/BuildingBurst.png` 裁切红色爆炸序列，生成 8~10 帧
  `sc-explosion` spritesheet。
- 在敌人死亡、炮弹命中、Boss 爆炸等位置播放 Phaser 动画；
  动画结束后销毁 sprite，粒子/飘字等原有反馈保留。
- 新增单位待机轻微浮动、部署闪光、开火后坐力等 tween（素材/无素材均可用）。
- 不在每帧创建新动画对象；复用 Phaser animation key。

## 4. 资源包结构

本地运行前由脚本生成（不提交）：

```text
public/assets/sc-local/
  manifest.json
  audio/Button.wav
  audio/Marine.selected.wav
  audio/Marine.attack.wav
  audio/Tank.selected.wav
  audio/Tank.attack2.wav
  audio/upgrade.Terran.wav
  audio/Zergling.death.wav
  audio/Hydralisk.death.wav
  audio/Ultralisk.death.wav
  audio/TerranBuilding.death.wav
  audio/YouWin.wav
  audio/YouLose.wav
  images/sc-marine.png
  images/sc-tank.png
  images/sc-explosion.png
```

脚本：`scripts/stage-starcraft-pack.py`（从 `artifacts/starcraft1` 复制/裁切）。

## 5. fallback

- 启动时检测 `assets/sc-local/manifest.json`；不存在或读取失败则完全使用现有程序化画面/合成音效。
- 单个纹理/音频缺失时只回退该项，不影响启动。
- 公开仓库克隆、未准备素材包的构建保持可运行。

## 6. 验收标准

- [x] 本地素材存在时：机枪兵/坦克显示 SC 像素帧；卡片、待部署托盘同步使用新纹理。
- [x] 本地素材存在时：选中机枪兵/坦克播放对应 SC selected 音效；缺失时回退 TTS。
- [x] 本地素材存在时：攻击/升级/击杀/胜负使用对应 SC 音效，受静音/音量控制。
- [x] 爆炸播放 `sc-explosion` 动画并自动销毁，无对象泄漏（实测同时存在多个动画实例）。
- [x] 素材包不存在时：游戏正常启动，保持原程序化画面/合成音效，无致命错误。
- [x] `.gitignore` 排除 `artifacts/starcraft1/` 与 `public/assets/sc-local/`，公开仓库不含版权素材。
- [x] `npm run typecheck`、`npm test`、`npm run build` 通过；浏览器无运行时错误。

## 7. 风险

- 素材帧裁切位置可能需要根据实际 Atlas 布局微调。
- Web Audio 解码需要用户首次手势解锁；解码前触发的声音可回退合成音。
- 公开部署的版权责任由部署者承担；本项目不将素材标记为可自由分发。
