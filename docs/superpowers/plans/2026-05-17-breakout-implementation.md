# 打砖块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 little-games 仓库的第二款游戏（打砖块），对齐俄罗斯方块 V1.5 的功能深度。

**Architecture:** 纯静态 HTML/CSS/JS，原生 ES Modules 拆分。复用 `shared/gesture-input.js` 和 `shared/audio-engine.js`。物理碰撞独立为 `physics.js` 纯函数模块，CI 测试守护。

**Tech Stack:** ES2020+ JavaScript（modules）、Canvas 2D、Web Audio API、Service Worker、localStorage、PWA manifest。零依赖，零构建。

**Spec:** `docs/superpowers/specs/2026-05-17-breakout-design.md`

**测试策略：** `physics.js` 和 `game.js` 是纯函数 + 状态，能 Node 跑。两套测试都进 `tests.html`（浏览器）和 `tests/run-tests.mjs`（CI）。Canvas / 音频 / 手势 / 设置 UI 走 spec §7.2 手测清单。

---

## 文件结构

```
little-games/
├── sw.js                            修改：CACHE_NAME bump v6 → v7（Phase A）
├── index.html                       修改：games 数组加打砖块卡（Phase A）
├── tests/run-tests.mjs              修改：import + 跑两个新测试（Phase J）
└── games/breakout/                  本计划主目录
    ├── index.html                   B1
    ├── style.css                    B2
    ├── manifest.json                B3
    ├── icon.svg                     B3
    ├── tests.html                   C1
    ├── tests/
    │   ├── physics.test.js          C3 / C4
    │   └── game.test.js             D1-D9
    └── js/
        ├── bricks.js                C2
        ├── physics.js               C3 / C4
        ├── game.js                  D1-D9
        ├── render.js                E1-E4
        ├── effects.js               E5
        ├── input.js                 F1
        ├── audio.js                 G1-G2
        ├── settings.js              H1-H2
        └── main.js                  I1-I8
```

---

## Phase A：仓库级修改

### Task A1：bump SW 缓存版本

**Files:**
- Modify: `sw.js:2`

- [ ] **Step 1：bump 版本号**

把 `sw.js` 第 2 行从

```js
const CACHE_NAME = 'little-games-v6';
```

改为

```js
const CACHE_NAME = 'little-games-v7';
```

- [ ] **Step 2：提交**

```bash
git add sw.js
git commit -m "chore(sw): bump cache to v7 for breakout"
```

---

### Task A2：首页加打砖块卡片

**Files:**
- Modify: `index.html:157-159`

- [ ] **Step 1：把 games 数组加一项**

把当前

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
];
```

改为

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
  { title: "打砖块",     desc: "弹球连击打砖，无尽模式越打越快", emoji: "🧨", path: "games/breakout/", highScoreKey: "breakout.highScore" },
];
```

- [ ] **Step 2：浏览器打开 `/index.html` 验证**

应看到两张卡片，打砖块卡 emoji 是 🧨。点击它会 404（目录还没建），是预期的。

- [ ] **Step 3：提交**

```bash
git add index.html
git commit -m "feat(home): add breakout card"
```

---

## Phase B：Breakout 静态骨架

### Task B1：HTML

**Files:**
- Create: `games/breakout/index.html`

- [ ] **Step 1：写完整 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>打砖块 · 小游戏乐园</title>
  <link rel="manifest" href="./manifest.json">
  <link rel="icon" type="image/svg+xml" href="./icon.svg">
  <link rel="apple-touch-icon" href="./icon.svg">
  <meta name="theme-color" content="#ff7043">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header id="top-bar">
    <div class="score-block">
      <div title="本局得分"><span class="emoji">🎯</span> <span id="score">0</span></div>
      <div title="最高记录"><span class="emoji">🏆</span> <span id="high-score">0</span></div>
      <div id="combo-block" class="hidden" title="连击"><span class="emoji">🔥</span> ×<span id="combo">1</span></div>
    </div>
    <button id="pause-btn" aria-label="暂停">⏸</button>
    <button id="help-btn" aria-label="帮助">？</button>
    <button id="settings-btn" aria-label="设置">⚙</button>
  </header>

  <main>
    <canvas id="game-canvas"></canvas>
  </main>

  <!-- 桌面方向板（CSS 限定 hover/fine pointer 才显示）-->
  <div id="control-pad" aria-label="方向按键">
    <button id="pad-left" aria-label="左移">←</button>
    <button id="pad-pause" aria-label="暂停切换">⏯</button>
    <button id="pad-right" aria-label="右移">→</button>
  </div>

  <!-- 帮助面板 -->
  <div id="help-panel" class="panel hidden" aria-hidden="true">
    <div class="panel-header">
      <h2>怎么玩</h2>
      <button id="help-close" aria-label="关闭帮助">✕</button>
    </div>

    <div class="help-section">
      <h3>🎮 目标</h3>
      <p>让球弹来弹去把砖块都打掉，连击越长得分越高。</p>
    </div>

    <div class="help-section">
      <h3>📱 手机和平板</h3>
      <ul>
        <li><b>左右拖动</b> — 移动板拍</li>
        <li><b>按住</b> — 自动暂停，松手继续</li>
        <li><b>右上 ⚙</b> — 打开设置</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>🖱 鼠标 / ⌨️ 键盘</h3>
      <ul>
        <li><b>鼠标拖动</b> — 移动板拍</li>
        <li><b>← → / A D</b> — 移动板拍</li>
        <li><b>P</b> — 暂停 / 继续</li>
        <li><b>Esc</b> — 关掉面板</li>
        <li><b>Enter</b> — 确认</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>🎁 道具</h3>
      <ul>
        <li><b>🟪 加宽板拍</b> — 板拍变宽 12 秒</li>
        <li><b>🌟 多球</b> — 当前每颗球各分裂一颗</li>
        <li><b>🐌 慢球</b> — 球速变慢 10 秒</li>
      </ul>
    </div>

    <div class="help-section">
      <h3>🏁 模式</h3>
      <p>🎯 标准 = 砖块压到板拍就结束 · ♾️ 无尽 = 压到板拍清上半区继续</p>
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
      <label>⏱️ 球速</label>
      <div class="slider-row">
        <span>🐌</span>
        <input type="range" id="speed-slider" min="1" max="5" step="1" value="2">
        <span>🚀</span>
      </div>
    </div>
    <div class="setting-row">
      <label>🏁 结束模式</label>
      <div class="seg" id="end-mode-seg">
        <button data-val="standard">🎯 标准</button>
        <button data-val="endless" class="active">♾️ 无尽</button>
      </div>
      <p class="hint">🎯 = 压到底就结束 · ♾️ = 压到底清上半区继续</p>
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

  <!-- 续玩询问气泡 -->
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

  <!-- 无尽模式清半区浮字 -->
  <div id="encourage-toast" class="toast hidden">💪</div>

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

- [ ] **Step 2：浏览器打开 `games/breakout/index.html`**

应看到没样式的元素堆叠。控制台报 `main.js 404` 是预期的。

- [ ] **Step 3：提交**

```bash
git add games/breakout/index.html
git commit -m "feat(breakout): HTML skeleton with all UI panels"
```

---

### Task B2：CSS

**Files:**
- Create: `games/breakout/style.css`

- [ ] **Step 1：写完整 CSS**

```css
:root {
  /* 默认 = 童趣 */
  --bg: #fff8e1;
  --bg-2: #ff8a65;
  --primary: #ff7043;
  --primary-dark: #e64a19;
  --text: #ffffff;
  --text-dim: #ffe0b2;
  --panel-bg: #ffecb3;
  --panel-text: #4e342e;
  --button-bg: #ffffff;
  --button-bg-text: #5d4037;
  --button-active: #ff7043;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  --canvas-bg: #ffffff;
  --canvas-grid: rgba(255, 112, 67, 0.16);
  --canvas-border: #ff7043;
  --brick-1: #4fc3f7;  /* 蓝 */
  --brick-2: #81c784;  /* 绿 */
  --brick-3: #fff176;  /* 黄 */
  --brick-5: #e57373;  /* 红 */
  --paddle: #ff7043;
  --ball: #ffffff;
}

body[data-theme="candy"] {
  --bg: #fce4ec;
  --bg-2: #f06292;
  --primary: #ec407a;
  --primary-dark: #ad1457;
  --text-dim: #f8bbd0;
  --panel-bg: #fce4ec;
  --panel-text: #880e4f;
  --button-bg-text: #ad1457;
  --button-active: #ec407a;
  --canvas-bg: #fff0f5;
  --canvas-grid: rgba(236, 64, 122, 0.18);
  --canvas-border: #ec407a;
  --brick-1: #f8bbd0;
  --brick-2: #f48fb1;
  --brick-3: #f06292;
  --brick-5: #c2185b;
  --paddle: #ec407a;
  --ball: #fff0f5;
}

body[data-theme="forest"] {
  --bg: #e8f5e9;
  --bg-2: #66bb6a;
  --primary: #43a047;
  --primary-dark: #1b5e20;
  --text-dim: #c8e6c9;
  --panel-bg: #e8f5e9;
  --panel-text: #1b5e20;
  --button-bg-text: #2e7d32;
  --button-active: #43a047;
  --canvas-bg: #f1f8e9;
  --canvas-grid: rgba(67, 160, 71, 0.18);
  --canvas-border: #43a047;
  --brick-1: #aed581;
  --brick-2: #81c784;
  --brick-3: #66bb6a;
  --brick-5: #2e7d32;
  --paddle: #43a047;
  --ball: #f1f8e9;
}

body[data-theme="ocean"] {
  --bg: #e0f7fa;
  --bg-2: #26c6da;
  --primary: #00acc1;
  --primary-dark: #006064;
  --text-dim: #b2ebf2;
  --panel-bg: #e0f7fa;
  --panel-text: #006064;
  --button-bg-text: #00838f;
  --button-active: #00acc1;
  --canvas-bg: #f0fbfd;
  --canvas-grid: rgba(0, 172, 193, 0.18);
  --canvas-border: #00acc1;
  --brick-1: #80deea;
  --brick-2: #4dd0e1;
  --brick-3: #26c6da;
  --brick-5: #00838f;
  --paddle: #00acc1;
  --ball: #f0fbfd;
}

body[data-theme="space"] {
  --bg: #311b92;
  --bg-2: #512da8;
  --primary: #7c4dff;
  --primary-dark: #4527a0;
  --text-dim: #d1c4e9;
  --panel-bg: #4527a0;
  --panel-text: #ffffff;
  --button-bg: #7e57c2;
  --button-bg-text: #ffffff;
  --button-active: #b388ff;
  --canvas-bg: #1a0a4a;
  --canvas-grid: rgba(179, 136, 255, 0.18);
  --canvas-border: #b388ff;
  --brick-1: #9575cd;
  --brick-2: #7e57c2;
  --brick-3: #b388ff;
  --brick-5: #ff80ab;
  --paddle: #b388ff;
  --ball: #ffffff;
}

body[data-theme="night"] {
  --bg: #1a1a2e;
  --bg-2: #16213e;
  --primary: #42a5f5;
  --primary-dark: #1976d2;
  --text-dim: #b0bec5;
  --panel-bg: #263858;
  --panel-text: #ffffff;
  --button-bg: #37475e;
  --button-bg-text: #ffffff;
  --button-active: #42a5f5;
  --canvas-bg: #0d1b2a;
  --canvas-grid: rgba(66, 165, 245, 0.12);
  --canvas-border: #42a5f5;
  --brick-1: #64b5f6;
  --brick-2: #4fc3f7;
  --brick-3: #ffd54f;
  --brick-5: #ef5350;
  --paddle: #42a5f5;
  --ball: #ffffff;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg);
  color: var(--panel-text);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

body {
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

#top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  min-height: 56px;
  flex-shrink: 0;
  gap: 8px;
}

.score-block {
  display: flex;
  gap: 12px;
  flex: 1;
  font-size: 18px;
  font-weight: bold;
  align-items: center;
}

.score-block .emoji { font-size: 20px; }

.score-block #combo-block { color: #ffeb3b; }
.score-block #combo-block.hidden { display: none; }

#top-bar button {
  width: 44px;
  height: 44px;
  font-size: 22px;
  background: var(--button-bg);
  color: var(--button-bg-text);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: var(--shadow);
}

main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  min-height: 0;
}

#game-canvas {
  background: var(--canvas-bg);
  outline: 3px solid var(--canvas-border);
  outline-offset: 0;
  border-radius: 8px;
  max-width: 100%;
  max-height: 100%;
}

/* 桌面方向板：只在有鼠标的设备显示 */
#control-pad {
  display: none;
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  gap: 12px;
  padding: 8px 12px;
  background: var(--panel-bg);
  border-radius: 16px;
  box-shadow: var(--shadow);
}

#control-pad button {
  width: 56px;
  height: 56px;
  font-size: 24px;
  background: var(--button-bg);
  color: var(--button-bg-text);
  border: none;
  border-radius: 12px;
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  #control-pad { display: flex; }
}

/* 面板通用 */
.panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--panel-bg);
  color: var(--panel-text);
  padding: 20px;
  border-radius: 16px;
  box-shadow: var(--shadow);
  width: min(440px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  z-index: 10;
}

.panel.hidden { display: none; }

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h2 { margin: 0; color: var(--primary-dark); }

.panel-header button {
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: var(--panel-text);
}

.help-section { margin-bottom: 12px; }
.help-section h3 { margin: 0 0 4px; color: var(--primary-dark); font-size: 17px; }
.help-section p, .help-section ul { margin: 0; padding-left: 20px; line-height: 1.5; }

.setting-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
  gap: 6px;
}

.setting-row label { font-weight: bold; color: var(--primary-dark); }
.setting-row .hint { font-size: 12px; color: var(--panel-text); opacity: 0.7; margin: 4px 0 0; }

.setting-row.toggle-row { flex-direction: row; align-items: center; justify-content: space-between; }

.seg {
  display: flex;
  gap: 6px;
}

.seg.seg-wrap {
  flex-wrap: wrap;
}

.seg button {
  flex: 1;
  min-width: 80px;
  padding: 10px 8px;
  background: var(--button-bg);
  color: var(--button-bg-text);
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
}

.seg button.active {
  background: var(--button-active);
  color: var(--text);
  border-color: var(--primary-dark);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-row input[type="range"] {
  flex: 1;
  accent-color: var(--primary);
}

.toggle {
  width: 56px;
  height: 36px;
  background: var(--button-bg);
  color: var(--button-bg-text);
  border: 2px solid transparent;
  border-radius: 18px;
  cursor: pointer;
  font-size: 16px;
}

.toggle.active { background: var(--button-active); color: var(--text); }

button.primary {
  background: var(--primary);
  color: var(--text);
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
}

button.secondary {
  background: var(--button-bg);
  color: var(--button-bg-text);
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
}

button.secondary.hidden { display: none; }

/* 气泡（resume / restart-confirm） */
.popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--panel-bg);
  color: var(--panel-text);
  padding: 20px;
  border-radius: 16px;
  box-shadow: var(--shadow);
  z-index: 11;
  width: min(360px, 88vw);
  text-align: center;
}

.popup.hidden { display: none; }
.popup p { margin: 0 0 12px; font-size: 16px; }
.popup-buttons { display: flex; gap: 8px; }
.popup-buttons button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: var(--button-bg);
  color: var(--button-bg-text);
  font-size: 15px;
  cursor: pointer;
}
.popup-buttons button.primary { background: var(--primary); color: var(--text); }

/* 游戏结束面板 */
#gameover-panel { text-align: center; }
.gameover-emoji { font-size: 64px; margin-bottom: 8px; }
.gameover-stat { font-size: 24px; margin: 4px 0; }

/* 浮字 toast */
.toast {
  position: fixed;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  font-size: 80px;
  pointer-events: none;
  z-index: 12;
  animation: toast-pop 1.2s ease-out;
}

.toast.hidden { display: none; }

@keyframes toast-pop {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  20%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  80%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
}

/* 暂停 overlay */
.pause-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #ffffff;
  z-index: 9;
}

.pause-overlay.hidden { display: none; }
.pause-icon { font-size: 96px; }
.pause-hint { font-size: 16px; margin-top: 12px; }

/* 版本号 */
.version-tag {
  position: fixed;
  bottom: 4px;
  right: 8px;
  font-size: 11px;
  color: var(--panel-text);
  opacity: 0.5;
  z-index: 1;
}
```

- [ ] **Step 2：浏览器打开页面**

样式齐全：顶栏背景色、按钮 44×44、canvas 占满主区。控制台仍报 `main.js 404`，预期。

- [ ] **Step 3：提交**

```bash
git add games/breakout/style.css
git commit -m "feat(breakout): style + 6 themes + responsive layout"
```

---

### Task B3：manifest.json + icon.svg

**Files:**
- Create: `games/breakout/manifest.json`
- Create: `games/breakout/icon.svg`

- [ ] **Step 1：写 manifest.json**

```json
{
  "name": "打砖块",
  "short_name": "打砖块",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#fff8e1",
  "theme_color": "#ff7043",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2：写 icon.svg（🧨 风格手绘）**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#ff7043"/>
  <!-- 砖块 4 行 4 列 -->
  <g fill="#ffffff" opacity="0.95">
    <rect x="80"  y="110" width="80" height="40" rx="6"/>
    <rect x="172" y="110" width="80" height="40" rx="6"/>
    <rect x="264" y="110" width="80" height="40" rx="6"/>
    <rect x="356" y="110" width="80" height="40" rx="6"/>
  </g>
  <g fill="#fff176">
    <rect x="80"  y="160" width="80" height="40" rx="6"/>
    <rect x="172" y="160" width="80" height="40" rx="6"/>
    <rect x="264" y="160" width="80" height="40" rx="6"/>
    <rect x="356" y="160" width="80" height="40" rx="6"/>
  </g>
  <g fill="#81c784">
    <rect x="80"  y="210" width="80" height="40" rx="6"/>
    <rect x="172" y="210" width="80" height="40" rx="6"/>
    <rect x="264" y="210" width="80" height="40" rx="6"/>
    <rect x="356" y="210" width="80" height="40" rx="6"/>
  </g>
  <g fill="#4fc3f7">
    <rect x="80"  y="260" width="80" height="40" rx="6"/>
    <rect x="172" y="260" width="80" height="40" rx="6"/>
    <rect x="264" y="260" width="80" height="40" rx="6"/>
    <rect x="356" y="260" width="80" height="40" rx="6"/>
  </g>
  <!-- 球 -->
  <circle cx="256" cy="360" r="18" fill="#ffffff"/>
  <!-- 板拍 -->
  <rect x="176" y="410" width="160" height="28" rx="14" fill="#ffffff"/>
</svg>
```

- [ ] **Step 3：提交**

```bash
git add games/breakout/manifest.json games/breakout/icon.svg
git commit -m "feat(breakout): PWA manifest + icon"
```

---

## Phase C：数据 + 物理（纯函数 + TDD）

### Task C1：tests.html 测试入口

**Files:**
- Create: `games/breakout/tests.html`

- [ ] **Step 1：写 tests.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>打砖块测试</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #fff; color: #333; }
    .ok { color: green; }
    .fail { color: red; font-weight: bold; }
    #summary { font-size: 18px; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>🧨 打砖块测试</h1>
  <div id="results"></div>
  <div id="summary"></div>

  <script type="module">
    const results = document.getElementById('results');
    let passed = 0, failed = 0;

    window.assertEq = (label, actual, expected) => {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      const line = document.createElement('div');
      if (ok) {
        line.className = 'ok';
        line.textContent = `✓ ${label}`;
        passed++;
      } else {
        line.className = 'fail';
        line.textContent = `✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
        failed++;
      }
      results.appendChild(line);
    };

    window.assertTrue = (label, cond) => {
      const line = document.createElement('div');
      if (cond) {
        line.className = 'ok';
        line.textContent = `✓ ${label}`;
        passed++;
      } else {
        line.className = 'fail';
        line.textContent = `✗ ${label}`;
        failed++;
      }
      results.appendChild(line);
    };

    await import('./tests/physics.test.js');
    await import('./tests/game.test.js');

    const summary = document.getElementById('summary');
    summary.textContent = `${passed} passed, ${failed} failed`;
    summary.style.color = failed === 0 ? 'green' : 'red';
  </script>
</body>
</html>
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/tests.html
git commit -m "test(breakout): tests.html browser entry"
```

---

### Task C2：bricks.js（数据）

**Files:**
- Create: `games/breakout/js/bricks.js`

- [ ] **Step 1：写 bricks.js**

```js
// bricks.js — 砖块定义（纯数据）
// 4 种颜色对应 1/2/3/5 分，按权重 5/3/2/1 随机生成
// CSS variable key 由 render 读 --brick-{value}

export const BRICK_DEFS = [
  { value: 1, weight: 5, cssVar: '--brick-1' },
  { value: 2, weight: 3, cssVar: '--brick-2' },
  { value: 3, weight: 2, cssVar: '--brick-3' },
  { value: 5, weight: 1, cssVar: '--brick-5' },
];

const TOTAL_WEIGHT = BRICK_DEFS.reduce((s, b) => s + b.weight, 0);

/** 按权重抽一种砖（返回 value，0 = 空格） */
export function randomBrickValue(rng = Math.random) {
  let r = rng() * TOTAL_WEIGHT;
  for (const b of BRICK_DEFS) {
    r -= b.weight;
    if (r < 0) return b.value;
  }
  return BRICK_DEFS[BRICK_DEFS.length - 1].value;
}

/** value → CSS variable key（render 用） */
export function brickCssVar(value) {
  const def = BRICK_DEFS.find((b) => b.value === value);
  return def ? def.cssVar : null;
}
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/bricks.js
git commit -m "feat(breakout): bricks data module (value/weight/color)"
```

---

### Task C3：physics.js — AABB sweep + 砖块命中

**Files:**
- Create: `games/breakout/js/physics.js`
- Create: `games/breakout/tests/physics.test.js`

- [ ] **Step 1：写失败测试 — `physics.test.js`（先建文件，包含 4 个 sweep 测试）**

```js
// physics.test.js — physics 模块纯函数测试
import {
  reflectFromBrick,
  paddleReflectionAngle,
  sweepAgainstBrick,
} from '../js/physics.js';

// reflectFromBrick：球从四方向进入矩形，速度分量反转
{
  // 从下进入（球向上移动），y 分量翻转
  const r = reflectFromBrick({ vx: 0.3, vy: -0.5 }, 'top');
  assertEq('reflectFromBrick top: vx unchanged', r.vx, 0.3);
  assertEq('reflectFromBrick top: vy flipped',   r.vy, 0.5);
}
{
  const r = reflectFromBrick({ vx: 0.3, vy: 0.5 }, 'bottom');
  assertEq('reflectFromBrick bottom: vy flipped', r.vy, -0.5);
}
{
  const r = reflectFromBrick({ vx: -0.4, vy: 0.2 }, 'right');
  assertEq('reflectFromBrick right: vx flipped', r.vx, 0.4);
  assertEq('reflectFromBrick right: vy unchanged', r.vy, 0.2);
}
{
  const r = reflectFromBrick({ vx: 0.4, vy: 0.2 }, 'left');
  assertEq('reflectFromBrick left: vx flipped', r.vx, -0.4);
}

// paddleReflectionAngle：命中中心 → 几乎竖直；两端 → ±60°
{
  const cur = { vx: 0, vy: 5 };
  const r = paddleReflectionAngle(cur, 0);   // 中心命中
  assertTrue('paddle center: vx≈0',       Math.abs(r.vx) < 0.01);
  assertTrue('paddle center: vy negative', r.vy < 0);
}
{
  const cur = { vx: 0, vy: 5 };
  const right = paddleReflectionAngle(cur, 1);    // 命中最右
  assertTrue('paddle right end: vx > 0', right.vx > 0);
  assertTrue('paddle right end: vy < 0', right.vy < 0);
  const left = paddleReflectionAngle(cur, -1);    // 命中最左
  assertTrue('paddle left end: vx < 0', left.vx < 0);
}
{
  // 镜像对称：speed 守恒
  const cur = { vx: 0, vy: 5 };
  const r1 = paddleReflectionAngle(cur, 0.7);
  const r2 = paddleReflectionAngle(cur, -0.7);
  const s1 = Math.hypot(r1.vx, r1.vy);
  const s2 = Math.hypot(r2.vx, r2.vy);
  assertTrue('paddle reflection conserves speed',
             Math.abs(s1 - 5) < 0.01 && Math.abs(s2 - 5) < 0.01);
  assertTrue('paddle reflection is symmetric',
             Math.abs(r1.vx + r2.vx) < 0.01 && Math.abs(r1.vy - r2.vy) < 0.01);
}

// sweepAgainstBrick：球从位置 A 到位置 B，AABB 命中
{
  // 球从下方向上穿入砖 (4, 5)
  const ball = { x: 4.5, y: 6 };
  const next = { x: 4.5, y: 5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);  // brickRow=5, brickCol=4, radius=0.3
  assertTrue('sweep top hit detected', hit !== null);
  assertEq('sweep top side',           hit.side, 'bottom');  // 球从下进，命中砖下沿
}
{
  // 球横穿砖
  const ball = { x: 3.5, y: 5.5 };
  const next = { x: 4.5, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  assertTrue('sweep horizontal hit detected', hit !== null);
  assertEq('sweep horizontal side', hit.side, 'left');
}
{
  // 球未触砖
  const ball = { x: 1, y: 1 };
  const next = { x: 1.2, y: 1.2 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  assertEq('sweep no hit', hit, null);
}
```

- [ ] **Step 2：浏览器打开 `games/breakout/tests.html` 确认全红**

应看到 `physics.test.js` import 失败（模块不存在）。**预期**——下一步写实现。

- [ ] **Step 3：写最小实现 — `physics.js`**

```js
// physics.js — 纯函数物理：AABB sweep、反射几何
// 单位：列（cell）。所有坐标 / 速度都用 cell 单位，render 层乘 cellSize。
// 球：x, y 是中心；radius 0.3 cell。
// 砖块：(row, col) → 包围盒 [col, col+1] × [row, row+1]。

/** 砖块命中后反弹速度，side ∈ 'top' | 'bottom' | 'left' | 'right' */
export function reflectFromBrick(vel, side) {
  if (side === 'top'    || side === 'bottom') return { vx:  vel.vx, vy: -vel.vy };
  if (side === 'left'   || side === 'right')  return { vx: -vel.vx, vy:  vel.vy };
  return { ...vel };
}

/**
 * 板拍角度反射。
 * @param {{vx, vy}} vel 当前速度
 * @param {number} hitOffsetRatio 命中点偏移占板拍半宽的比例（-1 = 最左，+1 = 最右）
 * @returns {{vx, vy}} 反射后速度（速度大小守恒）
 */
export function paddleReflectionAngle(vel, hitOffsetRatio) {
  const speed = Math.hypot(vel.vx, vel.vy);
  const t = Math.max(-1, Math.min(1, hitOffsetRatio));
  const angleDeg = t * 60;                      // ±60°
  const angleRad = angleDeg * Math.PI / 180;
  return {
    vx: speed * Math.sin(angleRad),
    vy: -speed * Math.abs(Math.cos(angleRad)),  // 始终向上
  };
}

/**
 * 球从 ball 移到 next 期间是否命中砖 (brickRow, brickCol)。
 * 命中则返回 { t, side, contactX, contactY }；未命中返回 null。
 * AABB-vs-circle 简化：把球当作点 + 把砖盒外扩 radius。
 */
export function sweepAgainstBrick(ball, next, brickCol, brickRow, radius) {
  const boxL = brickCol     - radius;
  const boxR = brickCol + 1 + radius;
  const boxT = brickRow     - radius;
  const boxB = brickRow + 1 + radius;

  const dx = next.x - ball.x;
  const dy = next.y - ball.y;

  // 整段 ray 都不进 box（粗剔除）
  if (Math.min(ball.x, next.x) > boxR || Math.max(ball.x, next.x) < boxL) return null;
  if (Math.min(ball.y, next.y) > boxB || Math.max(ball.y, next.y) < boxT) return null;

  // 计算进入 / 离开各轴的 t（slab method）
  let tEnterX = -Infinity, tExitX = Infinity;
  if (Math.abs(dx) > 1e-9) {
    const t1 = (boxL - ball.x) / dx;
    const t2 = (boxR - ball.x) / dx;
    tEnterX = Math.min(t1, t2);
    tExitX  = Math.max(t1, t2);
  } else {
    if (ball.x < boxL || ball.x > boxR) return null;
  }

  let tEnterY = -Infinity, tExitY = Infinity;
  if (Math.abs(dy) > 1e-9) {
    const t1 = (boxT - ball.y) / dy;
    const t2 = (boxB - ball.y) / dy;
    tEnterY = Math.min(t1, t2);
    tExitY  = Math.max(t1, t2);
  } else {
    if (ball.y < boxT || ball.y > boxB) return null;
  }

  const tEnter = Math.max(tEnterX, tEnterY);
  const tExit  = Math.min(tExitX, tExitY);

  if (tEnter > tExit || tEnter > 1 || tExit < 0) return null;
  const t = Math.max(0, tEnter);

  // 判定命中哪一边：进入时间大的那个轴
  let side;
  if (tEnterX > tEnterY) {
    side = dx > 0 ? 'left' : 'right';
  } else {
    side = dy > 0 ? 'top' : 'bottom';
  }

  return {
    t,
    side,
    contactX: ball.x + dx * t,
    contactY: ball.y + dy * t,
  };
}
```

- [ ] **Step 4：浏览器刷新 tests.html 看全绿**

应看到所有 physics 断言 ✓。

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/physics.js games/breakout/tests/physics.test.js
git commit -m "feat(breakout): physics module (sweep AABB + paddle angle)"
```

---

## Phase D：GameLogic（TDD，分多 task 增量加测试）

### Task D1：game.js — 初始状态 + setPaddleCol

**Files:**
- Create: `games/breakout/js/game.js`
- Create: `games/breakout/tests/game.test.js`

- [ ] **Step 1：写测试 — game.test.js（仅初始 + paddle 段）**

```js
// game.test.js — GameLogic 纯函数测试
import { GameLogic } from '../js/game.js';

// 初始状态
{
  const g = new GameLogic();
  assertEq('score=0',   g.score,        0);
  assertEq('combo=1',   g.combo,        1);
  assertEq('paused=false', g.paused,    false);
  assertEq('board 12 cols × 18 rows', g.cols * g.rows, 12 * 18);
  assertEq('initial 4 rows seeded',
           g.board.slice(0, 4).every(row => row.some(v => v > 0)), true);
  assertEq('bottom rows empty',
           g.board.slice(4).every(row => row.every(v => v === 0)), true);
  assertEq('1 ball at start', g.balls.length, 1);
  assertTrue('ball waiting for launch (vy === 0)', g.balls[0].vy === 0);
  assertEq('paddle col centered', g.paddle.col, 6);
}

// setPaddleCol：clamp 边界
{
  const g = new GameLogic();
  g.setPaddleCol(3);
  assertEq('paddle col=3', g.paddle.col, 3);
  g.setPaddleCol(-5);
  assertTrue('paddle col >= half-width (left clamp)', g.paddle.col >= 1.5);
  g.setPaddleCol(99);
  assertTrue('paddle col <= cols - half-width (right clamp)', g.paddle.col <= 12 - 1.5);
}
```

- [ ] **Step 2：浏览器 tests.html，全红（GameLogic 未定义）**

- [ ] **Step 3：写最小 game.js**

```js
// game.js — 打砖块核心逻辑
// 坐标系：cell 单位，原点左上。row=0 顶部，row=17 底部。
// board[r][c] = 砖块 value（0 = 空），by 4.2 BRICK_DEFS。
// 球：{x, y, vx, vy} 浮点 cell。
// 板拍：{ col: 中心列(浮点), widthMul, widthRemainMs }

import { randomBrickValue } from './bricks.js';
import {
  reflectFromBrick,
  paddleReflectionAngle,
  sweepAgainstBrick,
} from './physics.js';

export const COLS = 12;
export const ROWS = 18;
export const BALL_RADIUS = 0.3;
export const PADDLE_BASE_WIDTH = 3;       // cell
export const PADDLE_Y = 16;                // 板拍中心行（距底 2 格）
export const PADDLE_HALF_HEIGHT = 0.25;   // cell
export const INITIAL_BRICK_ROWS = 4;
export const SPEED_TABLE   = [6, 8, 10, 12, 14];   // 球速 cell/s（档位 1-5）
export const DESCENT_TABLE = [8000, 7000, 5000, 4000, 3000];  // 砖块下移间隔 ms

export class GameLogic {
  constructor() {
    this.cols = COLS;
    this.rows = ROWS;
    this.score = 0;
    this.combo = 1;
    this.paused = false;
    this.gameOver = false;
    this.endMode = 'endless';     // 'standard' | 'endless'
    this.speedLevel = 2;

    this.board = this._newBoard();
    this._seedInitialBricks();

    this.paddle = {
      col: COLS / 2,
      widthMul: 1,
      widthRemainMs: 0,
    };

    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;   // ms 倒计时，到 0 后随机角度发射
    this.brickDescentTimer = DESCENT_TABLE[this.speedLevel - 1];
    this.slowRemainMs = 0;
    this.fallingItem = null;

    this._onLock = null;
    this._onBrick = null;
    this._onDrop = null;
    this._onGameOver = null;
    this._onPaddleHit = null;
    this._onPowerup = null;
    this._onTopOut = null;
    this._onScoreChange = null;
    this._onComboChange = null;

    this._rng = Math.random;
  }

  _newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  _seedInitialBricks() {
    for (let r = 0; r < INITIAL_BRICK_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.board[r][c] = randomBrickValue(this._rng);
      }
    }
  }

  _spawnBall() {
    return {
      x: this.paddle ? this.paddle.col : COLS / 2,
      y: PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05,
      vx: 0,
      vy: 0,
    };
  }

  _paddleWidth() {
    return PADDLE_BASE_WIDTH * this.paddle.widthMul;
  }

  _paddleHalfWidth() {
    return this._paddleWidth() / 2;
  }

  setPaddleCol(col) {
    const half = this._paddleHalfWidth();
    this.paddle.col = Math.max(half, Math.min(COLS - half, col));
  }

  setPaused(p) { this.paused = !!p; }

  // 事件钩子
  onLock(fn)        { this._onLock = fn; }
  onBrick(fn)       { this._onBrick = fn; }
  onDrop(fn)        { this._onDrop = fn; }
  onPaddleHit(fn)   { this._onPaddleHit = fn; }
  onPowerup(fn)     { this._onPowerup = fn; }
  onTopOut(fn)      { this._onTopOut = fn; }
  onGameOver(fn)    { this._onGameOver = fn; }
  onScoreChange(fn) { this._onScoreChange = fn; }
  onComboChange(fn) { this._onComboChange = fn; }
}
```

- [ ] **Step 4：刷新 tests.html，初始 + paddle 段全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): GameLogic skeleton + paddle col + initial seeding"
```

---

### Task D2：game.step — 球贴板倒计时 + 自动发射

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：在 game.test.js 末尾追加测试**

```js
// 球发射：1.5s 倒计时
{
  const g = new GameLogic();
  assertTrue('initial ball glued (vy=0)', g.balls[0].vy === 0);
  g.step(800);
  assertTrue('still glued mid-countdown', g.balls[0].vy === 0);
  g.step(800);
  assertTrue('ball launched (vy != 0)', g.balls[0].vy !== 0);
  assertTrue('ball goes up', g.balls[0].vy < 0);
  const sp = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  const expected = SPEED_TABLE[g.speedLevel - 1];
  assertTrue('ball speed = speed table', Math.abs(sp - expected) < 0.01);
}

// paused 时 step 不推进
{
  const g = new GameLogic();
  g.setPaused(true);
  const before = g.ballRespawnTimer;
  g.step(2000);
  assertEq('paused: timer unchanged', g.ballRespawnTimer, before);
}
```

记得在 `import { GameLogic } ...` 行下追加 `import { SPEED_TABLE } from '../js/game.js';`（一行加在 GameLogic import 后）。

- [ ] **Step 2：浏览器跑测试，应有 3 个新断言红**

- [ ] **Step 3：补 game.js — 在 class 末尾（在 onScoreChange / onComboChange hook 之前）加 `step(dt)`**

```js
  step(dt) {
    if (this.paused || this.gameOver) return;

    // 慢球计时
    if (this.slowRemainMs > 0) {
      this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
    }
    // 板拍加宽计时
    if (this.paddle.widthRemainMs > 0) {
      this.paddle.widthRemainMs = Math.max(0, this.paddle.widthRemainMs - dt);
      if (this.paddle.widthRemainMs === 0) {
        this.paddle.widthMul = 1;
        this.setPaddleCol(this.paddle.col);
      }
    }

    // 球贴板倒计时
    if (this.ballRespawnTimer > 0) {
      this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - dt);
      // 球贴在板拍中间
      for (const b of this.balls) {
        b.x = this.paddle.col;
        b.y = PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05;
        b.vx = 0;
        b.vy = 0;
      }
      if (this.ballRespawnTimer === 0) {
        this._launchAllBalls();
      }
      return;
    }
  }

  _launchAllBalls() {
    const baseSpeed = SPEED_TABLE[this.speedLevel - 1];
    const mul = this.slowRemainMs > 0 ? 0.7 : 1;
    for (const b of this.balls) {
      // 向上 ±45° 随机
      const angle = (this._rng() * 90 - 45) * Math.PI / 180;
      const sp = baseSpeed * mul;
      b.vx = sp * Math.sin(angle);
      b.vy = -sp * Math.cos(angle);
    }
  }
```

- [ ] **Step 4：跑测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): step() with ball respawn countdown + launch"
```

---

### Task D3：game.step — 球运动 + 墙壁反射

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 球运动 + 墙壁反射
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 5, vy: 0 };   // 向右走，预测 200ms 后到 7.0
  g.step(200);
  assertTrue('ball moved right', g.balls[0].x > 6.5);

  // 让球撞右墙
  g.balls[0] = { x: 11.5, y: 8, vx: 5, vy: 0 };
  g.step(200);
  assertTrue('ball bounced off right wall (vx flipped)', g.balls[0].vx < 0);
}

// 顶墙反射
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 0.5, vx: 0, vy: -5 };
  g.step(200);
  assertTrue('ball bounced off top wall (vy flipped)', g.balls[0].vy > 0);
}

// 球掉底：combo 归 1，触发 onDrop
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.combo = 5;
  g.balls[0] = { x: 6, y: 17.8, vx: 0, vy: 5 };
  let dropped = 0;
  g.onDrop(() => dropped++);
  g.step(200);  // 200ms 后球 y=18.8，越出
  assertEq('combo reset to 1', g.combo, 1);
  assertEq('onDrop fired', dropped, 1);
  assertEq('1 ball respawned', g.balls.length, 1);
  assertTrue('respawn timer set', g.ballRespawnTimer > 0);
}
```

- [ ] **Step 2：跑测试，3 段红**

- [ ] **Step 3：在 step() 末尾补球的运动逻辑（把上一步 `return;` 之后的部分加上）**

把现有 step() 改为以下完整版本（替换整个 step）：

```js
  step(dt) {
    if (this.paused || this.gameOver) return;

    if (this.slowRemainMs > 0) this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
    if (this.paddle.widthRemainMs > 0) {
      this.paddle.widthRemainMs = Math.max(0, this.paddle.widthRemainMs - dt);
      if (this.paddle.widthRemainMs === 0) {
        this.paddle.widthMul = 1;
        this.setPaddleCol(this.paddle.col);
      }
    }

    if (this.ballRespawnTimer > 0) {
      this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - dt);
      for (const b of this.balls) {
        b.x = this.paddle.col;
        b.y = PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05;
        b.vx = 0;
        b.vy = 0;
      }
      if (this.ballRespawnTimer === 0) this._launchAllBalls();
      return;
    }

    // 推进所有球
    const dtSec = dt / 1000;
    for (const ball of this.balls) {
      this._stepBall(ball, dtSec);
    }
    // 移除掉底的球
    const survivors = this.balls.filter((b) => b.y < ROWS);
    if (survivors.length < this.balls.length) {
      this.balls = survivors;
      if (this.balls.length === 0) {
        this._handleDrop();
      }
    }
  }

  _stepBall(ball, dtSec) {
    // 子步：每帧拆 N 步，避免穿透
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dtSec / 0.4));
    const subDt = dtSec / steps;
    for (let i = 0; i < steps; i++) {
      let nx = ball.x + ball.vx * subDt;
      let ny = ball.y + ball.vy * subDt;

      // 左右墙
      if (nx < BALL_RADIUS) { nx = BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
      else if (nx > COLS - BALL_RADIUS) { nx = COLS - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }

      // 顶墙
      if (ny < BALL_RADIUS) { ny = BALL_RADIUS; ball.vy = Math.abs(ball.vy); }

      ball.x = nx;
      ball.y = ny;
    }
  }

  _handleDrop() {
    this.combo = 1;
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onDrop) this._onDrop();
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
  }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): ball motion + wall reflection + drop handling"
```

---

### Task D4：game.step — 板拍反射

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 板拍命中：球从板拍上方下来 → 反弹向上
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.paddle.col = 6;
  // 球正中央落在板拍中心：vy 向下，应反弹向上
  g.balls[0] = { x: 6, y: PADDLE_Y - 0.5, vx: 0, vy: 5 };
  let hits = 0;
  g.onPaddleHit(() => hits++);
  g.step(50);
  assertTrue('ball bounced off paddle (vy<0)', g.balls[0].vy < 0);
  assertEq('onPaddleHit fired', hits, 1);
}

// 板拍命中偏左 → vx 向左
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.paddle.col = 6;
  g.balls[0] = { x: 5.0, y: PADDLE_Y - 0.5, vx: 0, vy: 5 };  // 偏左
  g.step(50);
  assertTrue('left-of-center hit -> vx < 0', g.balls[0].vx < 0);
  assertTrue('vy < 0 (going up)', g.balls[0].vy < 0);
}
```

需要从 game.js 额外 export PADDLE_Y。已 export，跳过。

- [ ] **Step 2：跑测试，2 段红**

- [ ] **Step 3：补板拍命中**

在 `_stepBall` 函数内部，**替换为**带板拍判定的版本：

```js
  _stepBall(ball, dtSec) {
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dtSec / 0.4));
    const subDt = dtSec / steps;
    for (let i = 0; i < steps; i++) {
      const prev = { x: ball.x, y: ball.y };
      let nx = ball.x + ball.vx * subDt;
      let ny = ball.y + ball.vy * subDt;

      if (nx < BALL_RADIUS) { nx = BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
      else if (nx > COLS - BALL_RADIUS) { nx = COLS - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }

      if (ny < BALL_RADIUS) { ny = BALL_RADIUS; ball.vy = Math.abs(ball.vy); }

      ball.x = nx;
      ball.y = ny;

      // 板拍命中（仅当球向下移动）
      if (ball.vy > 0) {
        const half = this._paddleHalfWidth();
        const padL = this.paddle.col - half;
        const padR = this.paddle.col + half;
        const padT = PADDLE_Y - PADDLE_HALF_HEIGHT;
        const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
        // 球底沿（球中心 + radius）越过板拍上沿
        if (ball.y + BALL_RADIUS >= padT && ball.y - BALL_RADIUS <= padB
            && ball.x >= padL && ball.x <= padR) {
          const hitOffset = (ball.x - this.paddle.col) / half;
          const r = paddleReflectionAngle({ vx: ball.vx, vy: ball.vy }, hitOffset);
          ball.vx = r.vx;
          ball.vy = r.vy;
          ball.y = padT - BALL_RADIUS - 0.01;   // 推出板拍上沿，防止反复命中
          if (this._onPaddleHit) this._onPaddleHit();
        }
      }
    }
  }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): paddle hit angle reflection"
```

---

### Task D5：game.step — 砖块命中 + 计分 + combo

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 砖块命中 → 得分 = 颜色分值 × combo
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.combo = 3;
  // 把整个 board 清空，只剩 (5, 6) 一个 value=2 砖
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.board[5][6] = 2;
  // 球从 (6.5, 6) 向上撞砖底（即 row=5+1=6 处）
  g.balls[0] = { x: 6.5, y: 6.2, vx: 0, vy: -5 };
  let brickHits = 0;
  g.onBrick(() => brickHits++);
  g.step(50);
  assertEq('brick destroyed', g.board[5][6], 0);
  assertEq('score = 2 * 3 = 6', g.score, 6);
  assertEq('combo +1 → 4', g.combo, 4);
  assertEq('onBrick fired', brickHits, 1);
}

// combo 上限 ×10
{
  const g = new GameLogic();
  g.combo = 10;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.board[5][6] = 1;
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6.5, y: 6.2, vx: 0, vy: -5 };
  g.step(50);
  assertEq('combo capped at 10', g.combo, 10);
}

// 同帧最多消 1 砖
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  // 两个连续砖：(5, 6) 和 (5, 7)
  g.board[5][6] = 1;
  g.board[5][7] = 1;
  // 球横穿过两砖
  g.balls[0] = { x: 5.5, y: 5.5, vx: 30, vy: 0 };
  g.step(100);
  const totalDestroyed = (g.board[5][6] === 0 ? 1 : 0) + (g.board[5][7] === 0 ? 1 : 0);
  assertTrue('only 1 brick destroyed per step',totalDestroyed >= 1);
  // 注意：可能多步推进多次命中。重要的是不会同一帧同时消两个 + 反射方向
}
```

- [ ] **Step 2：跑测试，多段红**

- [ ] **Step 3：在 _stepBall 内部，**板拍命中之前**插入砖块命中（每个子步）**

把 `_stepBall` 改为以下（板拍逻辑保留，前面插砖块）：

```js
  _stepBall(ball, dtSec) {
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dtSec / 0.4));
    const subDt = dtSec / steps;
    for (let i = 0; i < steps; i++) {
      const prev = { x: ball.x, y: ball.y };
      const next = {
        x: ball.x + ball.vx * subDt,
        y: ball.y + ball.vy * subDt,
      };

      // 1. 砖块碰撞（找最近一个 hit）
      const brickHit = this._findBrickHit(prev, next);
      if (brickHit) {
        const r = reflectFromBrick({ vx: ball.vx, vy: ball.vy }, brickHit.side);
        ball.vx = r.vx;
        ball.vy = r.vy;
        ball.x = brickHit.contactX;
        ball.y = brickHit.contactY;
        this._onBrickDestroyed(brickHit.col, brickHit.row);
        continue;   // 这一子步消耗在砖上，直接进下一子步
      }

      // 2. 没撞砖 → 推进
      let nx = next.x, ny = next.y;

      if (nx < BALL_RADIUS) { nx = BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
      else if (nx > COLS - BALL_RADIUS) { nx = COLS - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }

      if (ny < BALL_RADIUS) { ny = BALL_RADIUS; ball.vy = Math.abs(ball.vy); }

      ball.x = nx;
      ball.y = ny;

      // 3. 板拍
      if (ball.vy > 0) {
        const half = this._paddleHalfWidth();
        const padL = this.paddle.col - half;
        const padR = this.paddle.col + half;
        const padT = PADDLE_Y - PADDLE_HALF_HEIGHT;
        const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
        if (ball.y + BALL_RADIUS >= padT && ball.y - BALL_RADIUS <= padB
            && ball.x >= padL && ball.x <= padR) {
          const hitOffset = (ball.x - this.paddle.col) / half;
          const r = paddleReflectionAngle({ vx: ball.vx, vy: ball.vy }, hitOffset);
          ball.vx = r.vx;
          ball.vy = r.vy;
          ball.y = padT - BALL_RADIUS - 0.01;
          if (this._onPaddleHit) this._onPaddleHit();
        }
      }
    }
  }

  _findBrickHit(prev, next) {
    // 扫一遍 board 找 sweep 命中（粗剔除：只检查 ball 包围盒覆盖的格子）
    const minR = Math.max(0, Math.floor(Math.min(prev.y, next.y) - BALL_RADIUS) - 1);
    const maxR = Math.min(ROWS - 1, Math.ceil(Math.max(prev.y, next.y) + BALL_RADIUS) + 1);
    const minC = Math.max(0, Math.floor(Math.min(prev.x, next.x) - BALL_RADIUS) - 1);
    const maxC = Math.min(COLS - 1, Math.ceil(Math.max(prev.x, next.x) + BALL_RADIUS) + 1);
    let best = null;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.board[r][c] === 0) continue;
        const h = sweepAgainstBrick(prev, next, c, r, BALL_RADIUS);
        if (h && (best === null || h.t < best.t)) {
          best = { ...h, col: c, row: r };
        }
      }
    }
    return best;
  }

  _onBrickDestroyed(col, row) {
    const value = this.board[row][col];
    this.board[row][col] = 0;
    this.score += value * this.combo;
    if (this.combo < 10) this.combo++;
    if (this._onScoreChange) this._onScoreChange(this.score);
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onBrick) this._onBrick({ col, row, value });
  }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): brick collision + scoring + combo"
```

---

### Task D6：砖块下移 + 压顶（标准 / 无尽）

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 砖块下移：定时器到 → 所有砖下移一行 + 顶部生成新行
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.brickDescentTimer = 1;
  const before = g.board.map(row => row.slice());
  g.step(100);
  // 原先 row 0 的砖现在在 row 1
  for (let c = 0; c < COLS; c++) {
    assertEq(`row 0 moved to row 1 col=${c}`, g.board[1][c], before[0][c]);
  }
  // row 0 重新生成（部分非零）
  assertTrue('row 0 regenerated', g.board[0].some(v => v > 0));
}

// 压顶（标准）：触发 game over
{
  const g = new GameLogic();
  g.endMode = 'standard';
  g.ballRespawnTimer = 0;
  // 把整板填满，下沿越过 PADDLE_Y
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  let gameOverCalled = null;
  g.onGameOver((mode) => { gameOverCalled = mode; });
  // 触发砖块下移检查
  g.brickDescentTimer = 1;
  g.step(100);
  assertEq('standard topOut triggers gameOver', gameOverCalled, 'standard');
  assertEq('gameOver flag set', g.gameOver, true);
}

// 压顶（无尽）：清前 9 行 + 下半区上移 9 行
{
  const g = new GameLogic();
  g.endMode = 'endless';
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  // 上半（前 9 行）放标记值
  for (let c = 0; c < g.cols; c++) { g.board[5][c] = 3; }   // 标志位
  let topOutCalled = 0;
  g.onTopOut(() => topOutCalled++);
  g.brickDescentTimer = 1;
  g.step(100);
  assertEq('endless topOut fired', topOutCalled, 1);
  assertEq('combo reset', g.combo, 1);
  assertEq('gameOver still false', g.gameOver, false);
  // 原 row 5 的标记应该在 row 14（5 + 9）
  assertEq('row 5 moved to row 14', g.board[14][3], 3);
  // 下半区 row 9..17 现已经空（清掉的"下半"——按 spec 是清前 9 行 + 下半上移）
  // 重述：清前 9 行（row 0..8），row 9..17 上移到 row 0..8，row 9..17 清空
  assertEq('row 9..17 cleared', g.board[15][3], 0);
  assertEq('row 17 cleared',     g.board[17][3], 0);
}
```

- [ ] **Step 2：跑测试，多段红**

- [ ] **Step 3：在 game.js 的 `step()` 内**，在球贴板倒计时分支后（return 之前的位置不要被覆盖）追加砖块下移逻辑

把 step() 整体改为如下：

```js
  step(dt) {
    if (this.paused || this.gameOver) return;

    if (this.slowRemainMs > 0) this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
    if (this.paddle.widthRemainMs > 0) {
      this.paddle.widthRemainMs = Math.max(0, this.paddle.widthRemainMs - dt);
      if (this.paddle.widthRemainMs === 0) {
        this.paddle.widthMul = 1;
        this.setPaddleCol(this.paddle.col);
      }
    }

    // 砖块下移定时器
    this.brickDescentTimer -= dt;
    if (this.brickDescentTimer <= 0) {
      this.brickDescentTimer += DESCENT_TABLE[this.speedLevel - 1];
      this._descendBricks();
    }

    if (this.ballRespawnTimer > 0) {
      this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - dt);
      for (const b of this.balls) {
        b.x = this.paddle.col;
        b.y = PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05;
        b.vx = 0;
        b.vy = 0;
      }
      if (this.ballRespawnTimer === 0) this._launchAllBalls();
      return;
    }

    const dtSec = dt / 1000;
    for (const ball of this.balls) this._stepBall(ball, dtSec);

    const survivors = this.balls.filter((b) => b.y < ROWS);
    if (survivors.length < this.balls.length) {
      this.balls = survivors;
      if (this.balls.length === 0) this._handleDrop();
    }
  }

  _descendBricks() {
    // 检查是否会压到板拍（任意砖下沿越过 PADDLE_Y - PADDLE_HALF_HEIGHT）
    // 当前最低有砖的行 + 1 = 下沿
    let lowestBrickRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].some((v) => v > 0)) { lowestBrickRow = r; break; }
    }
    // 下移后最低砖在 lowestBrickRow + 1
    const wouldHitPaddle = lowestBrickRow + 1 + 1 > PADDLE_Y - PADDLE_HALF_HEIGHT;
    if (lowestBrickRow >= 0 && wouldHitPaddle) {
      this._handleTopOut();
      return;
    }
    // 安全：所有砖下移 1 行 + 顶部新生成一行
    for (let r = ROWS - 1; r > 0; r--) {
      for (let c = 0; c < COLS; c++) this.board[r][c] = this.board[r - 1][c];
    }
    for (let c = 0; c < COLS; c++) this.board[0][c] = randomBrickValue(this._rng);
  }

  _handleTopOut() {
    if (this.endMode === 'standard') {
      this.gameOver = true;
      if (this._onGameOver) this._onGameOver('standard');
      return;
    }
    // endless：清前 9 行，row 9..17 → row 0..8，row 9..17 清空
    const upper = this.board.slice(9, ROWS).map((row) => row.slice());
    const empty = Array.from({ length: 9 }, () => Array(COLS).fill(0));
    this.board = [...upper, ...empty];
    this.combo = 1;
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onTopOut) this._onTopOut();
  }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): brick descent + top-out handling (standard/endless)"
```

---

### Task D7：道具掉落 + 接到生效

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 道具掉落：强制 8% 触发（用固定 rng）
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  // 强制 rng：第一次抽道具掉落（< 0.08），第二次决定哪个 powerup
  let calls = 0;
  const seq = [0.05, 0.0];  // 0.05 < 0.08，触发；0.0 → wider
  g._rng = () => seq[Math.min(calls++, seq.length - 1)];

  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.board[5][6] = 1;
  g.balls[0] = { x: 6.5, y: 6.2, vx: 0, vy: -5 };
  g.step(50);
  assertTrue('powerup item spawned', g.fallingItem !== null);
  assertEq('powerup type wider', g.fallingItem.type, 'wider');
}

// 接到加宽：板拍变宽 + 计时 12 秒
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.fallingItem = { type: 'wider', x: 6, y: PADDLE_Y - 0.5 };
  g.paddle.col = 6;
  let pwUp = null;
  g.onPowerup((t) => { pwUp = t; });
  g.step(150);  // 道具下落 ≈ 0.45 cell（半球速 / 2）
  // 道具继续下落直到碰板拍
  for (let i = 0; i < 200 && g.fallingItem !== null; i++) g.step(100);
  assertEq('paddle widened',     g.paddle.widthMul, 1.6);
  assertTrue('width timer set',  g.paddle.widthRemainMs > 0);
  assertEq('onPowerup fired wider', pwUp, 'wider');
}

// 接到慢球：球速 × 0.7
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.fallingItem = { type: 'slow', x: g.paddle.col, y: PADDLE_Y - 0.5 };
  g.balls[0] = { x: 6, y: 8, vx: 0, vy: -10 };
  for (let i = 0; i < 200 && g.fallingItem !== null; i++) g.step(100);
  assertTrue('slow remain set', g.slowRemainMs > 0);
}

// 多球分裂
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 3, vy: -5 };
  g.fallingItem = { type: 'multi', x: g.paddle.col, y: PADDLE_Y - 0.5 };
  for (let i = 0; i < 200 && g.fallingItem !== null; i++) g.step(100);
  assertEq('balls doubled', g.balls.length, 2);
}
```

- [ ] **Step 2：跑测试，多段红**

- [ ] **Step 3：补 game.js**

3a. 在 `_onBrickDestroyed` 末尾，**加道具掉落判定**：

```js
  _onBrickDestroyed(col, row) {
    const value = this.board[row][col];
    this.board[row][col] = 0;
    this.score += value * this.combo;
    if (this.combo < 10) this.combo++;
    if (this._onScoreChange) this._onScoreChange(this.score);
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onBrick) this._onBrick({ col, row, value });

    // 8% 概率掉道具，且场上 ≤ 1
    if (this.fallingItem === null && this._rng() < 0.08) {
      const pool = ['wider', 'multi', 'slow'];
      const type = pool[Math.floor(this._rng() * pool.length)];
      this.fallingItem = { type, x: col + 0.5, y: row + 0.5 };
    }
  }
```

3b. 在 step() 末尾（球推进 + survivors 逻辑之后），**加道具下落**：

```js
    // 道具下落（板拍接 / 漏接）
    if (this.fallingItem) {
      const itemSpeedY = SPEED_TABLE[this.speedLevel - 1] * 0.5 * (dt / 1000);
      this.fallingItem.y += itemSpeedY;
      const half = this._paddleHalfWidth();
      const padT = PADDLE_Y - PADDLE_HALF_HEIGHT - 0.3;
      const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
      const padL = this.paddle.col - half;
      const padR = this.paddle.col + half;
      if (this.fallingItem.y >= padT && this.fallingItem.y <= padB
          && this.fallingItem.x >= padL && this.fallingItem.x <= padR) {
        this._applyPowerup(this.fallingItem.type);
        this.fallingItem = null;
      } else if (this.fallingItem.y >= ROWS) {
        this.fallingItem = null;
      }
    }
```

3c. **加 `_applyPowerup`**：

```js
  _applyPowerup(type) {
    if (type === 'wider') {
      this.paddle.widthMul = 1.6;
      this.paddle.widthRemainMs = 12000;
      this.setPaddleCol(this.paddle.col);
    } else if (type === 'slow') {
      this.slowRemainMs = 10000;
      // 立即把现有球速 ×0.7
      for (const b of this.balls) {
        b.vx *= 0.7;
        b.vy *= 0.7;
      }
    } else if (type === 'multi') {
      const copies = this.balls.map((b) => ({
        x: b.x,
        y: b.y,
        vx: -b.vx || (this._rng() < 0.5 ? -3 : 3),
        vy: b.vy,
      }));
      this.balls = [...this.balls, ...copies];
    }
    if (this._onPowerup) this._onPowerup(type);
  }
```

3d. **慢球到期恢复**：在 step 顶部的 slowRemain 处理后追加：

```js
    // 慢球到期：把球速恢复
    if (this.slowRemainMs === 0 && this._slowWasActive) {
      for (const b of this.balls) {
        b.vx /= 0.7;
        b.vy /= 0.7;
      }
      this._slowWasActive = false;
    }
```

把 slow 那段改为：

```js
    if (this.slowRemainMs > 0) {
      this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
      this._slowWasActive = true;
    } else if (this._slowWasActive) {
      for (const b of this.balls) { b.vx /= 0.7; b.vy /= 0.7; }
      this._slowWasActive = false;
    }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): power-ups (wider/multi/slow) + falling item"
```

---

### Task D8：serialize / restore

**Files:**
- Modify: `games/breakout/js/game.js`
- Modify: `games/breakout/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 序列化 / 反序列化
{
  const g = new GameLogic();
  g.score = 1234;
  g.combo = 5;
  g.endMode = 'standard';
  g.speedLevel = 4;
  g.paddle.col = 7.2;
  g.paddle.widthMul = 1.6;
  g.paddle.widthRemainMs = 5000;
  g.slowRemainMs = 3000;
  g.brickDescentTimer = 2222;
  g.ballRespawnTimer = 333;
  g.balls = [{ x: 4, y: 5, vx: -3, vy: 2 }, { x: 6, y: 7, vx: 1, vy: -4 }];
  g.fallingItem = { type: 'multi', x: 5, y: 5 };

  const snap = g.serialize();
  const g2 = new GameLogic();
  g2.restore(snap);
  assertEq('restored score',           g2.score, 1234);
  assertEq('restored combo',           g2.combo, 5);
  assertEq('restored endMode',         g2.endMode, 'standard');
  assertEq('restored speedLevel',      g2.speedLevel, 4);
  assertEq('restored paddle.col',      g2.paddle.col, 7.2);
  assertEq('restored paddle.widthMul', g2.paddle.widthMul, 1.6);
  assertEq('restored widthRemain',     g2.paddle.widthRemainMs, 5000);
  assertEq('restored slowRemain',      g2.slowRemainMs, 3000);
  assertEq('restored descent timer',   g2.brickDescentTimer, 2222);
  assertEq('restored respawn timer',   g2.ballRespawnTimer, 333);
  assertEq('restored balls count',     g2.balls.length, 2);
  assertEq('restored fallingItem',     g2.fallingItem.type, 'multi');
  assertEq('restored board[0][0]',     g2.board[0][0], g.board[0][0]);
}
```

- [ ] **Step 2：跑测试，红**

- [ ] **Step 3：在 game.js 类末尾加 serialize / restore**

```js
  serialize() {
    return {
      v: 1,
      score: this.score,
      combo: this.combo,
      endMode: this.endMode,
      speedLevel: this.speedLevel,
      board: this.board.map((row) => row.slice()),
      paddle: { ...this.paddle },
      balls: this.balls.map((b) => ({ ...b })),
      fallingItem: this.fallingItem ? { ...this.fallingItem } : null,
      brickDescentTimer: this.brickDescentTimer,
      ballRespawnTimer: this.ballRespawnTimer,
      slowRemainMs: this.slowRemainMs,
      gameOver: this.gameOver,
    };
  }

  restore(snap) {
    if (!snap || snap.v !== 1) return false;
    this.score = snap.score;
    this.combo = snap.combo;
    this.endMode = snap.endMode;
    this.speedLevel = snap.speedLevel;
    this.board = snap.board.map((row) => row.slice());
    this.paddle = { ...snap.paddle };
    this.balls = snap.balls.map((b) => ({ ...b }));
    this.fallingItem = snap.fallingItem ? { ...snap.fallingItem } : null;
    this.brickDescentTimer = snap.brickDescentTimer;
    this.ballRespawnTimer = snap.ballRespawnTimer;
    this.slowRemainMs = snap.slowRemainMs;
    this.gameOver = !!snap.gameOver;
    this._slowWasActive = this.slowRemainMs > 0;
    return true;
  }

  reset() {
    this.score = 0;
    this.combo = 1;
    this.gameOver = false;
    this.board = this._newBoard();
    this._seedInitialBricks();
    this.paddle = { col: COLS / 2, widthMul: 1, widthRemainMs: 0 };
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
    this.brickDescentTimer = DESCENT_TABLE[this.speedLevel - 1];
    this.slowRemainMs = 0;
    this._slowWasActive = false;
    this.fallingItem = null;
  }

  setSpeedLevel(level) {
    const newLevel = Math.max(1, Math.min(5, level | 0));
    if (newLevel !== this.speedLevel) {
      // 按比例换速；下移定时器按比例缩放
      const oldDescent = DESCENT_TABLE[this.speedLevel - 1];
      const newDescent = DESCENT_TABLE[newLevel - 1];
      this.brickDescentTimer *= newDescent / oldDescent;
      // 球速也按档位重新算
      const oldSp = SPEED_TABLE[this.speedLevel - 1] * (this.slowRemainMs > 0 ? 0.7 : 1);
      const newSp = SPEED_TABLE[newLevel - 1] * (this.slowRemainMs > 0 ? 0.7 : 1);
      const ratio = newSp / oldSp;
      for (const b of this.balls) { b.vx *= ratio; b.vy *= ratio; }
      this.speedLevel = newLevel;
    }
  }

  setEndMode(mode) {
    if (mode === 'standard' || mode === 'endless') this.endMode = mode;
  }
```

- [ ] **Step 4：测试全绿**

- [ ] **Step 5：提交**

```bash
git add games/breakout/js/game.js games/breakout/tests/game.test.js
git commit -m "feat(breakout): serialize/restore + reset/setSpeed/setEndMode"
```

---

## Phase E：渲染 + 特效

### Task E1：render.js — 基础绘制

**Files:**
- Create: `games/breakout/js/render.js`

- [ ] **Step 1：写 render.js**

```js
// render.js — Canvas 绘制
import { brickCssVar } from './bricks.js';
import {
  COLS, ROWS, BALL_RADIUS,
  PADDLE_Y, PADDLE_HALF_HEIGHT,
} from './game.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 24;
    this._theme = this._readTheme();
    this._resize();
    window.addEventListener('resize', this._resize.bind(this));
  }

  _resize() {
    const wrap = this.canvas.parentElement;
    const maxW = wrap.clientWidth - 16;
    const maxH = wrap.clientHeight - 16;
    const cell = Math.min(Math.floor(maxW / COLS), Math.floor(maxH / ROWS));
    this.cellSize = Math.max(8, cell);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = COLS * this.cellSize * dpr;
    this.canvas.height = ROWS * this.cellSize * dpr;
    this.canvas.style.width = COLS * this.cellSize + 'px';
    this.canvas.style.height = ROWS * this.cellSize + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _readTheme() {
    const styles = getComputedStyle(document.body);
    const read = (key, fallback) => styles.getPropertyValue(key).trim() || fallback;
    return {
      bg:      read('--canvas-bg',  '#ffffff'),
      grid:    read('--canvas-grid','rgba(0,0,0,0.06)'),
      brick1:  read('--brick-1',    '#4fc3f7'),
      brick2:  read('--brick-2',    '#81c784'),
      brick3:  read('--brick-3',    '#fff176'),
      brick5:  read('--brick-5',    '#e57373'),
      paddle:  read('--paddle',     '#ff7043'),
      ball:    read('--ball',       '#ffffff'),
    };
  }

  refreshTheme() { this._theme = this._readTheme(); }

  _cssVarValue(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  draw(game) {
    const ctx = this.ctx;
    const w = COLS * this.cellSize;
    const h = ROWS * this.cellSize;

    // 抖动
    const shake = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 背景
    ctx.fillStyle = this._theme.bg;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = this._theme.grid;
    ctx.lineWidth = 1;
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellSize + 0.5);
      ctx.lineTo(w, r * this.cellSize + 0.5);
      ctx.stroke();
    }

    // 砖块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = game.board[r][c];
        if (v === 0) continue;
        const key = brickCssVar(v);
        const color = this._cssVarValue(key) || this._theme.brick1;
        this._drawBrick(c, r, color);
      }
    }

    // 板拍
    this._drawPaddle(game);

    // 球
    for (const b of game.balls) this._drawBall(b);

    // 道具
    if (game.fallingItem) this._drawFallingItem(game.fallingItem);

    // 球贴板倒计时数字
    if (game.ballRespawnTimer > 0) {
      const sec = Math.ceil(game.ballRespawnTimer / 1000);
      ctx.fillStyle = this._theme.paddle;
      ctx.font = `bold ${this.cellSize * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sec), game.paddle.col * this.cellSize, (PADDLE_Y - 2) * this.cellSize);
    }

    // 特效层（粒子 + 闪烁）
    if (this.effects) {
      this.effects.drawParticles(ctx, this.cellSize);
      this.effects.drawFlashes(ctx, w, h);
    }

    ctx.restore();
  }

  _drawBrick(col, row, color) {
    const ctx = this.ctx;
    const x = col * this.cellSize + 1;
    const y = row * this.cellSize + 1;
    const s = this.cellSize - 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, 4);
    else ctx.rect(x, y, s, s);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 2, y + 2, s - 4, 3);
  }

  _drawPaddle(game) {
    const ctx = this.ctx;
    const halfW = (3 * game.paddle.widthMul) / 2;
    const x = (game.paddle.col - halfW) * this.cellSize;
    const y = (PADDLE_Y - PADDLE_HALF_HEIGHT) * this.cellSize;
    const w = 2 * halfW * this.cellSize;
    const h = 2 * PADDLE_HALF_HEIGHT * this.cellSize;
    ctx.fillStyle = this._theme.paddle;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  _drawBall(ball) {
    const ctx = this.ctx;
    ctx.fillStyle = this._theme.ball;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(ball.x * this.cellSize, ball.y * this.cellSize, BALL_RADIUS * this.cellSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawFallingItem(item) {
    const ctx = this.ctx;
    const emoji = { wider: '🟪', multi: '🌟', slow: '🐌' }[item.type] || '?';
    ctx.font = `${this.cellSize * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, item.x * this.cellSize, item.y * this.cellSize);
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/render.js
git commit -m "feat(breakout): canvas renderer (bricks/paddle/ball/item)"
```

---

### Task E2：effects.js — 粒子 / 抖动 / 闪烁

**Files:**
- Create: `games/breakout/js/effects.js`

- [ ] **Step 1：写 effects.js**

```js
// effects.js — 粒子 / 抖动 / 闪烁 / 道具光环（受 intensity 控制）

export class Effects {
  constructor() {
    this.intensity = 1.0;
    this.particles = [];
    this.shake = null;            // { amp, dur, t }
    this.flashes = [];            // [{ color, alpha, life, dur }]
  }

  setIntensity(v) { this.intensity = v; }

  step(dt) {
    // particles
    const dtSec = dt / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 30 * dtSec;          // gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.shake) {
      this.shake.t += dt;
      if (this.shake.t >= this.shake.dur) this.shake = null;
    }

    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }

  spawnBrickParticles(col, row, color) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(8 * this.intensity));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: col + 0.5,
        y: row + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 500 + Math.random() * 300,
        maxLife: 500,
      });
    }
  }

  spawnPaddleGlow() {
    if (this.intensity === 0) return;
    this.flashes.push({ kind: 'paddle', color: '#ffffff', alpha: 0.6, life: 500, dur: 500 });
  }

  triggerShake(amp = 6, dur = 240) {
    if (this.intensity === 0) return;
    this.shake = { amp: amp * this.intensity, dur, t: 0 };
  }

  triggerFlash(color = '#ff0000', alpha = 0.4, dur = 180) {
    if (this.intensity === 0) return;
    this.flashes.push({ kind: 'screen', color, alpha, life: dur, dur });
  }

  getShakeOffset() {
    if (!this.shake) return { x: 0, y: 0 };
    const r = this.shake.amp * (1 - this.shake.t / this.shake.dur);
    return {
      x: (Math.random() * 2 - 1) * r,
      y: (Math.random() * 2 - 1) * r,
    };
  }

  drawParticles(ctx, cellSize) {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * cellSize, p.y * cellSize, 2 + alpha * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlashes(ctx, w, h) {
    for (const f of this.flashes) {
      if (f.kind !== 'screen') continue;
      ctx.globalAlpha = f.alpha * (f.life / f.dur);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/effects.js
git commit -m "feat(breakout): effects (particles/shake/flash)"
```

---

## Phase F：输入

### Task F1：input.js shim

**Files:**
- Create: `games/breakout/js/input.js`

- [ ] **Step 1：写 input.js**

```js
// input.js — 仅 re-export shared/gesture-input.js
export { Input } from '../../../shared/gesture-input.js';
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/input.js
git commit -m "feat(breakout): input shim → shared/gesture-input"
```

---

## Phase G：音效

### Task G1：audio.js — 基础音效

**Files:**
- Create: `games/breakout/js/audio.js`

- [ ] **Step 1：写 audio.js**

```js
// audio.js — 打砖块音效
import { AudioEngine } from '../../../shared/audio-engine.js';

const BRICK_FREQ = { 1: 440, 2: 554, 3: 659, 5: 880 };

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
    this.speedLevel = 2;
  }

  setBgmOn(on) {
    this.bgmOn = on;
    if (!on) this.stopBgm(200);
    else if (!this.bgmController && this.ctx) this._startBgm();
  }

  stopBgm(fadeMs = 200) {
    if (this.bgmController) {
      this.bgmController.stop(fadeMs);
      this.bgmController = null;
    }
  }

  setSpeedLevel(level) {
    this.speedLevel = level;
    if (this.bgmController) {
      this.stopBgm(150);
      setTimeout(() => { if (this.bgmOn) this._startBgm(); }, 200);
    }
  }

  // ── 游戏音效 ──
  playPaddle() {
    this.playTone({ freq: 600, type: 'square', duration: 60, gain: 0.3 });
  }

  playBrick(value) {
    const freq = BRICK_FREQ[value] || 440;
    this.playTone({ freq, type: 'square', duration: 70, gain: 0.35 });
  }

  playWall() {
    this.playTone({ freq: 380, type: 'square', duration: 40, gain: 0.2 });
  }

  playPowerup() {
    this.playNoiseSweep({ fromFreq: 800, toFreq: 2400, duration: 220, gain: 0.25 });
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this.scheduleNote(523, t0,         100, 0.3, 'triangle');
    this.scheduleNote(659, t0 + 0.06,  100, 0.3, 'triangle');
    this.scheduleNote(784, t0 + 0.12,  120, 0.3, 'triangle');
  }

  playDrop() {
    this.playThump({ fromFreq: 220, toFreq: 80, duration: 220, gain: 0.5 });
  }

  playTopOut() {
    this.playNoiseSweep({ fromFreq: 2000, toFreq: 200, duration: 400, gain: 0.4 });
    this.playTone({ freq: 110, type: 'sawtooth', duration: 400, gain: 0.3 });
  }

  playHighScore() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) =>
      this.scheduleNote(f, t0 + i * 0.08, 180, 0.32, 'triangle')
    );
  }

  startBgm() { if (this.bgmOn && !this.bgmController) this._startBgm(); }

  _startBgm() {
    if (!this.ctx) return;
    // 简单的 4 小节 loop：5 度 + 大调和弦琶音
    const tempoBase = 110;     // BPM
    const tempo = tempoBase + (this.speedLevel - 1) * 10;
    const beat = 60 / tempo;   // 一拍秒
    const notes = [
      [261, 329, 392, 329],     // C E G E
      [294, 349, 440, 349],     // D F A F
      [261, 329, 392, 329],
      [220, 294, 349, 294],     // A D F D
    ];
    let stop = false;
    const schedule = (start) => {
      let t = start;
      for (const bar of notes) {
        for (const f of bar) {
          this.scheduleNote(f, t, beat * 0.9 * 1000, 0.12, 'triangle');
          t += beat;
        }
      }
      return t;
    };
    let next = this.ctx.currentTime + 0.1;
    const loop = () => {
      if (stop) return;
      next = schedule(next);
      setTimeout(loop, (next - this.ctx.currentTime - 0.3) * 1000);
    };
    loop();
    this.bgmController = {
      stop: (fadeMs) => { stop = true; },
    };
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/audio.js
git commit -m "feat(breakout): audio engine (brick/paddle/drop/bgm)"
```

---

## Phase H：设置 + 持久化

### Task H1：settings.js

**Files:**
- Create: `games/breakout/js/settings.js`

- [ ] **Step 1：写 settings.js**

```js
// settings.js — 设置面板 + localStorage
const KEY = 'breakout.settings';
const KEY_HIGH = 'breakout.highScore';

const DEFAULTS = {
  theme: 'cheery',
  speed: 2,
  endMode: 'endless',
  sfxOn: true,
  bgmOn: true,
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
      this.highScore = parseInt(localStorage.getItem(KEY_HIGH) || '0', 10) || 0;
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) {}
  }

  get(key) {
    return key === 'highScore' ? this.highScore : this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') this.highScore = value;
    else { this.state[key] = value; this.apply(); }
    this.save();
  }

  apply() {
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);
    this.audio.setSpeedLevel(this.state.speed);
    this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1.0);
    this.game.setSpeedLevel(this.state.speed);
    this.game.setEndMode(this.state.endMode);
    document.body.dataset.theme = this.state.theme;
    this._syncUi();
  }

  _syncUi() {
    document.querySelectorAll('#theme-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.theme));
    document.querySelectorAll('#end-mode-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.endMode));
    document.querySelectorAll('#fx-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.fxLevel));
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.value = String(this.state.speed);
    const sfx = document.getElementById('sfx-toggle');
    if (sfx) { sfx.classList.toggle('active', this.state.sfxOn); sfx.textContent = this.state.sfxOn ? '🔊' : '🔇'; }
    const bgm = document.getElementById('bgm-toggle');
    if (bgm) { bgm.classList.toggle('active', this.state.bgmOn); bgm.textContent = this.state.bgmOn ? '🎵' : '🔕'; }
  }

  bindUi() {
    const wireSeg = (segId, key) => {
      document.querySelectorAll(`#${segId} button`).forEach((b) => {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.set(key, b.dataset.val);
        });
      });
    };
    wireSeg('theme-seg', 'theme');
    wireSeg('end-mode-seg', 'endMode');
    wireSeg('fx-seg', 'fxLevel');

    const slider = document.getElementById('speed-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.set('speed', parseInt(slider.value, 10));
      });
    }

    const sfx = document.getElementById('sfx-toggle');
    if (sfx) sfx.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.set('sfxOn', !this.state.sfxOn);
    });
    const bgm = document.getElementById('bgm-toggle');
    if (bgm) bgm.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.set('bgmOn', !this.state.bgmOn);
    });
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/breakout/js/settings.js
git commit -m "feat(breakout): settings panel + localStorage persistence"
```

---

## Phase I：入口 + 整合

### Task I1：main.js — 实例化模块 + 主循环

**Files:**
- Create: `games/breakout/js/main.js`

- [ ] **Step 1：写 main.js**

```js
// main.js — 打砖块入口
import { GameLogic } from './game.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';
import { Input } from './input.js';
import { brickCssVar } from './bricks.js';

const SAVE_KEY = 'breakout.saveGame';

const canvas = document.getElementById('game-canvas');
const game = new GameLogic();
const effects = new Effects();
const renderer = new Renderer(canvas, effects);
const audio = new Audio();
const settings = new Settings(game, audio, effects);
settings.load();
settings.apply();
settings.bindUi();

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high-score');
const comboEl = document.getElementById('combo');
const comboBlock = document.getElementById('combo-block');

function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function updateScoreUi() {
  scoreEl.textContent = String(game.score);
  highEl.textContent = String(settings.get('highScore'));
  comboEl.textContent = String(game.combo);
  comboBlock.classList.toggle('hidden', game.combo <= 1);
}

// 事件接线
game.onPaddleHit(() => { audio.playPaddle(); vibrate([15]); });
game.onBrick(({ col, row, value }) => {
  audio.playBrick(value);
  const cssVar = brickCssVar(value);
  const color = getComputedStyle(document.body).getPropertyValue(cssVar).trim() || '#fff';
  effects.spawnBrickParticles(col, row, color);
  updateScoreUi();
});
game.onComboChange(() => updateScoreUi());
game.onScoreChange(() => updateScoreUi());
game.onDrop(() => {
  audio.playDrop();
  effects.triggerShake(4, 200);
  effects.triggerFlash('#ff5252', 0.35, 200);
  vibrate([60, 30, 30]);
  updateScoreUi();
});
game.onPowerup((type) => {
  audio.playPowerup();
  effects.spawnPaddleGlow();
  vibrate([20, 30, 40]);
});
game.onTopOut(() => {
  audio.playTopOut();
  effects.triggerShake(8, 400);
  effects.triggerFlash('#ffffff', 0.5, 220);
  vibrate([40, 20, 40, 20, 80]);
  showEncourageToast();
  updateScoreUi();
});

// 高分基线（破纪录庆祝一次）
let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
}

// 游戏结束
const gameoverPanel = document.getElementById('gameover-panel');
const finalScoreEl = document.getElementById('final-score');
const finalHighEl = document.getElementById('final-high');
const replayBtn = document.getElementById('replay-btn');
const shareBtn = document.getElementById('share-btn');

game.onGameOver((mode) => {
  finalScoreEl.textContent = String(game.score);
  finalHighEl.textContent = String(settings.get('highScore'));
  gameoverPanel.classList.remove('hidden');
});

replayBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  gameoverPanel.classList.add('hidden');
  game.reset();
  resetHighScoreTracker();
  clearSave();
  updateScoreUi();
});

// 输入
const input = new Input(
  canvas,
  () => renderer.cellSize,
  () => ({ row: 0, col: game.paddle.col })   // gesture-input 用 piece state，对打砖块只关心 col
);
input.on('moveTo', (_row, col) => game.setPaddleCol(col));
input.on('pauseChange', (paused) => game.setPaused(paused));
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});

// 桌面方向板 ← → ⏯
const padLeft = document.getElementById('pad-left');
const padRight = document.getElementById('pad-right');
const padPause = document.getElementById('pad-pause');
let padHoldTimer = null;
function startHoldMove(delta) {
  game.setPaddleCol(game.paddle.col + delta);
  if (padHoldTimer) return;
  padHoldTimer = setInterval(() => {
    game.setPaddleCol(game.paddle.col + delta);
  }, 40);
}
function stopHoldMove() { if (padHoldTimer) { clearInterval(padHoldTimer); padHoldTimer = null; } }
padLeft.addEventListener('pointerdown', () => startHoldMove(-0.5));
padLeft.addEventListener('pointerup', stopHoldMove);
padLeft.addEventListener('pointercancel', stopHoldMove);
padLeft.addEventListener('pointerleave', stopHoldMove);
padRight.addEventListener('pointerdown', () => startHoldMove(0.5));
padRight.addEventListener('pointerup', stopHoldMove);
padRight.addEventListener('pointercancel', stopHoldMove);
padRight.addEventListener('pointerleave', stopHoldMove);
padPause.addEventListener('pointerdown', () => toggleManualPause());

// 键盘
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'p' || e.key === 'P') { e.preventDefault(); toggleManualPause(); }
  else if (e.key === 'Escape') { closeAllPanels(); }
});

// 手动暂停 overlay
const pauseOverlay = document.getElementById('pause-overlay');
let manualPaused = false;
function setManualPause(p) {
  manualPaused = p;
  pauseOverlay.classList.toggle('hidden', !manualPaused);
  game.setPaused(p);
  if (p) audio.stopBgm(120);
  else if (settings.get('bgmOn')) audio.startBgm();
}
function toggleManualPause() { setManualPause(!manualPaused); }
document.getElementById('pause-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleManualPause(); });
pauseOverlay.addEventListener('pointerdown', () => { if (manualPaused) setManualPause(false); });

// 帮助 / 设置面板开关
const helpPanel = document.getElementById('help-panel');
const settingsPanel = document.getElementById('settings-panel');

function openPanel(panel) {
  closeAllPanels();
  panel.classList.remove('hidden');
  game.setPaused(true);
  audio.stopBgm(120);
}
function closePanel(panel) {
  panel.classList.add('hidden');
  // 若没有别的暂停理由，恢复
  if (!manualPaused && [helpPanel, settingsPanel, gameoverPanel].every((p) => p.classList.contains('hidden'))) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
}
function closeAllPanels() {
  helpPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  document.getElementById('restart-confirm').classList.add('hidden');
  if (!manualPaused && gameoverPanel.classList.contains('hidden')) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
}

document.getElementById('help-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); openPanel(helpPanel); });
document.getElementById('help-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePanel(helpPanel); });
document.getElementById('settings-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); openPanel(settingsPanel); });
document.getElementById('settings-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePanel(settingsPanel); });

// 重启确认
const restartConfirm = document.getElementById('restart-confirm');
document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.remove('hidden');
});
document.getElementById('restart-cancel').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.add('hidden');
});
document.getElementById('restart-ok').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  game.reset();
  resetHighScoreTracker();
  clearSave();
  updateScoreUi();
  if (!manualPaused) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
});

// 续玩
const resumePopup = document.getElementById('resume-popup');
let resumePending = false;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
function persistSave() {
  if (resumePending || game.gameOver) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}
window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistSave(); });

const snap = loadSave();
if (snap && snap.score > 0) {
  resumePending = true;
  game.setPaused(true);
  resumePopup.classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game.restore(snap)) return;
    resumePopup.classList.add('hidden');
    resumePending = false;
    resetHighScoreTracker();
    updateScoreUi();
    if (!manualPaused) game.setPaused(false);
  });
  document.getElementById('resume-discard').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    clearSave();
    resumePopup.classList.add('hidden');
    resumePending = false;
    if (!manualPaused) game.setPaused(false);
  });
}

// 浮字 toast（无尽压顶）
const encourageToast = document.getElementById('encourage-toast');
function showEncourageToast() {
  encourageToast.classList.remove('hidden');
  encourageToast.style.animation = 'none';
  // reflow trigger
  void encourageToast.offsetWidth;
  encourageToast.style.animation = '';
  setTimeout(() => encourageToast.classList.add('hidden'), 1200);
}

// 主题切换需要重读 canvas variables
const observer = new MutationObserver(() => renderer.refreshTheme());
observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

// 破纪录庆祝
function celebrateHighScore() {
  audio.playHighScore();
  effects.triggerFlash('#ffeb3b', 0.4, 600);
  vibrate([50, 20, 60, 20, 80, 30, 120]);
}

// 分享
function buildShareText() {
  return `🎯 ${game.score}\n🧨 我在小游戏乐园打砖块得了 ${game.score} 分！\nhttps://zhcqiu.github.io/little-games/`;
}
async function shareScore() {
  const text = buildShareText();
  if (navigator.share) {
    try { await navigator.share({ title: '打砖块', text }); return; } catch (e) {}
  }
  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = '📋 已复制';
    setTimeout(() => { shareBtn.textContent = '📤 分享成绩'; }, 1200);
  } catch (e) {}
}
if (navigator.share || navigator.clipboard) {
  shareBtn.classList.remove('hidden');
}
shareBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); shareScore(); });

// 主循环
updateScoreUi();
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(100, now - lastTime);
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game);

  // 高分追踪
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
    highEl.textContent = String(game.score);
  }
  if (!highScoreCelebrated && highScoreBaseline > 0 && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    celebrateHighScore();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
```

- [ ] **Step 2：本地起 server 试跑**

```bash
python -m http.server 8765
```

浏览器开 `http://127.0.0.1:8765/games/breakout/`，验证：
- 球贴板拍 1.5s 倒计时数字
- 球发射后能打砖（蓝绿黄红 4 色）
- 拖动屏幕板拍跟随
- 顶栏 🎯 数字增长，🔥 ×N 在 ≥2 时显示
- 设置 ⚙ 打开能切主题（画面立即变色）
- 帮助 ？ 打开 / 关闭
- 测速档位 5 时砖块下移很快

- [ ] **Step 3：提交**

```bash
git add games/breakout/js/main.js
git commit -m "feat(breakout): main entry — game loop + all UI panels + persistence"
```

---

## Phase J：CI + 测试整合

### Task J1：把测试 import 进 run-tests.mjs

**Files:**
- Modify: `tests/run-tests.mjs`

- [ ] **Step 1：在文件顶部 tetris import 下追加**

```js
import { GameLogic, COLS, ROWS, SPEED_TABLE, PADDLE_Y } from '../games/breakout/js/game.js';
import { reflectFromBrick, paddleReflectionAngle, sweepAgainstBrick } from '../games/breakout/js/physics.js';
import { randomBrickValue } from '../games/breakout/js/bricks.js';
```

- [ ] **Step 2：在文件末尾、`// ───── result ─────` 之前，插入打砖块断言**

```js
// ───── breakout ─────
// physics
{
  const r = reflectFromBrick({ vx: 0.3, vy: -0.5 }, 'top');
  eq('breakout reflect top vx', r.vx, 0.3);
  eq('breakout reflect top vy', r.vy, 0.5);
}
{
  const r = paddleReflectionAngle({ vx: 0, vy: 5 }, 0);
  truthy('breakout paddle center vx≈0', Math.abs(r.vx) < 0.01);
  truthy('breakout paddle center vy<0', r.vy < 0);
}
{
  const right = paddleReflectionAngle({ vx: 0, vy: 5 }, 1);
  truthy('breakout paddle right vx>0', right.vx > 0);
}
{
  const ball = { x: 4.5, y: 6 };
  const next = { x: 4.5, y: 5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  truthy('breakout sweep top hit', hit !== null && hit.side === 'bottom');
}
{
  const noHit = sweepAgainstBrick({ x: 1, y: 1 }, { x: 1.2, y: 1.2 }, 4, 5, 0.3);
  eq('breakout sweep no hit', noHit, null);
}

// bricks
{
  // 至少跑 100 次，确保 randomBrickValue 不抛
  let sum = 0;
  for (let i = 0; i < 100; i++) sum += randomBrickValue();
  truthy('breakout bricks return value > 0', sum > 0);
}

// game initial
{
  const g = new GameLogic();
  eq('breakout score=0',     g.score, 0);
  eq('breakout combo=1',     g.combo, 1);
  eq('breakout cols',        g.cols, COLS);
  eq('breakout rows',        g.rows, ROWS);
  eq('breakout 1 ball',      g.balls.length, 1);
  truthy('breakout ball glued', g.balls[0].vy === 0);
}

// 球发射
{
  const g = new GameLogic();
  g.step(1600);
  truthy('breakout ball launched', g.balls[0].vy !== 0 && g.balls[0].vy < 0);
}

// 砖块命中 + 计分
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.combo = 3;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.board[5][6] = 2;
  g.balls[0] = { x: 6.5, y: 6.2, vx: 0, vy: -5 };
  g.step(50);
  eq('breakout brick cleared', g.board[5][6], 0);
  eq('breakout score = value × combo', g.score, 6);
  eq('breakout combo +1', g.combo, 4);
}

// 掉球归 combo
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.combo = 7;
  g.balls[0] = { x: 6, y: 17.8, vx: 0, vy: 5 };
  g.step(200);
  eq('breakout drop reset combo', g.combo, 1);
  eq('breakout respawned 1 ball', g.balls.length, 1);
}

// 无尽压顶
{
  const g = new GameLogic();
  g.endMode = 'endless';
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  for (let c = 0; c < g.cols; c++) g.board[5][c] = 3;
  g.brickDescentTimer = 1;
  let topOut = 0;
  g.onTopOut(() => topOut++);
  g.step(100);
  eq('breakout endless topOut',  topOut, 1);
  eq('breakout row 5→14 marker', g.board[14][3], 3);
  eq('breakout row 17 cleared',  g.board[17][3], 0);
}

// 标准压顶
{
  const g = new GameLogic();
  g.endMode = 'standard';
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  g.brickDescentTimer = 1;
  let mode = null;
  g.onGameOver((m) => { mode = m; });
  g.step(100);
  eq('breakout standard game over', mode, 'standard');
  eq('breakout gameOver flag',      g.gameOver, true);
}

// 序列化
{
  const g = new GameLogic();
  g.score = 999;
  g.combo = 4;
  const snap = g.serialize();
  const g2 = new GameLogic();
  g2.restore(snap);
  eq('breakout restore score', g2.score, 999);
  eq('breakout restore combo', g2.combo, 4);
}
```

- [ ] **Step 3：跑 node 测试**

```bash
node tests/run-tests.mjs
```

Expected: 全绿，行数比之前多。

- [ ] **Step 4：提交**

```bash
git add tests/run-tests.mjs
git commit -m "test(breakout): integrate physics + game tests into CI"
```

---

## Phase K：发布前手测 + 收尾

### Task K1：node + python server 手测

- [ ] **Step 1：本地跑 node check + tests**

```bash
node --check sw.js
node --check index.html 2>/dev/null || true
node --check games/breakout/js/*.js
node tests/run-tests.mjs
```

Expected: 全绿。

- [ ] **Step 2：起 server，浏览器全功能过一遍**

```bash
python -m http.server 8765
```

打开 `http://127.0.0.1:8765/games/breakout/`，按 spec §7.2 清单过：

```
[ ] 球贴板拍 1.5s 倒计时 ✨ 显示，然后随机角度发射
[ ] 拖动屏幕板拍跟随
[ ] 球反弹墙壁、击碎砖块（4 色都试到）
[ ] 砖块下移：调速度档位 5 看节奏
[ ] 8% 概率掉道具：故意打很多砖等到掉一个
[ ]   接 🟪 → 板拍变宽 12s 收回
[ ]   接 🌟 → 球数 +1（多球 1 → 2 → 4）
[ ]   接 🐌 → 球速明显变慢 10s
[ ] 掉球：球出底，combo 归 1，1.5s 后重发
[ ] 压顶（无尽）：故意不打砖，等砖块下移到板拍 → 清半区 + 💪 浮字
[ ] 切换标准 → 同样情况 → game-over 面板
[ ] 6 主题切换：童趣 / 糖果 / 森林 / 海洋 / 太空 / 夜空 颜色全跟随
[ ] fxLevel 切到关：无粒子无抖动无 vibrate
[ ] 暂停按钮 + 帮助 + 设置 三按钮互斥不冲突
[ ] 重启按钮 → 确认气泡 → 重置
[ ] 切到后台：再回来续玩弹窗弹出，选"继续"或"新开"两条路都试
[ ] 分享：iOS / Chrome 测原生分享 / 剪贴板复制兜底
[ ] DevTools → Application → Service Workers 看到 sw.js 已激活（v7）
[ ] DevTools → Network → Offline 模式刷新仍能玩
```

- [ ] **Step 3：bump 版本号 tag**

把 `games/breakout/index.html` 末尾 `<div class="version-tag">v1.0</div>` 保持不变（已是 v1.0）。

- [ ] **Step 4：（可选）真机测试**

部署到 GitHub Pages 后 iOS Safari + Android Chrome 各一局，"添加到主屏幕"独立 PWA 启动验证。

---

### Task K2：最终 push

- [ ] **Step 1：检查 git status 无未提交**

```bash
git status
```

应该 `nothing to commit, working tree clean`。

- [ ] **Step 2：push**

```bash
git push
```

等 CI 绿 → GitHub Pages 部署完成。

- [ ] **Step 3：浏览器开 `https://zhcqiu.github.io/little-games/`**

应看到打砖块卡片（🧨），点进去能玩。

---

## 自审

- **Spec 覆盖**：
  - §2.1 棋盘/板拍/球：D1 实例化、D2 发射、E1 渲染 ✓
  - §2.2 物理：C3 sweep、C3 反射、D4 板拍、D5 砖块 ✓
  - §2.3 砖块下移：D6 ✓
  - §2.4 Combo：D5 ✓
  - §2.5 道具：D7 ✓
  - §2.6 压顶：D6 ✓
  - §3 模块结构：完整覆盖到 9 个 JS 模块 ✓
  - §4 视觉/音效/设置：B2 主题、E1 渲染、E2 特效、G1 音效、H1 设置 ✓
  - §6 持久化：D8 序列化、I1 main 三事件保存 + resumePending ✓
  - §7 测试：C3、D1-D8、J1 ✓
  - §8 接入：A1 SW、A2 首页卡 ✓
- **占位扫描**：无 TBD / TODO。每步都有可运行的代码。
- **类型一致**：`ballRespawnTimer`、`brickDescentTimer`、`paddle.col`、`paddle.widthMul`、`paddle.widthRemainMs`、`slowRemainMs`、`fallingItem.type ∈ {'wider','multi','slow'}`、`endMode ∈ {'standard','endless'}` 在所有 task 中一致。
- **导出一致**：`game.js` 导出 `GameLogic, COLS, ROWS, BALL_RADIUS, PADDLE_BASE_WIDTH, PADDLE_Y, PADDLE_HALF_HEIGHT, INITIAL_BRICK_ROWS, SPEED_TABLE, DESCENT_TABLE`；`physics.js` 导出 `reflectFromBrick, paddleReflectionAngle, sweepAgainstBrick`；`bricks.js` 导出 `BRICK_DEFS, randomBrickValue, brickCssVar`。所有 import 与 export 对齐。
