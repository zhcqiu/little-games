# 贪吃蛇 · 设计 Spec

**日期**：2026-05-17
**状态**：待评审
**作者**：zhcqiu + Claude
**目标**：little-games 仓库的第二款游戏（继俄罗斯方块之后）

---

## 1. 概述

### 1.1 背景

`little-games` 是面向 10 岁以下儿童的网页小游戏合集，部署在 GitHub Pages。本 spec 描述第二款游戏：贪吃蛇。整体风格与 Tetris 对齐（同款 UI 模板、主题系统、共享工具、emoji 化文案、离线优先）。

### 1.2 目标用户

10 岁以下儿童，主要在手机和平板上玩，必须支持触屏。家长可能在路上 / 无网环境下让孩子玩。

### 1.3 硬约束（仓库级）

- 界面全部使用简体中文，**emoji 优先**于汉字
- 手机和平板优先，竖屏 / 横屏自适应
- 必须支持触屏交互（不依赖鼠标 hover、键盘）
- 互动元素 ≥ 44×44px
- 首次在线访问后必须可离线运行（根 SW 接管）
- 纯静态：HTML / CSS / JS，无构建工具，无外部 CDN，无运行时依赖

### 1.4 用户提出的核心特性

1. 操作方式：**滑动转向**（4 方向 swipe）+ **长按暂停**（任意手指落下即暂停，沿用 Tetris 语义）
2. 棋盘 **12 × 16**（竖向略长）
3. 速度 **5 档手动**，不自动加速
4. 食物 **单一**：每次只有 1 个，吃 1 个 +1 分 + 身体 +1 节
5. 结束模式 **三选一**：🎯 标准 / ♾️ 穿墙 / 💖 复活
6. 视觉：表情蛇头（朝行进方向） + 主题色身体 + emoji 食物

---

## 2. 实现取向

**采用：原生 ES Modules 拆分**，照搬 Tetris 范本。

- 无构建工具，浏览器原生 `<script type="module">`
- 复用 `shared/gesture-input.js`（**新增 swipe 语义事件**）和 `shared/audio-engine.js`
- 复用 Tetris 的 CSS 变量主题系统（6 主题）、面板模板、续玩 / 破纪录 / 触觉 / 减动效模式

不引入游戏库、不引入新依赖。

---

## 3. 文件结构

```
games/snake/
├── index.html         ~110 行  画布 + 顶栏 + 设置/帮助/续玩/结束面板骨架
├── style.css          ~280 行  6 主题 + 安全区 + 桌面方向板 + 各种 popup
├── manifest.json      ~20 行   独立 PWA 清单
├── icon.svg                   游戏图标（蛇主题）
├── tests.html                 浏览器侧测试入口
├── tests/
│   └── game.test.js           纯函数测试（碰撞 / 转向 / 复活 / 食物刷新）
└── js/
    ├── main.js        ~250 行  入口 + 主循环 + 续玩 + 破纪录庆祝 + 键盘/方向板/面板
    ├── game.js        ~250 行  栅格、蛇身、食物、转向、三结束模式、tick 推进
    ├── render.js      ~180 行  Canvas 绘制（背景 / 蛇身 / 蛇头表情 / 食物 emoji / 主题）
    ├── effects.js     ~120 行  粒子（吃 / 死 / 复活）/ 屏幕抖动 / 死亡闪烁
    ├── input.js       ~10 行   re-export shim → shared/gesture-input.js
    ├── audio.js       ~160 行  音效（吃 / 转 / 死 / 复活 / 穿墙 / BGM）
    └── settings.js    ~200 行  设置面板 + localStorage
```

仓库根改动：

- `sw.js` 的 `CACHE_NAME` 从 `little-games-v6` bump 到 `little-games-v7`
- `index.html` 的 `games` 数组追加蛇卡片
- `tests/run-tests.mjs` 加 import + 新断言段
- `shared/gesture-input.js` 新增 `swipe` 事件（详见 §5.2），不影响 Tetris

### 模块边界（同 Tetris 范本）

| 模块 | 职责 | 不该做的事 |
|---|---|---|
| `main.js` | 入口、串联各模块、主循环 | 不写游戏逻辑细节 |
| `game.js` | 栅格、蛇身、食物、规则、tick 推进 | 不接触 DOM / Canvas |
| `render.js` | Canvas 绘制 | 不管特效队列 |
| `effects.js` | 粒子 / 抖动 / 闪烁状态 + 渲染辅助 | 不管基础棋盘 |
| `input.js` | re-export shim → shared/gesture-input.js | 不重写状态机 |
| `audio.js` | 该游戏所有音效（extends AudioEngine） | 不写通用合成原语 |
| `settings.js` | 设置面板 UI + localStorage + apply() | 不内联游戏逻辑 |

---

## 4. 屏幕布局

### 4.1 顶栏（沿用 Tetris 风格）

```
+----------------------------------------------+
| 🎯 12  🏆 47                ⏸  ❓  ⚙       |  ~56px
+----------------------------------------------+
```

- 左：🎯 本局分数 / 🏆 最高分数（两行堆叠，同 Tetris score-block）
- 右：⏸ 暂停 / ❓ 帮助 / ⚙ 设置（每个 44×44）
- **不要**"下一块"位（蛇没有"下一个"概念，留空更干净）

### 4.2 画布

- 12 × 16 栅格
- `cellSize = floor(min(screenWidth / 13, (screenHeight - 56 - controlPadHeight) / 17))`（多留 1 cell 边距给 outline + 间距）
- 居中显示，左右 / 上下留白
- 用 `outline: 3px solid var(--canvas-border)` 替代 border（避开 box-sizing 坑，lessons-learned §1.8）
- `touch-action: none`
- Canvas 内部尺寸 `cssSize * devicePixelRatio`，避免高 DPI 模糊

### 4.3 桌面方向板（CSS `(hover: hover) and (pointer: fine)` 限定显示）

```
        ↑
    ←   ↓   →
```

4 个 60×60 按钮，触屏隐藏。复用 Tetris `#control-pad` 样式系统。

### 4.4 面板（结构同 Tetris）

帮助 / 设置 / 重启确认气泡 / 游戏结束 / 暂停 overlay / 续玩气泡 / 浮字 toast —— 一比一沿用 Tetris 模板，只换内容文案。

### 4.5 文案表

```
顶栏           🎯 本局   🏆 最高

帮助面板
  🎮 目标:    控制蛇吃食物，吃越多越长
  📱 手机/平板:
    单指快速滑动 ↑ ↓ ← →  — 蛇下一格往那个方向走
    按住屏幕  — 蛇会停下来等你松手再走
    右上 ⚙  — 打开设置（速度、模式、主题…）
  🖱 鼠标 (电脑):  鼠标按住+滑动也行
  ⌨️ 键盘:  ← ↑ → ↓ 或 W A S D = 转向；P = 暂停；Esc = 关面板
  🌈 设置里:
    速度  — 蛇爬多快
    结束模式 — 标准/穿墙/复活
    色彩主题 — 6 种

设置面板
  🎨 色彩主题   童趣 / 糖果 / 森林 / 海洋 / 太空 / 夜空
  ⏱️ 爬行速度   🐌 ───── 🚀 （5 档）
  🏁 结束模式   🎯 标准 / ♾️ 穿墙 / 💖 复活
    说明:   🎯 撞=结束 · ♾️ 穿墙 · 💖 撞会断半身后续命
  🔊 音效 / 🎵 背景音乐 / 🎬 动效强度
  🔄 重新开始

重启确认气泡
  ⚠️ 当前进度会丢失     ❌ 取消 / ✅ 确认

续玩气泡
  📋 上次玩到一半，继续吗？     🆕 新开 / ▶️ 继续

游戏结束面板
  💥 (emoji bounce 动画)
  🎯 N    🏆 N
  ▶️ 再玩一局    📤 分享成绩 (feature-detect)

死亡浮字   😵
吃食物浮字  ✨ + 漂字 +1
穿墙浮字    ✨
复活浮字    💖
破纪录浮字   🏆 大字 + 彩色粒子
棋盘填满浮字 🏆
暂停 overlay  ⏸ + "点屏幕 / 按 P 继续"
```

---

## 5. 操作 / 手势状态机

### 5.1 整体模型

**蛇头每 tick 自动前进一格**，玩家唯一能做的就是改方向。状态机比 Tetris 简单（无双指旋转）：

```
              ┌─ touch ─┐
   IDLE ────────────────▶  DRAG  ─ swipe(threshold)→ 触发 swipe 方向（可重复）
     ◀────── lift ──────
```

任何手指落下 → 自动暂停（同 Tetris 的 pauseChange 语义）。所有手指松开 → 恢复。

### 5.2 shared/gesture-input.js 扩展

**新加一个语义事件 `swipe(dir)`**，dir ∈ `'up' | 'down' | 'left' | 'right'`。规则：

```js
// 进入 DRAG 状态时（与现有 dragOrigin 并列，独立追踪）
this.swipeOrigin = { x: f.x, y: f.y };

// 每帧 _tick 内（与现有 moveTo 逻辑并列、不互斥）
const dx = f.x - this.swipeOrigin.x;
const dy = f.y - this.swipeOrigin.y;
const threshold = Math.max(20, this.getCellSize() * 0.6);
if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) {
  const dir = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
  this.handlers.swipe(dir);
  this.swipeOrigin = { x: f.x, y: f.y };  // 锚点跟随，允许同一根手指连续多次转向
}
```

键盘：方向键 / WASD 一律额外触发 `swipe(dir)`（不影响现有 `moveTo`，Tetris 不订阅 swipe）。

Tetris 不订阅 `swipe` → 行为零变化。

`handlers.swipe` 默认值 `() => {}`，订阅前安全。

### 5.3 蛇游戏侧消费

```js
input.on('swipe', (dir) => game.queueDirection(dir));
input.on('pauseChange', (paused) => game.setPaused(paused));
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});
```

`game.queueDirection(dir)` 把 dir 写进 `nextDirection`，**但拒绝 180° 反向**（否则下一 tick 自撞必死）。一个 tick 内多次滑动 → 以最后一次为准。

### 5.4 tick 推进

```js
step(dt) {
  if (this.paused || this.dead) return;
  this.accumulator += dt;
  while (this.accumulator >= this.tickInterval) {
    this.accumulator -= this.tickInterval;
    this._advance();
  }
}

_advance() {
  if (this.nextDirection) {
    this.currentDirection = this.nextDirection;
    this.nextDirection = null;
  }
  const head = this._nextHeadCell();   // 应用 currentDirection
  // 边界 / 自撞检测，看 §6 三模式分支
  // 食物碰撞 → +1 分，不弹尾；否则弹尾 + 把 head 插入身体前端
}
```

### 5.5 长按暂停

`pauseChange(true)` 在第 1 根手指落下立即触发 → 游戏暂停，蛇停在原地。手指还在屏幕上时玩家可以多次滑动 → 每次 swipe 都把 `nextDirection` 改写。松手 → `pauseChange(false)` → 游戏从暂停恢复，下一 tick 用 `nextDirection`。

快速滑动（落下→滑→抬手 ~200ms）：暂停窗口极短，视觉上是"蛇直接转弯"。
真"长按思考"（手指放着不动）：游戏冻结，蛇等玩家想清楚。

### 5.6 防误触

- 滑动阈值：`max(20px, cellSize * 0.6)`，确保小屏幕也能稳定识别
- 不允许 180° 反向（直接忽略 swipe）
- 一根手指期间可以连续多次 swipe（如先上后右走 L 形），但每次都要重新滑过阈值
- 多指落下：所有指都算"按下"，pauseChange 仍只触发一次

### 5.7 桌面方向板按钮

`#control-pad` 的 4 个按钮 onclick 直接调 `game.queueDirection('up' / 'down' / 'left' / 'right')`，**不**走 `swipe` 事件（按钮无需走手势识别，且要顺便 `audio.unlock()`）。

---

## 6. 游戏规则

### 6.1 棋盘与初始状态

- 12 列 × 16 行，索引从 0 起，左上 (0,0)、右下 (15,11)
- 蛇初始长度 4，水平方向：蛇头在 (row=8, col=7)，身体依次 (8,6) (8,5) (8,4)
- `currentDirection = 'right'`，`nextDirection = null`
- 首颗食物：从所有非蛇身格里均匀随机抽一个

### 6.2 速度档位

| 档位 | tickInterval（ms/格） | 备注 |
|---|---|---|
| 1（最慢，默认） | 400 | 2.5 格 / 秒 |
| 2 | 300 | ~3.3 格 / 秒 |
| 3 | 220 | ~4.5 格 / 秒 |
| 4 | 160 | 6.25 格 / 秒 |
| 5（最快） | 110 | ~9 格 / 秒 |

设置滑条改动**立即生效**：当前累积 tick 走完按新速度。**不自动加速**。

### 6.3 推进规则

每 tick：

1. 应用 `nextDirection`（若有且非反向）到 `currentDirection`，清空 `nextDirection`
2. 计算下一蛇头格 `nextHead = head + dirVector(currentDirection)`
3. 边界检查（按结束模式分支，§6.4）
4. 自撞检查：若 `nextHead` 命中蛇身（**不含**即将被弹出的尾巴）→ 死亡分支
5. 食物检查：若 `nextHead === food`，吃食物：+1 分，**不弹尾**（身体顺势加长 1），重新生成食物
6. 否则正常前进：把 `nextHead` 压入身体头部，弹出尾

数据结构：用数组存身体（`this.snake = [{row, col}, ...]`，[0] 是头）。蛇短，O(N) 自撞检查能接受；192 格上限。

### 6.4 三种结束模式

| 模式 | 撞墙 | 撞自己 |
|---|---|---|
| 🎯 **标准** | 死亡 → 结束面板 | 死亡 → 结束面板 |
| ♾️ **穿墙** | 从对边出现（pass-through），✨ 浮字 | 死亡 → 结束面板 |
| 💖 **复活** | 死亡 → 抖落后半身体 + 1 秒无敌闪烁 + 复活音 + 浮字 💖 | 同左 |

**复活模式细节**：

- **回滚致死那一步推进**：蛇头保持在上一 tick 末的位置不动（不真的进入墙 / 自身）
- 保留**前** `Math.max(2, Math.floor(length / 2))` 节（蛇头 + 紧邻的若干身体），抖落尾段
- `currentDirection` 不变；`nextDirection` 清空（玩家想转就重新滑）
- 1 秒无敌期：渲染时蛇身整条 alpha 在 1.0 / 0.4 之间 100ms 周期闪烁；逻辑上无敌期内撞墙临时按"穿墙"处理、撞自己直接跳过判定
- 砍尾后理论上不会自重叠（保留的是前半段连续节）；即便边界情况导致重叠，无敌期会盖过
- **分数不清零**（这是儿童友好的关键）
- 无次数上限（小朋友可以无限复活）

模式可在设置面板里**实时切换**。切换瞬间生效——例：标准 → 穿墙 后下一 tick 起就允许穿越；穿墙 → 标准 后下一 tick 起撞墙就死。

### 6.5 持久化

- `snake.highScore` — 整数最高分
- `snake.settings` — `{ speed, endMode, sfxOn, bgmOn, theme, fxLevel }`
- `snake.saveGame` — 续玩快照：`{ v, snake: [{row,col}], direction, nextDirection, food: {row,col}, foodEmoji, score, reviveInvincibleMs }`

启动检测 saveGame → 弹"📋 上次玩到一半，继续吗？"气泡，逻辑套 Tetris 的 `resumePending` 守卫（lessons-learned §1.5）。

`localStorage` 不可用时静默用默认值，不报错（lessons-learned §J）。

### 6.6 棋盘填满

理论上当蛇 length = 192 时无格放食物。处理：弹胜利浮字 🏆 + 走结束面板（按标准结束流程）。**优先级低**，能跑到再说。

---

## 7. 视听 FX 详细规范

### 7.1 视觉 FX

#### 7.1.1 蛇身

- 单元格内画圆角方块（圆角 `cellSize * 0.25`），主题 `--primary` 填充
- **头朝向**用 emoji 🐍（或 😋）画在头格中央：`ctx.save()` → 平移到格中心 → `ctx.rotate(angleByDir)` → `fillText('🐍')` → `ctx.restore()`
- 尾段稍微淡（alpha 渐变 1.0 → 0.85），让蛇有"动"的感觉
- 复活无敌期：整条蛇 alpha 在 1.0 ↔ 0.4 之间 100ms 周期闪烁

> 备选：纯色块 + 头部画两个小白圆点当眼睛（不用 emoji 旋转）。实施时若 emoji 旋转效果不佳可换。

#### 7.1.2 食物

- 每次生成时从 emoji 池随机抽一个：🍎 🍓 🍒 🍇 🍌 🍑 🥕 🌽 🍄
- 单 cell 居中，emoji 字号 `cellSize * 0.9`
- "脉冲"动画：基于 `performance.now()` 每 700ms 在 0.95 ↔ 1.05 倍缩放间呼吸（`Math.sin`），告诉小朋友这是目标
- 选中 emoji 写入 game state（`game.foodEmoji`），续玩可恢复

#### 7.1.3 背景栅格

极淡的 `--canvas-grid` 1px 网格线，与 Tetris 一致。

#### 7.1.4 粒子（effects.js）

| 触发 | 粒子数 | 颜色 | 初速 | 寿命 |
|---|---|---|---|---|
| 吃食物 | 8 | 主题 `--primary` + 暖色调 | ±150 px/s 水平、−200 ~ −400 px/s 垂直 | 600ms |
| 死亡 | 16 | 红 + 橙 + 黄 | 全方向 360° 散射 ±250 px/s | 800ms |
| 复活 | 12 | 主题色 + 粉 + 浅紫 | 全方向散射 ±180 px/s + 上升 | 700ms |

物理 `gravity = 980 px/s²`，alpha 线性渐 0。共用 effects.js 的粒子池。

#### 7.1.5 屏幕抖动

| 事件 | amp | dur |
|---|---|---|
| 吃食物 | 3 px | 80 ms |
| 死亡 | 14 px | 240 ms |
| 复活 | 8 px | 180 ms |

`effects.setIntensity(0)` 时全部跳过（减动效模式）。

#### 7.1.6 浮字 toast

复用 Tetris `.clear-toast` 大字弹出 + 漂浮动画：

| 事件 | toast |
|---|---|
| 吃食物 | ✨（短促） |
| 穿墙 | ✨（瞬时） |
| 复活 | 💖 |
| 破纪录瞬间 | 🏆 |
| 棋盘填满 | 🏆 |

不挡视野，900ms 自动消失。

### 7.2 听觉（audio.js extends shared/AudioEngine）

| 方法 | 描述 | 实现 |
|---|---|---|
| `playEat()` | 吃食物 | 上行小三度 C5→E5，两段 80ms 三角波，主基 + 微泛音 |
| `playTurn()` | 转向（轻轻一下） | 30ms 900Hz 正弦，gain 0.05，几乎察觉不到但确认操作 |
| `playDie()` | 死亡 | 下行 A4→F4→D4 方波 + 低通滤波，共 600ms |
| `playRevive()` | 复活 | 上行琶音 G4→C5→E5→G5，每音 80ms，三角波 |
| `playWrap()` | 穿墙瞬间 | 短促 `playNoiseSweep` 2000→200Hz, 120ms |
| `playHighScore()` | 破纪录 | 与 Tetris 同 pattern |
| `startBgm()` / `stopBgm(fadeMs)` | BGM | 8 小节 C 大调五声音阶，比 Tetris 慢一档（每拍 700ms） |

BGM 实现细节：用 `AudioContext.currentTime` 调度，**不用** setInterval。停止时**必须** `bgmController = null`（lessons-learned §1.3）。

iOS Safari 兼容：AudioContext 仅在 `input.onFirstTouch` 中创建（lessons-learned §1.6）。

### 7.3 触觉（vibrate）

| 事件 | pattern |
|---|---|
| 吃食物 | `[15]` |
| 转向（仅滑动转向触发） | `[8]` |
| 死亡 | `[40, 40, 80, 40, 120]` |
| 复活 | `[20, 30, 60]` |

`fxLevel === 'off'` 时全部跳过。

---

## 8. 设置面板

```
设置                                ✕
─────────────────────────────────────
🎨 色彩主题
   🎨 童趣  🍬 糖果  🌳 森林
   🌊 海洋  🚀 太空  🌙 夜空          (6 主题 seg-wrap)

⏱️ 爬行速度
   🐌 ●───────── 🚀                  (5 档 slider，默认 1)

🏁 结束模式
   🎯 标准  ♾️ 穿墙  💖 复活            (3 选 seg)
   说明：🎯 撞=结束 · ♾️ 穿墙 · 💖 撞会断半身后续命

🔊 音效                           🔊  (toggle)
🎵 背景音乐                       🎵  (toggle)
🎬 动效强度
   ✨ 强  🌿 弱  🚫 关                (3 选 seg)

         🔄 重新开始                   (按 → 弹"⚠️ 当前进度会丢失"确认气泡)
```

### 8.1 行为（与 Tetris 一致）

- 任何 UI 改动走 `settings.set(key, value)` → `apply()` → `save()`（lessons-learned §A）
- 没有"应用"按钮，改完立即生效
- 没有"恢复默认"按钮——避免小朋友误触
- 打开设置面板自动暂停游戏 + 停 BGM，关闭恢复

### 8.2 设置项一览

| 设置 | 默认值 | 取值 | 行为 |
|---|---|---|---|
| `theme` | `cheery` | cheery / candy / forest / ocean / space / night | 立即换主题（body data-attribute） |
| `speed` | 1 | 1-5 | 立即生效到当前局 |
| `endMode` | `standard` | standard / wrap / revive | 立即生效 |
| `sfxOn` | true | bool | 关闭后所有 SFX 调用 return |
| `bgmOn` | true | bool | 关闭时 BGM 200ms 渐隐再停 |
| `fxLevel` | `strong` | strong / mild / off | 映射 effects.intensity = 1.0 / 0.4 / 0 |
| `highScore` | 0 | int | 玩游戏自动更新 |

---

## 9. 离线方案与 PWA

### 9.1 文件

`games/snake/manifest.json`：

```json
{
  "name": "贪吃蛇",
  "short_name": "蛇",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#fff8e1",
  "theme_color": "#ff7043",
  "icons": [{ "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

`games/snake/icon.svg`：蛇主题 SVG，64×64 viewBox，主题色 + 表情蛇头（设计阶段在实施时定稿）。

### 9.2 SW 注册

`main.js` 底部：

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => console.warn('SW 注册失败：', err));
  });
}
```

三层 `..` 上溯到仓库根 sw.js（lessons-learned §1.1）。

### 9.3 缓存版本 bump

`sw.js`：`CACHE_NAME = 'little-games-v7'`（当前 v6 → v7）。`activate` 自动清旧缓存。

加 snake 资源**不需要**改 sw.js 的 PRECACHE——runtime caching 第一次访问自动入缓存。

### 9.4 首页接入

`index.html` 的 `games` 数组追加：

```js
{ title: "贪吃蛇", desc: "滑动转向，吃越多越长", emoji: "🐍",
  path: "games/snake/", highScoreKey: "snake.highScore" },
```

---

## 10. 错误处理

| 场景 | 处理 |
|---|---|
| AudioContext 创建失败 / 用户禁用音频 | try-catch + 静默 return（继承自 AudioEngine） |
| localStorage 不可用 | 设置和最高分仅当局生效，默认值兜底 |
| Service Worker 注册失败 | 不影响在线游玩，console.warn |
| 屏幕方向旋转 / resize | 监听 `resize`，重算 cell 尺寸，重绘 |
| 标签页切后台 | `visibilitychange` → 暂停 + BGM 静音；回前台不自动恢复，需用户主动点屏 |
| 触摸被父容器吞 | `<canvas>` 上 `touch-action: none` |
| 高 DPI 屏幕 | Canvas 内部尺寸 = `cssSize * devicePixelRatio` |
| 棋盘全填满 | 触发胜利浮字 🏆 + 走结束面板 |
| 续玩存盘竞态 | `resumePending` 守卫（lessons-learned §1.5） |
| BGM 控制器没 null | `stopBgm` 强制 `bgmController = null`（lessons-learned §1.3） |
| 多行同时变化（数组操作） | 用 filter / map，不用 splice + unshift 循环（lessons-learned §1.2） |

---

## 11. 测试策略

### 11.1 纯函数测试

`games/snake/tests/game.test.js` 最少覆盖：

```
[初始化]
□ 新 Game 蛇长 4，蛇头 (8, 7)，方向 right
□ 食物在非蛇身格

[转向]
□ queueDirection('up') 当前 right → nextDirection = up ✓
□ queueDirection('left') 当前 right → 拒绝（180° 反向），nextDirection 不变 ✓
□ 同一 tick 内多次 queueDirection 取最后一次

[前进]
□ tick 后蛇头按 currentDirection 推进 1 格，尾巴弹出
□ 吃食物：长度 +1，分数 +1，不弹尾，新食物在非蛇身格

[标准模式]
□ 撞墙 → dead = true
□ 撞自身 → dead = true

[穿墙模式]
□ 从右边走出 → 从左边出现（行号不变）；4 边都验证
□ 撞自身仍然 dead

[复活模式]
□ 撞墙：dead 保持 false，蛇头保持在上一 tick 位置，蛇身砍到前 max(2, floor(len/2)) 节，分数不变
□ 复活后 1 秒无敌期内再撞不会真死
□ 无敌期结束后正常死亡逻辑恢复

[食物生成]
□ 棋盘全填满时不再生成新食物（返回 null）
□ 生成的食物不与蛇身重合

[序列化]
□ serialize → restore 状态一致
□ restore 异常 / 版本号不对 → 返回 false
```

### 11.2 浏览器侧 tests.html

仿 `games/tetris/tests.html`：引入 `tests/game.test.js`，用 `window.assertEq` 全局，跑完输出绿色 ✓ / 红色 ✗ 列表。

### 11.3 Node CI

`tests/run-tests.mjs` 顶部加 import + 底部加断言段。CI（`.github/workflows/check.yml`）自动跑。

### 11.4 手动测试清单

```
[功能]
□ 滑动转向：上下左右 4 个方向都对
□ 长按暂停：手指放屏幕不动 → 蛇停 → 松手蛇继续
□ 桌面键盘 ↑↓←→ / WASD 转向
□ 桌面方向板 4 按钮
□ 180° 反向被拒绝
□ 标准模式撞墙 / 撞自己 → 游戏结束
□ 穿墙模式：4 个边都能穿
□ 复活模式：身体砍半 + 无敌 1 秒 + 分数保留

[设置]
□ 速度滑条立即生效
□ 主题切换 6 个全 OK
□ 结束模式切换：游戏中切瞬间生效
□ 音效 / BGM toggle 即时响应
□ 动效强度：强 → 弱粒子变少 / shake 变小，关全跳过
□ 重启确认气泡阻止误触

[体验]
□ 蛇头方向旋转跟手
□ 食物 emoji 每次重生换样
□ 吃食物的粒子 + 抖动 + +1 浮字
□ 死亡 / 复活 / 穿墙的视听对得上
□ 破纪录庆祝（首次超越最高分）

[离线 / 续玩]
□ 在线打开一次 → 断网刷新还能玩
□ "添加到主屏幕" → 主屏启动正常
□ 玩到一半切后台 → 回来续玩气泡 → 继续按"上次状态"
□ 续玩竞态守卫（resumePending）

[兼容]
□ iOS Safari 15+
□ Android Chrome 100+
□ iPad 横竖屏切
□ 桌面 Chrome / Firefox / Edge
```

---

## 12. 浏览器兼容性

与 Tetris 一致：

| 必须支持 | 最低版本 |
|---|---|
| iOS Safari | 15 |
| Android Chrome | 100 |
| 桌面 Chrome / Edge / Firefox | 最近 2 年 |

不支持：IE / iOS 14- / 老款 Android WebView。

---

## 附录 A：术语表

- **tick**：游戏推进的最小时间单位，由 `tickInterval` 决定（按速度档位）。每 tick 蛇前进 1 格。
- **currentDirection / nextDirection**：当前方向 / 下一 tick 要切换的方向。`nextDirection` 在 tick 起始被应用、清空。
- **180° 反向**：试图让蛇头朝身体来时方向走，会立即自撞，所以拒绝。
- **穿墙（wrap）**：走出棋盘 N 边从对边出现（col 或 row 取模数）。
- **复活（revive）**：撞死后蛇身砍半 + 无敌期，分数不清零。
- **swipe**：shared/gesture-input.js 新增的语义事件，dir ∈ `'up' | 'down' | 'left' | 'right'`。Tetris 不订阅，零影响。

---

## 附录 B：与 Tetris 共用 / 不共用一览

| 模块 / 模式 | 共用 | 备注 |
|---|---|---|
| shared/gesture-input.js | ✓（扩展） | 新增 `swipe` 事件 |
| shared/audio-engine.js | ✓ | 直接复用 |
| CSS 主题变量系统 + 6 主题 | ✓ | 复制 Tetris style.css 顶部 |
| 设置面板"立即生效 + 持久化"模式 | ✓ | lessons-learned §A |
| 续玩三重保险（beforeunload / pagehide / visibilitychange） | ✓ | lessons-learned §B |
| 续玩竞态守卫 `resumePending` | ✓ | lessons-learned §1.5 |
| 桌面方向板 + CSS media query | ✓ | lessons-learned §E |
| 减动效模式 intensity 旋钮 | ✓ | lessons-learned §D |
| 触觉反馈分级 | ✓ | lessons-learned §H |
| Web Share + 剪贴板兜底 | ✓ | lessons-learned §I |
| 破纪录 baseline 锁定 | ✓ | lessons-learned §G |
| 帮助面板模板 | ✓ | 文案换 |
| 重启确认气泡 | ✓ | 复用 |
| 游戏结束面板 | ✓ | 复用 |
| 上拉容忍 | ✗ | 蛇不需要 |
| 双指旋转 | ✗ | 蛇不需要 |
| Ghost piece / next 预览 | ✗ | 蛇不需要 |
| 无尽模式（清半区） | ✗ | 蛇用复活模式替代 |
| 行消除 / lock delay | ✗ | 蛇是连续推进，无 lock 概念 |
