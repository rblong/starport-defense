# AGENTS.md · 项目协作规则

本文件是 星际塔防 项目的常驻工作规则，DSH、Codex 以及后续任何执行器都必须遵守。

## 最高优先级规则：先需求，后实现

**用户每提出一次新需求或玩法调整，必须先整理需求文档，再改代码。**

具体要求：

1. 先创建或更新对应的需求文档：
   - 新玩法/大改：在 `docs/` 下新建编号需求文档，或更新现有 v2 需求文档。
   - 小调整：更新对应需求文档的章节、数值表与验收标准。
2. 在 [`docs/00-requirement-process.md`](docs/00-requirement-process.md) 的需求登记表中登记：
   - 需求编号
   - 用户原始要求摘要
   - 需求文档路径/章节
   - 状态（待实现 / 实现中 / 已实现 / 已验收）
3. 需求文档写清：目标、范围、非目标、数值、交互、验收标准。
4. 需求文档落盘后，才允许修改业务代码。
5. 实现完成后，必须更新：
   - `README.md` 的功能/操作/验证状态
   - `docs/03-implementation-report.md` 的实施与验收结果
   - `artifacts/` 中的验收记录
6. 如需求与既有文档冲突，以最新登记的需求文档为准，并同步修正旧文档或标注“已被取代”。

## 协作规则

- DSH 与 Codex 共享工作区；改动前先查看 `artifacts/COLLABORATION.md` 与 `artifacts/codex-to-deepseek.md`。
- 不并发修改对方负责的文件；发现代码问题先写审查记录，不直接重构建对方正在编辑的文件。
- Codex 默认只做独立审查，不修改 `src/`、`tests/`、`public/`；如需改代码先登记文件所有权。
- 不在共享工作区随意切换分支或 force push。
- 第三方素材（尤其 `artifacts/starcraft1/`）只可作为**本地可选素材包**接入
  `public/assets/sc-local/`，并通过 `scripts/stage-starcraft-pack.py` 生成；不得提交、不得随公开仓库或部署产物分发。
- 所有第三方素材接入必须有程序化 fallback；公开部署前移除素材包或替换为已授权资源。
- 语音/视觉优先使用项目内原创 TTS 与程序化图形；本地素材缺失时游戏必须正常启动。

## 当前玩法基线

- 水晶经济、制造队列、待部署、拖放/点击部署、升级/撤离。
- 最新四兵种：Marine、Goliath、攻城坦克、战列巡航舰 Battlecruiser（需求09取代此前三兵种基线）。
- 单位不会被敌人攻击（已确认）。
- 标准 12 波 + Boss + 无尽模式、1x–5x、自动下一波、高分辨率渲染继续保留。

## 常用命令

```bash
npm run typecheck
npm test
npm run build
npm run dev
```
