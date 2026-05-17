# 打砖块 · 设计 Spec

**日期**：2026-05-17
**状态**：待评审
**作者**：zhcqiu + Claude
**目标**：little-games 仓库的第二款游戏，对齐俄罗斯方块 V1.5 的体验深度

---

## 1. 概述

### 1.1 背景

`little-games` 已落地第一款游戏俄罗斯方块（V1.5）。仓库结构、共享工具（`shared/gesture-input.js`、`shared/audio-engine.js`）、PWA / SW 模式、6 主题 CSS variables、设置面板 + 续玩 + 分享 + 破纪录庆祝 等周边都已沉淀为可复用模板。本 spec 描述第二款游戏：**打砖块**（Breakout）。

### 1.2 目标用户

10 岁以下儿童，主要在手机和平板上玩。家长可能在路上 / 无网环境下让孩子玩。

### 1.3 硬约束（来自仓库级共识）

- 界面全部使用简体中文，emoji 优先（参考 `docs/architecture.md §3.4`）
- 手机和平板优先，竖屏布局
- 必须支持触屏交互（不依赖鼠标 hover / 键盘）
- 互动元素 ≥ 44×44px
- 首次在线访问后必须可离线运行
- 纯静态：HTML / CSS / JS，无构建工具，无外部 CDN
- 无外部游戏库（Phaser/PixiJS 一律不引）

### 1.4 用户提出的核心决策

1. **关卡结构**：无尽随机（与俄罗斯方块同款节奏）
2. **失败逻辑**：掉球不扣命，扣连击倍率（combo 归 1）
3. **砖块补充**：阶梯状从顶部下移，按时间节奏注入新行
4. **结束条件**：砖块压到板拍 → 无尽模式清上半区继续；标准模式 game over
5. **板拍操作**：全画面拖动，板拍跟随手指 X 坐标
6. **道具**：轻量 3 样（加宽板拍 / 多球 / 慢球）
7. **砖块种类**：全部一击碎，颜色区分分值（1/2/3/5）
8. **Combo 机制**：每击碎 +1，上限 ×10，掉球归 1
9. **球发射**：贴在板拍中央，1.5s 后随机角度自动上发
10. **V1.0 范围**：与俄罗斯方块 V1.5 全面对齐

---

## 2. 实现取向

**采用：原生 ES Modules 拆分 + 与俄罗斯方块模块对照同构**。复用 `shared/gesture-input.js` 和 `shared/audio-engine.js`，无构建工具，零外链。

物理碰撞独立成 `physics.js` 纯函数模块，方便 CI 守护手感。

---

## 3. 文件结构

```
games/breakout/
├── index.html         ~120 行  顶栏 + canvas + 桌面方向板 + 帮助/设置/续玩/重启确认/结束 面板
├── style.css          ~200 行  CSS variables（6 主题 + 砖块色）+ 响应式布局
├── manifest.json      ~20 行   独立 PWA 清单（🧨 + "打砖块"）
├── icon.svg                    独立图标（🧨 风格 SVG）
├── tests.html                  浏览器测试入口
├── tests/
│   ├── game.test.js   ~150 行  GameLogic 纯函数测试
│   └── physics.test.js ~100 行 物理碰撞 / 反射几何测试
└── js/
    ├── main.js        ~120 行  入口、事件桥、主循环、续玩 IO
    ├── game.js        ~300 行  GameLogic：board / balls / paddle / powerups / combo / 计分
    ├── physics.js     ~120 行  AABB sweep、板拍角度反射（纯函数）
    ├── bricks.js      ~40 行   砖块定义：分值、出现权重、主题色 key（纯数据）
    ├── render.js      ~220 行  Canvas 绘制
    ├── effects.js     ~150 行  粒子 / 抖动 / 闪烁 / 浮字 / 道具光环
    ├── input.js       ~10 行   re-export `shared/gesture-input.js`
    ├── audio.js       ~180 行  extends AudioEngine：弹板 / 弹砖 / 接道具 / 掉球 / BGM
    └── settings.js    ~120 行  设置面板 + localStorage 持久化
```

### 模块边界

| 模块 | 职责 | 不该做的事 |
|---|---|---|
| `main.js` | 入口、事件桥、主循环、续玩 | 不写物理 / 渲染细节 |
| `game.js` | balls / paddle / board / powerups state + 规则 + 回调 | 不接触 DOM / Canvas / Audio |
| `physics.js` | sweep AABB、命中判定、板拍角度反射（纯函数） | 不持有 state |
| `bricks.js` | 颜色定义 + 分值 + 主题色 key | 不含逻辑 |
| `render.js` | Canvas 绘制 | 不管特效队列 |
| `effects.js` | 粒子 / 抖动 / 闪烁 / 浮字 + setIntensity | 不管基础渲染 |
| `input.js` | re-export `shared/gesture-input.js` | 不重写状态机 |
| `audio.js` | extends `AudioEngine`，本游戏所有音 | 不写通用合成原语 |
| `settings.js` | 设置 UI + localStorage + apply() | 不内联游戏逻辑 |

### 数据流

```
                pointerdown / keydown / pad-button
                       ↓
        Input(gesture-input.js) ── moveTo / pauseChange / firstTouch
                       ↓
                  main.js（事件桥）
                       ↓
                  Game.setPaddleCol(col) / setPaused(p)
                       ↓
       ┌──── balls[] ────┐
       │   paddle         │   step(dt)：物理 / 碰撞 / 计分 / 压顶 / 道具计时
       │   bricks[][]     │
       │   powerups[]     │
       │   combo          │
       └──────────────────┘
              ↓ 回调       ↓ 回调          ↓ 回调
        Audio.playBrick  Effects.spawn   main.persistSave
        Audio.playPaddle Effects.flash   main.celebrateHighScore
        Audio.playDrop   Effects.shake
              ↓
   Renderer.draw（每帧读 game + effects）
```

---

## 4. 核心机制

### 4.1 棋盘 / 板拍 / 球 / 砖块基础

- **棋盘逻辑层**：12 列 × 18 行；竖屏 9:16 友好。
- **板拍**：宽度初始 3 格（≈画布 25%），Y 固定，距底部约 2 格高。靠 `Input.moveTo(_, col)` 更新中心列。
- **球**：半径 ≈ 半格；浮点坐标，不吸附网格。速度档位 1-5：≈ 6 / 8 / 10 / 12 / 14 格/秒。**本局内球速不再加快**，靠砖块下移频率提供压力。
- **砖块**：一击碎，4 色，分值 1 / 2 / 3 / 5，初始 4 行铺底。

### 4.2 砖块色 / 分值 / 权重

| Emoji 色 | 分值 | 权重 |
|---|---|---|
| 🟦 蓝 | 1 | 5 |
| 🟩 绿 | 2 | 3 |
| 🟨 黄 | 3 | 2 |
| 🟥 红 | 5 | 1 |

CSS variable key：`--brick-1` / `--brick-2` / `--brick-3` / `--brick-5`。

### 4.3 物理 / 碰撞

- **每帧子步**：球速大时单帧拆 N 步（N = ceil(球位移 / 半格)），每步独立 AABB 判定，防穿透。
- **砖块命中**：检测穿越方向 → 反弹对应分量；同帧最多消 1 砖。
- **板拍命中（角度反射）**：命中 X 偏移占板拍半宽的比例 t ∈ [-1, 1]，反射角 θ = t × 60°（中心垂直，两端 ±60°）。这是经典 Breakout 手感。
- **墙壁**：左 / 右 / 上反射；下方出界 → 触发掉球。

### 4.4 砖块下移节奏

- 每 N 秒所有砖块下移 1 行，顶部按权重生成新行：
  - 速度档位 1 → N = 8 秒
  - 档位 2 → 7 秒
  - 档位 3 → 5 秒
  - 档位 4 → 4 秒
  - 档位 5 → 3 秒
- 节奏纯时间驱动，与击碎速率**无关**。
- 砖块占据画布 > ¾ 高度时，下一波生成前顶部闪 ⚠️ 0.3s。

### 4.5 Combo

- 每击碎 1 块 combo + 1，上限 × 10。
- 任意球掉出底部 → combo → 1。
- 每次得分 = `颜色分值 × combo`。
- 顶栏右上 `🔥 ×N`，combo == 1 时隐藏。

### 4.6 道具

击碎砖块时 **8% 概率**掉落一个 emoji 道具（3 选 1 随机），从砖块位置以 ≈ 球速一半下落。**场上最多 1 个**。板拍接住生效；漏接消失。

| Emoji | 名字 | 效果 | 时长 |
|---|---|---|---|
| 🟪 | 加宽板拍 | 板拍宽度 × 1.6 | 12 秒（栈式叠加重置计时） |
| 🌟 | 多球 | 当前每颗球各分裂一颗（同位置反向）| 直到所有球都掉光 |
| 🐌 | 慢球 | 所有球速 × 0.7 | 10 秒 |

实现要点：
- 道具效果计时器在 `game.step(dt)` 推进，到期自动恢复。
- 多球：`balls[]` 数组化，所有球各自独立物理；只有 `balls.length === 0` 才算掉球。
- 板拍宽度到期收回时，如果球当前正贴板的下沿，给一帧的"宽度过渡"避免吃球。

### 4.7 "压顶"事件

- 检测：任意砖块的**下沿 Y** 越过板拍 Y。
- **标准模式**：触发 game-over 面板。
- **无尽模式**：清掉**上半区前 9 行**，下半区 9 行**上移 9 行**填补；所有球回板拍中央，等待 1.5s 重发；combo → 1；浮字 💪。
  - 与俄罗斯方块"清下半区 + 上半下移"逻辑反向（板拍在下，下半区不可让）。

### 4.8 球发射

- 时机：开局 / 掉光所有球 / 压顶清半区后。
- 球贴在板拍中央，倒计时 1.5s（视觉上 ✨ 闪烁 + 倒计时数字）。
- 自动发射，向上 ±45° 随机角度，速度 = 当前球速档位（受慢球道具影响）。

---

## 5. 视听细节

### 5.1 主题

复用 Tetris 6 主题（童趣/糖果/森林/海洋/太空/夜空），CSS variables。在 `:root` 每主题块加：

```css
--brick-1: ...;  /* 蓝 */
--brick-2: ...;  /* 绿 */
--brick-3: ...;  /* 黄 */
--brick-5: ...;  /* 红 */
--paddle: ...;
--ball: ...;
```

Canvas 用 `getComputedStyle(document.body)` 读，主题切换零刷新。

### 5.2 特效（受 fxLevel 控制）

| 事件 | 强 (1.0) | 弱 (0.4) | 关 (0) |
|---|---|---|---|
| 击碎砖块 | 8 粒子 + 颜色闪 | 3 粒子 | 直接消失 |
| 接道具 | 板拍光环 0.5s + 浮字 emoji | 浮字 | 无 |
| 掉球 | 屏幕轻抖 + 红闪 + 浮字 "❄️" | 红闪 | 无 |
| 压顶（无尽）| 上半区横扫闪光 + 浮字 💪 + 抖 | 浮字 💪 | 浮字 💪 |
| 压顶（标准）| 全屏闪 + 抖 | 全屏闪 | 无 |
| 破纪录 | 烟花连放 1.2s + 顶栏 🏆 抖动 | 浮字 🎉 | 浮字 🎉 |

### 5.3 音效

| 事件 | 合成 |
|---|---|
| 弹板拍 | `playTone({freq:600, type:'square', duration:60, gain:0.3})` |
| 弹砖（按分值变调）| 1→440Hz / 2→554 / 3→659 / 5→880，duration 70 |
| 弹墙 | playTone freq=380 duration=40 gain=0.2 |
| 接道具 | playNoiseSweep 上扫 + 三音琶音 |
| 掉球 | `playThump from=220 to=80` |
| 压顶 | playNoiseSweep + 长音 |
| 破纪录 | 短旋律 4 音 |
| BGM | 4 小节 loop，AudioContext 调度；速度档位高时 tempo 略提 |

### 5.4 顶栏布局

```
┌─────────────────────────────────────────────────┐
│ 🎯 score  🏆 high  🔥 ×3   ⏸  ？ ⚙              │
└─────────────────────────────────────────────────┘
```

- 🔥 combo ×1 时隐藏。
- 不显示"剩余命数"——失败逻辑里没有命；用顶部 ⚠️ 预警即可。

### 5.5 帮助面板

- **🎮 目标**：让球弹来弹去把砖块都打掉，连击越长得分越高。
- **📱 手机/平板**：左右拖动 = 移板拍；按住 = 暂停。
- **🖱 鼠标**：拖动 / 屏幕底部 ← → 方向板。
- **⌨️ 键盘**：← → / A D / 空格 = 移板拍方向键 / P 暂停 / Esc 关面板 / Enter 确认。
- **🎁 道具**：🟪 加宽 / 🌟 多球 / 🐌 慢球。
- **🏁 模式**：标准 = 压到底就结束；无尽 = 压到底清上半区继续。

### 5.6 设置面板

| 字段 | 选项 | 默认 |
|---|---|---|
| 🎨 色彩主题 | 童趣 / 糖果 / 森林 / 海洋 / 太空 / 夜空 | 童趣 |
| ⏱️ 球速 | 1 / 2 / 3 / 4 / 5 | 2 |
| 🏁 结束模式 | 标准 / 无尽 | 无尽 |
| 🔊 音效 | 开 / 关 | 开 |
| 🎵 背景音乐 | 开 / 关 | 开 |
| 🎬 动效强度 | 强 / 弱 / 关 | 强 |
| 🔄 重新开始 | 按钮 | – |

### 5.7 触觉反馈

| 事件 | pattern |
|---|---|
| 弹板拍 | `[15]` |
| 接道具 | `[20, 30, 40]` |
| 掉球 | `[60, 30, 30]` |
| 压顶（无尽）| `[40, 20, 40, 20, 80]` |
| 破纪录 | `[50, 20, 60, 20, 80, 30, 120]` |

`fxLevel === 'off'` 时全部关闭。

---

## 6. 持久化

### 6.1 localStorage key namespace

| key | 内容 |
|---|---|
| `breakout.highScore` | 整数最高分 |
| `breakout.settings` | JSON：`{ speed, endMode, sfxOn, bgmOn, theme, fxLevel }` |
| `breakout.saveGame` | 续玩快照 |

### 6.2 续玩快照字段

```js
{
  board: [[colorKey|null, ...], ...],   // 12×18 网格
  balls: [{x, y, vx, vy}, ...],
  paddle: { col, widthMul, widthTimer },
  combo: 3,
  score: 1234,
  powerups: [
    { type: '🌟', activeRemain: 0 },
    { type: '🐌', activeRemain: 4200 },   // ms
  ],
  fallingItem: { type: '🟪', x, y } | null,
  brickDescentTimer: 2300,                 // 距离下一波 ms
  ballRespawnTimer: 0,                     // > 0 表示球贴板倒计时
}
```

### 6.3 续玩三事件保存

- `pagehide` / `beforeunload` / `visibilitychange → hidden` 都触发 `persistSave()`。
- `resumePending` 守卫（参考 lessons-learned §1.5）防新空局覆盖旧存档：续玩弹窗弹出前 → `resumePending = true`，用户选择前 `persistSave()` 直接 return。

---

## 7. 测试策略

### 7.1 纯函数测试

`tests/physics.test.js`：
- AABB 命中四方向反射对称性
- 板拍角度反射：中心 → 竖直；两端 → ±60°
- 子步穿透检测：单帧位移 > 砖块边长时仍正确命中
- 同帧多砖：只消第一个

`tests/game.test.js`：
- 初始状态：`score === 0`，combo == 1，球贴板拍中央
- 击碎砖块：得分 = 分值 × combo，combo 自增，封顶 10
- 掉球：combo → 1，球计时 1.5s 重发，score 不变
- 压顶（标准）：触发 game-over 回调
- 压顶（无尽）：清前 9 行 + 下半区上移 9 行；combo → 1；砖块计数守恒（不消失也不重复）
- 道具：8% 概率 / 场上至多 1 / 接住生效 / 漏接消失
- 多球分裂 + 全部掉光才算掉球
- `serialize() / restore()` 状态等同（含道具计时器）

两个测试都 import 进 `tests/run-tests.mjs`，CI 自动跑。

### 7.2 浏览器手测清单（V1.0 发布前）

- iPhone Safari + Android Chrome 各完整一局
- 切后台再回：球暂停 + 续玩弹窗不丢档
- DevTools → Offline 模式刷新仍能玩
- 6 主题逐一切换，砖块/板拍/球颜色全部跟随
- fxLevel "关" 后无粒子无抖动无震动
- 道具：连续打砖到掉道具 → 板拍接 → 生效 → 计时到期恢复
- 加宽板拍 + 多球 + 慢球三道具同时生效不冲突
- 压顶（标准）→ game-over → 再玩；压顶（无尽）→ 清半区继续
- 破纪录烟花放一次（不重复）
- 分享按钮：iOS Safari 原生分享 / 无 share API 环境复制到剪贴板 + 浮字 📋

### 7.3 SW 缓存版本

发布时 `sw.js` 的 `CACHE_NAME` 从 `little-games-v6` bump 到 `little-games-v7`。

---

## 8. 接入仓库

### 8.1 首页加卡片

`index.html` `games` 数组追加：

```js
{ title: "打砖块", desc: "弹球连击打砖，无尽模式越打越快", emoji: "🧨", path: "games/breakout/", highScoreKey: "breakout.highScore" },
```

### 8.2 CI

`tests/run-tests.mjs` 顶部 `import` 两个测试模块，底部 `eq()` 断言。

### 8.3 SW 版本

`sw.js`：`CACHE_NAME = 'little-games-v7'`。

---

## 9. 不做（YAGNI）

明确**不**在 V1.0 范围里的：

- **多血量砖块 / 不可破坏砖块**：增加复杂度但收益不大，全色一击碎已经足够策略。
- **关卡剧情 / 图形化关卡（爱心 / 星星 / 彩虹）**：无尽随机已经定了，hand-crafted 留给后续 V1.X。
- **激光 / 穿透球 / 磁阳板**：超出 3 道具范围，UI 也吃不下。
- **联网榜单 / 上传成绩**：违反离线优先约束。
- **录像 / 回放**：lessons-learned 列入"可选"，先把游戏做稳。
- **多人本地对战**：屏幕一分为二的设计成本太高。

---

## 10. 完成定义

V1.0 发布前过一遍：

```
[ ] 界面 100% 简体中文，emoji 优先
[ ] 触屏完整可玩（不需要键盘 / 鼠标）
[ ] 所有按钮 ≥ 44×44
[ ] iPhone 刘海 / 底部 home indicator 不挡 UI
[ ] 离线模式（DevTools Offline）能完整玩
[ ] iOS Safari AudioContext 首次触摸才创建
[ ] localStorage 不可用时游戏仍能玩（默认值兜底）
[ ] 主题切换无需刷新立即生效
[ ] 断线续玩不会被切后台覆盖（resumePending 守卫）
[ ] BGM 改任何设置后不会丢
[ ] 多球 + 加宽板拍 + 慢球三道具同时生效不冲突
[ ] 压顶（标准）+ 压顶（无尽）两条路径都验证
[ ] node tests/run-tests.mjs 全绿
[ ] CI 跑过
[ ] 真机 iOS + Android 至少各试 1 局
```
