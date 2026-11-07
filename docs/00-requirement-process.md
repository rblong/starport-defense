# 需求管理流程与登记表

本文件是需求流程的常驻记录。**每次用户提出新需求，先更新需求文档并在此登记，再开始实现。**

## 1. 强制流程

1. **登记**：在下方登记表新增一行，分配需求编号（如 `REQ-20261107-01`）。
2. **写需求**：创建或更新需求文档，至少包含：
   - 背景/目标
   - 范围与非目标
   - 规则、数值、交互
   - UI/文案
   - 验收标准
3. **确认基线**：如有关键歧义，先和用户确认；需求文档稳定后才进入实现。
4. **实现**：仅修改需求所覆盖的代码/资源。
5. **验收**：更新实施报告、README 和 `artifacts/` 证据。
6. **回填状态**：把登记表状态改为“已实现/已验收”。

> 需求文档优先于聊天上下文和旧文档；冲突时以最新需求文档为准。

## 2. 需求登记表

| 编号 | 日期 | 用户要求摘要 | 需求文档 | 状态 |
| --- | --- | --- | --- | --- |
| REQ-20261106-01 | 2026-11-06 | 界面模糊，提高清晰度 | `docs/03-implementation-report.md` 验收段、`README` 高分辨率渲染 | 已验收 |
| REQ-20261106-02 | 2026-11-06 | GitHub 创建项目 | 工程交付，无游戏规则变更 | 已推送（CI workflow 待 workflow scope） |
| REQ-20261106-03 | 2026-11-06 | 速度支持 1/2/3/4/5 | `docs/01-requirements.md` 速度相关条目、`README` 操作 | 已验收 |
| REQ-20261106-04 | 2026-11-06 | 无限关/无尽模式 | `docs/01-requirements.md` FR-25、`docs/03` 验收 | 已验收 |
| REQ-20261106-05 | 2026-11-06 | 自动下一波 | `docs/01-requirements.md` FR-26、设置表、`docs/03` 验收 | 已验收 |
| REQ-20261106-06 | 2026-11-06 | 人族人员设备、水晶、制造、拖放、机枪兵/喷火兵、选中语音 | [`docs/04-unit-gameplay-redesign.md`](04-unit-gameplay-redesign.md) | 已实现，浏览器已验证 |
| REQ-20261107-01 | 2026-11-07 | 增加攻城坦克，远距离范围攻击 | [`docs/04-unit-gameplay-redesign.md`](04-unit-gameplay-redesign.md) §4.3/§8/§13 | 已实现，浏览器已验证 |
| REQ-20261107-02 | 2026-11-07 | 地图左右拖动，横向长度约为当前 2 倍 | [`docs/06-map-horizontal-expansion.md`](06-map-horizontal-expansion.md) | 已实现，浏览器已验证 |
| REQ-20261107-03 | 2026-11-07 | 接入 Codex 整理的星际争霸元素：动效、音效、图形动画 | [`docs/07-starcraft-asset-integration.md`](07-starcraft-asset-integration.md) | 已实现，浏览器已验证；素材本地包未提交 |
| REQ-20261107-04 | 2026-11-07 | 打虫族：将敌人接入星际虫族视觉 | [`docs/08-zerg-enemy-integration.md`](08-zerg-enemy-integration.md) | 已实现，浏览器已验证；素材本地包未提交 |
| REQ-20261107-05 | 2026-11-07 | 四兵种、比例、步态、射击、地图与指挥台重做 | [09-visual-command-overhaul.md](09-visual-command-overhaul.md) | 已实现，浏览器基础验收通过（Codex） |
| REQ-20261107-06 | 2026-11-07 | 航母更正为人族战列巡航舰；游戏改名星际塔防 | [09-visual-command-overhaul.md](09-visual-command-overhaul.md) 更正 | 已实现并完成基础验收（Codex） |
| REQ-20261107-07 | 2026-11-07 | 深空战列舰菜单、上下机械风、人族基地与背景音乐 | [10-terran-interface-style.md](10-terran-interface-style.md) | 已实现，基础浏览器验收通过（Codex） |
| REQ-20261107-08 | 2026-11-07 | 源码同步到 GitHub | 工程交付：源码/文档/项目资源统一提交，忽略本地第三方包 | 已完成提交前测试与构建，执行同步 |

## 3. 需求文档模板



```markdown
# 需求：<标题>

## 背景与目标
## 范围 / 非目标
## 规则与数值
## 交互与 UI
## 音频/视觉（如适用）
## 验收标准
## 对现有系统的影响
```

## 4. 当前有效文档

- [`docs/04-unit-gameplay-redesign.md`](04-unit-gameplay-redesign.md)：当前 v2 玩法权威需求。
- [`docs/06-map-horizontal-expansion.md`](06-map-horizontal-expansion.md)：横向 2 倍地图与相机平移需求。
- [`docs/01-requirements.md`](01-requirements.md)：v1 基线，玩法部分已被 v2 取代。
- [`docs/02-technical-design.md`](02-technical-design.md)：技术基线。
- [`docs/03-implementation-report.md`](03-implementation-report.md)：实施与验收报告。
- [`AGENTS.md`](../AGENTS.md)：常驻协作与流程规则。
