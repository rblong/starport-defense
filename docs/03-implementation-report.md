# 实施与验收报告

> 当前版本：**v2.0.0（人族作战单位玩法）**
> 需求来源：[人族作战单位玩法需求（v2）](04-unit-gameplay-redesign.md)

## 1. 本次改造摘要

将原“建造四类防御塔”玩法改造为：

- 基础货币改为**水晶**。
- 点击制造卡申请制造作战单位，水晶立即扣除并进入生产队列。
- 制造完成后单位进入待部署区，可拖放到部署点，也可点击单位再点击部署点。
- 已部署单位可选中、升级、撤离，并播放兵种专属中文语音。
- 初始三个兵种：**机枪兵**（单体点射）、**喷火兵**（扇形火焰 + 灼烧）与**攻城坦克**（远程范围炮击）。
- 已确认：**第一版单位不会被敌人攻击，也没有单位生命值/维修机制**。
- 地图扩展为 **2560×720 世界宽度（2 倍视口）**、36×8 网格、32 个部署点；相机支持左右拖动与 A/D、方向键平移，顶部显示视角条。
- 可选接入 **星际争霸本地素材包**：机枪兵/攻城坦克像素帧、红色爆炸序列、按钮/攻击/选中/升级/击杀/胜负音效；素材不提交、不随公开仓库分发，缺包自动 fallback。

保留：12 波标准战役、Boss、无尽模式、1x–5x 速度、自动下一波、下一波预览、轨道轰炸、暂停/帮助/结算、2x 内部渲染、背景铺满、本地存档。

## 2. 已实现内容

### 2.0 横向地图与相机平移

- 世界宽度 2560，逻辑视口 1280×720，地图 36×8 格、32 个部署点。
- 路径从世界左侧入口折返至最右侧指挥中心；背景/星云/暗角覆盖全宽。
- 在战场按住左键左右拖动即可平移；未超过 6px 阈值时仍按点击处理。
- `A`/`D` 与 `←`/`→` 可平移 180px/次；相机 viewX 限制在 0..1280，无黑边。
- 顶部 HUD 下方显示当前视口在世界中的位置条。
- 待部署单位拖到战场时，UIScene 只上传画布指针坐标，GameScene 用当前平移相机换算世界坐标，已验证平移后部署与选中不会偏移。
- 暂停/结算时禁止平移；点选单位与拖动地图互不误触。

### 2.1 经济与制造

- `START_CRYSTALS = 220`，HUD 改为“水晶”并使用水晶图标。
- 击杀敌人和清波奖励仍进入同一经济池，评分公式使用剩余水晶。
- 制造卡：机枪兵 60 水晶 / 2.0s，喷火兵 120 水晶 / 3.5s，攻城坦克 180 水晶 / 5.0s。
- 单生产线、队列上限 3、待部署上限 3；生产/队列/待部署状态由 GameScene 持有并通过 `game:production` 快照同步 UI。
- 制造、队列、完成、等待部署区空位均有 UI 提示或状态表现。

### 2.2 部署

- `ProductionTray` 管理生产进度、队列数量和待部署槽位。
- 拖动待部署单位时显示拖拽影像，GameScene 高亮合法部署点并显示范围预览。
- 支持点击待部署单位 → 点击部署点。
- 非法位置（非部署点、已占用）被拒绝；部署成功后才从待部署区移除。
- 部署消耗在制造时已支付，部署本身不扣水晶。

### 2.3 兵种与战斗

- 机枪兵：单发追踪弹，Lv1 伤害 12 / 间隔 0.45s / 射程 160。
- 喷火兵：正面扇形火焰，Lv1 伤害 38 / 间隔 1.7s / 射程 120 / 100° / 灼烧 8×3s。
- 三个兵种均支持 Lv2、Lv3 升级；升级扣水晶并播放升级语音。
- 攻城坦克：远程炮击，Lv1 伤害 55 / 间隔 2.8s / 射程 260 / 溅射 70；炮弹按飞行时间落到目标位置，命中范围内全部敌人。
- 撤离返还“总投入水晶”的 60%，播放撤离语音。
- 旧炮塔的减速、连锁、迫击炮溅射机制不再使用；新增火焰扇形、灼烧与坦克落点范围伤害。

### 2.4 语音

- 12 段原创中文无线电语音：3 兵种 × 选中 / 部署 / 升级 / 撤离。
- 使用本机 TTS 生成 WAV 后放入 `public/audio/voice/`，运行期不依赖在线服务。
- 选中语音与部署/升级/撤离语音均受静音与音量控制；同一条语音 1.5s 内不重复。
- 浏览器验证中已确认 WAV 请求被触发，控制台无错误。

### 2.5 可选星际素材本地包

- `scripts/stage-starcraft-pack.py` 从 Codex 整理的 `artifacts/starcraft1/` 生成本地包到 `public/assets/sc-local/`。
- 资源内容：
  - `sc-marine` / `sc-tank`：从原图集裁切的像素单位帧；
  - `sc-explosion`：9 帧红色爆炸 spritesheet；
  - 12 个 WAV：Button、Marine.selected/attack、Tank.selected/attack2、upgrade、Zergling/Hydralisk/Ultralisk death、TerranBuilding death、YouWin/YouLose。
- BootScene 异步检测本地 manifest；存在时注册纹理/动画并启用 SC 音频，缺失时静默回退。
- 机枪兵/坦克显示 SC 帧；卡片、待部署托盘同步换纹理；选中播放对应 SC selected 音效。
- 攻击、升级、击杀、胜利/失败使用对应音效；喷火兵无对应素材，保留合成音效/TTS。
- 爆炸使用 `sc-explode` 动画；动画完成自动销毁，实测可同时存在多个实例。
- `.gitignore` 排除 `public/assets/sc-local/` 和 `artifacts/starcraft1/`；公开仓库不包含版权素材。

### 2.6 UI / 文案

- 底部：三张制造卡 + 生产/待部署托盘 + 轨道轰炸 + 开始下一波 + 单位面板。
- 面板文案改为：制造终端、待部署、升级、撤离、水晶、部署点、指挥中心。
- 菜单帮助更新为制造/部署/兵种/升级/语音/水晶说明。
- 单位选中面板显示伤害、射程、间隔、扇形角度与灼烧。

### 2.7 虫族敌人

- 本地素材包存在时，敌人使用 Codex 素材中的 Zerg 像素帧：Zergling、Hydralisk、Lurker、Ultralisk。
- 映射：scout/runner/shard → 跳虫，brute/elite → 刺蛇，splitter → 潜伏者，boss → 雷兽。
- 下一波预览图标、Boss 血条与击杀提示使用虫族名称；战斗数值、路径、分裂、狂暴规则不变。
- 无素材包时仍使用程序化虫群纹理；名称保持当前虫族名称。
- 虫族死亡音效沿用 `docs/07` 的 Zergling / Hydralisk / Ultralisk death 映射。

## 3. 自动化验证

| 项目 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 7 个测试文件、**33** 个测试通过 |
| `npm run build` | 通过 |
| 测试覆盖 | 波次、敌人、单位配置、路径、索敌、护甲、评分、经济、存档、无尽波次 |

新增/更新的单元测试：

- 单位配置为 3 个兵种、各 3 级、制造时间与语音字段存在。
- 单位升级伤害递增、升级费用递增。
- 撤离返还 60%。
- 评分公式改用“水晶”。

## 4. 真实浏览器验收

Headless Chrome + CDP，1280×720、DPR 1、实际鼠标事件：

| 验收项 | 结果 |
| --- | --- |
| 主菜单进入标准模式 | 通过 |
| 底部三个制造卡（机枪兵 / 喷火兵 / 攻城坦克） | 通过 |
| 申请制造机枪兵：220 → 160 水晶，进入生产 | 通过 |
| 2 秒后机枪兵进入待部署区 | 通过 |
| 拖动到部署点完成部署 | 通过 |
| 点击待部署单位 → 点击部署点完成部署 | 通过 |
| 选中机枪兵/喷火兵/攻城坦克触发对应 WAV 语音请求 | 通过 |
| 喷火兵升级：Lv1 → Lv2，扣 100 水晶 | 通过 |
| 喷火兵撤离：返还 132 水晶（总投入 220 的 60%） | 通过 |
| 喷火兵扇形命中 5 个目标并施加灼烧 | 通过 |
| 攻城坦克制造：220 → 40 水晶，5 秒后进入待部署 | 通过 |
| 攻城坦克远程范围炮击：6 个目标同时受击 | 通过 |
| 地图世界宽度 2560、视口 1280、36×8 格、32 个部署点 | 通过 |
| 战场左拖：viewX 0 → 500，HUD 视角条更新 | 通过 |
| D/A 键平移：500 → 680 → 500 | 通过 |
| 左拖到最右侧：viewX clamp 到 1280 | 通过 |
| 平移后从待部署区拖到部署点 | 通过（单位正确落在世界坐标 pad） |
| 平移后点击已部署单位 | 通过（选中机枪兵） |
| 本地星际包纹理/动画注册 | 通过（sc-marine / sc-tank / sc-explosion / sc-explode） |
| 卡片与部署单位使用 SC 纹理 | 通过 |
| SC selected / attack / death / Button 音效请求 | 通过 |
| SC 爆炸动画多个实例同时播放 | 通过（5 个 sprite 均 playing） |
| 素材包缺失 fallback | 通过（菜单启动、程序化纹理、无运行时错误） |
| 虫族敌人纹理/下一波预览/Boss 血条 | 通过（跳虫 → Zergling、雷兽 → Ultralisk） |
| 虫族敌人无素材包 fallback | 通过（程序化 enemy-scout，无运行时错误） |
| 开始第 1 波，多兵种自动攻击、击杀敌人 | 通过 |
| 控制台异常 / 页面错误 | 0 |

验收数据：

- `artifacts/unit-gameplay-verification.json`
- `artifacts/unit-upgrade-verification.json`
- `artifacts/firebat-verification.json`
- `artifacts/tank-verification.json`
- `artifacts/map-pan-verification.json`
- `artifacts/map-runtime-verification.json`
- `artifacts/starcraft-pack-verification.json`
- `artifacts/starcraft-pack-final-verification.json`
- `artifacts/sc-pack-fallback-verification.json`
- `artifacts/zerg-enemy-verification.json`
- `artifacts/zerg-fallback-verification.json`

截图：

| 场景 | 文件 |
| --- | --- |
| 制造与部署界面 | `artifacts/screenshots/80-tank-ui.png` |
| 机枪兵部署 | `artifacts/screenshots/72-marine-deployed.png` |
| 喷火兵部署 | `artifacts/screenshots/73-firebat-deployed.png` |
| 喷火兵升级 | `artifacts/screenshots/76-firebat-upgrade.png` |
| 喷火兵灼烧 | `artifacts/screenshots/79-firebat-burn.png` |
| 攻城坦克远程炮击 | `artifacts/screenshots/83-tank-shell.png` |
| 2 倍地图左侧 | `artifacts/screenshots/90-map-wide-initial.png` |
| 拖动到地图中部 | `artifacts/screenshots/91-map-panned.png` |
| 地图最右侧（指挥中心） | `artifacts/screenshots/92-map-right-edge.png` |
| 平移后部署 | `artifacts/screenshots/93-panned-deploy.png` |
| 1920×1080 平移检查 | `artifacts/screenshots/94-map-1920-panned.png` |
| 星际素材本地包界面 | `artifacts/screenshots/99-sc-pack-final.png` |
| 星际爆炸动画 | `artifacts/screenshots/100-sc-explosion.png` |
| 星际素材静音面板 | `artifacts/screenshots/101-sc-muted.png` |
| 虫族波次 | `artifacts/screenshots/102-zerg-wave.png` |
| 最终 Boss 雷兽 | `artifacts/screenshots/103-zerg-boss.png` |
| 多兵种战斗 | `artifacts/screenshots/75-unit-combat.png` |

## 5. 与旧版本的关系

- 旧炮塔配置和数据入口被两个作战单位配置取代；`towers.ts` 保留了过渡别名以便迁移。
- 旧炮塔纹理仍可生成但不再被玩法使用；后续可清理。
- 旧版四塔/建造/卖出的玩家侧文案已替换。
- 旧版验收报告不再作为当前玩法依据；本报告为 v2 验收记录。

## 6. 已知限制

1. 单位不会受到伤害，这是已确认的第一版范围；若后续加入单位生命/维修，需要新增敌人攻击逻辑与平衡。
2. 横向地图尚未提供小地图，只提供顶部视角条；长距离拖动时定位依赖视角条。
3. 标准 12 波与无尽模式沿用旧波次；地图变长、加入坦克后，完整通关与高波次数值曲线还需要真人试玩继续调参。
3. 待部署区/生产队列暂不支持取消或退款。
4. 喷火兵火焰视觉为短时程序化扇形，后续可加强粒子与音效层次。
5. 语音为系统 TTS 生成；本地星际素材包存在时，机枪兵/坦克选中使用 SC selected 音效，其余事件保留 TTS/合成音。
6. 星际素材权利归 Blizzard 等主体；本地包不提交、不随公开仓库分发，公开部署前必须移除或替换为已授权资源。
7. 虫族敌人视觉使用本地可选包中的 Zerg 帧；无包时回退程序化虫群，名称仍为当前虫族名称。

## 7. 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```


## 8. Codex：四兵种与工业指挥台升级（2026-11-07）

- 需求：REQ-20261107-05 / docs/09-visual-command-overhaul.md。保留 Phaser 4.2.1、二维、1280×720 逻辑画面与双屏横向世界。
- 制造菜单调整为 Marine、Goliath、坦克、Carrier。成本 60/120/180/260，生产 2/3.5/5/7 秒；4 号热键新增。喷火兵不再出现在当前制造入口。
- 新增工业甲板绘制模块：2x 离屏烘焙成两块 2560px 纹理，包含板缝、铆钉、磨损、服务设施、跑道肩线、灯带与方向标。32 部署点保留；网格步长由64调为60，为150px指挥台留出空间，路线长度3060px（入口延伸至屏幕外）。
- 操作台包含可点击小地图、四制造卡、生产/待部署、遥测/升级/撤离/目标和两项指挥按钮。相机与拖放保持屏幕/世界坐标转换。
- 单位共用世界尺寸表，升级保持模型比例；16 方向渲染保留精灵透视，不再整张旋转。航母悬浮且绘制在地面单位之上。
- 虫族 Zergling/Hydralisk/Lurker 每方向7帧，Ultralisk每方向9帧；共16方向。步态根据实际移动距离更新，暂停冻结。无包时用程序化附肢动作。
- 武器新增炮口亮芯/光晕、步枪/双管曳光、重炮冲击和拦截机翼队。Goliath与航母增加独立合成射击音，并补8份原创系统TTS语音。视觉翼队不重复结算伤害。
- 验证：typecheck、33/33单测、build通过；Chrome实际输入验证制造、非法拖放、四单位部署、升级不变形、小地图跳转与步态暂停；缺包fallback制造/部署/移动通过，844×390截图已检查。浏览器脚本异常0。
- 证据：artifacts/visual-overhaul-verification.json、artifacts/screenshots/110–115。浏览器脚本 scripts/verify-visual.mjs 使用独立9233调试Chrome，额外注入水晶以覆盖高成本单位，不代表自然经济通关。
- 限制：本轮未重跑完整战役/无尽平衡，不新增玩家单位自由移动；第三方图集仍是本地可选包，未提交或公开部署。制作好的public音频与程序化图形不依赖此本地包。


## 9. 更正、品牌、人类机械风与背景音乐

REQ-20261107-06/07：游戏改名“星际塔防”；第四兵种从Carrier更正为Battlecruiser，替换本地16方向模型与程序化锤头舰体、语音、标识、舰载激光炮及合成射击音，不再生成拦截机。原有本地Carrier文件留存但不再被manifest引用。

菜单采用imagegen生成的原创深空战列舰背景（public/assets/art/terran-battlecruiser-menu.png），标题与按钮移至左侧金属指挥面板。顶部HUD增加模块化仪表窗、通风栅、铆钉及金属分层；共享按钮改为倒角装甲边框与低亮度状态灯，底部操作台同步配色。终点本地纹理为人族CommandCenter，缺包仍可运行。

背景音乐为36.92秒原创程序合成循环，22.05kHz单声道PCM WAV。首次交互后启动、菜单/暂停独立开关、持久化musicEnabled、总音量/静音即时同步、页面隐藏暂停。浏览器实测音乐loop=true、playing=true、volume=0.14（总音量50%）、零音量/静音/独立关闭均暂停；关闭设置已写入存档。

新增音乐字段对旧存档默认为开启，无需更改既有存档键。当前工作未提交/推送。基础Chrome验收、33项单测和生产构建通过；截图110–116与visual-overhaul-verification.json记录最终界面及战列舰。
