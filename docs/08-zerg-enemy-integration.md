# 需求：虫族敌人接入（打虫族）

需求编号：`REQ-20261107-04`
日期：2026-11-07
状态：已实现，浏览器已验证；素材仍为本地可选包，未提交。
关联：[`docs/07-starcraft-asset-integration.md`](07-starcraft-asset-integration.md)

## 1. 目标

把当前程序化的异星虫群替换为 Codex 素材包中的**星际争霸虫族**外观，让玩家明确“打虫族”。

- 使用本地可选素材包中的 Zergling / Hydralisk / Lurker / Ultralisk 像素帧。
- 不改变敌人路径、数量、血量、护甲、分裂、Boss 狂暴等战斗规则。
- 无本地素材包时保持现有程序化虫群，游戏可正常运行。
- 素材仍遵循 `docs/07` 的**本机可选包、不提交、不公开分发**边界。

## 2. 敌兵映射

| 当前敌人 | 新视觉 | 说明 |
| --- | --- | --- |
| scout | Zergling（跳虫） | 轻型冲锋单位 |
| runner | Zergling（跳虫） | 高速单位，复用同一帧 |
| brute | Hydralisk（刺蛇） | 重型远程单位外观 |
| splitter | Lurker（潜伏者） | 分裂单位视觉 |
| shard | Zergling 缩小版 | 分裂幼虫 |
| elite | Hydralisk 精英放大/提亮 | 精英单位 |
| boss | Ultralisk（雷兽） | 最终 Boss 视觉 |

## 3. 表现

- 敌人 sprite 使用 SC 像素帧，保留朝向旋转、受击闪白、减速/灼烧 tint、血条、Boss 光晕。
- 本地素材存在时，下一波预览图标、Boss 血条名称同步使用 Zerg 视觉/名称。
- 虫族死亡继续使用现有 Zerg death 音效映射（Zergling / Hydralisk / Ultralisk）。
- 素材缺失时下一波预览回退当前程序化纹理。

## 4. 命名

本地素材包存在时，玩家侧敌人名称改为虫族名称：

- 跳虫、迅捷跳虫、刺蛇、潜伏者、分裂幼虫、精英刺蛇、雷兽。
- Boss 相关文案从“虚空母舰”改为“雷兽”；不改变战斗数值与结算规则。

## 5. 验收标准

- [x] 有素材包时，scout/runner/brute/splitter/shard/elite/boss 均使用对应 Zerg 像素帧。
- [x] 下一波预览、Boss 血条、击杀提示的显示名称一致（跳虫/迅捷跳虫/刺蛇/潜伏者/分裂幼虫/精英刺蛇/雷兽）。
- [x] 敌人朝向/受击/减速/灼烧/Boss 光晕仍正常。
- [x] 无素材包时程序化虫群与当前名称正常显示。
- [x] 浏览器控制台无错误；`tsc`、33 个测试、生产构建通过。
- [x] `public/assets/sc-local/` 与 `artifacts/starcraft1/` 仍被忽略，不提交版权素材。

## 7. 验证记录

- `artifacts/zerg-enemy-verification.json`：本地包存在时 Zergling/Ultralisk、下一波预览、Boss 血条。
- `artifacts/zerg-fallback-verification.json`：移除素材包后程序化虫群正常启动。
- 截图：`artifacts/screenshots/102-zerg-wave.png`、`103-zerg-boss.png`。

## 6. 非目标

- 不增加虫族主动攻击玩家单位/建筑。
- 不改变敌人路径、波次数量或数值平衡。
- 不接入虫族建筑、飞龙/飞螳等其他单位。
