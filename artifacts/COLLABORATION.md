# Agent Collaboration / 协作清单

更新时间：2026-11-07 00:25（Asia/Shanghai）

当前有两个执行器在同一个工作区：

- **DSH（本会话）**：人族单位玩法重构。
- **Codex**：独立检查与后续协作；已输出 `artifacts/independent-review.md`。

## 写作用域（避免同时改同一文件）

REQ-20261107-10：Codex按用户确认接管自然地形地图绘制与TowerView后坐力bug修复；继续保留当前路径、点位及玩法。

REQ-20261107-09：用户继续授权Codex调整首页动态地球/战列舰/喷焰、标题配色与按钮音效。本轮Codex负责菜单背景新模块、Boot/Menu、Button/音效、项目美术和相关文档/验收；DSH请勿并发修改这些文件。

### 最新交接：REQ-20261107-05

用户在 Codex 聊天中明确要求 Codex 优化界面、地图、四兵种及动画。Codex 本轮接管 `src/types.ts`、`src/data/towers.ts`、`src/assets/*`、`src/entities/*`、`src/render/*`、`src/ui/*`、`src/scenes/GameScene.ts` / `UIScene.ts` / 菜单文案、`src/game/constants.ts`、`scripts/stage-starcraft-pack.py`、对应测试，以及需求09/验收文档。DSH 请暂缓编辑这些文件，本轮以需求09为准；此前的写作用域在这些文件上由本段取代。Codex 不提交/推送双方混合改动，不切共享分支。

DSH 当前负责：

- `src/data/towers.ts`、`src/types.ts`、`src/game/*`、`src/domain/*`
- `src/scenes/GameScene.ts`、`UIScene.ts`、`MenuScene.ts`
- `src/ui/UnitCard.ts`、`ProductionTray.ts`、`Button.ts`
- `src/entities/*`、`src/render/*`、`src/systems/audio.ts`
- `public/audio/voice/*`
- `README.md`、`docs/01-04`、`docs/06-08`、`artifacts/screenshots/70-*` 至 `103-*`、本轮验收 JSON

Codex 当前负责：

- 独立检查、验收建议，优先写入 `artifacts/independent-review.md`。
- 如需修改代码，请先在此文件登记文件清单，或使用独立分支/worktree。
- Codex 已确认此分工；具体回复与后续交接请读 [`codex-to-deepseek.md`](codex-to-deepseek.md)。当前不修改业务代码、不切换共享目录分支，由 Harness 继续实现，Codex 负责独立审查和边界验收。

## 协作规则

1. **先需求，后实现**：用户每提出一次新需求，先更新需求文档并在 `docs/00-requirement-process.md` 登记，再改代码。
2. 同一时间不要修改对方负责的文件。
3. 发现对方代码问题：写入审查文件，不要直接重构对方正在改的文件。
4. 运行 `npm test` / 浏览器验收前先确认没有另一方正在写同一文件。
5. Git 使用独立功能分支（例如 `feature/terran-units` 与 `codex/review`），通过 PR 合并；不要互相 force push。
5. 第三方素材（尤其是 `artifacts/starcraft1/`）只作为本地可选包接入 `public/assets/sc-local/`，不得提交/公开分发；公开部署前移除或替换为已授权资源。游戏必须有程序化 fallback。
6. 本地素材包由 `scripts/stage-starcraft-pack.py` 生成；提交前确认 `public/assets/sc-local/` 被 `.gitignore` 排除。

## 当前状态

- 玩法重构已实现：水晶、制造队列、待部署、拖放/点击部署、机枪兵/喷火兵/攻城坦克、升级/撤离、12 段语音。
- 横向 2 倍地图已实现：世界 2560×720、36×8 网格、32 部署点；拖动/A/D/方向键平移，视角条，平移后部署与选中已验证。
- 星际素材本地包已接入：SC Marine/Tank 纹理、红色爆炸动画、12 个 WAV；仅本地 `public/assets/sc-local/`，不提交；缺包 fallback 已验证。
- 虫族敌人已接入：Zergling/Hydralisk/Lurker/Ultralisk 视觉，名称改为跳虫/刺蛇/潜伏者/雷兽；Boss 血条与下一波预览同步；缺包回退程序化纹理已验证。
- `npm run typecheck` 通过；`npm test` 33/33 通过；生产构建通过。
- 浏览器已验证制造、拖放部署、点击部署、升级、撤离、喷火兵灼烧、攻城坦克远程范围炮击、横向地图拖动/边界/平移后部署和基础战斗。
- 攻城坦克：180 水晶 / 5s；Lv1 55 伤害、射程 260、溅射 70；一次炮弹命中 6 个目标（hp 60→5）已复验。
- Codex 审查发现的语音设置问题已修复：播放中的语音会响应静音/音量变化，静音或音量归零会停止当前语音。
- 尚未提交本轮全部改动；README/docs 已按 v2 + 横向地图更新。

## 需要 Codex / 用户确认

- Codex 当前负责的具体模块和分支？
- 是否允许 DSH 现在把本轮改动提交为 `feature/terran-units` checkpoint，再继续做最终验收？
- `artifacts/independent-review.md` 可以作为协作记录保留，但不进入游戏运行资源。

## 源码同步授权（2026-11-07）

用户已在Codex聊天中明确要求“源码同步到git”，授权将双方累计工作统一提交并推送origin/main。此授权取代之前等待checkpoint确认与不提交混合改动的临时约定。原始第三方素材包、node_modules和dist继续排除；旧Carrier/Firebat未使用语音保留本地，不纳入本次提交。

Codex 正在修复 REQ-20261107-11 背景音乐，负责 src/main.ts、src/systems/audio.ts、MenuScene 播放提示及对应文档/验收脚本，延续此前视觉与音频写作用域。

REQ-20261107-12 音效/音乐独立音量：Codex 扩展负责 types.ts、save.ts、UIScene暂停设置与save测试。

Codex 继续负责 REQ-14 战场质感重做：battlefield、stage-terrain-pack、PadView、对应文档与浏览器验收。用户否定上一版视觉，不能恢复随机透明拼片或多边形高台。
