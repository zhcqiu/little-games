# 连连看 · 设计 Spec

**日期**：2026-05-18
**状态**：待评审
**作者**：zhcqiu + Claude
**目标**：little-games 仓库的第四款游戏（继 tetris / breakout / snake 之后）

---

## 1. 概述

### 1.1 背景

`little-games` 是面向 10 岁以下儿童的网页小游戏合集，部署在 GitHub Pages。本 spec 描述第四款游戏：**连连看**。整体风格与现有 3 款游戏对齐（同款顶栏 + 面板模板、6 主题、共享 audio-engine + global-settings、emoji 文案、离线优先、纯静态无构建）。

### 1.2 目标用户

10 岁以下儿童，主要在手机和平板上玩，必须支持触屏。家长可能在路上 / 无网环境下让孩子玩。

### 1.3 硬约束（仓库级）

- 界面全部使用简体中文，**emoji 优先**于汉字
- 手机和平板优先，竖屏 / 横屏自适应
- 必须支持触屏交互（不依赖鼠标 hover、键盘）
- 互动元素 ≥ 44×44px
- 首次在线访问后必须可离线运行（根 SW 接管，runtime caching 自动覆盖新游戏，**不动 sw.js**）
- 纯静态：HTML / CSS / JS，无构建工具，无外部 CDN，无运行时依赖

### 1.4 用户提出的核心特性

1. **两种玩法并存**，按难度档自动切换：
   - 入门档 = **翻牌配对**（Memory，所有牌背面朝上，翻 2 张配对）
   - 其余 3 档 = **经典连连看**（≤2 拐弯连线消除）
2. 棋盘上图案使用 **emoji**（零资源、跨平台原生渲染、小朋友辨识度高）
3. **4 档难度**：🌱 入门 4×4 / ⭐ 初级 6×6 / 🔥 进阶 8×10 / 💎 高手 10×12
4. 辅助功能：
   - **💡 提示** —— 高亮一对可消牌，无限次
   - **🔀 洗牌** —— 自动 + 手动，无限次
   - **⏱️ 计时 / 倍速**（进阶档可选，高手档默认开）
   - **🔥 连击 combo 加分**
5. **连线动画** —— 主题色发光彩线 + 粒子，跟 fxLevel 联动

---

## 2. 实现取向

**采用：原生 ES Modules 拆分 + DOM 网格 + Canvas 覆盖层（方案 B）**

- 棋盘 = CSS Grid + `<button class="tile">`，每 tile 直接放 emoji 字符（浏览器原生渲染、字号 `clamp()` 自适配、tap 区天然 ≥ 44×44）
- Canvas 覆盖层只画"连线路径 + 粒子"，对接现有 `effects.js` 模式
- 消除动画 = CSS transition / animation（淡出 + 缩放）
- 无构建工具，浏览器原生 `<script type="module">`
- 复用 `shared/global-settings.js` + `shared/audio-engine.js` + `shared/themes.css`

**与其它 3 游戏架构差异：**

| 维度 | snake/tetris/breakout | 连连看 |
|---|---|---|
| 渲染 | 单 canvas | DOM tiles + canvas overlay |
| 主循环 | rAF 驱动游戏逻辑 | 事件驱动；只有 effects 用 rAF |
| 命中测试 | 自绘 + 坐标反查 | 原生 button event.target |

理由：连连看本质是"grid-tap 离散事件"游戏，DOM tile 是契合手机/触屏 + 大点击区约束的最优解；Canvas overlay 保留"彩线+粒子"视觉语言不动。

---

## 3. 文件结构

```
games/lianliankan/
├── index.html          ~120 行  顶栏 + 棋盘容器 + canvas overlay + 各面板
├── style.css           ~320 行  6 主题 tile 配色 + grid layout + 面板复用
├── manifest.json       ~20 行   独立 PWA 清单
├── icon.svg                    游戏图标（连连看主题）
├── tests.html                  浏览器侧测试入口
├── tests/
│   ├── board.spec.js           findPath / hasAnySolvable / reshuffle 单测
│   ├── game.spec.js            状态机 / combo / Memory / 计分 / 存档往返
│   └── generation.spec.js      各档棋盘对数 + emoji 偶数对 + 初始有解
└── js/
    ├── main.js         ~250 行  入口 + 暂停理由计数 + 存盘/续玩 + 引导 + 面板
    ├── game.js         ~250 行  状态机 / combo / 计分 / 计时 / serialize / 事件回调
    ├── board.js        ~200 行  Int8Array 棋盘 + findPath + hasAnySolvable + reshuffle
    ├── render.js       ~200 行  DOM tiles mount + 状态 class + canvas overlay 路径绘制
    ├── input.js        ~30 行   pointerdown / target 命中 → tile.dataset.idx
    ├── effects.js      ~150 行  粒子系统 + 路径折线 + fxLevel 联动
    ├── audio.js        ~150 行  音效（select / match / miss / combo / hint / shuffle / win）
    └── settings.js     ~180 行  设置面板 + lianliankan.settings + difficulty / timed
```

仓库根改动：

- `index.html` 的 `games` 数组追加连连看卡片（含 `highScoreKey: 'lianliankan.highScore'`）
- `sw.js` **不动**（runtime caching 自动覆盖新游戏，参照 lessons-learned）

**模块边界：**

| 模块 | 职责 | 不该做的事 |
|---|---|---|
| `main.js` | 入口、串联各模块、暂停理由引用计数、存盘/续玩、键盘快捷键 | 不写游戏逻辑细节 |
| `game.js` | 状态机、combo、计分、计时器、事件分发 | 不接触 DOM |
| `board.js` | Int8Array 棋盘 + 路径算法 + 无解检测 + 洗牌 | 不写游戏状态机 |
| `render.js` | DOM tiles mount / 状态 class / canvas overlay | 不写游戏逻辑 |
| `input.js` | pointerdown → tile 命中事件 | 不重写状态机 |
| `effects.js` | 粒子 + 路径折线绘制 + 屏幕震动 | 不写棋盘绘制 |
| `audio.js` | 音效（extends AudioEngine） | 不写通用合成原语 |
| `settings.js` | 设置面板 UI + localStorage + apply() | 不内联游戏逻辑 |

---

## 4. 棋盘与连线算法

### 4.1 棋盘表示

`(rows+2) × (cols+2)` 的 `Int8Array`，外圈一圈值 `0` 作哨兵（让连线能"绕出去再绕回来"，这是连连看标准玩法）。

内部值：`0 = 空`、`1..N = emoji 索引`（高位 bit 在 Memory 档表示"已翻开"）。

### 4.2 4 档难度

| 档 | 棋盘 | 总格数 | 对数 | emoji 种类 | 玩法 | 计时默认 |
|---|---|---|---|---|---|---|
| 🌱 入门 | 4×4 | 16 | 8 | 8 种各 2 张 | **翻牌配对** | 否 |
| ⭐ 初级 | 6×6 | 36 | 18 | 9 种各 4 张 | 连连看 | 否 |
| 🔥 进阶 | 8×10 | 80 | 40 | 10 种各 8 张 | 连连看 | 可选 |
| 💎 高手 | 10×12 | 120 | 60 | 12 种各 10 张 | 连连看 | 是 |

emoji 池写死 ≥ 30 个（动物 / 水果 / 交通 / 自然 / 食物 / 表情各 5 类），生成时随机抽取。

### 4.3 连线算法 — `findPath(a, b)`

不用 BFS，用**3 段折线穷举**：

```
情形 1（0 拐弯）：a 和 b 同行/同列，中间格全空
情形 2（1 拐弯）：尝试两个角点 c = (a.r, b.c) 和 c = (b.r, a.c)
                  要求 c 为空 且 a→c、c→b 直线段全空
情形 3（2 拐弯）：枚举所有"中间行" r ∈ [0, rows+1]（含哨兵）
                  要求 (a→中间行) 列段空 且 (b→中间行) 列段空
                       且 (中间行 a.c..b.c) 段空
                  列方向同理
```

返回值：成功 → `[a, p1, ..., b]` 折线顶点数组（render.js 直接画）；失败 → `null`。

复杂度 O(rows + cols)。10×12 棋盘 ≤ 22 次条件检查 / 对。

**边界：** `findPath(a, b)` a==b 返回 null；输入越界坐标返回 null；不同 emoji 返回 null。

### 4.4 无解检测 — `hasAnySolvable()`

剩余格集合 group by emoji，每组内 `C(k,2)` 配对调 `findPath`，找到任意一对返回 `true`。10×12 最坏 60 对 ≤ 1800 次调用 × 22 检查 ≈ 4 万次基本操作，单帧内完成无感。

### 4.5 洗牌 — `reshuffle()`

收集剩余 emoji 列表，Fisher-Yates 重排后写回原位置；重排后再跑 `hasAnySolvable`，最多重试 5 次。5 次都失败 → 标记 `unsolvableEscape` 让 game.js 直接判赢（兜底，几乎不可能触发）。

剩余仅 1 对时跳过洗牌（无意义，留给玩家消）。

### 4.6 生成 — `generate(difficulty)`

按表 §4.2 抽取 emoji，按对放入数组，Fisher-Yates 全棋盘洗牌后写入 Int8Array。生成后验证 `hasAnySolvable`，否则重洗。

---

## 5. UI / 交互流

### 5.1 屏幕布局

```
+----------------------------------------------+
| 🎯 0   🔥 0连   ⏱ 0:00      ⏸  ❓  ⚙        |  顶栏 ~56px
+----------------------------------------------+
|                                              |
|    🍎  🐱  🌸  🍎      ← DOM grid             |
|    🌟  🐱  🚗  🌸        CSS grid-template     |
|    🚗  🌟  ❄️  ❄️        gap=4px               |
|                                              |
|    <canvas overlay>     ← 路径线 + 粒子        |
|                                              |
+----------------------------------------------+
|          💡 提示       🔀 洗牌                 |  底栏 ~56px
+----------------------------------------------+
```

- 棋盘容器 `aspect-ratio: cols/rows`，最大宽 `min(95vw, 95vh * cols/rows)`，居中
- tile 字号 `clamp(20px, min(8vw, 6vh), 56px)`
- canvas overlay：`position: absolute; inset: 0; pointer-events: none`，与棋盘容器同坐标系
- 顶栏：左 3 块统计（🎯 score / 🔥 combo / ⏱ 计时）+ 右 3 按钮（⏸ ❓ ⚙）
- 底栏：提示 + 洗牌按钮（入门档隐藏；无限次，按钮上不显剩余次数）
- 计时块在非计时档隐藏

### 5.2 点击状态机 —— 连线模式

```
idle ──tap T1──→ oneSelected(T1)
                      │
                      ├─ tap T1 again → idle（取消，描边消失）
                      ├─ tap T2:
                      │     T1.emoji==T2.emoji && findPath(T1,T2) != null
                      │     → matched
                      │     │
                      │     ├─ 画路径线 ~150ms（彩线 + 粒子）
                      │     ├─ 100ms 后两 tile .clearing 淡出
                      │     ├─ 250ms 后 board[T1]=board[T2]=0
                      │     ├─ 检查 hasAnySolvable() → 否则 reshuffle
                      │     ├─ 全清 → win 事件
                      │     └─ combo++（若距上次消除 ≤ 2.5s）
                      │     → idle
                      └─ tap T2 (不同 emoji 或 findPath 返回 null)
                            → T1 闪红 80ms → oneSelected(T2)
```

**isResolving 锁**：matched / win 动画期间（100~250ms）忽略所有 tap。

### 5.3 翻牌状态机 —— 入门档（Memory）

```
所有 tile 初始背面朝上（显示 ❓）。

idle ──tap T1──→ T1 翻开（emoji 显示）, oneFlipped(T1)
       │
       └─ tap T2:
            T2 立即翻开（emoji 显示）
            │
            ├─ T2.emoji == T1.emoji
            │     → 200ms 后两 tile .clearing 淡出 → idle
            └─ T2.emoji != T1.emoji
                  → 显示 600ms → 两 tile 翻回背面 → idle

期间 isResolving 锁忽略额外 tap。
```

### 5.4 事件 → 反馈对照

| 事件 | 视觉 | 音效 | 震动 | 文案 |
|---|---|---|---|---|
| 选中 | tile 描边主题色 + scale(1.05) | playSelect（短 chirp） | 5ms | — |
| 取消选中 | 描边消失 | — | — | — |
| 配对成功 | 路径彩线 + 粒子 + 淡出 | playMatch | 15ms | ✨ |
| 配对失败 | 闪红 80ms | playMiss（低音 thud） | 30ms | — |
| 连击 (combo≥2) | 大字 toast | playCombo | 20-20-60 | 🔥 N连 |
| 用提示 | 两 tile 黄色脉冲 800ms | playHint | — | 💡 |
| 自动洗牌 | 所有 tile 翻转动画 + 重新填字 | playShuffle | 50ms | 🔀 自动洗牌 |
| 手动洗牌 | 同上 | playShuffle | 50ms | 🔀 |
| 清空棋盘（win） | 全屏彩色粒子喷发 + 顶栏破纪录庆祝 | playWin | 100-50-100-50-200 | 🏆 |
| 计时模式超时 | 棋盘暗化 + gameover 面板 | playDie | 40-40-80 | ⏰ 时间到 |

**fxLevel 联动：**
- `strong`：路径线（发光彩线 + 8 颗粒子）+ tile 描边动画 + 全屏粒子
- `mild`：路径线（细线无粒子）+ tile 描边静态 + 少量粒子
- `off`：不画路径线，只 tile 高亮 + 淡出；不震动

### 5.5 面板（沿用 snake 模板）

5 个面板 / popup：
- **#help-panel** —— 怎么玩、玩法切换说明（入门=翻牌、其它=连线）、提示/洗牌说明
- **#settings-panel** —— 难度（4 段 seg） + 计时开关 toggle + 重新开始按钮；底部 hint 提示"主题/音效/动效请在主菜单 ⚙️ 里设置"
- **#gameover-panel** —— 通关：🏆 + 最终分 + 用时 + 再玩 / 分享；超时：⏰ + 已消对数 + 再玩
- **#resume-popup** —— 上次玩到一半，继续吗？
- **#tutorial-popup** —— 首次进入弹一次（`lianliankan.tutorialSeen` 写 localStorage）

**版本号：** 右下 `<div id="version-tag" class="version-tag">v1.0</div>`，沿用 snake 风格。

### 5.6 文案表

```
顶栏           🎯 本局   🔥 N连   ⏱ MM:SS

帮助面板
  🎮 目标:
    入门档：翻 2 张相同的就消除！
    其它档：用 ≤2 拐弯的折线连接 2 张相同的图案
  📱 手机/平板:
    点 1 张图 → 再点另 1 张相同的
    💡 提示  —— 高亮一对可消的
    🔀 洗牌  —— 重排剩下的图案
  🌈 设置里有啥:
    难度 / 计时
    色彩主题 / 音效 / 音乐 / 动效请在主菜单 ⚙️ 设置

设置面板
  🎯 难度    🌱 入门 / ⭐ 初级 / 🔥 进阶 / 💎 高手
  ⏱ 计时    （toggle，仅 🔥/💎 档显示）
  🔄 重新开始
  Hint: 🎨 主题 / 🔊 音效 / 🎵 音乐 / 🎬 动效请在主菜单 ⚙️ 里设置

游戏结束
  通关：🏆 + 用时 MM:SS + 🎯 最终分 + ▶️ 再玩一局 + 📤 分享成绩
  超时：⏰ + 已消 X 对 + ▶️ 再玩一局
```

---

## 6. 数据与存档

### 6.1 localStorage 字段

| Key | 内容 | 说明 |
|---|---|---|
| `lg.settings` | 共享 theme / sfxOn / bgmOn / fxLevel | 由 [[shared/global-settings.js]] 管理 |
| `lianliankan.settings` | `{ difficulty, timed }` | 私有设置 |
| `lianliankan.highScore` | `{ [difficulty]: { bestScore, fastestMs } }` | 每档独立 |
| `lianliankan.saveGame` | 当前局快照 | 见 §6.2 |
| `lianliankan.tutorialSeen` | `'1'` | 新手引导已看过 |

### 6.2 存档 schema (version 1)

```json
{
  "version": 1,
  "difficulty": "intermediate",
  "timed": false,
  "rows": 6,
  "cols": 6,
  "boardData": [/* (rows+2)*(cols+2) 个 int8 */],
  "score": 30,
  "combo": 2,
  "elapsedMs": 12340,
  "lastMatchAt": 12200
}
```

**触发存盘：** `beforeunload` / `pagehide` / `visibilitychange→hidden`。

**Restore 边界：**
- `version != 1` → 丢弃
- `rows/cols` 与存档 `difficulty` 不匹配 → 丢弃
- `boardData.length != (rows+2)*(cols+2)` → 丢弃
- 成功 restore → 把 `settings.difficulty` 同步成存档值

### 6.3 计分公式

```
单对得分 = 10 × (1 + 0.5 × max(0, combo - 1))
combo：距上次消除 ≤ 2.5s 累加，否则归 1
通关：所有对消完
通关用时：从首次 tap 到通关时刻的 elapsedMs
```

**最高分**：每档独立保存 `bestScore`（单局总分）和 `fastestMs`（通关用时）。

---

## 7. 错误处理 / 边界

| 情况 | 处理 |
|---|---|
| 同 tile 快速双击 | 第 2 次 tap 命中 selected tile → 取消选中 |
| 动画期间再点 | `isResolving` 锁忽略 tap（100~250ms） |
| emoji 池不够（理论不会） | 池硬编码 ≥ 30 个，最大档 12 种已远低于上限 |
| 续玩存档 version 不符 | 丢弃，开新局 |
| 续玩存档 board 尺寸不符 | 丢弃，开新局 |
| 计时模式中途切难度 | 弹"当前进度会丢失"确认 |
| 全部消完恰好同时无解 | win 优先于 reshuffle |
| iOS 切后台 AudioContext suspended | 沿用 `audio-engine.js` 的 `resume()` |
| 用户连点 hint 按钮 | 已高亮中再点 → 切到下一对可消的；无下一对 → 复用同一对脉冲 |
| 无解→洗牌 5 次仍无解 | 直接判赢 + toast "🎲 这局有点奇怪，自动通过" |
| `reshuffle` 仅剩 1 对 | 跳过洗牌 |
| pointer target 不是 tile（点到 gap） | 忽略 |
| `findPath` 输入越界 | 返回 null，不抛 |

---

## 8. 测试

`tests/` 下 ESM 单测，浏览器跑 `tests.html`（沿用 snake/tests 形态）。

### 8.1 `board.spec.js`

- `findPath` 同行 / 同列
- `findPath` 1 拐弯（4 种角点组合）
- `findPath` 2 拐弯（含中间行 / 中间列两种）
- `findPath` 哨兵绕外（路径经过外圈）
- `findPath` 中间格被阻挡 → null
- `findPath` 不同 emoji → null
- `findPath` a==b → null
- `findPath` 输入越界 → null
- `findPath` 各档棋盘尺寸（4×4 / 6×6 / 8×10 / 10×12）边界
- `hasAnySolvable` 全空棋盘 / 仅 1 对 / 多对无解 / 多对有解
- `reshuffle` 不改变 emoji 直方图、不改变剩余对数、洗牌后至少 1 对可消
- `reshuffle` 5 次重试失败 → 抛 `unsolvableEscape`

### 8.2 `game.spec.js`

- 状态机：idle → oneSelected → matched / mismatch / cancel 路径完整
- combo 计数 + 2.5s 时间窗口
- Memory 模式翻牌 → 翻回 / 翻消
- 计分公式（含 combo bonus）
- serialize / restore 往返 = 原 state
- 存档 version / 尺寸不符 → restore 返回 false

### 8.3 `generation.spec.js`

- 各档棋盘对数正确（8 / 18 / 40 / 60）
- emoji 直方图全偶数
- 初始 `hasAnySolvable` = true（重洗机制工作）
- 生成不依赖 Math.random 顺序（注入 seed 可复现）

### 8.4 手工冒烟

4 档各开一局，浏览器 DevTools 模拟 iPhone SE / iPad / 桌面三种 viewport，含横竖屏切换。

---

## 9. 不做的事

- 不引入外部依赖（库 / 字体 / 图标）
- 不实现网络多人 / 排行榜
- 不做"关卡 / 章节"概念，每局独立
- 不做自定义皮肤 / emoji 选择，emoji 池固定
- 不做提示 / 洗牌的次数限制
- 不动 `sw.js`（runtime caching 自动覆盖）
- 不动 `shared/` 现有模块（按现状用）

---

## 10. 参考

- [[2026-05-17-snake-design]] —— UI 模板 / 暂停理由计数 / 续玩 / 破纪录庆祝直接复用
- [[2026-05-17-breakout-design]] —— 计时 / 难度档分级思路
- `docs/architecture.md` —— 共享模块说明
- `docs/adding-a-new-game.md` —— 添加新游戏的步骤
- `docs/lessons-learned.md` —— Canvas 高 DPI / 安全区 / outline 替代 border 等坑
