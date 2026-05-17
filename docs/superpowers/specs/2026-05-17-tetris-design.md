# 俄罗斯方块 · 设计 Spec

**日期**：2026-05-17
**状态**：待评审
**作者**：zhcqiu + Claude
**目标**：little-games 仓库的第一款游戏

---

## 1. 概述

### 1.1 背景

`little-games` 仓库是面向 10 岁以下儿童的网页小游戏合集，部署在 GitHub Pages（https://zhcqiu.github.io/little-games/）。本 spec 描述第一款游戏：俄罗斯方块。

### 1.2 目标用户

10 岁以下儿童，主要在手机和平板上玩，必须支持触屏。家长可能在路上 / 无网环境下让孩子玩。

### 1.3 硬约束（来自仓库级共识）

- 界面全部使用简体中文
- 手机和平板优先，竖屏 / 横屏自适应
- 必须支持触屏交互（不依赖鼠标 hover、键盘）
- 互动元素 ≥ 44×44px
- 首次在线访问后必须可离线运行
- 纯静态：HTML / CSS / JS，无构建工具，无外部 CDN

### 1.4 用户提出的核心特性

1. 砖块下落较慢，速度可手动调整
2. 下落砖块的位置用单指调整，角度用双指旋转
3. 成功消除时给予强烈的视觉和听觉刺激
4. 单人游戏

---

## 2. 实现取向

**采用：原生 ES Modules 拆分**。无构建工具，浏览器原生 `<script type="module">` 加载。

放弃单文件极简方案（800+ 行单文件难维护）；放弃引入游戏库（Phaser/PixiJS 违反"无外链 / 离线可玩"原则且学习曲线过重）。

---

## 3. 文件结构

```
games/tetris/
├── index.html          ~50 行   画布 + 顶栏 + 齿轮按钮 + 设置面板骨架
├── style.css           ~150 行  移动端响应式布局、按钮、面板
├── manifest.json       ~20 行   PWA 清单：俄罗斯方块独立 PWA
├── icon.svg                     游戏图标（SVG）
└── js/
    ├── main.js         ~60 行   入口：实例化模块、串起主循环
    ├── game.js         ~250 行  棋盘、方块、碰撞、消行、上拉容忍、游戏模式
    ├── pieces.js       ~80 行   7 种方块定义和 4 旋转态（纯数据）
    ├── input.js        ~180 行  触摸事件 → 手势状态机 → 语义事件
    ├── render.js       ~200 行  Canvas 绘制 + 粒子系统 + 屏幕抖动 + ghost
    ├── audio.js        ~150 行  Web Audio 合成：锁定 / 移动 / 旋转 / 消除 / 结束 / BGM
    └── settings.js     ~80 行   设置面板逻辑 + localStorage 持久化
```

**仓库根新增**（用于全站离线）：
```
little-games/
├── sw.js               根 Service Worker（scope = 整个站点）
├── manifest.json       首页 PWA 清单
└── icon.svg            首页图标
```

### 模块边界

每个模块单一职责，通过事件 / 显式方法调用串联：

- `input.js` 不知道有"方块"——只发 `{ type: 'moveTo', col, row }` 和 `{ type: 'rotate', dir }` 事件
- `game.js` 不知道画面长什么样——只暴露 `state` 对象给 render 读
- `render.js` 不操作游戏状态——只读 state，维护自己的粒子 / 抖动队列
- `audio.js` 由 `game.js` 在关键事件回调里触发

---

## 4. 屏幕布局

### 4.1 手机竖屏（主要布局）

```
+--------------------------------------+
| 🎮 本局: 12 行    [▢]      ⚙       |  顶栏 ~56px
|    最高: 47       下一块            |
+--------------------------------------+
|                                      |
|         ░░  ← ghost piece (半透明)   |
|         ▓▓  ← active piece           |
|        ░░░                            |
|        ▓▓▓                            |  10×20 棋盘
|                                      |  (整块都是手势区)
|                                      |
|                                      |
|  □□  □□□                             |
|  □□□□□□  □□                          |  已堆积
|  □□□□□□□□□□                          |
+--------------------------------------+
```

### 4.2 自适应

单元格尺寸：`min(screenWidth / 11, (screenHeight - 80) / 21)`，自适应竖屏 / 横屏。

| 设备 | 单元格尺寸 |
|---|---|
| iPhone SE (375px 宽) | ~34px |
| 标准手机 (390px 宽) | ~36px |
| iPad 竖屏 | ~48px+ |

横屏与平板使用同一套布局自然撑大，整体居中，左右留白。**不**做横屏分栏。

### 4.3 顶栏元素

- 左：「本局: N 行」「最高: N 行」（小字两行堆叠）
- 中：「下一块」3×3 缩略图（~50×50）
- 右：齿轮按钮 ⚙（48×48 触控区）

### 4.4 设置面板（齿轮触发，从上方滑下的全屏模态）

```
设置                                ✕
─────────────────────────────────────
下落速度       慢 ●──────────── 快
上拉容忍       [0]  [1●]  [2]
结束模式       [标准●]  [无尽]
音效                      [开●]
背景音乐                  [开●]
─────────────────────────────────────
            [  重新开始游戏  ]
```

### 4.5 游戏结束面板（仅"标准"模式触发）

```
        🎮 游戏结束
      本局消除: 12 行
      最高记录: 47 行

        [  再玩一局  ]
```

---

## 5. 手势状态机

### 5.1 三状态

`IDLE`（0 指）↔ `DRAG`（1 指）↔ `ROTATE`（2 指）。

```
            ┌─ touch ─┐                ┌─ +1 finger ─┐
   IDLE ───────────────▶  DRAG  ─────────────────────▶  ROTATE
     ◀────── lift ──────    ◀── lift one ──    ◀──────────┘
                            ◀─────── lift both ──────────┘
```

### 5.2 DRAG 状态

进入时**快照**：`origin = { touchX, touchY, pieceCol, pieceRow }`。每帧根据当前手指位置：

```
targetCol = origin.pieceCol + round((touch.x - origin.touchX) / cellSize)
desiredRow = origin.pieceRow + round((touch.y - origin.touchY) / cellSize)
minRow = piece.lowWaterMark - upwardTolerance
targetRow = clamp(desiredRow, minRow, BOARD_HEIGHT)
```

调 `game.tryMoveTo(targetCol, targetRow)`：碰撞了就尽量靠近，最后落点更新 `piece.lowWaterMark = max(lowWaterMark, piece.row)`。

**关键**：单指按下时**暂停自动下落**。允许小朋友按住思考。

### 5.3 ROTATE 状态

进入时（第 2 指落下）：`angle0 = atan2(f2.y - f1.y, f2.x - f1.x)`，`accumulator = 0`。

每帧：
```
currentAngle = atan2(f2.y - f1.y, f2.x - f1.x)
delta = wrapToPlusMinus180(currentAngle - angle0)
accumulator += delta * 0.5      // 抖动平滑
angle0 = currentAngle

if (accumulator > 30°)  → emit rotate(+1), accumulator -= 30°
if (accumulator < -30°) → emit rotate(-1), accumulator += 30°
```

旋转期间**单指 DRAG 暂停**（不同时改位置和角度）。一指离开后回到 DRAG，重新快照 `origin`。

### 5.4 旋转受阻 → wall-kick lite

`game.tryRotate(dir)` 在新角度下若有碰撞，按顺序尝试：原位 → 左 1 → 右 1 → 下 1。都不行，旋转失败（不振铃，不嘟声）。

### 5.5 Lock delay（落地缓冲）

当 `piece.tryMoveDown()` 第一次失败：开 500ms 计时器。期间任何成功的 `tryMove` 或 `tryRotate` **重置**计时器（无次数上限）。计时器触发：调 `game.lockPiece()`。

### 5.6 边界与裁剪

- 横向夹到 `[0, BOARD_WIDTH - pieceWidth]`，不振铃只夹紧
- 纵向：`piece.row >= 0` 必须满足，即使 `upwardTolerance = 2`
- `piece.lowWaterMark` 在出新方块时重置为 `piece.row`

### 5.7 防误触

- 第 2 指落下后**取消** DRAG 当帧产生的任何 step
- 一指变两指 / 两指变一指都视为"换状态"，**重新快照** origin

---

## 6. 游戏规则

### 6.1 棋盘与方块

- **棋盘**：10 列 × 20 行（不含上方 2 行 "spawn buffer"，那 2 行不可见，用于检测顶部溢出）
- **7 种方块**：I（青）、O（黄）、T（紫）、S（绿）、Z（红）、J（蓝）、L（橙）。颜色饱和度调高一档对小孩更醒目
- **4 旋转态**：每种方块 4 个状态，硬编码 4×4 网格的占位数组到 `pieces.js`

### 6.2 出牌策略：7-bag

把 7 种方块洗成一袋，依次出完后再洗下一袋。**保证 7 块内每种各出现一次**。

`下一块` 预览读 bag 的下一个；bag 空了提前补一袋。

### 6.3 出生位置

- `col = floor((10 - pieceWidth) / 2)`（居中）
- `row = -1`（出生在可见区上方一行）
- `lowWaterMark = row` 重置

### 6.4 自动下落

`fallSpeed` 由速度滑条决定，5 档：

| 档位 | 速度 |
|---|---|
| 1 (最慢) | 1500ms / 格（默认起点） |
| 2 | 1000ms / 格 |
| 3 | 700ms / 格 |
| 4 | 450ms / 格 |
| 5 (最快) | 250ms / 格 |

`requestAnimationFrame` 主循环累计 `dt`，超过 `fallSpeed` 就尝试 `tryMoveDown()`。**有手指按住 → 累计但不下落**（暂停语义）。

### 6.5 消行

每次 lock 后扫描全部 20 行：满行（10 格非空）收集到 `clearedRows[]`。

1. 触发视觉 FX（粒子 + 高亮闪烁 + 屏幕抖动，详见 §7）
2. 触发音频 FX（消除音阶，详见 §7）
3. 200ms 后真正移除这些行，上面方块下落填补
4. `score += clearedRows.length`

### 6.6 两种结束模式

新方块出生时若发生碰撞（出生位置已被占）：

- **标准模式**：游戏结束 → 显示结算面板（消除行数 + 最高分 + 再玩一局）
- **无尽模式**：清空下半区域（第 10–19 行整体清空，第 0–9 行不动）→ 继续游戏。屏幕响"哗啦"清空音 + 大范围粒子 + 浮字"继续加油！"（1 秒）

### 6.7 持久化

`localStorage` 键：

- `tetris.highScore` — 最高消除行数
- `tetris.settings` — `{ speed: 1, upwardTolerance: 1, endMode: 'standard', soundOn: true, bgmOn: true }`

游戏首次打开读取并应用；改动后立即写回。`localStorage` 不可用时静默用默认值，不报错。

---

## 7. 视听 FX 详细规范

### 7.1 视觉 FX

#### 7.1.1 Ghost piece（落点预览）

每帧重算硬落到底的位置，绘制半透明 `alpha 0.25` 方块轮廓，同色描边。

#### 7.1.2 消行高亮闪烁

检测到消行后，先**不立即**删除。被消行的方格绘制 200ms 白光叠加：`alpha 0.85 → 0`（线性渐隐）。这期间这些行变成"消行动画块"，不参与新方块碰撞。

#### 7.1.3 粒子爆炸

每个被消方格喷出 8 个粒子（10 列 × 4 消 = 320 粒子上限）。每个粒子：

```
position  = 格中心
velocity  = (random ±200 px/s 水平, -300 ~ -500 px/s 垂直)
gravity   = 980 px/s²
color     = 该格原方块颜色
life      = 800ms，alpha 线性渐至 0
size      = 4-8 px
```

存到 `render.particles[]`，每帧物理更新 + 绘制，到期出列。

#### 7.1.4 屏幕抖动

```
offsetX = sin(elapsed * 60) * amplitude * (1 - elapsed/duration)
offsetY = cos(elapsed * 65) * amplitude * (1 - elapsed/duration)
```

| 消行数 | amplitude | duration |
|---|---|---|
| 1 | 4 px | 80 ms |
| 2 | 6 px | 100 ms |
| 3 | 8 px | 120 ms |
| 4 | 12 px | 150 ms |

### 7.2 听觉 FX（Web Audio API 合成）

`audio.js` 暴露 6 个接口：`playLock()` / `playMove()` / `playRotate()` / `playClear(lines)` / `playGameOver()` / `playEndlessReset()` + BGM 控制器。

所有声音都用 `OscillatorNode + GainNode + envelope`，无外部资源。

#### 7.2.1 锁定音

三角波，220Hz（A3），envelope attack 5ms / decay 100ms。短促闷响。

#### 7.2.2 移动 / 旋转音

正弦波，移动 600Hz / 旋转 800Hz，30ms 总时长，envelope attack 2ms / decay 28ms。音量 -20dB。

#### 7.2.3 消除音阶

| 消行 | 频率（Hz） | 时长 |
|---|---|---|
| 1 | C5 (523) | 250ms |
| 2 | C5+E5 (523+659) | 350ms |
| 3 | C5+E5+G5 (+784) | 450ms |
| 4 | C5+E5+G5+C6 + 上行琶音 C6→E6→G6 | 600ms |

波形：正弦（基音）+ 三角（泛音），envelope attack 10ms / sustain 70% / decay 全程 release。

#### 7.2.4 结束音

方波 + 低通滤波，下行小三度：A4(440) → F4(349) → D4(294)，每音 250ms，总 750ms，envelope 慢衰。

#### 7.2.5 无尽模式清半区音

白噪声（`AudioBufferSourceNode` 加随机数据）通过带通滤波器扫频从 2000Hz → 200Hz，400ms。

#### 7.2.6 BGM 循环

8 小节 C 大调五声音阶旋律，主旋律 + 简单根音伴奏。约 16 秒一圈无缝循环。两个 `OscillatorNode`：

- 主旋律：三角波，音量 -18dB，按节拍切频率
- 伴奏：正弦波 + 极轻颤音，每两拍切根音

用 `AudioContext.currentTime` 调度，提前 100ms 排好下一个音；不依赖 setInterval。

### 7.3 音频上下文初始化

iOS / Safari 要求 `AudioContext` 由用户手势创建。**首次触摸**才 `new AudioContext()`，前面所有声音调用都丢弃或缓冲。这是 `audio.js` 的必要兜底。

---

## 8. 设置面板与文案

### 8.1 设置项行为

| 设置 | 默认值 | 行为 |
|---|---|---|
| 下落速度 | 档位 1（最慢） | 滑动**立即**应用到当前局 |
| 上拉容忍 | 1 格 | 改动**立即**生效，影响当前及之后的方块 |
| 结束模式 | 标准 | 改动**立即**生效；无尽切标准时下次顶部碰撞才结束 |
| 音效 | 开 | 切换不影响 BGM；关闭后所有 SFX 调用直接 return |
| 背景音乐 | 开 | 切换立即生效；关闭时 BGM 节点 200ms 渐隐再停 |

**没有"恢复默认"按钮**——避免小朋友误触。`localStorage` 损坏或缺失时用默认值兜底。

### 8.2 「重新开始游戏」

1. 关闭设置面板
2. 弹小确认气泡："当前进度会丢失，确认？" → [取消] [确认]
3. 确认后：清棋盘、重置 score、重新发牌

游戏结束面板的「再玩一局」**不需要**确认。

### 8.3 设置面板打开时的暂停

打开设置面板自动暂停自动下落和 BGM。关闭面板恢复。

### 8.4 完整文案表

```
顶栏
  本局: {N} 行
  最高: {N} 行
  下一块

齿轮按钮              （仅图标，aria-label="设置"）

设置面板
  标题:      设置
  关闭:      ✕                  （aria-label="关闭设置"）
  下落速度
    左端:    慢
    右端:    快
  上拉容忍
    选项:    0 格 / 1 格 / 2 格
  结束模式
    选项:    标准 / 无尽
    说明小字: 标准 = 堆到顶就结束；无尽 = 堆到顶清下半区继续
  音效:                    开 / 关
  背景音乐:                开 / 关
  按钮:      重新开始游戏

重启确认气泡
  正文:      当前进度会丢失，确认？
  按钮:      取消 / 确认

游戏结束面板
  标题:      🎮 游戏结束
  本局:      本局消除: {N} 行
  最高:      最高记录: {N} 行
  按钮:      再玩一局

无尽模式清半区提示（不弹面板，仅瞬时浮字 1 秒）
  文字:      继续加油！
```

---

## 9. 离线方案与 PWA

### 9.1 架构

仓库根放一个 **Service Worker**，scope 覆盖整个站点：

```
little-games/
├── sw.js                       根 SW
├── manifest.json               首页 PWA 清单
├── icon.svg                    首页图标
├── index.html                  注册 /sw.js + 引用 /manifest.json
└── games/
    └── tetris/
        ├── manifest.json       俄罗斯方块独立 PWA 清单
        ├── icon.svg            俄罗斯方块图标
        ├── index.html          也注册 /sw.js
        └── ...
```

### 9.2 SW 策略：cache-first + runtime caching

- `install` 事件：把首页核心资源（`/`、`/index.html`、`/icon.svg`、`/manifest.json`）塞进 `little-games-v1` 缓存。首页 CSS / JS 内联在 index.html 内，无独立文件需要预缓存
- `fetch` 事件：同源 GET 请求 → 先查缓存，命中返回；未命中走网络，成功后**写入缓存**再返回
- 版本号 `v1` → `v2` 时在 `activate` 阶段自动清旧缓存

**好处**：加新游戏**不用**改 `/sw.js`——第一次访问该游戏时所有资源自动入缓存，下次离线可玩。

### 9.3 PWA Manifest

#### 首页 (`/manifest.json`)

```json
{
  "name": "小游戏乐园",
  "short_name": "小游戏",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fff8e1",
  "theme_color": "#ff7043",
  "icons": [
    { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

#### 俄罗斯方块 (`/games/tetris/manifest.json`)

```json
{
  "name": "俄罗斯方块",
  "short_name": "方块",
  "start_url": "/games/tetris/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#42a5f5",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

两个 PWA 都可独立"添加到主屏幕"。iOS Safari 对 SVG 图标支持有限，最坏情况下显示默认图标但 PWA 仍能用。后续如需 PNG fallback 再补。

### 9.4 已知限制（写进 README）

1. **首次访问必须在线**——SW 只能由首次访问注册并缓存
2. SW 只在 HTTPS 下工作（GitHub Pages 满足）
3. 用户清浏览器数据 / 长期不用浏览器自清 → 需要再次联网刷新
4. iOS Safari 14+ 才完整支持

---

## 10. 错误处理

| 场景 | 处理 |
|---|---|
| `AudioContext` 创建失败 / 用户禁用音频 | 所有声音调用 try-catch + 静默 return |
| `localStorage` 不可用 | 设置和最高分**仅当局生效**，不报错；每次加载用默认值 |
| Service Worker 注册失败 | 不影响在线游玩；控制台 warn，下次访问再试 |
| 屏幕方向旋转 | 监听 `resize`，重算 cell 尺寸，重绘 |
| 标签页失去焦点 / 切后台 | 监听 `visibilitychange` → 暂停自动下落 + BGM 静音；回前台恢复 |
| 触摸事件被父容器吞掉 | `<canvas>` 上 `touch-action: none` 阻断浏览器默认滚动 / 缩放 |
| 高 DPI 屏幕（Retina） | Canvas 用 `devicePixelRatio` 缩放避免模糊 |

---

## 11. 测试策略

### 11.1 手动测试清单

```
[功能性]
□ 7 种方块都能正常出现、旋转正确
□ 单消、双消、三消、四消视听效果分别正确
□ 7-bag 验证：连续观察 20 个方块，每 7 个无重复
□ Ghost piece 与实际落点完全重合
□ Wall-kick：T 块顶到墙边能旋转

[手势]
□ 单指左拖 → 横向逐格走
□ 单指下拖快 → 砸块快速下落
□ 单指上拖：upwardTolerance = 0 时纹丝不动；= 2 时可回拉 2 格
□ 双指连线转 → 旋转，单方向连续旋转有效
□ 单指→双指→单指 转换无跳格

[设置]
□ 滑速度立即生效
□ 改上拉容忍立即对当前方块生效
□ 切换音效/BGM 即时响应
□ 重启确认气泡阻止误触

[结束模式]
□ 标准模式：堆到顶 → 结算面板
□ 无尽模式：堆到顶 → 下半区清空 + "继续加油！"浮字

[离线]
□ 在线打开一次，断网刷新还能玩
□ "添加到主屏幕"成功，从主屏幕开能玩
□ 清浏览器缓存 → 离线打开失败（预期）

[兼容性]
□ iPhone Safari（iOS 15+）
□ Android Chrome（最近 2 年版本）
□ iPad Safari（横竖屏切换）
□ 桌面 Chrome / Firefox
```

### 11.2 不引入自动化测试

理由：

1. 纯静态游戏没有 backend、无 CI 收益
2. 触摸手势需要真机测试，单元测试性价比低
3. 引入 Jest / Playwright 会破坏"无构建工具"原则

如以后游戏数量增加、逻辑复杂时再启动 `tests.html`（暴露纯函数 + `console.assert`，浏览器打开就跑）。**MVP 不做。**

---

## 12. 浏览器兼容性目标

| 必须支持 | 最低版本 |
|---|---|
| iOS Safari | 15 |
| Android Chrome | 100 |
| Desktop Chrome / Edge / Firefox | 最近 2 年 |

不支持：IE / 老款 Android WebView / iOS 14 及以下。

---

## 附录 A：术语表

- **lowWaterMark**：每个方块在本回合内到达过的最低行号。上拉受其约束。
- **lock delay**：方块碰到底后给玩家 500ms 调整的缓冲期。
- **7-bag**：把 7 种方块洗成一袋，依次发完再洗下一袋的出牌策略。
- **wall-kick**：旋转受阻时尝试小幅位移（原位 / 左 / 右 / 下）使旋转成立的策略。
- **ghost piece**：半透明显示方块当前硬落到底的位置。
- **scope**：Service Worker 控制的 URL 路径范围。根 `/sw.js` 的 scope 是 `/`，覆盖整站。
