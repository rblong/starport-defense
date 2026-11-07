# 星港防线 · 技术方案与实施计划

| 项目 | 内容 |
| --- | --- |
| 版本 | v0.1（v1 技术基线；v2 人族单位改造见 [需求](04-unit-gameplay-redesign.md) 与 [验收报告](03-implementation-report.md)） |
| 日期 | 2026-11-06 |
| 状态 | v2 单位玩法已实现；本文件保留塔防/渲染/工程基线 |
| 关联文档 | [需求规格说明](./01-requirements.md) |
| 引擎版本 | Phaser **4.2.1**（固定版本） |

---

## 1. 目标与约束

### 1.1 技术目标

- 用 **Phaser 4** 做出一个完整、可玩、可验收的塔防小游戏，而不是技术 Demo。
- 规则、数值、关卡、波次全部**配置驱动**，便于调试与后续扩展。
- 核心战斗逻辑与 Phaser 渲染解耦，可单元测试、可复现。
- 零外部美术/音频/字体资源；静态构建，无后端，运行期无第三方请求。
- 桌面浏览器稳定 60 fps，移动端横屏可玩（P1）。
- 代码结构清晰、场景可反复重开且不泄漏监听与计时器。

### 1.2 关键约束

- Phaser 4 主推 WebGL，Canvas 渲染器已弃用；本项目要求 **WebGL2**，不支持时给出说明页。
- 游戏逻辑分辨率固定 **1280 × 720**，用 Scale FIT 适配所有窗口。
- 无物理引擎：路径移动、弹道、碰撞全部自定义数学计算，避免物理时间步与游戏速度的耦合。
- 无运行时资源加载（除构建产物 JS/CSS）；纹理在启动时程序化生成。
- 单页静态部署，开发/预览命令必须简单可复现。

---

## 2. 技术选型

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 游戏引擎 | **Phaser 4.2.1**（精确锁定） | 2026-11 当前 npm `latest`；WebGL 渲染器、统一 Filter、场景/输入/Tween/粒子完整 |
| 语言 | **TypeScript**（strict） | 领域类型、配置校验、重构安全 |
| 构建 | **Vite**（当前稳定版） | 快速 dev server、ESM、静态构建 |
| 包管理 | **pnpm 10** | 本机已有 10.33.0；锁文件固定 |
| Node | **22 LTS** | 本机已有 v22.20.0 |
| 测试 | **Vitest**（当前稳定版） | 纯 TS 单元测试，无需 DOM/WebGL |
| UI | 全部 Phaser GameObjects | 不引入 React/Vue/UI 框架，减少集成面 |
| 字体 | 系统字体栈 | 不加载字体文件；中文回退到微软雅黑/苹方 |
| 音频 | Web Audio 合成 | 无外部音频文件；首次用户手势后解锁 |
| 后端 | 无 | localStorage 保存设置与最佳成绩 |

**版本策略**：

- `phaser` 锁定 `4.2.1`，不使用 `^` 自动升级。升级前必须重新跑类型检查、场景冒烟与性能测试。
- TypeScript 若与 Phaser 类型定义存在兼容问题，回退到 5.9.x；以脚手架实际验证为准，不阻塞方案。
- 所有依赖锁定在 `pnpm-lock.yaml`；交付时记录实际版本。

**脚手架方式**：自建最小 Vite + TypeScript + Phaser 工程，参考官方 `create-phaser-game` 的 Vite/TS 模板结构，但不引入模板中不需要的示例代码与资源。理由：项目需要严格控制目录、配置与程序化资源，最小脚手架更干净。

### 2.1 计划中的脚本

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

---

## 3. 总体架构

### 3.1 分层

```text
┌──────────────────────────────────────────────────────────────┐
│ Presentation（Phaser）                                       │
│  scenes/  ui/  render/  entities/                            │
│  场景、HUD、程序化纹理、精灵/容器、Tween、粒子、输入           │
├──────────────────────────────────────────────────────────────┤
│ Application（GameScene 编排 + Systems）                       │
│  systems/：Wave / Build / Combat / Skill / Economy / Audio /  │
│             Save / Effects                                   │
│  拥有游戏运行时状态；按固定步长推进；通过 EventBus 与 UI 通信    │
├──────────────────────────────────────────────────────────────┤
│ Domain（纯 TypeScript，不 import Phaser）                     │
│  domain/：damage、slow、targeting、path、score、economy 规则    │
│  可独立单元测试，可复现                                       │
├──────────────────────────────────────────────────────────────┤
│ Data（纯 TypeScript 配置）                                    │
│  towers / enemies / waves / level01 / balance                 │
└──────────────────────────────────────────────────────────────┘
```

依赖方向只能自上而下：`Presentation → Application → Domain → Data`。  
**硬约束**：`src/domain/**` 与 `src/data/**` 不得 import `phaser`，保证 Vitest 在 Node 环境直接运行。

### 3.2 关键架构决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 物理 | 不用 Arcade/Matter | 固定路径 + 弹道自算更可控；避免物理时间步与 2x 速度冲突 |
| 时间步 | 固定 60 Hz 累积器 | 冷却、减速、波次生成可复现；便于单元测试 |
| 渲染对象 | 普通 Sprite/Container | 实体数量 ≤ 120，无需 SpriteGPULayer；逐个体控制更简单 |
| UI | 独立 UIScene 叠在 GameScene 上 | HUD 不跟随世界摄像机；场景暂停/结算解耦 |
| 状态通信 | 类型化 EventBus | UI 不直接改 GameScene 内部状态；命令与通知分离 |
| 资源 | 启动时程序化生成纹理 | 零外部素材、无版权风险、加载极快 |
| 滤镜 | 只用于核心/标题等少量对象 | Phaser 4 Filter 效果强但每个滤镜额外开销；单位一律用加法混合贴图模拟发光 |
| 摄像机 | 固定不滚动 | 单屏地图，降低坐标/输入/UI 复杂度 |
| 存档 | 只存元进度与设置 | 小游戏无需中局恢复；避免复杂快照 |
| 随机性 | 战斗无随机；视觉随机仅限背景/粒子 | 保证同配置下战斗结果确定 |

### 3.3 目录结构（计划）

```text
starport-defense/
├─ index.html
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ vite.config.ts
├─ README.md
├─ docs/
│  ├─ 01-requirements.md
│  └─ 02-technical-design.md
├─ public/
│  └─ favicon.svg                # 可选，极小
├─ src/
│  ├─ main.ts                    # Phaser.Game 配置与启动
│  ├─ game/
│  │  ├─ GameConfig.ts           # 1280x720、Scale、渲染参数、场景列表
│  │  ├─ EventBus.ts             # 类型化事件总线
│  │  ├─ GameEvents.ts           # 命令/通知事件类型
│  │  ├─ Palette.ts              # 颜色与字体常量
│  │  └─ Depth.ts                # 渲染层级常量
│  ├─ domain/
│  │  ├─ types.ts                # Vec2、TowerStats 等共享类型
│  │  ├─ combat.ts               # 护甲、伤害、减速、分裂结算
│  │  ├─ targeting.ts            # 索敌排序（纯函数）
│  │  ├─ path.ts                 # 路径长度/插值/进度
│  │  ├─ economy.ts              # 扣费/返还/奖励
│  │  └─ score.ts                # 评分公式
│  ├─ data/
│  │  ├─ balance.ts              # 初始经济、卖出比例、技能参数、波次奖励
│  │  ├─ towers.ts               # 4 座塔 + 升级表
│  │  ├─ enemies.ts              # 敌人类型
│  │  ├─ waves.ts                # 12 波编队
│  │  └─ level01.ts              # 网格、路径、建造位、核心位置
│  ├─ scenes/
│  │  ├─ BootScene.ts            # WebGL 检查、纹理生成、存档加载
│  │  ├─ MenuScene.ts            # 标题/开始/帮助/设置
│  │  ├─ GameScene.ts            # 世界、输入、模拟编排、暂停
│  │  └─ UIScene.ts              # HUD、建造栏、面板、结算遮罩
│  ├─ entities/
│  │  ├─ EnemyView.ts            # 敌人容器：精灵、血条、状态、受击反馈
│  │  ├─ TowerView.ts            # 塔容器：底座、炮塔、等级光环
│  │  ├─ ProjectilePool.ts       # 脉冲/榴弹投射物对象池
│  │  ├─ CoreView.ts             # 核心与脉动
│  │  └─ FloatingTextPool.ts     # 信用点/伤害飘字对象池
│  ├─ systems/
│  │  ├─ GameSimulation.ts       # 固定步长、命令队列、实体容器
│  │  ├─ WaveSystem.ts           # 生成队列、波次完成
│  │  ├─ BuildSystem.ts          # 放置、升级、卖出、合法性
│  │  ├─ CombatSystem.ts         # 索敌、冷却、攻击、弹道、伤害
│  │  ├─ SkillSystem.ts          # 轨道轰炸状态机
│  │  ├─ EconomySystem.ts        # 信用点/完整度/奖励
│  │  ├─ AudioSystem.ts          # Web Audio 合成音效
│  │  ├─ SaveSystem.ts           # localStorage 读写与回退
│  │  └─ EffectsSystem.ts        # 震动、粒子、飘字、减少动态效果
│  ├─ render/
│  │  ├─ generateTextures.ts     # 全部程序化纹理
│  │  ├─ Starfield.ts            # 星空/星云背景
│  │  └─ uiAtlas.ts              # UI 图标绘制
│  ├─ ui/
│  │  ├─ Hud.ts                  # 顶部状态栏
│  │  ├─ BuildBar.ts             # 塔卡 + 技能按钮
│  │  ├─ TowerPanel.ts           # 选中塔面板
│  │  ├─ Button.ts               # 统一按钮/悬停/禁用态
│  │  ├─ Modal.ts                # 暂停/结算/帮助遮罩
│  │  └─ Toast.ts                # 短提示
│  └─ utils/
│     ├─ math.ts                 # clamp/lerp/distance
│     ├─ pool.ts                 # 通用对象池
│     └─ assert.ts               # 配置断言（开发期）
└─ tests/
   ├─ combat.test.ts
   ├─ targeting.test.ts
   ├─ economy.test.ts
   ├─ path.test.ts
   ├─ score.test.ts
   └─ config.test.ts
```

文件数量约为 35–45 个；不引入 ECS、依赖注入容器或状态管理库，避免过度设计。

### 3.4 场景职责

| 场景 | 职责 | 生命周期要点 |
| --- | --- | --- |
| `BootScene` | WebGL2 预检、生成全部程序化纹理、读取 settings/progress、初始化全局单例 | 只执行一次；生成失败时显示静态错误层 |
| `MenuScene` | 标题、开始、玩法说明、设置、最佳成绩；动态星空背景 | 从 GameScene 返回时重新创建；不持有游戏模拟 |
| `GameScene` | 关卡世界、输入、模拟、系统编排、暂停/恢复、结算触发 | 每次开局重建；在 `shutdown` 中清理 EventBus/计时器 |
| `UIScene` | HUD、建造栏、塔面板、技能冷却、暂停/帮助/结算遮罩 | 由 GameScene 启动；监听 GameScene 状态事件；不直接改模拟 |

不单独建立 `PauseScene`/`ResultScene`：暂停与结算都是 UIScene 内的全屏遮罩，减少场景切换和状态同步成本。

### 3.5 EventBus 与输入

**通信原则**：UI 发“命令”，GameScene 发“状态快照/事件”。UI 不直接持有敌人、塔、经济等运行时对象。

| 方向 | 事件（示例） | 载荷 |
| --- | --- | --- |
| UI → Game | `ui:startWave` | 无 |
| UI → Game | `ui:selectBuild` | `towerType` |
| UI → Game | `ui:cancelBuild` | 无 |
| UI → Game | `ui:placeTower` | `padIndex` |
| UI → Game | `ui:selectTower` | `towerId \| null` |
| UI → Game | `ui:upgradeTower` / `ui:sellTower` | `towerId` |
| UI → Game | `ui:setTargetMode` | `towerId, mode`（P1） |
| UI → Game | `ui:castSkill` | `{x, y}` |
| UI → Game | `ui:setSpeed` / `ui:togglePause` | `1 \| 2` / 无 |
| UI → Game | `ui:restart` / `ui:quitToMenu` | 无 |
| Game → UI | `game:hud` | 完整度、信用点、波次、击杀、剩余敌人、速度、暂停、冷却 |
| Game → UI | `game:phase` | `prepare` / `wave` / `victory` / `defeat` |
| Game → UI | `game:selection` | 选中塔详情或 `null` |
| Game → UI | `game:waveBanner` / `game:bossSpawn` | 文案与进度 |
| Game → UI | `game:toast` | 错误或提示文案 |
| Game → UI | `game:result` | 胜负、统计、评分、最佳 |

- 命令进入 GameScene 后先放入**命令队列**，在下一个固定步开始时统一执行，避免 UI 事件在模拟步中途修改实体集合。
- UI 侧对 HUD 更新做“仅变化时刷新”，技能冷却每帧仅更新一个进度图形，不重建文案对象。

**输入层级**：

1. `UIScene` 位于 `GameScene` 之上，所有按钮/塔卡/面板都设置交互区。
2. UI 交互对象在 `pointerdown` 中调用 `event.stopPropagation()`，防止点击穿透到战场。
3. GameScene 侧再维护 `pointerOverUi` 标志（由 UIScene 在悬停/离开时广播）作为兜底；暂停/结算遮罩存在时直接忽略战场输入。
4. 战场坐标使用 Phaser Pointer 的本地坐标（摄像机无滚动/缩放），不手写 DPR 换算；网格换算集中在 `GridMath`。
5. 触摸端与鼠标共用同一套 Pointer 逻辑；右键取消同时支持 `Esc` 与 UI 取消按钮。

**场景清理契约**：

- 每个 `bindEvents()` 返回清理函数；`shutdown` 时调用 `EventBus.off`/场景事件 `off`。
- 模拟内的定时效果（技能延迟、波次生成）全部走固定步计时器，不用 `this.time.delayedCall`，避免暂停/重开后的悬挂回调。
- 重开时销毁当前 GameScene 并重建，不复用带监听器的场景实例。

---

## 4. 运行时流程

### 4.1 对局状态机

```text
            ┌──────────┐
            │  MENU    │
            └────┬─────┘
                 │ start
                 ▼
            ┌──────────┐   startWave   ┌──────────┐
            │ PREPARE  │ ────────────▶ │   WAVE   │
            └────┬─────┘ ◀──────────── └────┬─────┘
                 │        waveCleared       │
                 │                          │ integrity <= 0
                 │ wave 12 cleared          ▼
                 ▼                    ┌──────────┐
            ┌──────────┐              │  DEFEAT  │
            │ VICTORY  │              └────┬─────┘
            └────┬─────┘                   │
                 └───────────┬─────────────┘
                             ▼
                    RESULT 遮罩 / MENU / RESTART
```

- `RunPhase = 'prepare' | 'wave' | 'victory' | 'defeat'`。
- `paused` 是正交标志，只在 `prepare`/`wave` 时允许为 true；暂停时不推进模拟、冷却和波次计时。
- 胜利/失败后停止模拟，但保留场景与特效做背景，UIScene 展示结算。

### 4.2 固定步长模拟

```ts
const STEP_SEC = 1 / 60;
const MAX_STEPS_PER_FRAME = 12;
const MAX_FRAME_DELTA = 0.1; // 100ms，防止切后台后爆炸

update(_time: number, deltaMs: number): void {
  if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;

  this.accumulator += Math.min(deltaMs / 1000, MAX_FRAME_DELTA) * this.speed;

  let steps = 0;
  while (this.accumulator >= STEP_SEC && steps < MAX_STEPS_PER_FRAME) {
    this.simulation.step(STEP_SEC); // 先消费命令队列，再推进
    this.accumulator -= STEP_SEC;
    steps++;
  }

  // 防止螺旋死亡：极端卡顿后丢弃积压时间，而不是继续追赶
  if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

  this.syncViews(); // 模拟位置 → Phaser 显示对象
}
```

- 1x 速度每 60 Hz 显示帧约 1 步；5x 约 5 步（最高每秒 300 步模拟）。
- 显示刷新率高于 60 Hz 时，部分渲染帧没有模拟步，视觉位置保持一致；不引入插值（本项目运动速度低，观感可接受）。
- 所有冷却、减速持续时间、技能延迟、波次时间使用模拟秒，不受渲染帧率影响。
- 纯表现层 Tween（炮塔后坐、闪白、飘字）走 Phaser 时间，不参与战斗判定；暂停时随场景暂停。
- `speed` 只影响模拟累积，不影响 UI 动画与音效节流；5x 下避免同一音效每帧叠播。

### 4.3 一帧的处理顺序

```text
Pointer 事件 → UI 命令 / GameScene 输入意图（入队）
  ↓
固定步：消费命令 → 波次生成 → 敌人移动/漏怪 → 塔冷却/索敌/攻击 →
        弹道推进/命中 → 分裂/击杀/奖励 → 技能延迟结算 → 清理死亡对象
  ↓
同步视图：敌人/塔位置旋转、血条、选中范围、技能冷却、HUD 变化
  ↓
Phaser 渲染（Sprite/Text/Graphics/Particle）
```

### 4.4 暂停、恢复、切后台

- UIScene 点击暂停：`this.scene.pause('GameScene')`，UIScene 保持活动并显示遮罩；GameScene 监听 `Phaser.Scenes.Events.PAUSE` 更新标志并广播状态。
- 恢复：UIScene 调用 `this.scene.resume('GameScene')`；GameScene 监听 `RESUME`，将 `accumulator` 清零，避免暂停期间累计 delta 造成跳帧。
- 暂停时：不推进模拟、不推进冷却、不生成敌人、不可建造/释放技能；UIScene 的按钮仍可操作。
- `document.visibilitychange` 变为 hidden 时自动触发暂停；回到前台显示“已暂停”遮罩，由玩家继续。
- 结算后 `paused = false` 但模拟停止；暂停按钮禁用/不展示。

### 4.5 渲染同步

- 敌人/塔使用 Container + Sprite；模拟层只维护 `x/y/alive/hp` 等数据，`syncViews` 每帧把位置、旋转、血条、着色同步到显示对象。
- 选中范围圈由 GameScene 中一个 Graphics 对象绘制，只在选择变化时重绘，不每帧重建。
- HUD 只在 `game:hud` 事件发生时重建文本内容；技能冷却环每帧更新 Graphics 的扇区。
- 敌人朝向沿路径切线，炮塔朝向当前目标（仅表现，不参与判定）。
- 死亡对象先从模拟容器移除，再隐藏/回收到对象池；不从数组中间 `splice`（使用 swap-pop 或标记清理）。

---

## 5. 数据与配置

### 5.1 核心类型（示意）

```ts
export interface Vec2 { x: number; y: number }
export interface GridPos { col: number; row: number }

export type TowerAttackKind = 'projectile' | 'splash' | 'aura' | 'chain';

export interface TowerLevelStats {
  damage: number;
  cooldown: number;      // 秒
  range: number;         // 像素
  projectileSpeed?: number;
  splashRadius?: number;
  chainCount?: number;
  chainRadius?: number;
  chainFalloff?: number;
  slowFactor?: number;
  slowDuration?: number;
}

export interface TowerConfig {
  id: string;
  name: string;
  cost: number;
  attackKind: TowerAttackKind;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats]; // 3 级
  upgradeCosts: [number, number]; // L2、L3
  accent: number;          // 视觉主色
  description: string;
}

export interface EnemyConfig {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  armor: number;
  reward: number;
  leakDamage: number;
  slowResist: number;      // 0–1，Boss 为 0.5
  showHealthBar: boolean;
  splitInto?: { enemyId: string; count: number };
}

export interface WaveGroup {
  enemyId: string;
  count: number;
  interval: number;        // 组内间隔，秒
  delay: number;           // 相对波次开始的延迟，秒
}

export interface WaveConfig {
  index: number;
  hpScale: number;         // 仅作用于非 Boss
  groups: WaveGroup[];
}

export interface LevelConfig {
  id: string;
  cols: number;            // 18
  rows: number;            // 8
  tileSize: number;        // 64
  origin: Vec2;            // 网格左上角在 1280x720 中的像素坐标
  path: GridPos[];         // 路径关键点（格子坐标，载入时转为像素中心）
  pads: GridPos[];         // 16 个建造位（格子坐标）
  core: GridPos;           // 核心位置/路径终点
}
```

运行时不直接存配置对象：`TowerInstance` 持有 `configId`、`level`、`padIndex`、`cooldown`、`targetMode`；`EnemyInstance` 持有 `configId`、`hp`、路径进度、减速状态等。配置只读，实例可写。

### 5.2 配置组织

- `balance.ts`：初始信用点/完整度、卖出比例、清波奖励公式、技能数值、速度档位。
- `towers.ts`：4 座塔的 L1–L3 数值与升级费用；需求文档 5.3 为数值基线。
- `enemies.ts`：全部敌人与 Boss；需求文档 5.4 为数值基线。
- `waves.ts`：12 波标准编队，以及 `getWaveForIndex()` 在 12 波后生成的无尽波次；需求文档 5.5 为波次基线。
- `level01.ts`：网格尺寸、路径、建造位、核心；路径/建造位是唯一地图数据源。
- 用 `satisfies` + 开发期 `assertConfig()` 校验：数量、索引、价格为正、升级后数值单调、波次编队引用的敌人存在、建造位不与路径重叠。

**路径与地图初稿**：

- 逻辑网格：18 × 8，单格 64 px；网格原点 `(64, 88)`（顶部 HUD 64，战场高 560，上下留白 24）。
- 战场区域：y = 64–624；底部建造栏 y = 624–720。
- 路径关键点（格子坐标，最终在 `level01.ts` 中定稿）：
  `(-2,3) → (3,3) → (3,6) → (8,6) → (8,1) → (13,1) → (13,4) → (17,4)`
- 核心位于最后格中心附近 `(17,4)`；路径两侧人工布置 16 个建造位，避开路径格。
- 敌人从屏幕左侧外进入，到达核心格时判定漏怪。
- 地图设计原则：关键转角附近提供高价值建造位；中央区域留出能覆盖多段路径的建造位；不出现“唯一最优”位置。

### 5.3 存档结构

```ts
interface ProgressData {
  version: 1;
  bestScore: number;
  cleared: boolean;
  bestWave: number;
  totalKills: number;
}

interface SettingsData {
  version: 1;
  soundEnabled: boolean;
  reducedMotion: boolean;
  defaultSpeed: 1 | 2; // P1
  volume: number;      // P1
}
```

- 键名：`starport-defense:v1:progress`、`starport-defense:v1:settings`。
- 读取：`try/catch` + 字段校验 + 默认值合并；损坏时回退默认，不删除原键。
- 写入：设置变更、结算时；不逐帧写。
- 存储不可用（隐私模式/配额）时降级为内存状态，游戏继续可玩，仅不持久化。
- 不保存当前局内状态；刷新即结束本局。

---

## 6. 核心系统设计

### 6.1 路径系统

- 预计算路径折线：各段长度、累计长度、总长度、每段方向。
- 敌人状态用 `distance`（已行进像素）表示进度；`positionAt(distance)` 返回位置和切线方向。
- 速度单位 px/s；减速通过修改有效速度实现。
- 漏怪判定：`distance >= totalLength`；触发一次，标记死亡/移除，扣完整度。
- 分裂产生的分裂幼虫继承死亡位置对应的 `distance`，从该点继续前进。
- 路径系统为纯函数，单独测试边界（起点、终点、超界钳制、转角连续性）。

### 6.2 经济与完整度

- `EconomySystem` 维护信用点与完整度；所有变更走方法并广播 HUD 事件。
- 建造/升级前检查余额；扣费与创建塔在同一模拟步内完成，避免 UI 与状态不一致。
- 击杀奖励在敌人死亡结算时发放；漏怪不发奖励。
- 清波奖励在波次完成时只发一次；用 `waveRewarded` 标记防止重复。
- 完整度归零只触发一次失败；之后的漏怪事件忽略。
- 完整度显示下限为 0；不出现负数。

### 6.3 建造 / 升级 / 卖出

- `BuildSystem` 持有建造位占用表：`padIndex → towerId | null`。
- 放置合法性依次检查：模式有效、pad 有效、无占用、余额足够。
- 放置成功：创建 `TowerInstance` + `TowerView`，扣费，清除放置模式，自动选中新塔。
- 升级：检查存在、未满级、余额足够；扣费、升级数据、更新外观与面板；保留目标优先级。
- 卖出：返还 `floor(totalInvested × 0.7)`；总投入 = 建造费 + 已支付升级费；释放建造位、销毁视图、清空选中。
- 防御塔不阻挡敌人、不改变路径。
- 所有操作通过命令队列执行；UI 的禁用态只是提示，最终以模拟层校验为准。

### 6.4 波次与生成

- `WaveSystem` 在波次开始时把 `groups` 展开为按时间排序的生成队列：
  `spawnAt = group.delay + i * group.interval`。
- 每个模拟步根据 `waveElapsed` 生成到期敌人；同一帧可生成多个。
- 波次结束条件：生成队列为空 **且** 存活敌人为 0 **且** 已无待结算的延迟效果（例如技能不影响结束判定，但分裂必须已结算）。
- 波次完成：发放清空奖励 → 若 `waveIndex === 12` 触发胜利，否则进入准备阶段并广播下一波信息。
- 准备阶段不限时；玩家点击“开始第 N 波”后才推进。
- 生成队列在失败时清空，停止后续生成。
- 第 12 波 Boss 生成时广播 `game:bossSpawn`，UIScene 显示 Boss 血条。
- 敌人生命缩放：`maxHp * wave.hpScale`，Boss 除外（`isBoss` 时固定）。

### 6.5 索敌

```ts
type TargetMode = 'first' | 'strongest' | 'nearest';
```

- 候选：存活、在射程内、可被攻击（当前无飞行/隐身单位，全部可攻击）。
- 排序：
  - `first`：沿路径进度最大（离核心最近）；
  - `strongest`：当前生命最高；
  - `nearest`：与塔距离最近。
- 默认 `first`；P1 每座塔可在面板切换，并在地图上显示当前模式图标。
- 冷却好了才重新索敌；目标死亡/离开射程时立即清除目标，在新一步重新索敌。
- 炮塔朝向目标做视觉旋转，不影响命中判定。
- 索敌排序为纯函数，输入塔位置、候选数组、模式，输出目标 id 或 null；单元测试覆盖并列情况（按实体 id 稳定排序）。

### 6.6 战斗与伤害

- **伤害结算**：`effective = ignoreArmor ? amount : max(1, amount - armor)`；统一走 `applyDamage()`，保证死亡、奖励、分裂、飘字只触发一次。
- **脉冲炮塔**：追踪弹，每步朝目标当前位置移动；命中或目标失效时移除。目标死亡则弹丸失效。
- **榴弹迫击炮**：开火时锁定目标当前点为落点；炮弹沿抛物线视觉飞行，到达后对落点半径内所有敌人分别结算伤害（含护甲）。目标死亡不改变落点。
- **霜冻发生器**：无弹道；每间隔对范围内所有敌人结算伤害 + 施加强减速。减速取“最强效果”，重复施加刷新持续时间；Boss 实际减速 = `slow × (1 - slowResist)`。
- **电弧线圈**：瞬发；主目标命中后，在 `chainRadius = 110 px` 内寻找最近的未命中敌人跳跃，最多 `chainCount` 个；每跳伤害 × 0.65 并各自结算护甲；渲染为一束短暂折线闪电。
- **分裂**：潜伏者死亡时生成 2 只分裂幼虫，继承当前路径进度与朝向；分裂幼虫无 `splitInto`，不会二次分裂。生成位置做极小随机偏移仅用于视觉分离（不影响路径进度）。
- **击杀统计**：普通敌人、分裂幼虫、精英、Boss 均计入击杀；Boss 被击杀后仍需等场上敌人清空、满足波次完成条件才触发胜利。
- **性能**：伤害/减速结算遍历场内敌人；规模 ≤ 80，直接遍历即可，不引入空间索引。

### 6.7 轨道轰炸

- `SkillSystem` 状态：`readyAt`（模拟秒）、`aiming`、`pendingImpact`。
- 点击技能按钮进入瞄准；点击战场记录目标点并生成 0.4 s 预警；取消操作清空瞄准，不进入冷却。
- 预警结束时：对半径 90 px 内所有敌人造成 200 点无视护甲伤害；设置 `readyAt = now + 30`；播放视觉效果。
- 冷却用模拟时间，暂停时不减少；HUD 显示剩余比例。
- 技能伤害不触发分裂以外的额外效果；对 Boss 正常生效但无百分比伤害。
- 释放条件：准备/波次阶段、未暂停、未在结算、冷却完毕；瞄准状态可被暂停打断并取消。
- 延迟结算走模拟计时器（`impactAt`），不使用 Phaser 定时器，确保 2x/暂停行为一致。

### 6.8 评分与结算

- 评分按需求 5.8 公式实现为纯函数；输入：已清波次、击杀数、剩余完整度、剩余信用点、是否胜利。
- 结算时写入 `bestScore`（取最大值）、是否通关、最高波次、累计击杀。
- 结算遮罩显示本局数据与历史最佳；重开/返回菜单由 UIScene 发命令，GameScene 停止模拟。
- 结算后禁止继续建造、放技能、开始波次；暂停按钮禁用。

### 6.9 音效系统

- `AudioSystem` 初始化延迟到首次用户手势（开始按钮点击），调用 `AudioContext.resume()`；失败时静默降级。
- 音效使用振荡器 + 增益包络合成：短促方波/锯齿（射击、按钮）、噪声爆炸（爆炸、漏怪）、低频扫频（Boss/失败）。
- 统一 `masterGain`，音量初始 0.35；静音立即生效并持久化。
- 同一音效 50 ms 内去重/节流，避免 2x 速度下爆音。
- 无 BGM；无外部音频文件。

---

## 7. 渲染与视觉方案

### 7.1 视觉方向与色板

**深空霓虹 / 全息星港**。深色背景 + 少量高饱和霓虹，让战斗单位和弹道成为视觉焦点。

| 用途 | 颜色 |
| --- | --- |
| 背景深空 | `#050814` |
| 面板/卡片 | `#0B1224` / `#121C33` |
| 主青色（玩家/能量） | `#39E7FF` |
| 洋红（危险/虫群） | `#FF4FD8` |
| 琥珀（信用点/警示） | `#FFC857` |
| 红色（受击/失败） | `#FF5A6A` |
| 绿色（治疗/成功/安全） | `#66FFB2` |
| 主文字 | `#EAF6FF` |
| 次文字 | `#8FA6C4` |

字体栈：`"Inter", "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif`；数字可使用等宽/半等宽字体栈，保证 HUD 数字跳动不抖。无外部字体文件。

### 7.2 程序化纹理清单

在 `BootScene` 中一次性生成，之后复用：

| 纹理 | 尺寸（约） | 用途 |
| --- | --- | --- |
| `bg-stars-far` / `bg-stars-near` | 256×256 | 两层 TileSprite 星空，慢速视差 |
| `nebula` | 1280×720 | 静态 CanvasTexture 星云（径向/线性渐变） |
| `pad` | 56×56 | 六边形/环形建造位 |
| `core` | 128×128 | 多层圆环 + 核心晶体 |
| `tower-base-{id}` / `tower-head-{id}` | 40–48 px | 4 座塔的底座与炮塔 |
| `enemy-{id}` | 24–56 px | 6 类敌人轮廓 |
| `bolt` / `shell` | 8×8 / 10×10 | 脉冲弹 / 榴弹 |
| `particle` | 6×6 | 圆形粒子 |
| `icon-{name}` | 20×20 | 货币、完整度、波次、击杀、暂停、音效、速度、技能 |

- 图形用 `Phaser.GameObjects.Graphics` 绘制后 `generateTexture()`；渐变/星云用 `CanvasTexture` 的 2D context。
- 炮塔/敌人由 1–3 个纹理组合到 Container，升级通过换炮管、叠光环、缩放/着色表现，不额外生成整套升级纹理。
- 图形资源总内存 < 10 MB；无网络加载。
- 所有轮廓用“形状 + 颜色”双编码：例如迅捷跳虫是细长三角、刺蛇是宽六边形、潜伏者有分叉结构。

### 7.3 背景与氛围

- 星云静态贴图 + 两层星空 TileSprite，缓慢反向漂移，营造纵深；减少动态效果时停止漂移。
- 地图路径用暗色发光轨道 + 流动能量点；核心有周期性脉冲和粒子。
- 建造位用低亮度六边形环，可建造时悬停变青色。
- 摄像机固定，不滚动、不缩放；屏幕震动只用于漏怪/Boss/技能，可在设置中关闭。

### 7.4 滤镜与特效策略（Phaser 4）

- Phaser 4 使用统一 Filter 系统：对象需 `enableFilters()`，再走 `filters.internal` / `filters.external`；摄像机默认具备 filters。
- **仅允许**以下位置使用 GPU Filter：
  - 核心光圈/标题 Logo 的 Glow（少量对象，内部滤镜）；
  - 结算标题的轻微 Glow。
- 敌人、炮塔、弹道、粒子**不使用**逐对象滤镜；发光感通过加法混合（ADD）纹理、粒子叠层和颜色实现。
- 不使用逐对象 Bloom；如确需 Bloom，用 ParallelFilters + Threshold + Blur + ADD 做一次全屏效果，且必须性能测试通过后再加。
- 不使用 SpriteGPULayer / TilemapGPULayer：当前实体规模不需要，且逐个体交互/特效更复杂。
- 不写自定义 shader/render node：需求可全部用标准对象 + 少量滤镜实现，降低 Phaser 4 新渲染架构的移植风险。
- WebGL 上下文丢失由 Phaser 4 自动恢复；不缓存任何原生 GL 资源。

### 7.5 战斗反馈清单

| 事件 | 表现 |
| --- | --- |
| 塔开火 | 炮塔后坐 Tween、炮口闪光、短促音效 |
| 脉冲命中 | 小火花、目标闪白 60 ms |
| 榴弹落点 | 环形冲击波 + 粒子 + 轻微震动 |
| 电弧连锁 | 折线闪电逐段亮起后淡出 |
| 减速 | 目标叠一层青色霜冻色调/粒子 |
| 击杀 | 爆炸粒子 + 信用点飘字（对象池） |
| 漏怪 | 红色边缘脉冲 + 轻微震动 + 核心受击闪红 |
| Boss 出现 | 横幅、低频音、Boss 血条滑入 |
| 技能 | 预警圈 0.4 s → 光柱/冲击波 → 粒子 → 震动 |
| 升级 | 塔身光环闪一下、范围圈短暂扩张 |
| 胜利/失败 | 慢动作/核心爆炸（失败）或核心脉冲（胜利），结算遮罩淡入 |

开启“减少动态效果”时：关闭震动、停止背景漂移、粒子数量减半、技能/漏怪不闪烁（改为静态高亮）。

---

## 8. UI 实现

### 8.1 布局常量

| 区域 | 坐标/尺寸 |
| --- | --- |
| 逻辑画布 | 1280×720 |
| 顶部 HUD | y 0–64，全宽 |
| 战场 | y 64–624，全宽 |
| 网格 | 18×8，单格 64，起点 (64, 88) |
| 底部建造栏 | y 624–720，全宽 |
| 建造位点击区 | 至少 56×56 |
| 底部按钮 | 高 56–64 |

- 缩放：`Phaser.Scale.FIT` + `CENTER_BOTH`，`autoRound` 关闭或按默认，保持霓虹边缘平滑。
- 高 DPI 下文字若偏软，优先加粗/描边/增大字号，不引入第二套 DOM UI。
- 所有 HUD/面板固定在 UIScene，不随世界摄像机移动。

### 8.2 UI 组件

| 组件 | 内容 |
| --- | --- |
| `Hud` | 完整度、信用点、波次 N/12、击杀、剩余敌人、速度 1x–5x、音效、暂停 |
| `BuildBar` | 4 张塔卡（图标、名称、造价、快捷键、禁用态）、技能按钮、开始波次按钮 |
| `TowerPanel` | 塔名/等级、伤害、攻速、射程、升级费、卖出返还、升级/卖出按钮、目标优先级（P1） |
| `Modal` | 帮助、设置、暂停、结算；半透明背景 + 居中面板 |
| `Toast` | 短提示，2 s 自动消失，最多同时 2 条 |
| `Button` | 统一悬停/按下/禁用/焦点态；点击区 ≥ 56 px |

- 面板用 Graphics 圆角矩形 + 描边，不使用九宫格贴图；文字直接 `Phaser.GameObjects.Text`。
- HUD 数字变化用一次 Tween 放大/回弹；信用点变化显示“+N / -N”提示。
- 塔卡买不起时降低透明度并显示红边；点击仍给出 Toast 说明，而不是无响应。
- 技能按钮冷却时覆盖扇区遮罩 + 剩余秒数；瞄准时按钮高亮。
- 帮助面板列出：目标、建造/升级/卖出、护甲/减速、技能、快捷键；不依赖外部图片。

### 8.3 交互状态

```text
IDLE
 ├─ 点击塔卡 → PLACE_MODE(towerType)
 │    ├─ hover pad → 预览/合法提示
 │    ├─ 点击合法 pad → 建造 → IDLE（自动选中新塔）
 │    └─ Esc/右键/再点塔卡 → IDLE
 ├─ 点击已建塔 → TOWER_SELECTED(towerId) → 面板
 │    ├─ 升级/卖出 → 更新状态
 │    └─ 点击空白/Esc → IDLE
 ├─ 点击技能 → SKILL_AIM
 │    ├─ 点击战场 → 释放 → IDLE（冷却中）
 │    └─ Esc/右键/再点技能 → IDLE
 └─ 点击开始下一波 → PLACE_MODE 被取消 → WAVE
```

- 放置模式与塔选中互斥；打开暂停/结算时清除临时模式。
- 点击 UI 不触发战场放置。
- 所有 UI 禁用状态以 GameScene 的权威状态为准，UI 不做“乐观扣费”。
- 目标优先级切换（P1）只改变一座塔的索敌策略，立即生效。

### 8.4 响应式、移动端与可访问性

- `index.html` 使用全屏深色页面，canvas 居中；页面无滚动条。
- 竖屏（`orientation: portrait` 且宽度 < 900）显示 CSS 遮罩“请横屏游玩”，并自动暂停游戏；转回横屏后恢复遮罩隐藏，玩家点击继续。
- 移动端触摸目标 ≥ 56 逻辑像素；不依赖 hover，点击/取消均可完成操作。
- P1 移动端打磨重点：塔卡与建造位点击热区、技能瞄准、面板遮挡、横屏安全区。
- 键盘：1–4 选塔，Q 技能，U 升级，S 卖出，F 速度，Space/Esc 暂停/关闭，Enter 开始下一波。
- 设置中的“减少动态效果”通过 `SettingsData.reducedMotion` 控制 EffectsSystem、星云漂移和震屏；“自动下一波”通过 `SettingsData.autoNextWave` 保存，准备阶段由真实时间倒计时触发 `startWave()`，暂停时不递减。
- 文字与背景对比度 ≥ 4.5:1（主要 HUD 文本）；不使用颜色作为唯一状态编码。

---

## 9. 性能设计

### 9.1 规模预算

| 项目 | 上限/目标 |
| --- | --- |
| 同时存活敌人 | ≤ 80（实际峰值预计 < 30） |
| 同时存在投射物 | ≤ 120 |
| 粒子 | ≤ 300 |
| 飘字 | ≤ 30 |
| 防御塔 | ≤ 16 |
| 模拟频率 | 60 Hz（1x–5x 时 60–300 步/秒） |
| 触发滤镜的对象 | ≤ 3 |
| 绘制批次 | 不强制数字；保持同类精灵相邻、避免频繁切换纹理 |

### 9.2 优化策略

- **对象池**：投射物、飘字、常用粒子/冲击波；避免战斗中频繁创建/GC。
- **零热路径分配**：模拟步内避免 `new Vector2`、临时数组、字符串拼接；复用 Vector、预分配数组；使用 swap-pop 删除。
- **只更新变化项**：HUD 文本按事件更新；技能冷却只更新 Graphics；塔范围圈只在选择/升级时重绘。
- **无物理引擎**：无 Arcade/Matter 的碰撞查询和刚体开销。
- **不做逐帧深度排序**：使用固定 Depth 常量（背景 < 路径 < 建造位 < 塔 < 敌人 < 投射物 < 特效 < UI）。
- **文本**：HUD 中的动态数值使用固定宽度的文本对象并更新 `setText`；不在每帧创建 Text。
- **粒子**：默认中低数量；Boss/技能等大场面使用一次性爆发后回收；减少动态效果时减半。
- **5x 速度**：只增加模拟步数，不提高渲染频率；音频做节流。
- **固定预算**：当投射物/粒子达到上限时复用最旧对象，不无限增长。

### 9.3 性能验证

- DEV 构建提供调试 HUD：FPS、模拟步数/帧、敌人/投射物/粒子数量、当前波次（`?debug=1` 或 `import.meta.env.DEV`）。
- 在第 11、12 波用调试工具生成压力场景，记录 Chrome Performance 面板的帧时间与长任务。
- 重点检查：GC 尖峰、滤镜对象数量、Text 重建、粒子爆发、2x 下的音频/更新频率。
- 验收参考环境：Windows 11 + Chrome 最新 + 1920×1080；同时人工检查 1280×720 与 844×390 横屏。

---

## 10. 测试与验收方案

### 10.1 测试分层

| 层 | 手段 | 覆盖 |
| --- | --- | --- |
| 纯逻辑单元测试 | Vitest（Node） | 伤害/护甲/减速、索敌、路径、经济、评分、配置完整性 |
| 类型/构建 | `tsc --noEmit`、`vite build` | 类型错误、死代码/打包问题 |
| 浏览器手动验收 | Chrome + 本地 preview | 全流程、UI、输入、音频、性能、响应式 |
| 开发工具 | DEV 调试面板 | 跳波、加钱、秒杀、压力测试 |
| 视觉检查 | 截图（1280×720、844×390） | 布局、遮挡、文字、特效可读性 |

不在 MVP 引入 Playwright/Cypress：本项目的核心风险是数值规则与 Canvas 手感，单元测试 + 浏览器手测性价比更高。若后续需要回归自动化，可再引入 Playwright 做启动冒烟。

### 10.2 单元测试清单

| 文件 | 用例 |
| --- | --- |
| `combat.test.ts` | 护甲减伤；最小 1 点；无视护甲；减速取最强/刷新；Boss 减速抗性；分裂只发生一次；死亡只结算一次奖励 |
| `targeting.test.ts` | first/strongest/nearest 排序；射程过滤；并列时稳定排序；无候选返回 null |
| `path.test.ts` | 累计长度；中点插值；转角方向；超界钳制；终点判定 |
| `economy.test.ts` | 扣费不足拒绝；卖出 70% 向下取整；总投入计算；清波奖励只发一次；完整度不为负 |
| `score.test.ts` | 胜利/失败公式；最佳分取最大；边界 0 |
| `config.test.ts` | 12 波存在；塔 3 级且升级费/数值合法；敌人引用有效；建造位不重叠路径；Boss 唯一；波次总数与需求一致 |

### 10.3 开发调试能力（仅 DEV）

- `?debug=1` 显示 FPS/实体计数/波次状态。
- 快捷键（仅 DEV）：加 500 信用点、跳至下一波、清除场上敌人、无敌/不扣完整度、直接胜利/失败。
- 调试面板不进入生产构建的 UI；通过 `import.meta.env.DEV` 包裹，避免线上作弊入口。
- 用调试能力快速到达第 6/11/12 波做平衡与性能检查，但仍需至少一次完整真实通关。

### 10.4 手动 QA 矩阵

| 场景 | 检查点 |
| --- | --- |
| 首次启动 | 标题、帮助、开始；无控制台错误；WebGL2 提示逻辑 |
| 完整通关 | 12 波、Boss、胜利结算、评分、最佳成绩保存 |
| 失败路径 | 放怪至完整度 0；失败结算；重开恢复初始状态 |
| 建造 | 每种塔、每个建造位、余额不足、占用位、取消放置 |
| 升级/卖出 | 3 级数值、返还、波次中操作、面板同步 |
| 技能 | 瞄准、取消、冷却、暂停中不可用、范围伤害 |
| 速度/暂停 | 1x–5x 冷却一致；暂停不推进；切后台自动暂停 |
| 响应式 | 1024×640、1280×720、1920×1080、844×390 横屏、竖屏提示 |
| 音频 | 首次手势后发声、静音、刷新后静音状态 |
| 重开/返回 | 连续重开 3 次、返回菜单再开始、无重复监听/计时器 |
| 性能 | 第 12 波峰值、2x、粒子密集、无长任务/GC 卡顿 |

### 10.5 命令与验收映射

```bash
pnpm install
pnpm typecheck   # NFR-04
pnpm test        # 10.2 单元测试
pnpm build       # 生产构建
pnpm preview     # 本地验收
```

需求文档第 12 节的 12 项 DoD 逐项映射到上述测试手段；交付时附：
- 实际依赖版本与构建产物摘要；
- 单元测试结果；
- 关键截图（主菜单、准备阶段、战斗、Boss、结算）；
- 手动 QA 记录（通过/问题/已知限制）；
- README 的运行与操作说明。

---

## 11. 实施计划

按顺序推进，每个里程碑可独立验收；不跨阶段堆功能。

### M0 · 脚手架与技术验证

- 自建 Vite + TS + Phaser 工程；1280×720 FIT + WebGL2 预检。
- BootScene 生成一张测试纹理；验证 Phaser 4 Filter（核心 Glow）、Scene pause/resume、固定步长循环、UIScene 输入不穿透。
- 跑通 `typecheck` / `build`；确认 Phaser 4.2.1 与 TypeScript 版本兼容。
- **退出标准**：本地页面正常显示测试场景；暂停/恢复无跳帧；构建成功；无控制台错误。

### M1 · 可玩垂直切片（Walking Skeleton）

- 网格/路径/建造位、核心；脉冲炮塔 + 跳虫；建造、经济、完整度。
- 3 个简化波次；开始波次、胜利/失败、重开；最小 HUD。
- 领域层：路径、伤害、索敌、经济、评分的初版纯函数与单元测试。
- **退出标准**：能用 1 座塔打完 3 波；重开状态干净；核心规则测试通过。

### M2 · 完整内容与流程

- 4 座塔全部攻击模式、3 级升级、卖出、目标优先级数据字段（P1 UI 可后置）。
- 全部敌人（分裂、护甲、精英、Boss）与 12 波配置。
- 轨道轰炸、暂停/1x/2x、菜单/帮助/设置、暂停/结算、音效、存档。
- 完整 HUD/建造栏/塔面板；开发调试面板。
- 第一轮平衡试玩与数值调整；补全单元测试。
- **退出标准**：完整 12 波可胜可败；所有系统按需求工作；无阻断性 bug；构建通过。

### M3 · 打磨与验收

- 程序化视觉细化、粒子/震动/飘字、Boss 表现、减少动态效果。
- 响应式与移动端横屏/触摸打磨；输入与字体细节。
- 性能压测与优化（第 12 波、2x、滤镜数量）；第二轮平衡。
- 完整手动 QA、截图、README、验收记录；修复缺陷。
- **退出标准**：需求文档第 12 节 DoD 全部通过；交付可运行的 `dist` 与文档。

---

## 12. 风险与应对

| 风险 | 概率/影响 | 应对 |
| --- | --- | --- |
| Phaser 4 较新，示例/API 与 v3 混杂 | 中/高 | 锁定 4.2.1；以安装包类型定义和官方 v4 文档/技能文件为准；M0 先验证 Filter/场景/粒子等关键 API；不照搬 v3 教程 |
| 逐对象滤镜拖垮低端机 | 中/中 | 滤镜只用于 ≤3 个对象；单位发光用加法贴图；性能不达标时移除滤镜 |
| 数值平衡耗时 | 高/中 | 配置驱动 + 调试跳波 + 早试玩；先保证“能通关”，再调难度曲线；最终数值可小幅调整 |
| 程序化美术显得简单/廉价 | 中/高 | 统一色板与剪影设计；把预算放在弹道、粒子、核心动画和 UI 质感；必要时减少单位种类但做精 |
| 输入层级/缩放导致误触 | 中/中 | UIScene 置顶 + stopPropagation + UI 悬停标志兜底；早做多分辨率手测 |
| 场景重开造成监听/计时器泄漏 | 中/高 | 生命周期清理契约；定时效果全部模拟时钟；连续重开 3 次 QA |
| 移动端性能与触控体验 | 高/中 | 桌面优先；移动为 P1；减少动态效果 + 粒子上限；横屏提示；触控热区加大 |
| 中文字体在不同系统下换行/溢出 | 中/低 | 系统字体栈 + 固定面板尺寸 + 文案长度限制；在 Windows/macOS 浏览器手测 |
| 范围蔓延（多地图/无尽/养成） | 高/中 | 明确非目标；P2 不进入本次实现；先完成单局闭环 |
| 2x 速度造成音效/粒子过密 | 中/低 | 音效节流、粒子预算、高倍速仅加速模拟不加速渲染 |

---

## 13. Phaser 4 实现注意事项

1. **渲染器**：项目明确要求 WebGL2；Canvas 已弃用。启动前做 `canvas.getContext('webgl2')` 检测，失败显示说明页。
2. **使用 v4 API**：不要使用 `preFX`/`postFX`、`setPipeline`、`BitmapMask`、`Mesh`、`Plane`、`setTintFill`、`Geom.Point` 等 v3 旧接口；Filter 使用 `enableFilters()` + `filters.internal/external`。
3. **粒子 API**：Phaser 3.60 之后与旧 `ParticleEmitterManager` 已不同；使用当前 4.2.1 的 ParticleEmitter API，并核对官方 v4 示例。
4. **对象滤镜必须显式开启**：`gameObject.enableFilters()` 后才能访问 `filters`；摄像机的滤镜默认可用。
5. **不要照搬 v3 教程中的自定义 Pipeline/Shader**；本项目不需要自定义 shader，保持标准渲染路径。
6. **上下文恢复**：Phaser 4 自动处理 WebGL context restore；不缓存原生 GL 句柄、不手动重建纹理。
7. **roundPixels**：Phaser 4 默认 false；本项目是霓虹矢量风，保持抗锯齿，不开启像素级取整。
8. **暂停**：暂停的是 Scene，不是只设一个 flag；UIScene 独立保持运行。恢复时必须重置固定步累积器。
9. **输入**：UIScene 与 GameScene 的输入处理顺序要显式控制；所有 UI 交互对象阻止事件冒泡。
10. **类型定义**：Phaser 4.2.1 自带 `types/phaser.d.ts`；Vite/TS 配置启用 DOM + ES2022；首次脚手架即验证类型检查。
11. **官方资料**：安装 Phaser 后包内提供 AI 技能文件（如 `skills/filters-and-postfx/SKILL.md`），可作为 v4 API 的实现参考；外部示例优先选择明确标注 v4 的内容。

---

## 14. 参考资料

- [Phaser 4 官网](https://phaser.io/phaser4)（当前提供 v4.2.1 下载）
- [Phaser 安装文档](https://docs.phaser.io/phaser/getting-started/installation)（npm 安装、TypeScript 定义、官方脚手架）
- [Phaser 3 vs Phaser 4：变化与升级理由](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)
- [Phaser 4 渲染器解析](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games)
- [Phaser 4.2 发布说明](https://phaser.io/news/2026/07/phaser-4-2-spine-renderer-mesh2d-stencil)
- [Phaser npm 包](https://www.npmjs.com/package/phaser)（本项目锁定 4.2.1）
- [Phaser 4 Filters 技能文件](https://cdn.jsdelivr.net/npm/phaser@4.1.0/skills/filters-and-postfx/SKILL.md)（参考 API 形态，实施以 4.2.1 类型定义为准）

---

## 15. 待确认项

与需求文档第 13 节一致：

1. 主题：深空霓虹科幻《星港防线》（推荐）；
2. 体量：1 图 12 波 + 4 塔 + 1 Boss（推荐），不做多地图战役；
3. 美术：全程序化生成（推荐），不引入外部素材包；
4. 平台：桌面优先，移动横屏 P1；
5. 语言：中文 UI。

确认后从 M0 脚手架开始实施，按 M1 → M2 → M3 推进，并在每个里程碑结束提供可运行版本与验收记录。
