# 贪吃蛇实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 little-games 仓库的第二款游戏（贪吃蛇），沿用俄罗斯方块范本，复用 shared/ 工具和 CSS 主题系统。

**Architecture:** 纯静态 HTML/CSS/JS，原生 ES Modules。`games/snake/` 子目录拆为 `index.html` + `style.css` + 7 个 JS 模块（main / game / render / effects / input / audio / settings）。共用 `shared/gesture-input.js`（新增 `swipe` 事件）和 `shared/audio-engine.js`。

**Tech Stack:** ES2020+ JavaScript（modules）、Canvas 2D、Web Audio API、Service Worker（已存在）、localStorage、PWA manifest。零依赖，零构建。

**Spec:** `docs/superpowers/specs/2026-05-17-snake-design.md`

**测试策略：** 为 `game.js` 的纯函数（初始化、queueDirection、advance、三种结束模式、食物生成、序列化）写 `tests/game.test.js`。浏览器侧 `tests.html` 用 `window.assertEq` 全局，控制台无错即通过；同样断言再 inline 到仓库根 `tests/run-tests.mjs` 让 CI 跑。UI / 音频 / Canvas / 手势用 spec §11.4 的手动测试清单。

**分段验收建议（提交策略）：** 4 个自然 checkpoint，每段结束都可以在浏览器手动跑：

| 阶段 | Phase | 完成时玩家看到 |
|---|---|---|
| Part 1：骨架空跑 | A + B | 打开 `games/snake/`：页面加载、空棋盘居中、顶栏图标点了有反应（设置 / 帮助面板能开关） |
| Part 2：能玩 | C + D + E | 蛇在棋盘上爬、滑动 / 键盘转向、吃食物长大、三种结束模式正常 |
| Part 3：好玩 | F + G + H | 音效 + BGM + 粒子 / 抖动 / 浮字 + 设置面板（速度 / 主题 / 模式…） |
| Part 4：上线 | I + J | 续玩、破纪录庆祝、首页接入、SW v7、文档同步 |

---

## 文件结构

```
little-games/
├── shared/
│   └── gesture-input.js          A1 修改：新增 swipe 事件（不影响 Tetris）
├── sw.js                          J1 修改：bump CACHE_NAME v6 → v7
├── index.html                     J2 修改：games 数组追加 snake 卡片
├── tests/
│   └── run-tests.mjs              J3 修改：import + 加 snake 断言
└── games/
    └── snake/                     本计划主目录
        ├── index.html             B1：DOM 骨架 + 模块入口
        ├── style.css              B2：6 主题 + 响应式 + 控制板
        ├── manifest.json          B3：PWA 清单
        ├── icon.svg               B3：游戏图标
        ├── tests.html             C1：纯函数测试入口
        ├── tests/
        │   └── game.test.js       C2-C7：核心逻辑断言
        └── js/
            ├── input.js           B4：re-export shim → shared/gesture-input.js
            ├── game.js            C2-C7：核心游戏逻辑（初始化 / 转向 / advance / 三模式 / 食物 / 序列化）
            ├── render.js          D1-D4：Canvas 绘制 + 主题
            ├── effects.js         G1：粒子 / 抖动 / 浮字状态
            ├── audio.js           F1-F3：吃 / 转 / 死 / 复活 / 穿墙 + BGM
            ├── settings.js        H1：设置面板 + localStorage
            └── main.js            E1, I1：入口 + 主循环 + 输入接线 + 续玩 + 破纪录
```

---

## Phase A：shared/gesture-input.js 扩展 swipe 事件

### Task A1：给 gesture-input.js 加 `swipe` 事件（非破坏性扩展）

**Files:**
- Modify: `shared/gesture-input.js`

- [ ] **Step 1：先写一段 Tetris 回归 smoke**

打开 `http://localhost:8000/games/tetris/`（先 `python -m http.server 8000`），玩 30 秒，确认：
- 单指拖动可移动方块
- 双指转可旋转
- 没控制台错误

记录基线，下面的改动后这套行为必须不变。

- [ ] **Step 2：修改 `shared/gesture-input.js`**

打开 `shared/gesture-input.js`。

在 `handlers` 对象（约第 19 行）里加 `swipe` 默认 noop。把：

```js
this.handlers = {
  moveTo: () => {},
  rotate: () => {},
  pauseChange: () => {},
  hardDrop: () => {},
};
```

改为：

```js
this.handlers = {
  moveTo: () => {},
  rotate: () => {},
  pauseChange: () => {},
  hardDrop: () => {},
  swipe: () => {},
};
```

并在构造函数初始化字段处加 `this.swipeOrigin = null;`（紧跟现有 `this.rotateAccumulator = 0;` 那行之后）。

- [ ] **Step 3：在 `_enterState` 里维护 swipeOrigin**

找到 `_enterState(s)` 方法（约第 126 行）。改为：

```js
_enterState(s) {
  if (s === STATE_DRAG) {
    const f = this.fingers.values().next().value;
    if (f) {
      this.swipeOrigin = { x: f.x, y: f.y };  // swipe 检测起点（与 piece state 无关）
    }
    const piece = this.getPieceState();
    if (piece && f) {
      this.dragOrigin = {
        touchX: f.x,
        touchY: f.y,
        pieceCol: piece.col,
        pieceRow: piece.row,
      };
    }
  } else if (s === STATE_ROTATE) {
    const fingers = Array.from(this.fingers.values());
    if (fingers.length < 2) return;
    this.rotateAngle0 = Math.atan2(
      fingers[1].y - fingers[0].y,
      fingers[1].x - fingers[0].x
    );
    this.rotateAccumulator = 0;
  } else {
    this.dragOrigin = null;
    this.swipeOrigin = null;
  }
}
```

**变化点**：
- DRAG 进入时一律设 swipeOrigin（即使 piece 为 null，蛇游戏没 piece 也要工作）
- IDLE 时清 swipeOrigin

- [ ] **Step 4：在 `_tick` 里加 swipe 检测**

找到 `_tick()` 方法（约第 150 行）。改为：

```js
_tick() {
  if (this.state === STATE_DRAG) {
    const f = this.fingers.values().next().value;
    if (!f) return;
    const cell = this.getCellSize();

    // swipe 检测：与 piece state 无关，蛇游戏单独订阅
    if (this.swipeOrigin) {
      const dx = f.x - this.swipeOrigin.x;
      const dy = f.y - this.swipeOrigin.y;
      const threshold = Math.max(20, cell * 0.6);
      if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) {
        const dir = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        this.handlers.swipe(dir);
        this.swipeOrigin = { x: f.x, y: f.y };  // 锚点跟随，支持连续多次
      }
    }

    // Tetris 用的 moveTo（蛇游戏不订阅，但保留 Tetris 行为）
    if (this.dragOrigin && cell > 0) {
      const targetCol = this.dragOrigin.pieceCol + Math.round((f.x - this.dragOrigin.touchX) / cell);
      const targetRow = this.dragOrigin.pieceRow + Math.round((f.y - this.dragOrigin.touchY) / cell);
      this.handlers.moveTo(targetRow, targetCol);
    }
  } else if (this.state === STATE_ROTATE) {
    this._rotateTick();
  }
}
```

**变化点**：swipe 检测和 moveTo 互不干扰；Tetris 不订阅 swipe → 行为零变化。

- [ ] **Step 5：键盘也触发 swipe**

找到 `_onKeyDown(e)` 方法（约第 35 行）。把方向键和 WASD 的 case 改成既发 moveTo（仅当 piece 存在）又发 swipe。把整个 `_onKeyDown` 替换为：

```js
_onKeyDown(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  if (this._firstTouchHandler) {
    this._firstTouchHandler();
    this._firstTouchHandler = null;
  }

  const piece = this.getPieceState();
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      this.handlers.swipe('left');
      if (piece) this.handlers.moveTo(piece.row, piece.col - 1);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      this.handlers.swipe('right');
      if (piece) this.handlers.moveTo(piece.row, piece.col + 1);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      this.handlers.swipe('down');
      if (piece) {
        if (e.shiftKey) this.handlers.hardDrop();
        else this.handlers.moveTo(piece.row + 1, piece.col);
      }
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      this.handlers.swipe('up');
      this.handlers.rotate(+1);
      break;
    case ' ':
      e.preventDefault();
      this.handlers.rotate(+1);
      break;
    case 'z':
    case 'Z':
      e.preventDefault();
      this.handlers.rotate(-1);
      break;
  }
}
```

**关键**：Tetris 没订阅 `swipe`（默认 noop），所以多发 swipe 完全不影响它。它依然收到 `moveTo` 和 `rotate`。

- [ ] **Step 6：跑 Tetris 回归 smoke**

刷新 `http://localhost:8000/games/tetris/`，重复 Step 1 的 30 秒玩耍。**必须**：
- 单指拖动还能移动方块（说明 moveTo 没坏）
- 双指转还能旋转
- 键盘 ← → ↓ 还能移动
- 上键还能旋转 CW
- 无控制台错误

如果回归失败，回看你哪步漏了什么；不要靠把 swipe 删了"修复"——那是退路。

- [ ] **Step 7：跑现有 Node 测试**

```bash
node tests/run-tests.mjs
```

应仍然全绿（gesture-input.js 不在 Node 测试范围，但要确认没意外破坏 import 链）。

- [ ] **Step 8：提交**

```bash
git add shared/gesture-input.js
git commit -m "feat(shared): add swipe event to gesture-input (non-breaking)"
```

---

## Phase B：Snake 骨架（HTML / CSS / manifest / icon / input shim）

### Task B1：Snake HTML 骨架

**Files:**
- Create: `games/snake/index.html`

- [ ] **Step 1：建目录**

```bash
mkdir -p games/snake/js
mkdir -p games/snake/tests
```

- [ ] **Step 2：写 `games/snake/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>贪吃蛇 · 小游戏乐园</title>
  <link rel="manifest" href="./manifest.json">
  <link rel="icon" type="image/svg+xml" href="./icon.svg">
  <link rel="apple-touch-icon" href="./icon.svg">
  <meta name="theme-color" content="#ff7043">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header id="top-bar">
    <div class="score-block">
      <div title="本局"><span class="emoji">🎯</span> <span id="score">0</span></div>
      <div title="最高"><span class="emoji">🏆</span> <span id="high-score">0</span></div>
    </div>
    <button id="pause-btn" aria-label="暂停">⏸</button>
    <button id="help-btn" aria-label="帮助">？</button>
    <button id="settings-btn" aria-label="设置">⚙</button>
  </header>

  <main>
    <canvas id="game-canvas"></canvas>
  </main>

  <!-- 桌面方向板（CSS 限定 hover/fine 才显示） -->
  <div id="control-pad" aria-label="方向按键">
    <button id="pad-up" aria-label="上">↑</button>
    <button id="pad-left" aria-label="左">←</button>
    <button id="pad-down" aria-label="下">↓</button>
    <button id="pad-right" aria-label="右">→</button>
  </div>

  <!-- 帮助面板 -->
  <div id="help-panel" class="panel hidden" aria-hidden="true">
    <div class="panel-header">
      <h2>怎么玩</h2>
      <button id="help-close" aria-label="关闭帮助">✕</button>
    </div>

    <div class="help-section">
      <h3>🎮 目标</h3>
      <p>控制蛇去吃食物，吃越多越长，看能长多长！</p>
    </div>

    <div class="help-section">
      <h3>📱 手机和平板</h3>
      <ul>
        <li><b>单指快速滑动</b> ↑ ↓ ← → — 蛇下一格往那个方向走</li>
        <li><b>按住屏幕</b> — 蛇会停下来等你松手再继续</li>
        <li><b>右上 ⚙</b> — 打开设置（速度、模式、主题…）</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>🖱 鼠标（电脑）</h3>
      <ul>
        <li><b>鼠标按住 + 拖动</b> — 跟手指一样</li>
        <li><b>屏幕底部方向板</b> — 点 ← ↑ ↓ →</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>⌨️ 键盘（电脑）</h3>
      <ul>
        <li><b>← ↑ → ↓</b> 或 <b>A W D S</b> — 转向</li>
        <li><b>P</b> — 暂停 / 继续</li>
        <li><b>Esc</b> — 关掉面板</li>
        <li><b>Enter</b> — 确认</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>🌈 设置里有啥</h3>
      <ul>
        <li><b>速度</b> — 蛇爬多快</li>
        <li><b>结束模式</b> — 🎯 撞=结束 · ♾️ 穿墙 · 💖 复活</li>
        <li><b>色彩主题</b> — 6 种</li>
      </ul>
    </div>
  </div>

  <!-- 设置面板 -->
  <div id="settings-panel" class="panel hidden" aria-hidden="true">
    <div class="panel-header">
      <h2>设置</h2>
      <button id="settings-close" aria-label="关闭设置">✕</button>
    </div>
    <div class="setting-row">
      <label>🎨 色彩主题</label>
      <div class="seg seg-wrap" id="theme-seg">
        <button data-val="cheery" class="active">🎨 童趣</button>
        <button data-val="candy">🍬 糖果</button>
        <button data-val="forest">🌳 森林</button>
        <button data-val="ocean">🌊 海洋</button>
        <button data-val="space">🚀 太空</button>
        <button data-val="night">🌙 夜空</button>
      </div>
    </div>
    <div class="setting-row">
      <label>⏱️ 爬行速度</label>
      <div class="slider-row">
        <span>🐌</span>
        <input type="range" id="speed-slider" min="1" max="5" step="1" value="1">
        <span>🚀</span>
      </div>
    </div>
    <div class="setting-row">
      <label>🏁 结束模式</label>
      <div class="seg" id="end-mode-seg">
        <button data-val="standard" class="active">🎯 标准</button>
        <button data-val="wrap">♾️ 穿墙</button>
        <button data-val="revive">💖 复活</button>
      </div>
      <p class="hint">🎯 撞=结束 · ♾️ 穿墙 · 💖 撞会断半身后续命</p>
    </div>
    <div class="setting-row toggle-row">
      <label>🔊 音效</label>
      <button id="sfx-toggle" class="toggle active" data-on="true" aria-label="音效开关">🔊</button>
    </div>
    <div class="setting-row toggle-row">
      <label>🎵 背景音乐</label>
      <button id="bgm-toggle" class="toggle active" data-on="true" aria-label="背景音乐开关">🎵</button>
    </div>
    <div class="setting-row">
      <label>🎬 动效强度</label>
      <div class="seg" id="fx-seg">
        <button data-val="strong" class="active">✨ 强</button>
        <button data-val="mild">🌿 弱</button>
        <button data-val="off">🚫 关</button>
      </div>
    </div>
    <button id="restart-btn" class="primary">🔄 重新开始</button>
  </div>

  <!-- 续玩气泡 -->
  <div id="resume-popup" class="popup hidden">
    <p>📋 上次玩到一半，继续吗？</p>
    <div class="popup-buttons">
      <button id="resume-discard">🆕 新开</button>
      <button id="resume-continue" class="primary">▶️ 继续</button>
    </div>
  </div>

  <!-- 重启确认气泡 -->
  <div id="restart-confirm" class="popup hidden">
    <p>⚠️ 当前进度会丢失</p>
    <div class="popup-buttons">
      <button id="restart-cancel">❌ 取消</button>
      <button id="restart-ok" class="primary">✅ 确认</button>
    </div>
  </div>

  <!-- 游戏结束面板 -->
  <div id="gameover-panel" class="panel hidden">
    <div class="gameover-emoji">💥</div>
    <p class="gameover-stat">🎯 <span id="final-score">0</span></p>
    <p class="gameover-stat">🏆 <span id="final-high">0</span></p>
    <button id="replay-btn" class="primary">▶️ 再玩一局</button>
    <button id="share-btn" class="secondary hidden">📤 分享成绩</button>
  </div>

  <!-- 浮字 toast -->
  <div id="event-toast" class="toast hidden">✨</div>
  <div id="clear-toast" class="clear-toast hidden">✨</div>

  <!-- 持久暂停 overlay -->
  <div id="pause-overlay" class="pause-overlay hidden">
    <div class="pause-icon">⏸</div>
    <div class="pause-hint">点屏幕 / 按 P 继续</div>
  </div>

  <!-- 角落版本号 -->
  <div id="version-tag" class="version-tag">v1.0</div>

  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3：建模块入口空壳**

创建 `games/snake/js/main.js`：

```js
// main.js — 占位，B4 起逐步填
console.log('snake main loaded');
```

- [ ] **Step 4：浏览器开 `http://localhost:8000/games/snake/`**

应看到：
- 顶栏（分数 / 暂停 / 帮助 / 设置）
- 中间空白（CSS 还没写，画布无样式）
- 控制台 "snake main loaded"
- 控制台一条 SW 注册警告（没事，B4 后修）

- [ ] **Step 5：提交**

```bash
git add games/snake/index.html games/snake/js/main.js
git commit -m "feat(snake): HTML scaffold + module entry"
```

---

### Task B2：Snake CSS

**Files:**
- Create: `games/snake/style.css`

- [ ] **Step 1：把 Tetris 的 style.css 完整拷过来当基底**

```bash
cp games/tetris/style.css games/snake/style.css
```

- [ ] **Step 2：修两处 snake 特有改动**

打开 `games/snake/style.css`。

a) 删掉与 next-block 相关的 CSS（snake 没"下一块"）。搜 `.next-block`，删整段（含 `.next-block .label`、`#next-canvas`）。

b) `#control-pad` 默认 5 个按钮成 1 行，snake 只有 4 个 + 不同布局。找到 `#control-pad button`，**保留**它的尺寸 / 颜色定义；找到 `#control-pad` flexbox 的 display 部分：

把：
```css
#control-pad {
  display: none;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg);
  flex-shrink: 0;
}
```

改成（用 grid 摆 ↑ ←↓→ 的"T"形布局）：

```css
#control-pad {
  display: none;
  grid-template-columns: 60px 60px 60px;
  grid-template-rows: 60px 60px;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg);
  flex-shrink: 0;
  justify-content: center;
}
#pad-up    { grid-column: 2; grid-row: 1; }
#pad-left  { grid-column: 1; grid-row: 2; }
#pad-down  { grid-column: 2; grid-row: 2; }
#pad-right { grid-column: 3; grid-row: 2; }
```

把媒体查询里的 `display: flex` 改为 `display: grid`：

```css
@media (hover: hover) and (pointer: fine) {
  #control-pad {
    display: grid;
  }
}
```

- [ ] **Step 3：浏览器手测**

刷新 `http://localhost:8000/games/snake/`。应看到：
- 顶栏背景色 `--bg-2`（默认童趣橙）
- 中间画布区有边框（虽然画布还没绘制内容）
- 桌面应看到 4 按钮"T 形"方向板
- 切换 DevTools "Toggle device toolbar" 模拟 iPhone → 方向板应隐藏
- 没控制台错误

- [ ] **Step 4：提交**

```bash
git add games/snake/style.css
git commit -m "feat(snake): copy theme CSS from tetris, adjust control-pad to 4-button T-layout"
```

---

### Task B3：Snake PWA manifest + 图标

**Files:**
- Create: `games/snake/manifest.json`
- Create: `games/snake/icon.svg`

- [ ] **Step 1：写 `manifest.json`**

```json
{
  "name": "贪吃蛇",
  "short_name": "蛇",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#fff8e1",
  "theme_color": "#ff7043",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2：写 `icon.svg`（圆角橙底 + 表情蛇头）**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#43a047"/>
  <!-- 蛇身体三节圆角方 -->
  <rect x="120" y="280" width="60" height="60" rx="14" fill="#fff8e1"/>
  <rect x="200" y="280" width="60" height="60" rx="14" fill="#fff8e1"/>
  <rect x="280" y="280" width="60" height="60" rx="14" fill="#fff8e1"/>
  <!-- 蛇头大圆角方 + 眼睛 -->
  <rect x="360" y="270" width="80" height="80" rx="20" fill="#fff8e1"/>
  <circle cx="395" cy="295" r="8" fill="#1b5e20"/>
  <circle cx="425" cy="295" r="8" fill="#1b5e20"/>
  <path d="M395 325 Q400 330 405 325 Q410 320 415 325" stroke="#1b5e20" stroke-width="4" fill="none"/>
  <!-- 食物 emoji-ish 红苹果 -->
  <circle cx="220" cy="170" r="36" fill="#e53935"/>
  <rect x="215" y="130" width="4" height="14" fill="#5d4037"/>
  <ellipse cx="232" cy="138" rx="10" ry="6" fill="#43a047" transform="rotate(20 232 138)"/>
</svg>
```

- [ ] **Step 3：浏览器手测**

刷新页面。DevTools → Application → Manifest，应看到名字 / 图标都被解析。访问 `http://localhost:8000/games/snake/icon.svg` 直接看图。

- [ ] **Step 4：提交**

```bash
git add games/snake/manifest.json games/snake/icon.svg
git commit -m "feat(snake): PWA manifest + icon"
```

---

### Task B4：input.js shim + SW 注册

**Files:**
- Create: `games/snake/js/input.js`
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：写 `input.js`（与 Tetris 同模式）**

```js
// input.js — re-export shim → shared/gesture-input.js
// 让本游戏的 main.js 用本地相对路径 import
export { Input } from '../../../shared/gesture-input.js';
```

- [ ] **Step 2：往 `main.js` 加 SW 注册和占位**

替换 `games/snake/js/main.js` 全部内容为：

```js
// main.js — 入口与主循环（后续 Task 逐步填）
console.log('snake main loaded');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
```

- [ ] **Step 3：浏览器手测**

刷新页面。应看到：
- 控制台 "snake main loaded"
- DevTools → Application → Service Workers 看到 `sw.js` 已激活（如果之前没注册过）
- 无 import 错误

- [ ] **Step 4：提交**

```bash
git add games/snake/js/input.js games/snake/js/main.js
git commit -m "feat(snake): input shim + SW registration"
```

---

## Phase C：核心游戏逻辑（含测试）

### Task C1：测试入口 `tests.html`

**Files:**
- Create: `games/snake/tests.html`
- Create: `games/snake/tests/game.test.js`

- [ ] **Step 1：写 `tests.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Snake Tests</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #fff; }
    .pass { color: #4caf50; }
    .fail { color: #f44336; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Snake 纯函数测试</h1>
  <pre id="log"></pre>
  <script type="module">
    const log = document.getElementById('log');
    let passed = 0, failed = 0;

    window.assertEq = (label, actual, expected) => {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (ok) { passed++; log.innerHTML += `<span class="pass">✓ ${label}</span>\n`; }
      else {
        failed++;
        log.innerHTML += `<span class="fail">✗ ${label}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(actual)}</span>\n`;
        console.error(`FAIL: ${label}`, { actual, expected });
      }
    };

    window.assertTrue = (label, cond) => {
      if (cond) { passed++; log.innerHTML += `<span class="pass">✓ ${label}</span>\n`; }
      else {
        failed++;
        log.innerHTML += `<span class="fail">✗ ${label}</span>\n`;
        console.error(`FAIL: ${label}`);
      }
    };

    await import('./tests/game.test.js');

    log.innerHTML += `\n${passed} passed, ${failed} failed`;
    document.title = (failed === 0 ? '✓ ' : '✗ ') + document.title;
  </script>
</body>
</html>
```

- [ ] **Step 2：建空 `tests/game.test.js`**

```js
// game.js 的测试将在 C2-C7 加入
```

- [ ] **Step 3：浏览器开 `tests.html`，看到 "0 passed, 0 failed"**

- [ ] **Step 4：提交**

```bash
git add games/snake/tests.html games/snake/tests/game.test.js
git commit -m "test(snake): test runner scaffold"
```

---

### Task C2：Game 初始化

**Files:**
- Create: `games/snake/js/game.js`
- Modify: `games/snake/tests/game.test.js`

- [ ] **Step 1：写测试**

替换 `games/snake/tests/game.test.js` 内容为：

```js
import { Game, BOARD_WIDTH, BOARD_HEIGHT } from '../js/game.js';

// 板尺寸
assertEq('BOARD_WIDTH = 12', BOARD_WIDTH, 12);
assertEq('BOARD_HEIGHT = 16', BOARD_HEIGHT, 16);

// 初始 Game
const g = new Game();
assertEq('初始蛇长 4', g.snake.length, 4);
assertEq('初始蛇头 (8, 7)', g.snake[0], { row: 8, col: 7 });
assertEq('初始蛇身[1] (8, 6)', g.snake[1], { row: 8, col: 6 });
assertEq('初始蛇身[2] (8, 5)', g.snake[2], { row: 8, col: 5 });
assertEq('初始蛇尾 (8, 4)', g.snake[3], { row: 8, col: 4 });
assertEq('初始方向 right', g.currentDirection, 'right');
assertEq('初始 nextDirection null', g.nextDirection, null);
assertEq('初始分数 0', g.score, 0);
assertEq('初始 dead false', g.dead, false);
assertEq('初始 paused false', g.paused, false);

// 食物在合法位置
assertTrue('食物不在蛇身上', !g.snake.some((s) => s.row === g.food.row && s.col === g.food.col));
assertTrue('食物有效行', g.food.row >= 0 && g.food.row < BOARD_HEIGHT);
assertTrue('食物有效列', g.food.col >= 0 && g.food.col < BOARD_WIDTH);
```

- [ ] **Step 2：刷新 tests.html → 预期红 `Game is not defined`**

- [ ] **Step 3：写 `js/game.js` 第一版**

```js
// game.js — 贪吃蛇核心逻辑

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 16;

const FOOD_EMOJI_POOL = ['🍎', '🍓', '🍒', '🍇', '🍌', '🍑', '🥕', '🌽', '🍄'];

const TICK_INTERVALS = [400, 300, 220, 160, 110];  // 5 档

const DIR_VECTORS = {
  up:    { dr: -1, dc:  0 },
  down:  { dr: +1, dc:  0 },
  left:  { dr:  0, dc: -1 },
  right: { dr:  0, dc: +1 },
};

const OPPOSITE = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export class Game {
  constructor() {
    this.snake = [
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 8, col: 5 },
      { row: 8, col: 4 },
    ];
    this.currentDirection = 'right';
    this.nextDirection = null;
    this.score = 0;
    this.dead = false;
    this.paused = false;
    this.endMode = 'standard';     // standard | wrap | revive
    this.tickInterval = TICK_INTERVALS[0];
    this.accumulator = 0;
    this.reviveInvincibleMs = 0;   // > 0 表示无敌期内
    this.foodEmoji = '🍎';
    this.food = this._spawnFood();

    this._onEat = null;
    this._onDie = null;
    this._onRevive = null;
    this._onWrap = null;
  }

  _spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.row},${s.col}`));
    const empty = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (!occupied.has(`${r},${c}`)) empty.push({ row: r, col: c });
      }
    }
    if (empty.length === 0) {
      this.foodEmoji = null;
      return null;
    }
    this.foodEmoji = FOOD_EMOJI_POOL[Math.floor(Math.random() * FOOD_EMOJI_POOL.length)];
    return empty[Math.floor(Math.random() * empty.length)];
  }

  setSpeed(level) {
    const i = Math.max(0, Math.min(4, (level | 0) - 1));
    this.tickInterval = TICK_INTERVALS[i];
  }
  setEndMode(m) {
    if (m === 'standard' || m === 'wrap' || m === 'revive') this.endMode = m;
  }
  setPaused(p) { this.paused = !!p; }

  onEat(cb)    { this._onEat = cb; }
  onDie(cb)    { this._onDie = cb; }
  onRevive(cb) { this._onRevive = cb; }
  onWrap(cb)   { this._onWrap = cb; }
}
```

- [ ] **Step 4：刷新 tests.html → 应全绿**

- [ ] **Step 5：提交**

```bash
git add games/snake/js/game.js games/snake/tests/game.test.js
git commit -m "feat(snake): Game init + food spawn"
```

---

### Task C3：queueDirection + 180° 反向拒绝

**Files:**
- Modify: `games/snake/js/game.js`
- Modify: `games/snake/tests/game.test.js`

- [ ] **Step 1：在 `tests/game.test.js` 末尾追加**

```js
// queueDirection
const g2 = new Game();
assertEq('初始 right', g2.currentDirection, 'right');
g2.queueDirection('up');
assertEq('up 入队', g2.nextDirection, 'up');
g2.queueDirection('left');
assertEq('left 入队（同 tick 多次取最后）', g2.nextDirection, 'left');

// 180° 反向拒绝
const g3 = new Game();          // currentDirection = right
g3.queueDirection('left');      // 反向
assertEq('反向 left 被拒绝', g3.nextDirection, null);
g3.queueDirection('down');
assertEq('非反向 down 接受', g3.nextDirection, 'down');

// 反向也要考虑已经入队的方向（蛇可能正要转 up，反 up 是 down，要拒绝）
const g4 = new Game();
g4.queueDirection('up');       // current=right, next=up
g4.queueDirection('down');     // down 是 up 的反向 → 拒绝
assertEq('next=up 时反向 down 被拒绝', g4.nextDirection, 'up');
```

- [ ] **Step 2：刷新 → 预期红 `queueDirection is not a function`**

- [ ] **Step 3：实现 `queueDirection`**

在 `Game` 类末尾（`onWrap` 之后）追加：

```js
  queueDirection(dir) {
    if (!DIR_VECTORS[dir]) return;
    // 拒绝 180° 反向：以"队列里下一个"为基准，没有就用 currentDirection
    const ref = this.nextDirection || this.currentDirection;
    if (OPPOSITE[ref] === dir) return;
    this.nextDirection = dir;
  }
```

- [ ] **Step 4：刷新 → 全绿**

- [ ] **Step 5：提交**

```bash
git add games/snake/js/game.js games/snake/tests/game.test.js
git commit -m "feat(snake): queueDirection with 180° reversal block"
```

---

### Task C4：advance() tick 推进 + 标准模式

**Files:**
- Modify: `games/snake/js/game.js`
- Modify: `games/snake/tests/game.test.js`

- [ ] **Step 1：在 `tests/game.test.js` 末尾追加**

```js
// 推进 1 tick
const g5 = new Game();
const food5 = g5.food;
// 把食物从蛇头前面挪开，避免吃到
if (food5.row === 8 && food5.col === 8) {
  g5.food = { row: 0, col: 0 };
}
const tailBefore = g5.snake[g5.snake.length - 1];
g5._advance();
assertEq('蛇头从 (8,7) → (8,8)', g5.snake[0], { row: 8, col: 8 });
assertEq('蛇身长度不变', g5.snake.length, 4);
assertTrue('尾被弹出', g5.snake[g5.snake.length - 1].col !== tailBefore.col || g5.snake[g5.snake.length - 1].row !== tailBefore.row);

// 应用 nextDirection
const g6 = new Game();
g6.food = { row: 0, col: 0 };  // 避吃
g6.queueDirection('down');
g6._advance();
assertEq('应用 down → 蛇头 (9, 7)', g6.snake[0], { row: 9, col: 7 });
assertEq('current=down', g6.currentDirection, 'down');
assertEq('next 清空', g6.nextDirection, null);

// 标准模式撞墙
const g7 = new Game();
g7.food = { row: 0, col: 0 };
g7.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
g7.currentDirection = 'right';
g7._advance();
assertEq('撞右墙 dead', g7.dead, true);

// 标准模式撞自己
const g8 = new Game();
g8.food = { row: 0, col: 0 };
// 蛇绕一圈：头 (5,5)，依次 (5,6)(6,6)(6,5)，方向 left → 下一步 (5,4)，安全
// 让头朝 (5,5) 想去 (5,5)... 简化：手动构造能自撞的状态
g8.snake = [{ row: 5, col: 5 }, { row: 4, col: 5 }, { row: 4, col: 6 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g8.currentDirection = 'up';
g8._advance();   // 头 (5,5) → (4,5)，命中身体
assertEq('撞自己 dead', g8.dead, true);

// 移动到尾巴位置不算撞（尾巴即将弹出）
const g9 = new Game();
g9.food = { row: 0, col: 0 };
// 蛇 head=(5,5) 朝 down，下一步 (6,5)。把 (6,5) 设为尾。
g9.snake = [{ row: 5, col: 5 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g9.currentDirection = 'down';  // 朝 (6,5)，那是尾
g9._advance();
assertEq('入尾位不死', g9.dead, false);
assertEq('新头在尾位 (6,5)', g9.snake[0], { row: 6, col: 5 });
```

- [ ] **Step 2：刷新 → 预期红 `_advance is not a function`**

- [ ] **Step 3：实现 `_advance` + 工具方法**

在 `Game` 类末尾追加：

```js
  _nextHeadCell() {
    const head = this.snake[0];
    const dir = DIR_VECTORS[this.currentDirection];
    return { row: head.row + dir.dr, col: head.col + dir.dc };
  }

  _hitWall(cell) {
    return cell.row < 0 || cell.row >= BOARD_HEIGHT
        || cell.col < 0 || cell.col >= BOARD_WIDTH;
  }

  /** 检查 cell 是否与蛇身(不含即将弹出的尾)重合 */
  _hitSelf(cell) {
    // 若不吃食物，下一 tick 尾巴会弹出，所以 snake[length-1] 不算冲突
    const eating = this.food && cell.row === this.food.row && cell.col === this.food.col;
    const limit = eating ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].row === cell.row && this.snake[i].col === cell.col) return true;
    }
    return false;
  }

  _advance() {
    if (this.dead) return;

    if (this.nextDirection) {
      this.currentDirection = this.nextDirection;
      this.nextDirection = null;
    }

    let nextHead = this._nextHeadCell();
    const invincible = this.reviveInvincibleMs > 0;

    // 边界处理
    if (this._hitWall(nextHead)) {
      if (this.endMode === 'wrap' || invincible) {
        nextHead = {
          row: (nextHead.row + BOARD_HEIGHT) % BOARD_HEIGHT,
          col: (nextHead.col + BOARD_WIDTH) % BOARD_WIDTH,
        };
        if (this._onWrap) this._onWrap();
      } else if (this.endMode === 'revive') {
        this._triggerRevive();
        return;
      } else {
        this._triggerDie();
        return;
      }
    }

    // 自撞
    if (this._hitSelf(nextHead)) {
      if (invincible) {
        // 无敌期：略过判定
      } else if (this.endMode === 'revive') {
        this._triggerRevive();
        return;
      } else {
        this._triggerDie();
        return;
      }
    }

    const ate = this.food && nextHead.row === this.food.row && nextHead.col === this.food.col;
    this.snake.unshift(nextHead);
    if (ate) {
      this.score += 1;
      this.food = this._spawnFood();   // 可能 null（棋盘填满）
      if (this._onEat) this._onEat();
    } else {
      this.snake.pop();
    }
  }

  _triggerDie() {
    this.dead = true;
    if (this._onDie) this._onDie();
  }

  _triggerRevive() {
    // C6 实现，此处占位
    this._triggerDie();
  }
```

- [ ] **Step 4：刷新 → 全绿**

- [ ] **Step 5：提交**

```bash
git add games/snake/js/game.js games/snake/tests/game.test.js
git commit -m "feat(snake): advance() + standard end mode (wall/self collision)"
```

---

### Task C5：穿墙模式 + 吃食物增长

**Files:**
- Modify: `games/snake/tests/game.test.js`
- Modify: `games/snake/js/game.js`

- [ ] **Step 1：在 `tests/game.test.js` 末尾追加**

```js
// 吃食物：长度 +1，分数 +1
const g10 = new Game();
g10.food = { row: 8, col: 8 };
const lenBefore = g10.snake.length;
g10._advance();
assertEq('吃后长 +1', g10.snake.length, lenBefore + 1);
assertEq('分数 +1', g10.score, 1);
assertTrue('新食物不在蛇身', !g10.snake.some((s) => s.row === g10.food.row && s.col === g10.food.col));

// 穿墙模式：右出左入
const g11 = new Game();
g11.setEndMode('wrap');
g11.food = { row: 0, col: 0 };
g11.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
g11.currentDirection = 'right';
g11._advance();
assertEq('穿墙后 dead=false', g11.dead, false);
assertEq('穿墙后头在左边 (8,0)', g11.snake[0], { row: 8, col: 0 });

// 上出下入
const g12 = new Game();
g12.setEndMode('wrap');
g12.food = { row: 4, col: 4 };
g12.snake = [{ row: 0, col: 7 }, { row: 1, col: 7 }, { row: 2, col: 7 }];
g12.currentDirection = 'up';
g12._advance();
assertEq('上穿墙头在 (15,7)', g12.snake[0], { row: 15, col: 7 });

// 穿墙模式撞自己仍死
const g13 = new Game();
g13.setEndMode('wrap');
g13.food = { row: 0, col: 0 };
g13.snake = [{ row: 5, col: 5 }, { row: 4, col: 5 }, { row: 4, col: 6 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g13.currentDirection = 'up';
g13._advance();
assertEq('wrap 模式撞自己 dead', g13.dead, true);
```

- [ ] **Step 2：刷新 → 全绿**（C4 的代码已经支持 wrap，此处只是断言验证）

- [ ] **Step 3：提交**

```bash
git add games/snake/tests/game.test.js
git commit -m "test(snake): assertions for wrap mode + food eating"
```

---

### Task C6：复活模式

**Files:**
- Modify: `games/snake/js/game.js`
- Modify: `games/snake/tests/game.test.js`

- [ ] **Step 1：在 `tests/game.test.js` 末尾追加**

```js
// 复活模式撞墙
const g14 = new Game();
g14.setEndMode('revive');
g14.food = { row: 0, col: 0 };
g14.snake = [
  { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 8, col: 8 },
  { row: 8, col: 7 }, { row: 8, col: 6 }, { row: 8, col: 5 }, { row: 8, col: 4 },
];
g14.score = 10;
g14.currentDirection = 'right';
g14._advance();
assertEq('revive 撞墙 dead=false', g14.dead, false);
assertEq('蛇头不动 (8,11)', g14.snake[0], { row: 8, col: 11 });
assertEq('蛇身砍到 max(2, floor(8/2))=4', g14.snake.length, 4);
assertEq('分数不变', g14.score, 10);
assertTrue('无敌期开启', g14.reviveInvincibleMs > 0);

// 长度小不会砍到 0
const g15 = new Game();
g15.setEndMode('revive');
g15.food = { row: 0, col: 0 };
g15.snake = [{ row: 0, col: 0 }, { row: 0, col: 1 }];   // 长 2
g15.currentDirection = 'up';
g15._advance();
assertEq('len=2 砍后保留 max(2, 1)=2', g15.snake.length, 2);

// 复活后无敌期内再撞不死
const g16 = new Game();
g16.setEndMode('revive');
g16.food = { row: 0, col: 0 };
g16.snake = [{ row: 0, col: 11 }, { row: 0, col: 10 }, { row: 0, col: 9 }, { row: 0, col: 8 }];
g16.currentDirection = 'right';
g16._advance();   // 触发复活
assertTrue('无敌期开启', g16.reviveInvincibleMs > 0);
const lenAfterRevive = g16.snake.length;
g16._advance();   // 无敌期内继续 right，又出墙
assertEq('无敌期内 dead=false', g16.dead, false);
// 无敌期内出墙按 wrap 处理
assertEq('无敌期+撞右墙：头 wrap 到 (0,0)', g16.snake[0], { row: 0, col: 0 });

// 无敌期超时
const g17 = new Game();
g17.setEndMode('revive');
g17.reviveInvincibleMs = 1000;
g17._tickInvincibility(500);
assertEq('500ms 后剩 500', g17.reviveInvincibleMs, 500);
g17._tickInvincibility(600);
assertEq('再 600ms 后归 0', g17.reviveInvincibleMs, 0);
```

- [ ] **Step 2：刷新 → 预期部分红（_triggerRevive 还是占位、_tickInvincibility 不存在）**

- [ ] **Step 3：替换 `_triggerRevive` + 加 `_tickInvincibility`**

在 `Game` 类里找到 `_triggerRevive`，把它替换为：

```js
  _triggerRevive() {
    // 回滚致死那一步：蛇头保持在上一 tick 末位置（什么都不做就是回滚）
    // 砍前 max(2, floor(length/2)) 节
    const keep = Math.max(2, Math.floor(this.snake.length / 2));
    this.snake = this.snake.slice(0, keep);
    // 清队列方向，玩家想转就重新滑
    this.nextDirection = null;
    // 1 秒无敌期
    this.reviveInvincibleMs = 1000;
    if (this._onRevive) this._onRevive();
  }

  _tickInvincibility(dt) {
    if (this.reviveInvincibleMs > 0) {
      this.reviveInvincibleMs = Math.max(0, this.reviveInvincibleMs - dt);
    }
  }
```

- [ ] **Step 4：刷新 → 全绿**

- [ ] **Step 5：提交**

```bash
git add games/snake/js/game.js games/snake/tests/game.test.js
git commit -m "feat(snake): revive mode (trim front-half, 1s invincibility, keep score)"
```

---

### Task C7：step() 主循环驱动 + 序列化

**Files:**
- Modify: `games/snake/js/game.js`
- Modify: `games/snake/tests/game.test.js`

- [ ] **Step 1：在 `tests/game.test.js` 末尾追加**

```js
// step 累加 dt 推进 tick
const g18 = new Game();
g18.food = { row: 0, col: 0 };
g18.setSpeed(1);   // tickInterval = 400
const before18 = g18.snake[0].col;
g18.step(200);
assertEq('200ms 不到一 tick，头不动', g18.snake[0].col, before18);
g18.step(300);     // 累计 500ms，跨过 400
assertEq('500ms 推进 1 tick', g18.snake[0].col, before18 + 1);

// paused 不推进
const g19 = new Game();
g19.food = { row: 0, col: 0 };
g19.setSpeed(5);   // 110ms
const col19 = g19.snake[0].col;
g19.setPaused(true);
g19.step(500);
assertEq('paused 不推进', g19.snake[0].col, col19);

// dead 不推进
const g20 = new Game();
g20.dead = true;
const col20 = g20.snake[0].col;
g20.step(500);
assertEq('dead 不推进', g20.snake[0].col, col20);

// 无敌期递减
const g21 = new Game();
g21.reviveInvincibleMs = 1000;
g21.food = { row: 0, col: 0 };
g21.step(500);
assertEq('step 500ms 无敌 -= 500', g21.reviveInvincibleMs, 500);

// 序列化 + 反序列化
const g22 = new Game();
g22.score = 7;
g22.snake = [{ row: 1, col: 1 }, { row: 1, col: 0 }];
g22.currentDirection = 'down';
g22.foodEmoji = '🍓';
g22.food = { row: 5, col: 5 };
const snap = g22.serialize();
const g23 = new Game();
const restored = g23.restore(snap);
assertEq('restore 返回 true', restored, true);
assertEq('恢复 score', g23.score, 7);
assertEq('恢复 snake', g23.snake, [{ row: 1, col: 1 }, { row: 1, col: 0 }]);
assertEq('恢复方向', g23.currentDirection, 'down');
assertEq('恢复食物', g23.food, { row: 5, col: 5 });
assertEq('恢复 emoji', g23.foodEmoji, '🍓');

// 异常 restore
const g24 = new Game();
assertEq('restore 空对象失败', g24.restore({}), false);
assertEq('restore null 失败', g24.restore(null), false);
assertEq('restore 错版本失败', g24.restore({ v: 999 }), false);

// reset
const g25 = new Game();
g25.score = 99;
g25.dead = true;
g25.snake = [{ row: 0, col: 0 }];
g25.reset();
assertEq('reset score=0', g25.score, 0);
assertEq('reset 蛇长 4', g25.snake.length, 4);
assertEq('reset 头 (8,7)', g25.snake[0], { row: 8, col: 7 });
assertEq('reset dead=false', g25.dead, false);
```

- [ ] **Step 2：刷新 → 预期红 `step is not a function` / `serialize` 等**

- [ ] **Step 3：实现 `step`、`serialize`、`restore`、`reset`**

在 `Game` 类末尾追加：

```js
  step(dt) {
    if (this.paused || this.dead) return;
    this._tickInvincibility(dt);
    this.accumulator += dt;
    while (this.accumulator >= this.tickInterval && !this.dead) {
      this.accumulator -= this.tickInterval;
      this._advance();
    }
  }

  reset() {
    this.snake = [
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 8, col: 5 },
      { row: 8, col: 4 },
    ];
    this.currentDirection = 'right';
    this.nextDirection = null;
    this.score = 0;
    this.dead = false;
    this.accumulator = 0;
    this.reviveInvincibleMs = 0;
    this.food = this._spawnFood();
  }

  serialize() {
    return {
      v: 1,
      snake: this.snake.map((s) => ({ row: s.row, col: s.col })),
      currentDirection: this.currentDirection,
      nextDirection: this.nextDirection,
      food: this.food ? { row: this.food.row, col: this.food.col } : null,
      foodEmoji: this.foodEmoji,
      score: this.score,
      reviveInvincibleMs: this.reviveInvincibleMs,
    };
  }

  restore(snap) {
    if (!snap || snap.v !== 1 || !Array.isArray(snap.snake)) return false;
    try {
      this.snake = snap.snake.map((s) => ({ row: s.row | 0, col: s.col | 0 }));
      this.currentDirection = snap.currentDirection || 'right';
      this.nextDirection = snap.nextDirection || null;
      this.food = snap.food ? { row: snap.food.row | 0, col: snap.food.col | 0 } : null;
      this.foodEmoji = snap.foodEmoji || '🍎';
      this.score = snap.score | 0;
      this.dead = false;
      this.accumulator = 0;
      this.reviveInvincibleMs = Math.max(0, snap.reviveInvincibleMs | 0);
      return true;
    } catch (e) {
      console.warn('restore failed:', e);
      return false;
    }
  }
```

- [ ] **Step 3a：刷新 tests.html，应全绿**

- [ ] **Step 4：提交**

```bash
git add games/snake/js/game.js games/snake/tests/game.test.js
git commit -m "feat(snake): step() main loop driver + serialize/restore/reset"
```

---

## Phase D：渲染

### Task D1：Canvas 初始化 + 画背景棋盘 + 蛇身

**Files:**
- Create: `games/snake/js/render.js`
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：写 `render.js`**

```js
// render.js — Canvas 绘制
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 30;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const containerW = parent.clientWidth;
    const containerH = parent.clientHeight;

    this.cellSize = Math.max(8, Math.floor(Math.min(
      containerW / (BOARD_WIDTH + 1),
      containerH / (BOARD_HEIGHT + 1)
    )));

    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _readTheme() {
    const s = getComputedStyle(document.body);
    return {
      canvasBg:    s.getPropertyValue('--canvas-bg').trim()   || '#ffffff',
      canvasGrid:  s.getPropertyValue('--canvas-grid').trim() || 'rgba(0,0,0,0.05)',
      primary:     s.getPropertyValue('--primary').trim()     || '#ff7043',
      primaryDark: s.getPropertyValue('--primary-dark').trim()|| '#e64a19',
    };
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const w = s * BOARD_WIDTH;
    const h = s * BOARD_HEIGHT;
    const offset = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    const theme = this._readTheme();

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offset.x, offset.y);

    // 背景
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = theme.canvasGrid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(w, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, h);
      ctx.stroke();
    }

    this._drawSnake(game, theme);
    this._drawFood(game);

    if (this.effects) this.effects.drawParticles(ctx, dt);

    ctx.restore();
  }

  _drawSnake(game, theme) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const len = game.snake.length;
    const invincible = game.reviveInvincibleMs > 0;
    // 无敌期闪烁：100ms 周期
    const flashOn = invincible
      ? (Math.floor(performance.now() / 100) % 2 === 0)
      : true;
    const baseAlpha = flashOn ? 1.0 : 0.4;

    ctx.fillStyle = theme.primary;
    for (let i = 0; i < len; i++) {
      const seg = game.snake[i];
      // 尾段稍微淡
      const tailFade = 1 - (i / Math.max(len, 1)) * 0.15;
      ctx.globalAlpha = baseAlpha * tailFade;
      this._drawRoundedCell(seg.col * s, seg.row * s, s, s * 0.25);
    }
    ctx.globalAlpha = 1;

    // 蛇头表情（延后到 D2 处理，先占位画两个白圆点当眼睛）
    if (len > 0) {
      const head = game.snake[0];
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = baseAlpha;
      // 简单两眼，先不区分方向
      ctx.beginPath();
      ctx.arc(head.col * s + s * 0.35, head.row * s + s * 0.4, s * 0.08, 0, Math.PI * 2);
      ctx.arc(head.col * s + s * 0.65, head.row * s + s * 0.4, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawRoundedCell(x, y, size, radius) {
    const ctx = this.ctx;
    const inset = 1;
    const w = size - inset * 2;
    const h = size - inset * 2;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w, h, radius);
    ctx.fill();
  }

  _drawFood(game) {
    if (!game.food) return;
    const ctx = this.ctx;
    const s = this.cellSize;
    const cx = game.food.col * s + s / 2;
    const cy = game.food.row * s + s / 2;
    // 脉冲 0.95 ↔ 1.05
    const pulse = 1 + Math.sin(performance.now() / 700 * Math.PI * 2) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.font = `${s * 0.9}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.foodEmoji || '🍎', 0, 0);
    ctx.restore();
  }
}
```

- [ ] **Step 2：在 `main.js` 接入**

替换 `games/snake/js/main.js` 全部内容为：

```js
// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';

const gameCanvas = document.getElementById('game-canvas');
const game = new Game();
const renderer = new Renderer(gameCanvas, null);   // effects 之后接入

let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

window._game = game;
window._renderer = renderer;
```

- [ ] **Step 3：浏览器手测**

刷新 `http://localhost:8000/games/snake/`：
- 应看到蛇（4 节橙色圆角方块，头在右）从中间一直往右爬
- 食物 emoji 在某个空格脉动
- 蛇撞到右墙就停（dead=true，但还没结束面板，先这样）
- 控制台无错

- [ ] **Step 4：提交**

```bash
git add games/snake/js/render.js games/snake/js/main.js
git commit -m "feat(snake): render canvas + snake body + food emoji + minimal main loop"
```

---

### Task D2：蛇头朝向（emoji 旋转）

**Files:**
- Modify: `games/snake/js/render.js`

- [ ] **Step 1：替换 `_drawSnake` 里"蛇头眼睛"那段**

找到 `_drawSnake` 函数中的"// 蛇头表情..."注释和它下面的两眼绘制代码（约 9 行），替换为：

```js
    // 蛇头表情：emoji 旋转到行进方向
    if (len > 0) {
      const head = game.snake[0];
      const cx = head.col * s + s / 2;
      const cy = head.row * s + s / 2;
      const angle = {
        right: 0,
        down: Math.PI / 2,
        left: Math.PI,
        up: -Math.PI / 2,
      }[game.currentDirection] || 0;

      ctx.save();
      ctx.globalAlpha = baseAlpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.font = `${s * 0.85}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 用一个朝右的表情；旋转后自然朝任意方向
      // 注：emoji 在不同平台渲染略有差，可换为 😋 / 🙂 / 🐲
      ctx.fillText('🐍', 0, 0);
      ctx.restore();
    }
```

- [ ] **Step 2：浏览器手测**

刷新页面。蛇头应是 🐍，撞墙前一直朝右。可在控制台跑：

```js
_game.currentDirection = 'down';
```

观察头部 emoji 旋转 90°。

> **如果 emoji 旋转后看着别扭**（某些平台 emoji 不对称，旋转 180° 后倒着），换成对称性更好的 emoji（试 😋、🙂、🐲），或退回到"圆点眼睛 + 朝向小三角"方案——这是 spec §7.1.1 的备选。

- [ ] **Step 3：提交**

```bash
git add games/snake/js/render.js
git commit -m "feat(snake): rotate snake-head emoji by current direction"
```

---

### Task D3：暂停 / 死亡视觉提示

**Files:**
- Modify: `games/snake/js/render.js`

- [ ] **Step 1：在 `Renderer.draw` 的最末（`ctx.restore()` 之前）加暂停遮罩**

替换整个 `draw` 方法为：

```js
  draw(game, dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const w = s * BOARD_WIDTH;
    const h = s * BOARD_HEIGHT;
    const offset = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    const theme = this._readTheme();

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = theme.canvasGrid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(w, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, h);
      ctx.stroke();
    }

    this._drawSnake(game, theme);
    this._drawFood(game);

    if (this.effects) this.effects.drawParticles(ctx, dt);

    // 死亡淡化：蛇 dead 时整画面再蒙一层灰
    if (game.dead) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }
```

> 暂停 overlay 不在 canvas 里画（是独立 DOM `#pause-overlay`）；这里只处理 dead 灰盖。

- [ ] **Step 2：浏览器手测**

让蛇撞墙（默认右行）。撞墙后画面应蒙一层灰，蛇停在最后一个安全位置。

- [ ] **Step 3：提交**

```bash
git add games/snake/js/render.js
git commit -m "feat(snake): dim canvas on death"
```

---

### Task D4：浏览器手测分段验收（Part 2 头）

- [ ] **Step 1：在浏览器跑一遍**

`http://localhost:8000/games/snake/` —— 应满足：

```
□ 页面加载无错
□ 蛇自动从中间往右爬
□ 食物 emoji 脉动可见
□ 撞墙后画面灰、蛇停
□ 主题色看着干净
□ 控制台无 error
```

- [ ] **Step 2：刷 tests.html 应全绿**

(无新代码，确认仍然 OK。)

> 至此 D 阶段结束。还没接入手势，所以蛇只会一直往右撞墙。下一 Phase E 接入。

---

## Phase E：输入接入

### Task E1：手势 / 键盘转向 + 暂停

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：替换 `main.js` 全部内容为**

```js
// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

const gameCanvas = document.getElementById('game-canvas');
const game = new Game();
const renderer = new Renderer(gameCanvas, null);

const input = new Input(
  gameCanvas,
  () => renderer.cellSize,
  () => null   // 蛇没有 "piece" 概念
);

input.on('swipe', (dir) => {
  game.queueDirection(dir);
});
input.on('pauseChange', (paused) => {
  game.setPaused(paused);
});

// 桌面方向板
function padDir(dir) { game.queueDirection(dir); }
document.getElementById('pad-up').addEventListener('click',    () => padDir('up'));
document.getElementById('pad-down').addEventListener('click',  () => padDir('down'));
document.getElementById('pad-left').addEventListener('click',  () => padDir('left'));
document.getElementById('pad-right').addEventListener('click', () => padDir('right'));

// 主循环
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

window._game = game;
window._renderer = renderer;
```

- [ ] **Step 2：浏览器手测**

`http://localhost:8000/games/snake/`：

- 桌面：键盘 ← ↑ → ↓ 或 WASD 应能让蛇转向
- 桌面：屏幕方向板 4 按钮应能转向
- 桌面：鼠标按住画布拖一段距离 → 蛇转向；鼠标按住不动 → 蛇暂停
- 控制台跑 `_game.snake` 看身体一直在变化

> 此时还没有游戏结束面板 / 音效 / 设置面板。撞墙就停在 dead 灰盖里——下一阶段补。

- [ ] **Step 3：跑 Tetris 回归 smoke**

打开 `http://localhost:8000/games/tetris/` 玩 30 秒，确认手势依然正常。

- [ ] **Step 4：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): wire input — swipe/keyboard/d-pad turn + long-press pause"
```

---

## Phase F：音频

### Task F1：audio.js 骨架（继承 AudioEngine + 基础事件音）

**Files:**
- Create: `games/snake/js/audio.js`

- [ ] **Step 1：写 `audio.js`**

```js
// audio.js — 贪吃蛇音效
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
  }

  setBgmOn(on) {
    this.bgmOn = on;
    if (!on) {
      this.stopBgm(200);
    } else if (on && !this.bgmController && this.ctx) {
      this._startBgm();
    }
  }

  stopBgm(fadeMs = 200) {
    if (this.bgmController) {
      this.bgmController.stop(fadeMs);
      this.bgmController = null;
    }
  }

  /** 吃食物：上行小三度 C5 → E5 */
  playEat() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    this.scheduleNote(523.25, t0,         80, 0.35, 'triangle');
    this.scheduleNote(659.25, t0 + 0.08,  80, 0.35, 'triangle');
  }

  /** 转向：30ms 900Hz 极轻一下 */
  playTurn() {
    this.playTone({ freq: 900, type: 'sine', duration: 30, gain: 0.05, attack: 2 });
  }

  /** 死亡：下行 A4→F4→D4，方波 + 低通 */
  playDie() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [{ freq: 440, time: 0 }, { freq: 349.23, time: 0.2 }, { freq: 293.66, time: 0.4 }];
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = n.freq;
      const when = t0 + n.time;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.2, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.3);
    }
  }

  /** 复活：上行琶音 G4→C5→E5→G5 */
  playRevive() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99];
    for (let i = 0; i < notes.length; i++) {
      this.scheduleNote(notes[i], t0 + i * 0.08, 80, 0.35, 'triangle');
    }
  }

  /** 穿墙：短促噪声扫频 */
  playWrap() {
    this.playNoiseSweep({ fromFreq: 2000, toFreq: 200, duration: 120, gain: 0.25, q: 2 });
  }

  /** 破纪录：上行 4 音 */
  playHighScore() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < notes.length; i++) {
      this.scheduleNote(notes[i], t0 + i * 0.08, 200, 0.4, 'triangle');
    }
  }

  startBgm() {
    if (this.bgmOn && !this.bgmController) this._startBgm();
  }

  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    // 8 小节 C 大调五声音阶，节奏比 Tetris 慢（beat=700ms）
    const melody = [
      261.63, 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63,
      261.63, 329.63, 261.63, 196.00, 220.00, 261.63, 329.63, 392.00,
    ];
    const bass = [
      130.81, 130.81, 174.61, 174.61,
      196.00, 196.00, 130.81, 130.81,
    ];

    const beatMs = 700;
    const totalDuration = (melody.length * beatMs) / 1000;

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = 0;
    bgmGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    bgmGain.connect(this.master);

    let stopFlag = false;

    const schedule = (loopStart) => {
      for (let i = 0; i < melody.length; i++) {
        const t = loopStart + (i * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = melody[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.45, t + 0.02);
        g.gain.linearRampToValueAtTime(0.3, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 0.7);
      }
      for (let i = 0; i < bass.length; i++) {
        const t = loopStart + (i * 2 * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bass[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.05);
        g.gain.linearRampToValueAtTime(0.18, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 1.3);
      }
    };

    let loopStart = ctx.currentTime + 0.1;
    schedule(loopStart);
    const interval = setInterval(() => {
      if (stopFlag) return;
      loopStart += totalDuration;
      schedule(loopStart);
    }, totalDuration * 1000 - 200);

    this.bgmController = {
      stop: (fadeMs = 200) => {
        stopFlag = true;
        clearInterval(interval);
        const tNow = ctx.currentTime;
        bgmGain.gain.cancelScheduledValues(tNow);
        bgmGain.gain.setValueAtTime(bgmGain.gain.value, tNow);
        bgmGain.gain.linearRampToValueAtTime(0, tNow + fadeMs / 1000);
      },
    };
  }
}
```

- [ ] **Step 2：接入 `main.js`**

修改 `games/snake/js/main.js`。在 import 段加：

```js
import { Audio } from './audio.js';
```

在 `const renderer = ...` 之后加：

```js
const audio = new Audio();
```

把 input 订阅块改为（加 onFirstTouch + audio.playTurn）：

```js
input.on('swipe', (dir) => {
  game.queueDirection(dir);
  audio.playTurn();
});
input.on('pauseChange', (paused) => {
  game.setPaused(paused);
});
input.onFirstTouch(() => {
  audio.unlock();
  if (audio.bgmOn) audio.startBgm();
});
```

把 padDir 改为也调 audio：

```js
function padDir(dir) {
  audio.unlock();
  game.queueDirection(dir);
  audio.playTurn();
}
```

在 `requestAnimationFrame(loop);` 之前加 game 事件接线：

```js
game.onEat(() => {
  audio.playEat();
});
game.onDie(() => {
  audio.playDie();
});
game.onRevive(() => {
  audio.playRevive();
});
game.onWrap(() => {
  audio.playWrap();
});
```

- [ ] **Step 3：浏览器手测**

刷新。**先点一下屏幕**（iOS 要求首触解锁 audio）。然后：
- 蛇吃食物应有"咚"两音
- 滑动转向应有微小"嘀"
- 撞墙死亡应有下行三音
- BGM 应循环播放

- [ ] **Step 4：提交**

```bash
git add games/snake/js/audio.js games/snake/js/main.js
git commit -m "feat(snake): audio (eat/turn/die/revive/wrap + pentatonic BGM)"
```

---

### Task F2：BGM 切后台 + 切面板暂停

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：在 `main.js` 末尾加 visibilitychange + 暂停 overlay 接线**

在 `window._renderer = renderer;` 之前追加：

```js
// 切后台暂停
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.setPaused(true);
    audio.stopBgm(100);
  } else {
    if (input.fingers && input.fingers.size === 0) game.setPaused(false);
    if (audio.bgmOn && audio.ctx) audio.startBgm();
  }
});

// 暂停按钮 + overlay
let manualPause = false;
const pauseOverlay = document.getElementById('pause-overlay');
function setManualPause(p) {
  manualPause = p;
  game.setPaused(p);
  pauseOverlay.classList.toggle('hidden', !p);
  if (p) audio.stopBgm(100);
  else if (audio.bgmOn && audio.ctx) audio.startBgm();
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'p' || e.key === 'P') {
    setManualPause(!manualPause);
    e.preventDefault();
  }
});
```

- [ ] **Step 2：浏览器手测**

- 按顶栏 ⏸ → overlay 显示 + BGM 停
- 点 overlay → 恢复
- 切到别的标签页 → BGM 停；回来 → BGM 继续

- [ ] **Step 3：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): pause button + overlay + visibilitychange auto-pause"
```

---

## Phase G：特效 / 浮字 / 触觉

### Task G1：effects.js（粒子 + 抖动）

**Files:**
- Create: `games/snake/js/effects.js`
- Modify: `games/snake/js/render.js`
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：写 `effects.js`**

```js
// effects.js — 视觉特效（粒子 + 屏幕抖动）
export class Effects {
  constructor() {
    this.particles = [];
    this.shake = null;            // { amplitude, duration, elapsed }
    this.intensity = 1.0;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  step(dt) {
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) this.shake = null;
    }
  }

  triggerShake(amplitude, duration) {
    if (this.intensity === 0) return;
    this.shake = { amplitude: amplitude * this.intensity, duration, elapsed: 0 };
  }

  getShakeOffset() {
    if (!this.shake) return { x: 0, y: 0 };
    const e = this.shake.elapsed;
    const d = this.shake.duration;
    const amp = this.shake.amplitude * (1 - e / d);
    return {
      x: Math.sin(e * 0.06) * amp,
      y: Math.cos(e * 0.065) * amp,
    };
  }

  /** 在某 (cellX, cellY) 中心喷一拨粒子 */
  spawnBurst(cellX, cellY, cellSize, palette, count = 8, vyRange = [-400, -200]) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * this.intensity));
    const cx = cellX * cellSize + cellSize / 2;
    const cy = cellY * cellSize + cellSize / 2;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 600,
        vy: vyRange[0] + Math.random() * (vyRange[1] - vyRange[0]),
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 700 + Math.random() * 200,
        elapsed: 0,
        size: 4 + Math.random() * 5,
      });
    }
  }

  /** 圆形散射（死亡 / 复活用） */
  spawnRadial(cellX, cellY, cellSize, palette, count = 16, speed = 250) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * this.intensity));
    const cx = cellX * cellSize + cellSize / 2;
    const cy = cellY * cellSize + cellSize / 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 800,
        elapsed: 0,
        size: 5 + Math.random() * 6,
      });
    }
  }

  drawParticles(ctx, dt) {
    const gravity = 980 / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.elapsed += dt;
      if (p.elapsed >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const dts = dt / 1000;
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += gravity * dt;
      const alpha = 1 - p.elapsed / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }
}
```

- [ ] **Step 2：在 `main.js` 接入 effects**

`main.js` 顶部 import 段加：

```js
import { Effects } from './effects.js';
```

把 `const renderer = new Renderer(gameCanvas, null);` 改为：

```js
const effects = new Effects();
const renderer = new Renderer(gameCanvas, effects);
```

把 game 事件接线改成（带粒子 + 抖动）：

```js
game.onEat(() => {
  audio.playEat();
  const head = game.snake[0];
  effects.spawnBurst(head.col, head.row, renderer.cellSize,
    ['#ffeb3b', '#ff9800', '#4caf50', '#f44336'], 8);
  effects.triggerShake(3, 80);
  showClearToast('✨');
  vibrate([15]);
});
game.onDie(() => {
  audio.playDie();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#f44336', '#ff9800', '#ffeb3b'], 16, 250);
  effects.triggerShake(14, 240);
  showClearToast('😵');
  vibrate([40, 40, 80, 40, 120]);
});
game.onRevive(() => {
  audio.playRevive();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#ec407a', '#b388ff', '#42a5f5'], 12, 180);
  effects.triggerShake(8, 180);
  showClearToast('💖');
  vibrate([20, 30, 60]);
});
game.onWrap(() => {
  audio.playWrap();
  showToast('✨');
});
```

把 input swipe 改成（加触觉）：

```js
input.on('swipe', (dir) => {
  game.queueDirection(dir);
  audio.playTurn();
  vibrate([8]);
});
```

把 padDir 也加触觉：

```js
function padDir(dir) {
  audio.unlock();
  game.queueDirection(dir);
  audio.playTurn();
  vibrate([8]);
}
```

主循环里加 effects.step：

```js
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  requestAnimationFrame(loop);
}
```

在 `window._renderer = renderer;` 之前追加工具函数 + vibrate：

```js
let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('event-toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1000);
}

let clearToastTimer = null;
function showClearToast(text) {
  const t = document.getElementById('clear-toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = '';
  clearTimeout(clearToastTimer);
  clearToastTimer = setTimeout(() => t.classList.add('hidden'), 900);
}

function vibrate(pattern) {
  // fxLevel 控制由 H1 settings 接入后再判；这里先简单 try
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}
```

- [ ] **Step 3：浏览器手测**

- 吃食物：粒子小爆 + 轻抖 + ✨ 浮字
- 撞墙：粒子圆散 + 大抖 + 😵 浮字
- 穿墙模式（暂时只能在控制台 `_game.setEndMode('wrap')`）：✨ 浮字
- 复活模式：`_game.setEndMode('revive')` 撞墙 → 蛇身砍半 + 💖 浮字 + 1 秒闪烁

- [ ] **Step 4：提交**

```bash
git add games/snake/js/effects.js games/snake/js/render.js games/snake/js/main.js
git commit -m "feat(snake): effects (particles, shake, toasts) + haptics"
```

---

## Phase H：设置面板

### Task H1：settings.js + 接线

**Files:**
- Create: `games/snake/js/settings.js`
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：写 `settings.js`**

```js
// settings.js — 设置面板 + localStorage
const KEY = 'snake.settings';
const KEY_HIGH = 'snake.highScore';

const DEFAULTS = {
  speed: 1,
  endMode: 'standard',
  sfxOn: true,
  bgmOn: true,
  theme: 'cheery',
  fxLevel: 'strong',
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };

export class Settings {
  constructor(game, audio, effects) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS };
    this.highScore = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      const h = localStorage.getItem(KEY_HIGH);
      if (h) this.highScore = parseInt(h, 10) || 0;
    } catch (e) { /* 默认值兜底 */ }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) {}
  }

  get(key) {
    if (key === 'highScore') return this.highScore;
    return this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') {
      this.highScore = value;
    } else {
      this.state[key] = value;
      this.apply();
    }
    this.save();
  }

  apply() {
    this.game.setSpeed(this.state.speed);
    this.game.setEndMode(this.state.endMode);
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);
    if (this.effects) this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1.0);
    document.body.dataset.theme = this.state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      getComputedStyle(document.body).getPropertyValue('--bg-2').trim() || '#ff7043'
    );
    this._syncUi();
  }

  _syncUi() {
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.value = this.state.speed;

    const setSeg = (id, val) => {
      const seg = document.getElementById(id);
      if (!seg) return;
      for (const btn of seg.querySelectorAll('button')) {
        btn.classList.toggle('active', btn.dataset.val === String(val));
      }
    };
    setSeg('theme-seg',    this.state.theme);
    setSeg('end-mode-seg', this.state.endMode);
    setSeg('fx-seg',       this.state.fxLevel);

    const sfxBtn = document.getElementById('sfx-toggle');
    if (sfxBtn) {
      sfxBtn.classList.toggle('active', this.state.sfxOn);
      sfxBtn.textContent = this.state.sfxOn ? '🔊' : '🔇';
    }
    const bgmBtn = document.getElementById('bgm-toggle');
    if (bgmBtn) {
      bgmBtn.classList.toggle('active', this.state.bgmOn);
      bgmBtn.textContent = this.state.bgmOn ? '🎵' : '🔕';
    }
  }

  bindUi() {
    // 主题
    const themeSeg = document.getElementById('theme-seg');
    themeSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('theme', btn.dataset.val);
    });

    // 速度
    document.getElementById('speed-slider')?.addEventListener('input', (e) => {
      this.set('speed', parseInt(e.target.value, 10) || 1);
    });

    // 结束模式
    document.getElementById('end-mode-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('endMode', btn.dataset.val);
    });

    // 音效 / BGM
    document.getElementById('sfx-toggle')?.addEventListener('click', () => {
      this.set('sfxOn', !this.state.sfxOn);
    });
    document.getElementById('bgm-toggle')?.addEventListener('click', () => {
      this.set('bgmOn', !this.state.bgmOn);
    });

    // 动效强度
    document.getElementById('fx-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('fxLevel', btn.dataset.val);
    });

    // 打开 / 关闭
    document.getElementById('settings-btn')?.addEventListener('click', () => this.open());
    document.getElementById('settings-close')?.addEventListener('click', () => this.close());

    // 帮助按钮
    document.getElementById('help-btn')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.remove('hidden');
      this.game.setPaused(true);
      this.audio.stopBgm(100);
    });
    document.getElementById('help-close')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.add('hidden');
      this.game.setPaused(false);
      if (this.state.bgmOn && this.audio.ctx) this.audio.startBgm();
    });

    // 重启
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.remove('hidden');
    });
    document.getElementById('restart-cancel')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
    });
    document.getElementById('restart-ok')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
      this.close();
      this.game.reset();
      if (this._onReset) this._onReset();
    });
  }

  onReset(cb) { this._onReset = cb; }

  open() {
    document.getElementById('settings-panel').classList.remove('hidden');
    this.game.setPaused(true);
    this.audio.stopBgm(100);
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this.game.setPaused(false);
    if (this.state.bgmOn && this.audio.ctx) this.audio.startBgm();
  }
}
```

- [ ] **Step 2：在 `main.js` 顶部 import 并实例化 settings**

import 段加：

```js
import { Settings } from './settings.js';
```

在 `const audio = new Audio();` 之后加：

```js
const settings = new Settings(game, audio, effects);
settings.load();
settings.apply();
settings.bindUi();
```

修改 vibrate 函数以读 fxLevel：

```js
function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}
```

修改 visibilitychange 的 BGM 恢复条件：

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.setPaused(true);
    audio.stopBgm(100);
  } else {
    if (input.fingers && input.fingers.size === 0) game.setPaused(false);
    if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
  }
});
```

修改 setManualPause 的 BGM 条件：

```js
function setManualPause(p) {
  manualPause = p;
  game.setPaused(p);
  pauseOverlay.classList.toggle('hidden', !p);
  if (p) audio.stopBgm(100);
  else if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
}
```

修改 firstTouch BGM 条件：

```js
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});
```

- [ ] **Step 3：浏览器手测**

- 点 ⚙ 设置面板打开、游戏暂停、BGM 停
- 切主题 → 整页换色（含画布背景 / 网格 / 蛇身）
- 滑速度 → 蛇明显变快
- 切结束模式 → 立即生效
- 音效 / BGM toggle → 即时
- 动效强度 → 关时无粒子无抖动
- ✕ 关闭面板 → 游戏恢复
- 重启 → 弹确认 → 确认后蛇回中间
- 刷新页面 → 设置仍在
- 点 ? 帮助按钮 → 帮助面板打开 → ✕ 关闭

- [ ] **Step 4：提交**

```bash
git add games/snake/js/settings.js games/snake/js/main.js
git commit -m "feat(snake): settings panel + theme/speed/end-mode/sfx/bgm/fx-level persistence"
```

---

### Task H2：游戏结束面板 + 再玩一局 + 分享

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：在 `main.js` 里完善 onDie，加结束面板逻辑**

把 `game.onDie(...)` 那块改为：

```js
game.onDie(() => {
  audio.playDie();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#f44336', '#ff9800', '#ffeb3b'], 16, 250);
  effects.triggerShake(14, 240);
  showClearToast('😵');
  vibrate([40, 40, 80, 40, 120]);
  showGameOverPanel();
  clearSave();
});
```

在 `window._renderer = renderer;` 之前补：

```js
function showGameOverPanel() {
  game.setPaused(true);
  const panel = document.getElementById('gameover-panel');
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-high').textContent = settings.get('highScore');
  panel.classList.remove('hidden');
  const shareBtn = document.getElementById('share-btn');
  if (navigator.share) shareBtn.classList.remove('hidden');
  else shareBtn.classList.add('hidden');
}

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  game.reset();
  game.setPaused(false);
  resetHighScoreTracker();
});

document.getElementById('share-btn').addEventListener('click', async () => {
  const score = game.score;
  const text = `🐍 我在贪吃蛇里吃了 ${score} 个！来挑战我吧 🎯`;
  try {
    await navigator.share({ title: '贪吃蛇', text, url: location.href });
  } catch (e) {
    try {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast('📋');
    } catch (err) {}
  }
});

// 占位：续玩 / 破纪录追踪在 Phase I 实现
function clearSave() {}
function resetHighScoreTracker() {}
```

- [ ] **Step 2：浏览器手测**

撞墙 → 结束面板弹出 → 显示分数和最高 → 点 ▶️ 再玩一局 → 蛇回中间继续。

- [ ] **Step 3：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): gameover panel + replay + share (web share + clipboard fallback)"
```

---

## Phase I：续玩 + 破纪录 + 完善

### Task I1：续玩存盘 + 启动检测 + 守卫

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：在 `main.js` 顶部增量加续玩逻辑**

在 `settings.bindUi();` **之后**插入：

```js
// 续玩存盘
const SAVE_KEY = 'snake.saveGame';
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persistSave() {
  if (resumePending) return;   // 守卫：弹窗未决前不要写
  try {
    if (game.dead) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}

let resumePending = false;
const savedSnap = loadSave();
if (savedSnap) {
  resumePending = true;
  game.setPaused(true);
  const popup = document.getElementById('resume-popup');
  popup.classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('click', () => {
    if (!game.restore(savedSnap)) {
      console.warn('restore failed');
      return;
    }
    resumePending = false;
    popup.classList.add('hidden');
    game.setPaused(false);
  });
  document.getElementById('resume-discard').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    resumePending = false;
    popup.classList.add('hidden');
    game.setPaused(false);
  });
}

window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistSave();
});
```

把 H2 的 `function clearSave() {}` 占位换成（此时 SAVE_KEY 已在上面定义，function 声明会被 hoist 到主作用域顶，运行 onDie 时已就绪）：

```js
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
```

- [ ] **Step 2：浏览器手测**

- 玩到中途（吃几个食物），切到别的标签页
- 切回来 → BGM / 游戏继续（visibility 不弹续玩，因为没刷新）
- F5 刷新 → 应弹"📋 上次玩到一半，继续吗？"
- 点 ▶️ 继续：分数、蛇位置、食物都恢复
- F5 再刷 → 又弹 → 点 🆕 新开：从头开始
- 死了之后刷新 → 不弹（已 clearSave）

- [ ] **Step 3：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): save/resume with race-condition guard"
```

---

### Task I2：破纪录庆祝 + 高分追踪

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：在 `main.js` 主循环里加破纪录逻辑**

把占位 `function resetHighScoreTracker() {}` 替换为：

```js
let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
}
function celebrateHighScore() {
  audio.playHighScore();
  vibrate([60, 30, 60, 30, 100]);
  showClearToast('🏆');
  // 顶上撒一拨彩色粒子
  effects.spawnBurst(6, 0, renderer.cellSize,
    ['#ff7043', '#ffeb3b', '#4caf50', '#42a5f5', '#9c27b0', '#f44336', '#ff9800'], 20, [-500, -250]);
  effects.triggerShake(16, 280);
}
```

修改主循环，把 highScore 追踪 + 庆祝接入：

```js
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  document.getElementById('high-score').textContent = settings.get('highScore');

  if (!highScoreCelebrated && highScoreBaseline > 0 && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    celebrateHighScore();
  }
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
  }
  requestAnimationFrame(loop);
}
```

- [ ] **Step 2：浏览器手测**

- 玩一局打高分（吃几个），死掉
- 再玩一局，吃到超过上一局：应炸一波 🏆 + 彩色粒子 + 抖动
- 顶栏 🏆 数字实时更新

- [ ] **Step 3：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): high-score celebration (baseline lock + rainbow burst on break)"
```

---

### Task I3：键盘 ESC / Enter 快捷

**Files:**
- Modify: `games/snake/js/main.js`

- [ ] **Step 1：在 keydown 监听里补 ESC / Enter**

找到现有的 `window.addEventListener('keydown', (e) => { ... if (e.key === 'p' || e.key === 'P') ... })` 那段。替换为：

```js
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  const helpPanel = document.getElementById('help-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const gameoverPanel = document.getElementById('gameover-panel');
  const restartConfirm = document.getElementById('restart-confirm');

  if (e.key === 'Escape') {
    if (!restartConfirm.classList.contains('hidden')) {
      restartConfirm.classList.add('hidden');
      e.preventDefault();
      return;
    }
    if (!settingsPanel.classList.contains('hidden')) {
      settings.close();
      e.preventDefault();
      return;
    }
    if (!helpPanel.classList.contains('hidden')) {
      helpPanel.classList.add('hidden');
      game.setPaused(false);
      if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
      e.preventDefault();
      return;
    }
  } else if (e.key === 'Enter') {
    if (!restartConfirm.classList.contains('hidden')) {
      document.getElementById('restart-ok').click();
      e.preventDefault();
      return;
    }
    if (!gameoverPanel.classList.contains('hidden')) {
      document.getElementById('replay-btn').click();
      e.preventDefault();
      return;
    }
  } else if (e.key === 'p' || e.key === 'P') {
    const panelsOpen = !helpPanel.classList.contains('hidden')
      || !settingsPanel.classList.contains('hidden')
      || !gameoverPanel.classList.contains('hidden');
    if (panelsOpen) return;
    setManualPause(!manualPause);
    e.preventDefault();
  }
});
```

- [ ] **Step 2：浏览器手测**

- 设置面板开着按 Esc → 关
- 帮助面板开着按 Esc → 关
- 死后按 Enter → 再玩一局
- 重启确认气泡按 Enter → 确认重启

- [ ] **Step 3：提交**

```bash
git add games/snake/js/main.js
git commit -m "feat(snake): keyboard ESC/Enter shortcuts"
```

---

## Phase J：上线接入

### Task J1：bump sw.js + 加首页卡片

**Files:**
- Modify: `sw.js`
- Modify: `index.html`

- [ ] **Step 1：bump CACHE_NAME**

打开 `sw.js`，把 `const CACHE_NAME = 'little-games-v6';` 改为：

```js
const CACHE_NAME = 'little-games-v7';
```

- [ ] **Step 2：首页加卡片**

打开根 `index.html`，找到 `const games = [ ... ]`。改为：

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
  { title: "贪吃蛇", desc: "滑动转向，吃越多越长", emoji: "🐍", path: "games/snake/", highScoreKey: "snake.highScore" },
];
```

- [ ] **Step 3：浏览器手测**

刷新 `http://localhost:8000/`。应：
- 看到两张卡片（俄罗斯方块、贪吃蛇）
- 蛇卡片下显示 🏆 N（如果之前玩过有分数）
- 点蛇卡片进游戏正常

- [ ] **Step 4：提交**

```bash
git add sw.js index.html
git commit -m "chore(infra): bump SW cache to v7, add snake card to home"
```

---

### Task J2：CI Node 测试加 snake 断言

**Files:**
- Modify: `tests/run-tests.mjs`

- [ ] **Step 1：在 `tests/run-tests.mjs` 末尾（`// ───── result ─────` 之前）追加 snake 测试段**

```js
// ───── snake ─────
const { Game: SnakeGame, BOARD_WIDTH: SW, BOARD_HEIGHT: SH } =
  await import('../games/snake/js/game.js');

eq('snake board 12 wide', SW, 12);
eq('snake board 16 tall', SH, 16);

const sg = new SnakeGame();
eq('snake init len 4', sg.snake.length, 4);
eq('snake head (8,7)', sg.snake[0], { row: 8, col: 7 });
eq('snake init dir right', sg.currentDirection, 'right');

// 180° 反向拒绝
const sg2 = new SnakeGame();
sg2.queueDirection('left');
eq('snake reject 180°', sg2.nextDirection, null);
sg2.queueDirection('up');
eq('snake accept perpendicular', sg2.nextDirection, 'up');

// advance + 撞墙（标准）
const sg3 = new SnakeGame();
sg3.food = { row: 0, col: 0 };
sg3.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
sg3._advance();
eq('snake wall hits dead', sg3.dead, true);

// wrap
const sg4 = new SnakeGame();
sg4.setEndMode('wrap');
sg4.food = { row: 0, col: 0 };
sg4.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }];
sg4._advance();
eq('snake wrap to col 0', sg4.snake[0], { row: 8, col: 0 });
eq('snake wrap not dead', sg4.dead, false);

// revive
const sg5 = new SnakeGame();
sg5.setEndMode('revive');
sg5.food = { row: 0, col: 0 };
sg5.snake = [
  { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 8, col: 8 },
  { row: 8, col: 7 }, { row: 8, col: 6 }, { row: 8, col: 5 }, { row: 8, col: 4 },
];
sg5.score = 5;
sg5._advance();
eq('snake revive not dead', sg5.dead, false);
eq('snake revive trim to 4', sg5.snake.length, 4);
eq('snake revive score kept', sg5.score, 5);
truthy('snake revive invincible', sg5.reviveInvincibleMs > 0);

// 吃食物
const sg6 = new SnakeGame();
sg6.food = { row: 8, col: 8 };
sg6._advance();
eq('snake ate +1', sg6.score, 1);
eq('snake grew', sg6.snake.length, 5);

// 序列化
const sg7 = new SnakeGame();
sg7.score = 11;
sg7.currentDirection = 'down';
sg7.foodEmoji = '🍓';
const snap = sg7.serialize();
const sg8 = new SnakeGame();
const ok = sg8.restore(snap);
truthy('snake restore ok', ok);
eq('snake restore score', sg8.score, 11);
eq('snake restore dir', sg8.currentDirection, 'down');
eq('snake restore emoji', sg8.foodEmoji, '🍓');
eq('snake restore invalid', sg8.restore({}), false);
```

- [ ] **Step 2：跑测试**

```bash
node tests/run-tests.mjs
```

应输出 `N passed, 0 failed`（具体数字看断言总数，0 failed 是关键）。

- [ ] **Step 3：提交**

```bash
git add tests/run-tests.mjs
git commit -m "test(snake): Node CI assertions for game.js"
```

---

### Task J3：本地完整手测 + 修 bug

- [ ] **Step 1：起本地 server，跑 spec §11.4 全清单**

```bash
python -m http.server 8000
```

按 spec `docs/superpowers/specs/2026-05-17-snake-design.md` §11.4 的清单，浏览器逐项验：

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
□ 玩到一半切后台 → 回来续玩气泡 → 继续按"上次状态"
□ 续玩竞态守卫（resumePending）

[兼容]
□ Chrome / Firefox / Edge 桌面
□ DevTools 模拟 iPhone（375×667）
□ DevTools 模拟 iPad（820×1180）
```

- [ ] **Step 2：每个 bug 用一个 fix 提交修掉**

```bash
git commit -m "fix(snake): <bug 简述>"
```

- [ ] **Step 3：刷 `games/snake/tests.html` 全绿**

- [ ] **Step 4：跑 `node tests/run-tests.mjs` 全绿**

---

### Task J4：推 GitHub Pages + 离线 / 真机测试

- [ ] **Step 1：推送**

```bash
git push
```

- [ ] **Step 2：等 ~60s，访问 https://zhcqiu.github.io/little-games/**

应看到两张卡。点贪吃蛇进入游戏。

- [ ] **Step 3：DevTools → Application → Service Workers**

确认：
- `/sw.js` 已激活
- Cache Storage 出现 `little-games-v7`
- 旧 `little-games-v6` 被清掉

- [ ] **Step 4：DevTools → Network → Offline，刷新页面**

- [ ] 首页仍能打开
- [ ] 贪吃蛇页面仍能玩（吃食物、转向、声音 / 粒子都在）

- [ ] **Step 5：真机测试**

iPhone Safari + Android Chrome 各：
- 打开 https://zhcqiu.github.io/little-games/games/snake/
- 跑 §11.4 [功能] [体验] 部分（不重测设置 / 兼容）
- 试 "添加到主屏幕"：iOS 分享按钮 → 添加到主屏幕；Android 菜单 → 安装应用
- 主屏启动应全屏无地址栏

- [ ] **Step 6：真机 bug 修掉后再推**

```bash
git commit -m "fix(snake): <真机 bug 简述>"
git push
```

---

## 自检

**1. Spec coverage：**

| Spec 节 | 实现任务 |
|---|---|
| §1 概述 + 硬约束 | （全计划遵循） |
| §2 实现取向 | A1, B1-B4, C1-C7, D1-D4, E1, F1-F2, G1, H1-H2, I1-I3 |
| §3 文件结构 | B1（HTML）+ B2（CSS）+ B3（manifest/icon）+ B4（input shim）+ C2-C7（game.js）+ D1-D4（render.js）+ E1（main 输入）+ F1-F2（audio.js）+ G1（effects.js）+ H1（settings.js）+ I1-I3（main 续玩 / 庆祝 / 快捷）+ J1（sw.js bump）+ J2（CI 接入） |
| §4 屏幕布局 | B1（HTML）+ B2（CSS）+ D1（canvas） |
| §5 手势状态机（含 swipe 扩展） | A1（shared 扩展）+ E1（接入） |
| §6.1 棋盘与初始状态 | C2 |
| §6.2 5 档速度 | C2（TICK_INTERVALS）+ H1（settings） |
| §6.3 推进规则 | C4 |
| §6.4 三种结束模式 | C4（标准 + wrap）+ C6（revive） |
| §6.5 持久化 | C7（serialize/restore）+ H1（settings）+ I1（saveGame） |
| §6.6 棋盘填满 | C2（_spawnFood 返回 null） |
| §7.1 视觉 FX | D1-D3（蛇身 / 蛇头 emoji / 食物脉动 / dead 灰盖）+ G1（粒子 / 抖动 / 浮字） |
| §7.2 听觉 FX | F1（playEat/Turn/Die/Revive/Wrap/HighScore + BGM）+ F2（visibility） |
| §7.3 触觉 | G1（vibrate）+ H1（fxLevel 控制） |
| §8 设置面板 | H1 |
| §9 离线 / PWA | B3（manifest/icon）+ B4（SW 注册）+ J1（CACHE bump） |
| §10 错误处理 | F2（visibility）+ H1（localStorage 兜底）+ B4（SW 失败 warn）+ I1（resumePending 守卫）+ D1（resize / DPR） |
| §11 测试 | C1-C7（pure-fn 浏览器侧）+ J2（Node CI）+ J3 J4（手测 / 真机） |
| §12 兼容性 | J3 J4 |
| 附录 A 术语 | （文档性，无任务） |
| 附录 B 共用一览 | （文档性，无任务） |

**2. Placeholder scan：** 完整代码块；无 TBD / TODO；每个 Step 都有可执行内容。✓

**3. Type consistency：**

- `Game.queueDirection / step / setSpeed / setEndMode / setPaused / reset / serialize / restore` 在 C2-C7 + H1 + I1 一致
- `Game.onEat / onDie / onRevive / onWrap` 回调名在 C2 定义、F1 + G1 + H2 + I1 调用一致
- `Renderer(canvas, effects)` 构造在 D1 定义，E1 + G1 接入时调用一致（`new Renderer(gameCanvas, effects)`）
- `Effects.spawnBurst / spawnRadial / triggerShake / getShakeOffset / drawParticles / step / setIntensity` 在 G1 定义、main.js 调用一致
- `Audio.unlock / setSfxOn / setBgmOn / startBgm / stopBgm / playEat / playTurn / playDie / playRevive / playWrap / playHighScore` 在 F1 定义、main.js + H1 调用一致
- `Settings.load / save / apply / get / set / bindUi / open / close / onReset` 在 H1 定义、main.js 调用一致
- `Input.on('swipe' | 'pauseChange') + onFirstTouch + fingers` 在 A1 扩展、E1 + I1 + main 引用一致
- `BOARD_WIDTH = 12 / BOARD_HEIGHT = 16` 在 C2 定义、D1 + J2 测试引用一致
- `reviveInvincibleMs` 字段在 C2 初始化、C4-C6 更新、C7 序列化、D1 渲染闪烁全部一致

未发现 inconsistency。

---

## 执行说明

执行此计划时按 Task 顺序逐个完成。每 Task 内步骤连续做完才能进下一 Task。`tests.html` 失败时不要继续下一 Task。手动测试发现的 bug，用 `fix(snake): ...` 形式的 commit 修，**不要回头改之前的 Task 代码**。

**checkpoint 验收点**：

- Phase B 结束：游戏页能打开、UI 元素都在（但还不能玩）
- Phase E 结束：能玩（4 方向转向 + 三模式 + 死亡）
- Phase H 结束：好玩（音效 + 特效 + 设置 + 结束面板）
- Phase J 结束：上线（首页接入 + 离线 + 真机）

每个 checkpoint 都建议人工 sanity check 一下再继续下一阶段。
