# 开源项目研究：关卡、地图与波次

研究日期：2026-11-07。面向星港防线后续多关卡设计。本文是研究与建议，不改变已确认的 v2 需求，也不代表已经实现以下功能。

研究方式：阅读官方仓库、格式文档，并重点查看 Mindustry 的波次/目标源码、OpenRA 地图加载源码、SC_Js 的关卡脚本；未安装运行这些项目，未验证与 Phaser 4.2.1 的兼容性。来源链接可能随分支更新。

## 1. 最值得参考的项目

| 项目 | 实际定位 | 借鉴重点 | 对本项目的建议 |
| --- | --- | --- | --- |
| [Mindustry](https://github.com/Anuken/Mindustry) | 自动化、塔防与 RTS 游戏 | 波次组、难度参数、关卡目标与解锁 | 优先研究其数据设计，按当前玩法重新实现 |
| [OpenRA](https://github.com/OpenRA/OpenRA) | 经典 RTS 开源引擎 | 地图包、地图专属规则、任务触发 | 学习结构，不迁移整个引擎 |
| [Tiled](https://github.com/mapeditor/tiled) | 通用 2D 地图编辑器 | 图层、对象、折线、自定义属性、JSON 导出 | 可视化编辑路线和部署点的优先候选 |
| [LDtk](https://github.com/deepnight/ldtk) | 2D 关卡编辑器 | 多关卡数据、实体和字段、JSON 格式 | 作为编辑器备选，先做小规模导入验证 |
| [SC_Js](https://github.com/gloomyson/SC_Js) | HTML5 Canvas RTS | 关卡初始化、单位布置、特殊规则 | 适合快速理解 RTS 关卡，避免照搬大脚本结构 |
| [scmJS](https://github.com/scm-js/scm-js) | 星际地图编辑与回放工具 | 编辑器交互和游戏数据导入 | 学习工具体验；不作为当前地图格式基础 |

## 2. Mindustry：波次要表达编队，解锁要表达条件

[SpawnGroup.java](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/game/SpawnGroup.java) 用开始/结束波、出现间隔、初始数量、增长参数和数量上限描述一组敌人；[Waves.java](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/game/Waves.java) 组合这些组。[Objectives.java](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/game/Objectives.java) 定义目标类，[SectorPreset.java](https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/type/SectorPreset.java) 描述预设区域。

本项目可借鉴的方向：保留手工设计的战役波次；无尽模式再用参数增长。困难不应只来自血量，还可以来自敌人组合、出现节奏和路线。通关解锁使用条件记录，避免到处判断“关卡编号加一”。这些是结合源码提出的适配建议，不是直接移植。

## 3. OpenRA：一关包含地图，也包含任务规则

[Map.cs](https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Game/Map/Map.cs) 将地图元信息、地形和可选规则纳入地图加载；[地图脚本文档](https://github.com/OpenRA/OpenRA/wiki/Map-scripting) 提供任务脚本参考。

对星港防线的启发：空间布局、敌军计划和胜利目标分别配置。相同地图可以有“守住全部波次”和“坚持指定时长”两个任务；同一套编队也能在不同布局中测试。首版只实现当前的清波胜利与核心摧毁失败，后续增加目标类型时再扩展触发机制。

## 4. Tiled：适合编辑路线和点位，但需要转换层

[官方 JSON 格式](https://doc.mapeditor.org/en/stable/reference/json-map-format/) 支持对象图层、折线、点对象及自定义属性。建议约定 `routes`、`pads`、`core`、`decorations` 图层；路线使用折线，部署点和核心使用带稳定 ID 的对象。

导出后先转换成项目自己的关卡格式，再交给游戏。转换时明确编辑器像素坐标与游戏网格坐标的关系，并检验点位。第一版只支持选定的图层和属性子集，不承诺读入任意 Tiled 地图。当前六边形部署标记是表现形式，不等于必须采用六边形地图网格。

## 5. LDtk：多关卡编辑的备选

[LDtk 仓库](https://github.com/deepnight/ldtk) 和[官方 JSON 文档](https://ldtk.io/json/) 可作为关卡编辑与结构化数据的参考；官方也提供 JSON Schema。

如果后续更重视整批关卡管理和实体属性录入，可以用同一张小地图对比 LDtk 与 Tiled：各画一条路线、四个部署点和一个核心，检查导出、转换、调整成本再选。当前不同时接入两个编辑器，避免维护两套导入逻辑。

## 6. SC_Js 与 scmJS：适合看什么

[SC_Js 的 Levels.js](https://github.com/gloomyson/SC_Js/blob/master/GameRule/Levels.js) 以关卡列表和加载函数设置地图、阵营和初始单位。它便于理解完整关卡如何组装，但星港防线新增关卡应优先增加数据，避免每关继续堆初始化逻辑。原仓库明确说明已移除版权素材，不能将其当作完整素材包。

[scmJS](https://github.com/scm-js/scm-js) 可参考路线之外的地图编辑体验；其[开发说明](https://docs.scmjs.dev/development/getting-started/) 将游戏图形与代码分开，要求从游戏文件获取。它服务于星际地图兼容，当前不需要为星港防线引入完整星际地图格式。

## 7. 当前项目的具体扩展点

本节来自本地工作区的只读检查；Harness 仍在开发，文件可能继续变化。

| 当前结构 | 多关卡后的问题 | 建议 |
| --- | --- | --- |
| `src/data/level01.ts` 导出 `LEVEL_ONE` | GameScene 多处直接引用唯一地图 | 用 `levelId` 查关卡，场景持有当前关卡配置 |
| `gridToPixel` 等函数默认使用 `LEVEL_ONE` | 漏传参数可能悄悄使用旧地图坐标 | 完成迁移后要求明确传入地图配置 |
| 全局 `WAVES`、`TOTAL_WAVES` | 不同关卡不能自然拥有不同波数 | 每关绑定自己的战役波次，胜利判断读取该配置 |
| `init` / 重开主要传递 `endless` | 重开时可能丢失关卡和难度 | 明确传递 `levelId`、模式和难度 |
| `ProgressData` 只有全局最佳成绩和通关标志 | 无法记录每一关是否完成 | 按关卡 ID 保存成绩，并给存档格式加迁移 |
| 配置测试写死 12 波、16 个部署点 | 新关卡会因旧地图约束失败 | 通用合法性测试与第一关特定断言分开 |
| `isOnPath` 仅比较路径控制点 | 不能检出部署点落在长线段中间 | 检查整段路线和部署占地；区分网格几何与像素容差 |

尤其注意：`path` 当前存的是拐点，不是所有经过的格子。点位检查需要覆盖线段；路线入口允许在地图外，验证器不能一律拒绝负坐标，而应明确允许入口走廊。

## 8. 建议的最小关卡结构

先分清三个概念：地图决定空间，任务决定目标和规则，波次决定敌人何时出现。第一版可用一个文件组织，字段仍应分层。

```ts
// 设计示意，尚未加入业务代码。
type MissionDefinition = {
  schemaVersion: 1;
  id: string;
  title: string;
  mapId: string;
  waveSetId: string;
  initialCrystals: number;
  coreIntegrity: number;
  allowedUnits: string[];
  prerequisiteMissionIds: string[];
  objective: { kind: 'clearWaves' };
};
```

地图继续定义尺寸、原点、路线、部署点和核心。波次定义敌人组、数量、间隔、延迟等现有参数。采用稳定字符串 ID，显示名称或菜单排序变化不应破坏存档。

无尽模式是任务模式，不是“第 13 关”；战役的波次计数属于当前任务。多路线可预留数据设计，只有明确需要时才把 `routeId` 接入刷怪与敌人运行状态。

## 9. 建议的三关原型

以下都是待评估的设计草案，波数与奖励不作为已确认数值。

| 关卡 | 要教会玩家的决策 | 布局变化 | 观察指标 |
| --- | --- | --- | --- |
| 星港外围 | 制造、部署、升级 | 单路线，清晰的安全部署区 | 首次部署耗时、前几波漏怪率 |
| 熔炉通道 | 群伤与单体的选择 | 弯道与集中交战区 | 两兵种使用比例、喷火兵有效命中数 |
| 紧急撤离 | 持续生产、升级和撤离的取舍 | 较少高价值点位，紧凑的编队节奏 | 失败波次、闲置水晶、点位利用率 |

三关先复用敌人和两个兵种，通过布局、编队与经济产生区别。每关应该有明确的决策变化，避免只换背景并提高血量。此阶段不增加单位受击机制，以符合已确认范围。

## 10. 落地次序与验收

1. 保持第一关行为，拆出关卡目录和配置选择，去掉场景对唯一地图/固定波数的依赖。
2. 增加第二张手写配置地图，证明添加关卡不需要复制 GameScene。
3. 增加关卡选择、逐关进度与存档迁移。旧通关记录只能映射到原有任务，不能默认解锁全部新任务；旧全局评分若含无尽成绩，应保留其原含义。
4. 加入配置校验：引用存在、ID 唯一、路线非退化、入口/核心约定、部署点占地与路线不冲突、波次参数合法。
5. 内容制作开始频繁调整点位时，再接入 Tiled 转换工具和小型预览流程。

验收重点：选关→开始→重开仍是同一关；胜利只更新该关；失败不错误解锁；切关不残留队列和敌人；不同波数结算正确；旧存档可读；地图入口的越界段合法且可正常入场。

在完整模拟中记录漏怪、受击、经济和单位配置，再做难度调整。仅用总血量除以理论 DPS 无法证明可通关，因为射程覆盖、火焰角度、护甲和生产时间都会影响结果。

## 11. 本轮建议

优先吸收 Mindustry 的数据组织、OpenRA 的地图/任务分离，再用轻量配置实现两个任务。编辑器首选评估 Tiled，LDtk 保留为备选。以上是适配本项目规模的判断，不意味着这些工具已经集成。

代码结构参考与素材使用分开处理；如复制开源实现，应先核对对应版本许可。本轮仅新增研究文档，没有安装工具、修改游戏逻辑或替 Harness 扩大本轮实现范围。
