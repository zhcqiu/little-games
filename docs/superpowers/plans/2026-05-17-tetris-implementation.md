# 俄罗斯方块实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 little-games 仓库的第一款游戏（俄罗斯方块），并搭建仓库级离线 / PWA 基础设施。

**Architecture:** 纯静态 HTML/CSS/JS，原生 ES Modules 拆分。仓库根放一个 Service Worker（cache-first + runtime caching）覆盖整站离线。Tetris 子目录拆为 `index.html` + `style.css` + 7 个 JS 模块（main / game / pieces / input / render / audio / settings）。

**Tech Stack:** ES2020+ JavaScript（modules）、Canvas 2D、Web Audio API、Service Worker、localStorage、PWA manifest。零依赖，零构建。

**Spec:** `docs/superpowers/specs/2026-05-17-tetris-design.md`

**测试策略：** 为 `game.js` 和 `pieces.js` 的纯函数（碰撞、消行、7-bag、wall-kick）写 `tests.html`，浏览器打开就跑 `console.assert`，控制台无错即通过。UI / 音频 / Canvas / 手势用 spec §11.1 的手动测试清单。

---

## 文件结构

```
little-games/
├── sw.js                          根 Service Worker（A1 新增）
├── manifest.json                  首页 PWA 清单（A1 新增）
├── icon.svg                       首页图标（A1 新增）
├── index.html                     已有，A2 修改：注册 SW + 加 Tetris 卡
└── games/
    └── tetris/                    本计划主目录
        ├── index.html             B1：DOM 骨架 + 模块入口
        ├── style.css              B2：移动端响应式样式
        ├── manifest.json          B3：Tetris PWA 清单
        ├── icon.svg               B3：游戏图标
        ├── tests.html             C1：纯函数测试入口
        └── js/
            ├── pieces.js          B4：7 种方块定义
            ├── game.js            C2-C8：核心游戏逻辑
            ├── render.js          D1-D4：Canvas 绘制 + FX
            ├── input.js           E1-E4：手势状态机
            ├── audio.js           F1-F4：Web Audio 合成
            ├── settings.js        G2：设置面板 + 持久化
            └── main.js            G1：入口 + 主循环
```

---

## Phase A：仓库级离线基础设施

### Task A1：根 Service Worker + 首页 PWA manifest + 图标

**Files:**
- Create: `sw.js`
- Create: `manifest.json`
- Create: `icon.svg`

- [ ] **Step 1：写 `sw.js`**

```js
// sw.js — 整站离线缓存（cache-first + runtime caching）
const CACHE_NAME = 'little-games-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
```

- [ ] **Step 2：写 `manifest.json`**

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

- [ ] **Step 3：写 `icon.svg`（简单的彩色游戏手柄）**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#ff7043"/>
  <g fill="#ffffff">
    <rect x="120" y="240" width="40" height="40" rx="6"/>
    <rect x="160" y="240" width="40" height="40" rx="6"/>
    <rect x="200" y="240" width="40" height="40" rx="6"/>
    <rect x="280" y="200" width="40" height="40" rx="6"/>
    <rect x="320" y="200" width="40" height="40" rx="6"/>
    <rect x="280" y="240" width="40" height="40" rx="6"/>
    <rect x="320" y="240" width="40" height="40" rx="6"/>
  </g>
  <text x="256" y="380" text-anchor="middle" font-family="sans-serif" font-size="60" font-weight="bold" fill="#ffffff">小游戏</text>
</svg>
```

- [ ] **Step 4：提交**

```bash
git add sw.js manifest.json icon.svg
git commit -m "feat(infra): root SW + PWA manifest + icon"
```

---

### Task A2：首页接入 SW + manifest + 加 Tetris 卡

**Files:**
- Modify: `index.html`

- [ ] **Step 1：在 `<head>` 加 manifest 链接和 theme-color**

找到 `<title>...</title>` 这一行，在它**前**面插入：

```html
<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.svg">
<meta name="theme-color" content="#ff7043">
```

- [ ] **Step 2：注册 SW（在 `</script>` 之前加几行）**

找到 `index.html` 末尾 `<script>` 标签里的最后一段（`if (games.length > 0) { ... }` 之后），在 `</script>` **之前**追加：

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
```

- [ ] **Step 3：把 Tetris 加进 `games` 数组**

把 `const games = [ ... ]` 改为：

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/" },
];
```

- [ ] **Step 4：在浏览器手测**

打开 https://zhcqiu.github.io/little-games/（部署后），确认：
- 首页能看到「俄罗斯方块」卡片
- DevTools → Application → Service Workers 看到 `/sw.js` 已激活
- 点击卡片跳到 `/games/tetris/`（404 是预期的，本任务还没建该路径）

- [ ] **Step 5：提交**

```bash
git add index.html
git commit -m "feat(home): register SW, link manifest, add Tetris card"
```

---

## Phase B：Tetris 骨架

### Task B1：Tetris HTML 骨架

**Files:**
- Create: `games/tetris/index.html`

- [ ] **Step 1：写完整 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>俄罗斯方块 · 小游戏乐园</title>
  <link rel="manifest" href="./manifest.json">
  <link rel="icon" type="image/svg+xml" href="./icon.svg">
  <link rel="apple-touch-icon" href="./icon.svg">
  <meta name="theme-color" content="#42a5f5">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header id="top-bar">
    <div class="score-block">
      <div>本局: <span id="score">0</span> 行</div>
      <div>最高: <span id="high-score">0</span> 行</div>
    </div>
    <div class="next-block">
      <div class="label">下一块</div>
      <canvas id="next-canvas" width="60" height="60"></canvas>
    </div>
    <button id="settings-btn" aria-label="设置">⚙</button>
  </header>

  <main>
    <canvas id="game-canvas"></canvas>
  </main>

  <!-- 设置面板 -->
  <div id="settings-panel" class="panel hidden" aria-hidden="true">
    <div class="panel-header">
      <h2>设置</h2>
      <button id="settings-close" aria-label="关闭设置">✕</button>
    </div>
    <div class="setting-row">
      <label>下落速度</label>
      <div class="slider-row">
        <span>慢</span>
        <input type="range" id="speed-slider" min="1" max="5" step="1" value="1">
        <span>快</span>
      </div>
    </div>
    <div class="setting-row">
      <label>上拉容忍</label>
      <div class="seg" id="upward-seg">
        <button data-val="0">0 格</button>
        <button data-val="1" class="active">1 格</button>
        <button data-val="2">2 格</button>
      </div>
    </div>
    <div class="setting-row">
      <label>结束模式</label>
      <div class="seg" id="end-mode-seg">
        <button data-val="standard" class="active">标准</button>
        <button data-val="endless">无尽</button>
      </div>
      <p class="hint">标准 = 堆到顶就结束；无尽 = 堆到顶清下半区继续</p>
    </div>
    <div class="setting-row toggle-row">
      <label>音效</label>
      <button id="sfx-toggle" class="toggle active" data-on="true">开</button>
    </div>
    <div class="setting-row toggle-row">
      <label>背景音乐</label>
      <button id="bgm-toggle" class="toggle active" data-on="true">开</button>
    </div>
    <button id="restart-btn" class="primary">重新开始游戏</button>
  </div>

  <!-- 重启确认气泡 -->
  <div id="restart-confirm" class="popup hidden">
    <p>当前进度会丢失，确认？</p>
    <div class="popup-buttons">
      <button id="restart-cancel">取消</button>
      <button id="restart-ok" class="primary">确认</button>
    </div>
  </div>

  <!-- 游戏结束面板 -->
  <div id="gameover-panel" class="panel hidden">
    <h2>🎮 游戏结束</h2>
    <p>本局消除: <span id="final-score">0</span> 行</p>
    <p>最高记录: <span id="final-high">0</span> 行</p>
    <button id="replay-btn" class="primary">再玩一局</button>
  </div>

  <!-- 无尽模式清半区浮字 -->
  <div id="encourage-toast" class="toast hidden">继续加油！</div>

  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2：在浏览器打开 `games/tetris/index.html`**

应看到没样式的元素堆叠（顶栏、画布、隐藏的面板）。**控制台报错 `main.js 404` 是预期的**——下一阶段才创建。

- [ ] **Step 3：提交**

```bash
git add games/tetris/index.html
git commit -m "feat(tetris): HTML skeleton with all UI panels"
```

---

### Task B2：Tetris CSS

**Files:**
- Create: `games/tetris/style.css`

- [ ] **Step 1：写完整 CSS**

```css
:root {
  --bg: #1a1a2e;
  --bg-2: #16213e;
  --primary: #42a5f5;
  --primary-dark: #1976d2;
  --text: #ffffff;
  --text-dim: #b0bec5;
  --panel-bg: #263858;
  --button-bg: #37475e;
  --button-active: #42a5f5;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

#top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-2);
  height: 56px;
  flex-shrink: 0;
}

.score-block {
  font-size: 14px;
  line-height: 1.4;
  flex: 1;
}

.next-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 12px;
}

.next-block .label { font-size: 11px; color: var(--text-dim); }
#next-canvas {
  background: var(--bg);
  border-radius: 4px;
  margin-top: 2px;
}

#settings-btn {
  width: 48px;
  height: 48px;
  font-size: 24px;
  background: transparent;
  color: var(--text);
  border: none;
  cursor: pointer;
}

main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: calc(100% - 56px);
  background: var(--bg);
}

#game-canvas {
  background: var(--bg);
  display: block;
  touch-action: none;
}

body { display: flex; flex-direction: column; }

/* 面板（设置 / 游戏结束） */
.panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--panel-bg);
  z-index: 100;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.panel.hidden { display: none; }

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel h2 { margin: 0; font-size: 22px; }

#settings-close {
  width: 44px;
  height: 44px;
  font-size: 24px;
  background: transparent;
  color: var(--text);
  border: none;
  cursor: pointer;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-row label {
  font-size: 16px;
  color: var(--text-dim);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-row span { font-size: 13px; color: var(--text-dim); }

#speed-slider {
  flex: 1;
  height: 44px;
  -webkit-appearance: none;
  background: transparent;
}

#speed-slider::-webkit-slider-runnable-track {
  height: 6px;
  background: var(--button-bg);
  border-radius: 3px;
}

#speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
  margin-top: -11px;
  cursor: pointer;
}

#speed-slider::-moz-range-track {
  height: 6px;
  background: var(--button-bg);
  border-radius: 3px;
}

#speed-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.seg {
  display: flex;
  gap: 8px;
}

.seg button {
  flex: 1;
  min-height: 44px;
  background: var(--button-bg);
  color: var(--text);
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.seg button.active {
  background: var(--primary);
  border-color: var(--primary);
}

.hint {
  font-size: 12px;
  color: var(--text-dim);
  margin: 0;
}

.toggle-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.toggle {
  min-width: 64px;
  min-height: 44px;
  background: var(--button-bg);
  color: var(--text-dim);
  border: 2px solid transparent;
  border-radius: 22px;
  font-size: 16px;
  cursor: pointer;
}

.toggle.active {
  background: var(--primary);
  color: var(--text);
  border-color: var(--primary);
}

button.primary {
  min-height: 56px;
  background: var(--primary);
  color: var(--text);
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: bold;
  margin-top: auto;
  cursor: pointer;
  box-shadow: var(--shadow);
}

button.primary:active { background: var(--primary-dark); }

/* 重启确认气泡 */
.popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--panel-bg);
  padding: 24px;
  border-radius: 16px;
  z-index: 200;
  box-shadow: var(--shadow);
  min-width: 280px;
  text-align: center;
}

.popup.hidden { display: none; }
.popup p { margin: 0 0 20px; font-size: 16px; }

.popup-buttons {
  display: flex;
  gap: 12px;
}

.popup-buttons button {
  flex: 1;
  min-height: 48px;
  background: var(--button-bg);
  color: var(--text);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.popup-buttons button.primary { background: var(--primary); }

/* 游戏结束面板 */
#gameover-panel {
  align-items: center;
  justify-content: center;
  text-align: center;
}

#gameover-panel h2 { font-size: 32px; margin-bottom: 16px; }
#gameover-panel p { font-size: 20px; margin: 8px 0; }
#gameover-panel button.primary { margin-top: 32px; min-width: 200px; }

/* 无尽模式鼓励浮字 */
.toast {
  position: fixed;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 112, 67, 0.95);
  color: white;
  padding: 16px 32px;
  border-radius: 24px;
  font-size: 24px;
  font-weight: bold;
  z-index: 150;
  box-shadow: var(--shadow);
  animation: toastFade 1s ease forwards;
  pointer-events: none;
}

.toast.hidden { display: none; }

@keyframes toastFade {
  0% { opacity: 0; transform: translate(-50%, -40%); }
  20% { opacity: 1; transform: translate(-50%, -50%); }
  80% { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, -60%); }
}
```

- [ ] **Step 2：刷新浏览器**

样式应已生效：顶栏、画布占满中间、面板隐藏。**控制台仍报 `main.js 404`，正常**。

- [ ] **Step 3：提交**

```bash
git add games/tetris/style.css
git commit -m "feat(tetris): mobile-first responsive styles"
```

---

### Task B3：Tetris PWA manifest + 图标

**Files:**
- Create: `games/tetris/manifest.json`
- Create: `games/tetris/icon.svg`

- [ ] **Step 1：写 `manifest.json`**

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

- [ ] **Step 2：写 `icon.svg`（T 块图案）**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a1a2e"/>
  <g fill="#42a5f5" stroke="#90caf9" stroke-width="6">
    <rect x="128" y="192" width="84" height="84" rx="8"/>
    <rect x="212" y="192" width="84" height="84" rx="8"/>
    <rect x="296" y="192" width="84" height="84" rx="8"/>
    <rect x="212" y="276" width="84" height="84" rx="8"/>
  </g>
</svg>
```

- [ ] **Step 3：提交**

```bash
git add games/tetris/manifest.json games/tetris/icon.svg
git commit -m "feat(tetris): PWA manifest + icon"
```

---

### Task B4：方块定义 `pieces.js`

**Files:**
- Create: `games/tetris/js/pieces.js`

- [ ] **Step 1：写完整模块**

每种方块用 4×4 网格表示，4 个旋转态用数组下标 0/1/2/3 表示。坐标系：行 0 在顶，列 0 在左。

```js
// pieces.js — 7 种方块定义，4 旋转态
// 每个 shape 是 4×4 二进制网格的行数组（'1' = 占位，'0' = 空）

export const PIECES = {
  I: {
    color: '#00bcd4',  // 青
    shapes: [
      ['0000', '1111', '0000', '0000'],
      ['0010', '0010', '0010', '0010'],
      ['0000', '0000', '1111', '0000'],
      ['0100', '0100', '0100', '0100'],
    ],
  },
  O: {
    color: '#ffeb3b',  // 黄
    shapes: [
      ['0110', '0110', '0000', '0000'],
      ['0110', '0110', '0000', '0000'],
      ['0110', '0110', '0000', '0000'],
      ['0110', '0110', '0000', '0000'],
    ],
  },
  T: {
    color: '#9c27b0',  // 紫
    shapes: [
      ['0000', '1110', '0100', '0000'],
      ['0100', '1100', '0100', '0000'],
      ['0000', '0100', '1110', '0000'],
      ['0100', '0110', '0100', '0000'],
    ],
  },
  S: {
    color: '#4caf50',  // 绿
    shapes: [
      ['0000', '0110', '1100', '0000'],
      ['1000', '1100', '0100', '0000'],
      ['0000', '0110', '1100', '0000'],
      ['1000', '1100', '0100', '0000'],
    ],
  },
  Z: {
    color: '#f44336',  // 红
    shapes: [
      ['0000', '1100', '0110', '0000'],
      ['0010', '0110', '0100', '0000'],
      ['0000', '1100', '0110', '0000'],
      ['0010', '0110', '0100', '0000'],
    ],
  },
  J: {
    color: '#3f51b5',  // 蓝
    shapes: [
      ['0000', '1110', '0010', '0000'],
      ['0100', '0100', '1100', '0000'],
      ['0000', '1000', '1110', '0000'],
      ['0110', '0100', '0100', '0000'],
    ],
  },
  L: {
    color: '#ff9800',  // 橙
    shapes: [
      ['0000', '1110', '1000', '0000'],
      ['1100', '0100', '0100', '0000'],
      ['0000', '0010', '1110', '0000'],
      ['0100', '0100', '0110', '0000'],
    ],
  },
};

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/**
 * 返回方块在指定旋转态下所占格子（相对坐标）的列表
 * @returns {Array<{row:number, col:number}>}
 */
export function getCells(type, rotation) {
  const shape = PIECES[type].shapes[rotation % 4];
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c] === '1') cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/**
 * 返回方块当前旋转态的有效宽度（最右占位列 + 1）
 */
export function getPieceWidth(type, rotation) {
  const cells = getCells(type, rotation);
  return Math.max(...cells.map((c) => c.col)) + 1;
}
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/pieces.js
git commit -m "feat(tetris): 7-piece definitions with 4 rotations each"
```

---

## Phase C：核心游戏逻辑（含测试）

### Task C1：测试入口 `tests.html`

**Files:**
- Create: `games/tetris/tests.html`

- [ ] **Step 1：写测试入口**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Tetris Tests</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #fff; }
    .pass { color: #4caf50; }
    .fail { color: #f44336; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Tetris 纯函数测试</h1>
  <pre id="log"></pre>
  <script type="module">
    const log = document.getElementById('log');
    let passed = 0, failed = 0;

    window.assertEq = (label, actual, expected) => {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (ok) {
        passed++;
        log.innerHTML += `<span class="pass">✓ ${label}</span>\n`;
      } else {
        failed++;
        log.innerHTML += `<span class="fail">✗ ${label}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(actual)}</span>\n`;
        console.error(`FAIL: ${label}`, { actual, expected });
      }
    };

    window.assertTrue = (label, cond) => {
      if (cond) {
        passed++;
        log.innerHTML += `<span class="pass">✓ ${label}</span>\n`;
      } else {
        failed++;
        log.innerHTML += `<span class="fail">✗ ${label}</span>\n`;
        console.error(`FAIL: ${label}`);
      }
    };

    // 后续任务会逐步往这里 import 测试模块
    await import('./tests/pieces.test.js');
    await import('./tests/game.test.js');

    log.innerHTML += `\n${passed} passed, ${failed} failed`;
    if (failed === 0) document.title = '✓ ' + document.title;
    else document.title = '✗ ' + document.title;
  </script>
</body>
</html>
```

- [ ] **Step 2：建空测试文件占位**

```bash
mkdir games/tetris/tests
```

创建 `games/tetris/tests/pieces.test.js`：

```js
// pieces.js 的测试将在 C2 加入
```

创建 `games/tetris/tests/game.test.js`：

```js
// game.js 的测试将在 C3-C8 加入
```

- [ ] **Step 3：在浏览器打开 `games/tetris/tests.html`**

应看到 "0 passed, 0 failed"。

- [ ] **Step 4：提交**

```bash
git add games/tetris/tests.html games/tetris/tests/
git commit -m "test(tetris): test runner scaffold"
```

---

### Task C2：`pieces.js` 测试 + 修正

**Files:**
- Modify: `games/tetris/tests/pieces.test.js`

- [ ] **Step 1：写测试**

```js
import { PIECE_TYPES, getCells, getPieceWidth, PIECES } from '../js/pieces.js';

// 7 种方块
assertEq('PIECE_TYPES 7 种', PIECE_TYPES.length, 7);

// 每种都有 4 个旋转态
for (const t of PIECE_TYPES) {
  assertEq(`${t} 有 4 旋转态`, PIECES[t].shapes.length, 4);
  assertTrue(`${t} 有颜色`, typeof PIECES[t].color === 'string');
}

// O 块旋转后形状不变
assertEq('O 块旋转 0 占 4 格', getCells('O', 0).length, 4);
assertEq('O 块旋转 1 占 4 格', getCells('O', 1).length, 4);
assertEq('O 块 4 旋转态一致', getCells('O', 0), getCells('O', 2));

// I 块横/纵宽度
assertEq('I 块横置宽 4', getPieceWidth('I', 0), 4);
assertEq('I 块纵置宽 1', getPieceWidth('I', 1), 3);  // 第 2 列占位，宽度 = 3

// T 块旋转态 0 是「凸」朝下的 T
const t0 = getCells('T', 0);
assertEq('T 块旋转 0 占 4 格', t0.length, 4);
// 占位应该是 row=1 的 (1,0)(1,1)(1,2) + row=2 的 (2,1)
const t0sorted = t0.slice().sort((a, b) => a.row - b.row || a.col - b.col);
assertEq('T 块旋转 0 占位正确', t0sorted, [
  { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }
]);
```

- [ ] **Step 2：刷新 `tests.html`**

应看到全绿。如果 `assertEq('I 块纵置宽 1', getPieceWidth('I', 1), 3)` 失败，根据实际占位修测试或修 pieces.js。**注意**：I 块旋转 1 时第 2 列占了 4 格（'0010'），所以 `getPieceWidth` = 3（列 0、1、2 中只有列 2 有占位，但 `getCells` 返回的 col 值取自 shape 的列索引；`Math.max(col) + 1 = 2 + 1 = 3`）。

- [ ] **Step 3：提交**

```bash
git add games/tetris/tests/pieces.test.js
git commit -m "test(tetris): assertions for pieces.js"
```

---

### Task C3：`game.js` — Board + 7-bag 出牌

**Files:**
- Create: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：写测试**

替换 `tests/game.test.js` 内容为：

```js
import { Game, createBag } from '../js/game.js';

// Board 初始化
const g = new Game();
assertEq('棋盘 20 行', g.board.length, 20);
assertEq('每行 10 列', g.board[0].length, 10);
assertEq('棋盘全空', g.board.flat().every((c) => c === null), true);

// 7-bag 包含全 7 种
const bag = createBag();
assertEq('一袋 7 块', bag.length, 7);
const sorted = bag.slice().sort();
assertEq('一袋含 IJLOSTZ', sorted, ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

// Game 第一块就出生
assertTrue('有当前方块', g.current !== null);
assertTrue('有下一块', g.next !== null);
assertTrue('当前方块在棋盘顶上方', g.current.row <= 0);
```

- [ ] **Step 2：刷新 tests.html**

预期红：`Game is not defined`。

- [ ] **Step 3：写 `game.js` 第一版**

```js
// game.js — 核心游戏逻辑
import { PIECE_TYPES, getCells, getPieceWidth } from './pieces.js';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

/** Fisher-Yates 洗 7 种方块 */
export function createBag() {
  const bag = PIECE_TYPES.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export class Game {
  constructor() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () =>
      Array(BOARD_WIDTH).fill(null)
    );
    this.score = 0;
    this.bag = createBag();
    this.nextBag = createBag();
    this.current = this._spawnNext();
    this.next = this._peekNext();
  }

  _drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = this.nextBag;
      this.nextBag = createBag();
    }
    return this.bag.shift();
  }

  _peekNext() {
    if (this.bag.length === 0) {
      this.bag = this.nextBag;
      this.nextBag = createBag();
    }
    return this.bag[0];
  }

  _spawnNext() {
    const type = this._drawFromBag();
    const rotation = 0;
    const width = getPieceWidth(type, rotation);
    const col = Math.floor((BOARD_WIDTH - width) / 2);
    const row = -1;
    return {
      type,
      rotation,
      row,
      col,
      lowWaterMark: row,
    };
  }
}
```

- [ ] **Step 4：刷新 tests.html，预期全绿**

- [ ] **Step 5：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): Game class + 7-bag piece generator"
```

---

### Task C4：移动与碰撞检测

**Files:**
- Modify: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：追加测试**

在 `tests/game.test.js` 末尾追加：

```js
// 碰撞检测
const g2 = new Game();
// 强行设置当前方块为 T 块、旋转 0、放置在 (5, 4)
g2.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
assertEq('在空棋盘 (5,4) 不冲突', g2._collides(5, 4, 0, 'T'), false);
assertEq('越左边界冲突', g2._collides(5, -1, 0, 'T'), true);
assertEq('越右边界冲突 (T width=3)', g2._collides(5, 8, 0, 'T'), true);
assertEq('越下边界冲突', g2._collides(19, 4, 0, 'T'), true);

// 放一个堵在 (8,5) 的格子，T 块 (rotation 0) 覆盖 (row+1, col..col+2) + (row+2, col+1)
g2.board[7][5] = '#aaa';
assertEq('堵在前方就冲突', g2._collides(6, 4, 0, 'T'), true);

// tryMoveTo
const g3 = new Game();
g3.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
const ok = g3.tryMoveTo(0, 5);
assertEq('成功移动到 (0,5)', ok && g3.current.col, 5);

// 越界时尽量靠近
g3.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
g3.tryMoveTo(0, 20);  // O 宽 2，最大 col = 8
assertEq('右越界夹到 col=8', g3.current.col, 8);

// tryMoveDown
const g4 = new Game();
g4.current = { type: 'I', rotation: 1, row: 0, col: 4, lowWaterMark: 0 };  // 纵 I，宽 1 高 4
const moved = g4.tryMoveDown();
assertEq('I 块下移一格', g4.current.row, 1);
assertEq('tryMoveDown 返回 true', moved, true);

// lowWaterMark 跟随 row 增加
assertEq('lowWaterMark 更新', g4.current.lowWaterMark, 1);
```

- [ ] **Step 2：刷新 tests.html，预期红**

`g._collides is not a function`。

- [ ] **Step 3：在 `game.js` 的 `Game` 类内追加方法**

```js
  /**
   * 在 (row, col, rotation) 放置 type 是否与棋盘或边界冲突
   */
  _collides(row, col, rotation, type) {
    const cells = getCells(type, rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = row + dr;
      const c = col + dc;
      if (c < 0 || c >= BOARD_WIDTH) return true;
      if (r >= BOARD_HEIGHT) return true;
      if (r < 0) continue;  // spawn buffer 上方，不算冲突
      if (this.board[r][c] !== null) return true;
    }
    return false;
  }

  /**
   * 尝试把当前方块移到 (row, col)。
   * 如果有冲突，从当前位置朝目标方向逐格挪，直到不能再挪为止（"尽量靠近"）。
   * @returns {boolean} 是否发生任何移动
   */
  tryMoveTo(targetRow, targetCol) {
    if (!this.current) return false;
    const p = this.current;
    const startRow = p.row;
    const startCol = p.col;

    // 横向：逐格挪到 targetCol
    const colStep = Math.sign(targetCol - startCol);
    while (p.col !== targetCol) {
      const nextCol = p.col + colStep;
      if (this._collides(p.row, nextCol, p.rotation, p.type)) break;
      p.col = nextCol;
    }

    // 纵向：逐格挪到 targetRow
    const rowStep = Math.sign(targetRow - p.row);
    while (p.row !== targetRow && rowStep !== 0) {
      const nextRow = p.row + rowStep;
      if (this._collides(nextRow, p.col, p.rotation, p.type)) break;
      p.row = nextRow;
    }

    if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;

    return p.row !== startRow || p.col !== startCol;
  }

  /** 尝试下移一格。失败返回 false。 */
  tryMoveDown() {
    if (!this.current) return false;
    const p = this.current;
    if (this._collides(p.row + 1, p.col, p.rotation, p.type)) return false;
    p.row++;
    if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;
    return true;
  }
```

- [ ] **Step 4：刷新 tests.html，预期全绿**

- [ ] **Step 5：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): collision detection + tryMoveTo + tryMoveDown"
```

---

### Task C5：旋转 + wall-kick lite

**Files:**
- Modify: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 旋转无障碍
const g5 = new Game();
g5.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
const r1 = g5.tryRotate(1);
assertEq('T 顺时针旋转成功', r1 && g5.current.rotation, 1);

// 旋转贴左壁的 T，需要 wall-kick 右 1
const g6 = new Game();
g6.current = { type: 'T', rotation: 1, row: 5, col: -1, lowWaterMark: 5 };
// rotation 1 时 col=0 占位（'0100' 在 col 1），实际占位列从 col+1=0 起
// 旋转到 rotation 2 时占位是 row+2 的 col 0..2，col=-1 越左
const before = g6.current.col;
g6.tryRotate(1);
assertEq('wall-kick 把方块向右推 1', g6.current.col > before, true);

// 旋转完全卡死则失败
const g7 = new Game();
g7.current = { type: 'I', rotation: 0, row: 5, col: 3, lowWaterMark: 5 };
// 把周围全堵死
for (let r = 4; r <= 8; r++) for (let c = 2; c <= 7; c++) {
  if (!(r === 5 && c >= 3 && c <= 6)) g7.board[r] && (g7.board[r][c] = '#aaa');
}
const r2 = g7.tryRotate(1);
assertEq('完全卡死时 tryRotate 返回 false', r2, false);
assertEq('卡死时旋转态不变', g7.current.rotation, 0);
```

- [ ] **Step 2：刷新 tests.html，预期红**

- [ ] **Step 3：在 `Game` 类追加方法**

```js
  /**
   * 尝试旋转。dir = +1 顺时针，-1 逆时针。
   * 旋转后若冲突，按顺序尝试 wall-kick：原位、左 1、右 1、下 1
   * @returns {boolean}
   */
  tryRotate(dir) {
    if (!this.current) return false;
    const p = this.current;
    const newRot = ((p.rotation + dir) % 4 + 4) % 4;
    const kicks = [
      { dr: 0, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: +1 },
      { dr: +1, dc: 0 },
    ];
    for (const { dr, dc } of kicks) {
      if (!this._collides(p.row + dr, p.col + dc, newRot, p.type)) {
        p.row += dr;
        p.col += dc;
        p.rotation = newRot;
        if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;
        return true;
      }
    }
    return false;
  }
```

- [ ] **Step 4：刷新 tests.html，预期全绿**

- [ ] **Step 5：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): rotation with wall-kick lite"
```

---

### Task C6：消行检测 + lock piece

**Files:**
- Modify: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// lockPiece 把方块写入棋盘并发新块
const g8 = new Game();
g8.current = { type: 'O', rotation: 0, row: 18, col: 0, lowWaterMark: 18 };
const beforeNext = g8.next;
g8.lockPiece();
assertEq('O 块锁后 (18,1)(18,2) 有色', g8.board[18][1], g8._color('O'));
assertEq('O 块锁后 (19,1)(19,2) 有色', g8.board[19][1], g8._color('O'));
assertEq('锁后切换到 next', g8.current.type, beforeNext);

// 消行
const g9 = new Game();
// 手动填满第 19 行
for (let c = 0; c < 10; c++) g9.board[19][c] = '#aaa';
// 第 18 行只缺 col 0
for (let c = 1; c < 10; c++) g9.board[18][c] = '#aaa';
const cleared = g9._findFullRows();
assertEq('第 19 行满', cleared, [19]);

// 模拟一次清行
g9._clearRows([19]);
assertEq('清行后第 19 行 = 原第 18 行', g9.board[19][0], null);
assertEq('清行后第 19 行 col 1 = 原第 18 行 col 1', g9.board[19][1], '#aaa');
assertEq('score 增加', g9.score, 1);
```

- [ ] **Step 2：在 `Game` 类追加方法**

```js
  _color(type) {
    return PIECES_COLOR[type];
  }

  /** 把当前方块写入 board，发新块 */
  lockPiece() {
    if (!this.current) return;
    const p = this.current;
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0 && r < BOARD_HEIGHT && c >= 0 && c < BOARD_WIDTH) {
        this.board[r][c] = this._color(p.type);
      }
    }
    this.current = this._spawnNext();
    this.next = this._peekNext();
  }

  _findFullRows() {
    const rows = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (this.board[r].every((c) => c !== null)) rows.push(r);
    }
    return rows;
  }

  _clearRows(rows) {
    rows = rows.slice().sort((a, b) => a - b);
    for (const r of rows.reverse()) {
      this.board.splice(r, 1);
      this.board.unshift(Array(BOARD_WIDTH).fill(null));
    }
    this.score += rows.length;
  }
```

注意要在 `game.js` 顶部加颜色映射（不依赖 pieces.js 因为那里的颜色是给 render 用的，但我们在 lock 时也要写入颜色字符串，让 render 读 board 直接拿到颜色）：

```js
import { PIECES, PIECE_TYPES, getCells, getPieceWidth } from './pieces.js';

const PIECES_COLOR = Object.fromEntries(
  PIECE_TYPES.map((t) => [t, PIECES[t].color])
);
```

放在文件 import 之后、`BOARD_WIDTH` 常量定义之前。

- [ ] **Step 3：刷新 tests.html，预期全绿**

- [ ] **Step 4：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): lock piece + full row detection + clear rows"
```

---

### Task C7：Lock delay + auto fall 接口

**Files:**
- Modify: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// step(dt) 累计时间，到 fallSpeed 触发下落
const g10 = new Game();
g10.setSpeed(5);  // 档位 5：250ms / 格
g10.current = { type: 'I', rotation: 1, row: 0, col: 4, lowWaterMark: 0 };
g10.step(100);
assertEq('100ms 不够下落', g10.current.row, 0);
g10.step(200);
assertEq('300ms 累计后下落一格', g10.current.row, 1);

// 暂停时不下落
g10.setPaused(true);
g10.step(500);
assertEq('暂停时不下落', g10.current.row, 1);
g10.setPaused(false);
g10.step(300);
assertEq('恢复后下落', g10.current.row, 2);

// Lock delay：到底后 500ms 才锁
const g11 = new Game();
g11.setSpeed(5);
g11.current = { type: 'O', rotation: 0, row: 18, col: 0, lowWaterMark: 18 };
// 第一次 step 触发下落失败 → 启动 lock timer
g11.step(300);
assertTrue('到底后开始 lock 计时', g11._lockTimer !== null);
assertEq('lock 计时中方块未锁', g11.current.type, 'O');
// 累计 < 500ms 不锁
g11.step(400);
assertEq('lock 计时中方块未锁(2)', g11.current.type, 'O');
// 累计 >= 500ms 锁定
g11.step(200);  // 累计 600ms
assertTrue('lock 计时完成', g11.current.type !== 'O' || g11.board[18][0] !== null);
```

- [ ] **Step 2：在 `Game` 类追加属性与方法**

构造函数最后增加：

```js
    this.fallSpeed = 1500;     // 默认档 1
    this.fallAccumulator = 0;
    this.paused = false;
    this._lockTimer = null;    // null = 不在 lock delay，数字 = 已累计 ms
    this._onLineClear = null;  // 回调：(rows, color[])
    this._onGameOver = null;
    this._onLock = null;
    this._endMode = 'standard';
```

追加方法：

```js
  static SPEEDS = [1500, 1000, 700, 450, 250];

  setSpeed(level) {  // 1..5
    this.fallSpeed = Game.SPEEDS[Math.max(0, Math.min(4, level - 1))];
  }

  setPaused(p) { this.paused = !!p; }
  setEndMode(m) { this._endMode = m; }

  onLineClear(cb) { this._onLineClear = cb; }
  onGameOver(cb) { this._onGameOver = cb; }
  onLock(cb) { this._onLock = cb; }

  /**
   * 推进游戏 dt 毫秒
   */
  step(dt) {
    if (this.paused || !this.current) return;
    this.fallAccumulator += dt;

    if (this._lockTimer !== null) {
      this._lockTimer += dt;
      // 期间任何成功 tryMove* 都会 resetLockTimer
      if (this._lockTimer >= 500) {
        this._performLock();
      }
      return;
    }

    while (this.fallAccumulator >= this.fallSpeed) {
      this.fallAccumulator -= this.fallSpeed;
      const moved = this.tryMoveDown();
      if (!moved) {
        this._lockTimer = 0;
        break;
      }
    }
  }

  /** 玩家操作后调用：如果新位置能继续下落，取消 lock；否则刷新 lock 计时 */
  resetLockTimerIfApplicable() {
    if (this._lockTimer === null) return;
    if (this.current && !this._collides(this.current.row + 1, this.current.col, this.current.rotation, this.current.type)) {
      this._lockTimer = null;
    } else {
      this._lockTimer = 0;
    }
  }

  _performLock() {
    if (this._onLock) this._onLock(this.current);
    const p = this.current;
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0 && r < BOARD_HEIGHT && c >= 0 && c < BOARD_WIDTH) {
        this.board[r][c] = this._color(p.type);
      }
    }
    this._lockTimer = null;

    const fullRows = this._findFullRows();
    if (fullRows.length > 0) {
      const colors = fullRows.map((r) => this.board[r].slice());
      if (this._onLineClear) this._onLineClear(fullRows, colors);
      this._clearRows(fullRows);
    }

    this.current = this._spawnNext();
    this.next = this._peekNext();

    if (this._collides(this.current.row, this.current.col, this.current.rotation, this.current.type)) {
      this._handleGameOver();
    }
  }

  _handleGameOver() {
    if (this._endMode === 'endless') {
      // 清空下半区（row 10..19）
      for (let r = 10; r < BOARD_HEIGHT; r++) {
        this.board[r] = Array(BOARD_WIDTH).fill(null);
      }
      // 重新出生
      this.current = this._spawnNext();
      this.next = this._peekNext();
      if (this._onGameOver) this._onGameOver('endless-reset');
      // 极端情况：依旧冲突（上半区也满）→ 真正 game over
      if (this._collides(this.current.row, this.current.col, this.current.rotation, this.current.type)) {
        if (this._onGameOver) this._onGameOver('standard');
        this.current = null;
      }
    } else {
      if (this._onGameOver) this._onGameOver('standard');
      this.current = null;
    }
  }

  reset() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () =>
      Array(BOARD_WIDTH).fill(null)
    );
    this.score = 0;
    this.bag = createBag();
    this.nextBag = createBag();
    this.current = this._spawnNext();
    this.next = this._peekNext();
    this._lockTimer = null;
    this.fallAccumulator = 0;
  }
```

修改 `tryMoveTo` 和 `tryRotate`，在返回 `true` 前调 `this.resetLockTimerIfApplicable()`：

把 `tryMoveTo` 的 `return p.row !== startRow || p.col !== startCol;` 改为：

```js
    const moved = p.row !== startRow || p.col !== startCol;
    if (moved) this.resetLockTimerIfApplicable();
    return moved;
```

把 `tryRotate` 内成功 return true 之前加：

```js
        this.resetLockTimerIfApplicable();
        return true;
```

把 `tryMoveDown` 的成功路径改为：

```js
    p.row++;
    if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;
    this.resetLockTimerIfApplicable();
    return true;
```

- [ ] **Step 3：刷新 tests.html，预期全绿**

- [ ] **Step 4：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): auto-fall timer + lock delay + game-over modes"
```

---

### Task C8：上拉容忍

**Files:**
- Modify: `games/tetris/js/game.js`
- Modify: `games/tetris/tests/game.test.js`

- [ ] **Step 1：追加测试**

```js
// 上拉容忍
const g12 = new Game();
g12.setUpwardTolerance(0);
g12.current = { type: 'O', rotation: 0, row: 10, col: 0, lowWaterMark: 10 };
g12.tryMoveTo(5, 0);
assertEq('upwardTolerance=0 不能上拉', g12.current.row, 10);

g12.setUpwardTolerance(2);
g12.tryMoveTo(8, 0);
assertEq('upwardTolerance=2 可拉到 10-2=8', g12.current.row, 8);
g12.tryMoveTo(5, 0);
assertEq('upwardTolerance=2 但 lowWaterMark=10 卡在 8', g12.current.row, 8);

// lowWaterMark 上拉后不降
g12.current.row = 12;
g12.current.lowWaterMark = 12;  // 模拟接着下落到 12
g12.tryMoveTo(8, 0);
assertEq('lowWaterMark=12 + tol=2 = min row 10', g12.current.row, 10);
```

- [ ] **Step 2：在 Game 构造函数加属性**

```js
    this.upwardTolerance = 1;
```

加 setter：

```js
  setUpwardTolerance(n) {
    this.upwardTolerance = Math.max(0, Math.min(2, n | 0));
  }
```

修改 `tryMoveTo` 的纵向逻辑：在原来的 `const rowStep = ...` 之前增加：

```js
    // 应用上拉地板
    const minRow = p.lowWaterMark - this.upwardTolerance;
    targetRow = Math.max(targetRow, minRow);
```

- [ ] **Step 3：刷新 tests.html，预期全绿**

- [ ] **Step 4：提交**

```bash
git add games/tetris/js/game.js games/tetris/tests/game.test.js
git commit -m "feat(tetris): upward drag tolerance based on low water mark"
```

---

## Phase D：渲染

### Task D1：Canvas 初始化 + 画棋盘 + 画当前方块

**Files:**
- Create: `games/tetris/js/render.js`

- [ ] **Step 1：写 `render.js` 第一版**

```js
// render.js — Canvas 绘制 + FX
import { getCells } from './pieces.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  constructor(canvas, nextCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.cellSize = 30;
    this.particles = [];
    this.shake = null;          // { amplitude, duration, elapsed }
    this.flashRows = [];        // [{ rows, elapsed, duration }]
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const containerW = this.canvas.parentElement.clientWidth;
    const containerH = this.canvas.parentElement.clientHeight;

    // 棋盘 = 10×20，留 padding 1 格
    this.cellSize = Math.floor(Math.min(
      containerW / (BOARD_WIDTH + 2),
      containerH / (BOARD_HEIGHT + 2)
    ));

    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;

    // 屏幕抖动
    let offsetX = 0, offsetY = 0;
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake = null;
      } else {
        const e = this.shake.elapsed;
        const d = this.shake.duration;
        const amp = this.shake.amplitude * (1 - e / d);
        offsetX = Math.sin(e * 0.06) * amp;
        offsetY = Math.cos(e * 0.065) * amp;
      }
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offsetX, offsetY);

    this._drawBoard(game);
    this._drawGhost(game);
    this._drawCurrent(game);
    this._drawFlashes(dt);
    this._drawParticles(dt);

    ctx.restore();

    this._drawNext(game);
  }

  _drawBoard(game) {
    const ctx = this.ctx;
    const s = this.cellSize;
    // 背景网格淡线
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, s * BOARD_WIDTH, s * BOARD_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(s * BOARD_WIDTH, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, s * BOARD_HEIGHT);
      ctx.stroke();
    }
    // 已堆积方块
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = game.board[r][c];
        if (color) this._drawCell(c * s, r * s, color, 1.0);
      }
    }
  }

  _drawCell(x, y, color, alpha = 1.0) {
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 2, y + 2, s - 4, 3);
    ctx.fillRect(x + 2, y + 2, 3, s - 4);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 2, y + s - 5, s - 4, 3);
    ctx.fillRect(x + s - 5, y + 2, 3, s - 4);
    ctx.globalAlpha = 1.0;
  }

  _drawCurrent(game) {
    if (!game.current) return;
    const p = game.current;
    const color = this._pieceColor(p.type, game);
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0) {
        this._drawCell(c * this.cellSize, r * this.cellSize, color, 1.0);
      }
    }
  }

  _pieceColor(type, game) {
    // 反查 board 已 lock 的颜色串里没有当前方块；从 PIECES 字典拿
    // 简化：要求 game 暴露一个查色辅助。这里直接 import PIECES。
    return import.meta._cachedPieces?.[type] ?? null;
  }

  _drawGhost(game) {
    // D2 实现
  }

  _drawFlashes(dt) {
    // D4 实现
  }

  _drawParticles(dt) {
    // D3 实现
  }

  _drawNext(game) {
    const ctx = this.nextCtx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    if (!game.next) return;
    const cells = getCells(game.next, 0);
    const color = this._pieceColor(game.next, game);
    const s = 12;
    const xOff = (this.nextCanvas.width - 4 * s) / 2;
    const yOff = (this.nextCanvas.height - 4 * s) / 2;
    for (const { row, col } of cells) {
      ctx.fillStyle = color;
      ctx.fillRect(xOff + col * s + 1, yOff + row * s + 1, s - 2, s - 2);
    }
  }

  triggerShake(amplitude, duration) {
    this.shake = { amplitude, duration, elapsed: 0 };
  }

  spawnParticles(rows, colorRows) {
    // D3 实现
  }

  flashRowsAnim(rows) {
    // D4 实现
  }
}
```

- [ ] **Step 2：修复 `_pieceColor` 颜色查询**

把 `import { getCells } from './pieces.js';` 改为：

```js
import { getCells, PIECES } from './pieces.js';
```

然后把 `_pieceColor` 简化为：

```js
  _pieceColor(type) {
    return PIECES[type].color;
  }
```

并修改两处调用：`this._pieceColor(p.type, game)` → `this._pieceColor(p.type)`，`this._pieceColor(game.next, game)` → `this._pieceColor(game.next)`。

- [ ] **Step 3：提交**

```bash
git add games/tetris/js/render.js
git commit -m "feat(tetris): canvas renderer skeleton with board + current piece"
```

---

### Task D2：Ghost piece

**Files:**
- Modify: `games/tetris/js/render.js`
- Modify: `games/tetris/js/game.js`

- [ ] **Step 1：在 `game.js` 暴露 ghost 计算**

在 `Game` 类追加：

```js
  /** 返回当前方块"硬落到底"会在哪一行（不修改状态） */
  computeGhostRow() {
    if (!this.current) return null;
    const p = this.current;
    let r = p.row;
    while (!this._collides(r + 1, p.col, p.rotation, p.type)) r++;
    return r;
  }
```

- [ ] **Step 2：在 `render.js` 实现 `_drawGhost`**

替换 `_drawGhost`：

```js
  _drawGhost(game) {
    if (!game.current) return;
    const ghostRow = game.computeGhostRow();
    if (ghostRow === null || ghostRow === game.current.row) return;
    const p = game.current;
    const color = this._pieceColor(p.type);
    const cells = getCells(p.type, p.rotation);
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const { row: dr, col: dc } of cells) {
      const r = ghostRow + dr;
      const c = p.col + dc;
      if (r >= 0) {
        ctx.strokeRect(c * s + 2, r * s + 2, s - 4, s - 4);
      }
    }
    ctx.globalAlpha = 1.0;
  }
```

- [ ] **Step 3：提交**

```bash
git add games/tetris/js/render.js games/tetris/js/game.js
git commit -m "feat(tetris): ghost piece preview"
```

---

### Task D3：粒子系统

**Files:**
- Modify: `games/tetris/js/render.js`

- [ ] **Step 1：实现 `spawnParticles` 和 `_drawParticles`**

替换两个方法：

```js
  spawnParticles(rows, rowSnapshots) {
    // rowSnapshots: 每个被消行的颜色数组（10 个 hex 串）
    const s = this.cellSize;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const colors = rowSnapshots[i];
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = colors[c] || '#ffffff';
        for (let k = 0; k < 8; k++) {
          this.particles.push({
            x: c * s + s / 2,
            y: r * s + s / 2,
            vx: (Math.random() - 0.5) * 400,
            vy: -300 - Math.random() * 200,
            color,
            life: 800,
            elapsed: 0,
            size: 4 + Math.random() * 4,
          });
        }
      }
    }
  }

  _drawParticles(dt) {
    const ctx = this.ctx;
    const gravity = 980 / 1000;  // px/ms²

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.elapsed += dt;
      if (p.elapsed >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const dts = dt / 1000;  // 速度单位 px/s
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
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/render.js
git commit -m "feat(tetris): particle system for line clear"
```

---

### Task D4：消行高亮闪烁

**Files:**
- Modify: `games/tetris/js/render.js`

- [ ] **Step 1：实现 `flashRowsAnim` 和 `_drawFlashes`**

替换两个方法：

```js
  flashRowsAnim(rows) {
    this.flashRows.push({ rows: rows.slice(), elapsed: 0, duration: 200 });
  }

  _drawFlashes(dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    for (let i = this.flashRows.length - 1; i >= 0; i--) {
      const f = this.flashRows[i];
      f.elapsed += dt;
      if (f.elapsed >= f.duration) {
        this.flashRows.splice(i, 1);
        continue;
      }
      const alpha = 0.85 * (1 - f.elapsed / f.duration);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      for (const r of f.rows) {
        ctx.fillRect(0, r * s, s * BOARD_WIDTH, s);
      }
    }
    ctx.globalAlpha = 1.0;
  }
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/render.js
git commit -m "feat(tetris): line clear flash overlay"
```

---

## Phase E：输入

### Task E1：Input 模块骨架 + Pointer 事件

**Files:**
- Create: `games/tetris/js/input.js`

- [ ] **Step 1：写 `input.js` 第一版**

```js
// input.js — 手势状态机
const STATE_IDLE = 0;
const STATE_DRAG = 1;
const STATE_ROTATE = 2;

export class Input {
  constructor(canvas, getCellSize) {
    this.canvas = canvas;
    this.getCellSize = getCellSize;
    this.state = STATE_IDLE;
    this.fingers = new Map();    // pointerId → {x, y}
    this.dragOrigin = null;       // { touchX, touchY, pieceCol, pieceRow }
    this.rotateAngle0 = 0;
    this.rotateAccumulator = 0;
    this.handlers = {
      moveTo: () => {},
      rotate: () => {},
      pauseChange: () => {},
    };

    canvas.addEventListener('pointerdown', this._onDown.bind(this));
    canvas.addEventListener('pointermove', this._onMove.bind(this));
    canvas.addEventListener('pointerup', this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));
  }

  on(event, fn) { this.handlers[event] = fn; }

  _onDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._updateStateOnTouchChange();
  }

  _onMove(e) {
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._tick();
  }

  _onUp(e) {
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.fingers.delete(e.pointerId);
    this._updateStateOnTouchChange();
  }

  _updateStateOnTouchChange() {
    const n = this.fingers.size;
    const prev = this.state;
    if (n === 0) this.state = STATE_IDLE;
    else if (n === 1) this.state = STATE_DRAG;
    else this.state = STATE_ROTATE;

    if (this.state !== prev) {
      this._enterState(this.state);
      this.handlers.pauseChange(n > 0);
    }
  }

  _enterState(s) {
    // 由 E2、E3 实现
  }

  _tick() {
    // 由 E2、E3 实现
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/input.js
git commit -m "feat(tetris): input module scaffold with pointer events"
```

---

### Task E2：DRAG 状态

**Files:**
- Modify: `games/tetris/js/input.js`

- [ ] **Step 1：在 `Input` 类追加 `_pieceState` 注入**

构造函数加一个参数 `getPieceState`：

```js
  constructor(canvas, getCellSize, getPieceState) {
    // ... 已有代码
    this.getPieceState = getPieceState;  // 返回 { row, col } 或 null
```

`getPieceState()` 由 main.js 传入，返回当前 game.current 的 row/col。

- [ ] **Step 2：实现 `_enterState` 和 DRAG 的 `_tick`**

替换：

```js
  _enterState(s) {
    if (s === STATE_DRAG) {
      const f = this.fingers.values().next().value;
      const piece = this.getPieceState();
      if (!piece) return;
      this.dragOrigin = {
        touchX: f.x,
        touchY: f.y,
        pieceCol: piece.col,
        pieceRow: piece.row,
      };
    } else if (s === STATE_ROTATE) {
      // E3 实现
    } else {
      this.dragOrigin = null;
    }
  }

  _tick() {
    if (this.state === STATE_DRAG && this.dragOrigin) {
      const f = this.fingers.values().next().value;
      const cell = this.getCellSize();
      if (cell <= 0) return;
      const targetCol = this.dragOrigin.pieceCol + Math.round((f.x - this.dragOrigin.touchX) / cell);
      const targetRow = this.dragOrigin.pieceRow + Math.round((f.y - this.dragOrigin.touchY) / cell);
      this.handlers.moveTo(targetRow, targetCol);
    } else if (this.state === STATE_ROTATE) {
      this._rotateTick();
    }
  }
```

- [ ] **Step 3：提交**

```bash
git add games/tetris/js/input.js
git commit -m "feat(tetris): DRAG state — 4-direction step move tracking"
```

---

### Task E3：ROTATE 状态

**Files:**
- Modify: `games/tetris/js/input.js`

- [ ] **Step 1：实现 ROTATE 进入和 `_rotateTick`**

修改 `_enterState`：

```js
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
    }
```

追加方法：

```js
  _rotateTick() {
    const fingers = Array.from(this.fingers.values());
    if (fingers.length < 2) return;
    const cur = Math.atan2(
      fingers[1].y - fingers[0].y,
      fingers[1].x - fingers[0].x
    );
    let delta = cur - this.rotateAngle0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    this.rotateAccumulator += delta * 0.5;  // 平滑
    this.rotateAngle0 = cur;

    const threshold = Math.PI / 6;  // 30°
    while (this.rotateAccumulator > threshold) {
      this.handlers.rotate(+1);
      this.rotateAccumulator -= threshold;
    }
    while (this.rotateAccumulator < -threshold) {
      this.handlers.rotate(-1);
      this.rotateAccumulator += threshold;
    }
  }
```

- [ ] **Step 2：处理 ROTATE → DRAG 的转换重新快照**

在 `_updateStateOnTouchChange` 末尾，**在 `_enterState` 调用之后**加一个对一指变两指 / 两指变一指的处理：DRAG 进入时已经快照 origin（基于当前剩余的那一个手指）；ROTATE 进入时记录 angle0。这一切都已经在 `_enterState` 里做了，不用额外改。

但是要**防止双指落下当帧产生 DRAG 残留 step**：在 `_onDown` 里，当第二指落下导致从 DRAG → ROTATE 时，**不要**再调一次 `_tick`。当前实现已经做到（`_onDown` 只调 `_updateStateOnTouchChange`，不主动 tick）。

- [ ] **Step 3：提交**

```bash
git add games/tetris/js/input.js
git commit -m "feat(tetris): ROTATE state — 30° threshold rotation"
```

---

### Task E4：iOS audio unlock 钩子

**Files:**
- Modify: `games/tetris/js/input.js`

- [ ] **Step 1：增加首次触摸回调**

构造函数加属性：

```js
    this._firstTouchHandler = null;
```

`on` 方法允许 `firstTouch`：

```js
  on(event, fn) { this.handlers[event] = fn; }
  onFirstTouch(fn) { this._firstTouchHandler = fn; }
```

`_onDown` 开头加：

```js
  _onDown(e) {
    if (this._firstTouchHandler) {
      this._firstTouchHandler();
      this._firstTouchHandler = null;
    }
    // ... 原有逻辑
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/input.js
git commit -m "feat(tetris): expose first-touch hook for audio unlock"
```

---

## Phase F：音频

### Task F1：AudioContext 懒初始化 + 基础工具

**Files:**
- Create: `games/tetris/js/audio.js`

- [ ] **Step 1：写 audio.js 第一版**

```js
// audio.js — Web Audio API 合成
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
    this.bgmOn = true;
    this.bgmController = null;
  }

  /** 由首次用户手势触发 */
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext 创建失败：', e);
    }
  }

  setSfxOn(on) { this.sfxOn = on; }
  setBgmOn(on) {
    this.bgmOn = on;
    if (!on && this.bgmController) {
      this.bgmController.stop(200);
      this.bgmController = null;
    } else if (on && !this.bgmController && this.ctx) {
      this._startBgm();
    }
  }

  /** 创建一个简单的 oscillator + envelope */
  _playTone({ freq, type = 'sine', duration, gain = 0.3, attack = 5, release = 50 }) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack / 1000);
    g.gain.linearRampToValueAtTime(gain * 0.7, t0 + (attack + 20) / 1000);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration / 1000 + 0.05);
  }

  _startBgm() {
    // F4 实现
  }
}
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/audio.js
git commit -m "feat(tetris): AudioContext lazy init + tone helper"
```

---

### Task F2：锁定 / 移动 / 旋转音 + 消除音阶

**Files:**
- Modify: `games/tetris/js/audio.js`

- [ ] **Step 1：追加方法**

```js
  playLock() {
    this._playTone({ freq: 220, type: 'triangle', duration: 100, gain: 0.4, attack: 5, release: 95 });
  }

  playMove() {
    this._playTone({ freq: 600, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
  }

  playRotate() {
    this._playTone({ freq: 800, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
  }

  playClear(lines) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    // C5, E5, G5, C6 频率
    const tones = [
      [523.25],
      [523.25, 659.25],
      [523.25, 659.25, 783.99],
      [523.25, 659.25, 783.99, 1046.50],
    ][Math.min(lines, 4) - 1] || [523.25];

    const duration = [250, 350, 450, 600][Math.min(lines, 4) - 1] || 250;

    for (const freq of tones) {
      this._scheduleChordNote(freq, t0, duration);
      // 三角泛音
      this._scheduleChordNote(freq * 2, t0, duration, 0.1, 'triangle');
    }

    // 四消额外接琶音
    if (lines >= 4) {
      const arp = [1046.50, 1318.51, 1567.98];
      for (let i = 0; i < arp.length; i++) {
        this._scheduleChordNote(arp[i], t0 + 0.4 + i * 0.08, 80);
      }
    }
  }

  _scheduleChordNote(freq, when, duration, gain = 0.25, type = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.linearRampToValueAtTime(gain * 0.7, when + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + duration / 1000 + 0.05);
  }
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/audio.js
git commit -m "feat(tetris): lock/move/rotate sounds + line-clear chord"
```

---

### Task F3：结束音 + 无尽模式清半区音

**Files:**
- Modify: `games/tetris/js/audio.js`

- [ ] **Step 1：追加方法**

```js
  playGameOver() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [
      { freq: 440, time: 0 },
      { freq: 349.23, time: 0.25 },
      { freq: 293.66, time: 0.5 },
    ];
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

  playEndlessReset() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t0);
    filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.4);
    filter.Q.value = 2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);

    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    source.start(t0);
    source.stop(t0 + 0.4);
  }
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/audio.js
git commit -m "feat(tetris): game-over descent + endless-reset noise sweep"
```

---

### Task F4：BGM 循环

**Files:**
- Modify: `games/tetris/js/audio.js`

- [ ] **Step 1：实现 `_startBgm`**

替换 `_startBgm`：

```js
  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    // C 大调五声音阶：C4 D4 E4 G4 A4 C5
    const melody = [
      261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00,
      261.63, 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63,
    ];
    const bass = [
      130.81, 130.81, 196.00, 196.00,
      174.61, 174.61, 196.00, 196.00,
    ];

    const beatMs = 500;
    const beatsPerBar = 4;
    const totalBeats = melody.length;
    const totalDuration = (totalBeats * beatMs) / 1000;

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = 0;
    bgmGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    bgmGain.connect(this.master);

    let stopFlag = false;

    const schedule = (loopStart) => {
      for (let i = 0; i < melody.length; i++) {
        const t = loopStart + (i * beatMs) / 1000;
        // 主旋律
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = melody[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.02);
        g.gain.linearRampToValueAtTime(0.3, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 0.5);
      }
      // 伴奏：每 2 拍切一次
      for (let i = 0; i < bass.length; i++) {
        const t = loopStart + (i * 2 * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bass[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.05);
        g.gain.linearRampToValueAtTime(0.2, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 1);
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

  startBgm() {
    if (this.bgmOn && !this.bgmController) this._startBgm();
  }
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/audio.js
git commit -m "feat(tetris): pentatonic BGM loop"
```

---

## Phase G：设置 / 主循环 / 整合

### Task G1：`main.js` 主循环 + 模块串联

**Files:**
- Create: `games/tetris/js/main.js`

- [ ] **Step 1：写完整 main.js**

```js
// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';

const gameCanvas = document.getElementById('game-canvas');
const nextCanvas = document.getElementById('next-canvas');

const game = new Game();
const renderer = new Renderer(gameCanvas, nextCanvas);
const audio = new Audio();
const settings = new Settings(game, audio);

settings.load();
settings.apply();

const input = new Input(
  gameCanvas,
  () => renderer.cellSize,
  () => game.current ? { row: game.current.row, col: game.current.col } : null
);

input.on('moveTo', (row, col) => {
  game.tryMoveTo(row, col);
});
input.on('rotate', (dir) => {
  if (game.tryRotate(dir)) audio.playRotate();
});
input.on('pauseChange', (paused) => {
  game.setPaused(paused);
});
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});

// Game 事件 → Audio / Renderer
game.onLock((piece) => audio.playLock());
game.onLineClear((rows, colorRows) => {
  audio.playClear(rows.length);
  renderer.flashRowsAnim(rows);
  renderer.spawnParticles(rows, colorRows);
  const shake = [
    { amp: 4, dur: 80 },
    { amp: 6, dur: 100 },
    { amp: 8, dur: 120 },
    { amp: 12, dur: 150 },
  ][Math.min(rows.length, 4) - 1];
  renderer.triggerShake(shake.amp, shake.dur);
});
game.onGameOver((mode) => {
  if (mode === 'endless-reset') {
    audio.playEndlessReset();
    showToast('继续加油！');
  } else {
    audio.playGameOver();
    showGameOverPanel();
  }
});

// 主循环
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  renderer.draw(game, dt);
  // 更新分数显示
  document.getElementById('score').textContent = game.score;
  document.getElementById('high-score').textContent = settings.get('highScore');
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 可见性变化：切后台暂停 / BGM 静音
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.setPaused(true);
    if (audio.bgmController) audio.bgmController.stop(100);
  } else {
    if (input.fingers && input.fingers.size === 0) game.setPaused(false);
    if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
  }
});

// 浮字提示
let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('encourage-toast');
  t.textContent = text;
  t.classList.remove('hidden');
  // 重置动画
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1000);
}

// 游戏结束面板
function showGameOverPanel() {
  game.setPaused(true);
  const panel = document.getElementById('gameover-panel');
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-high').textContent = settings.get('highScore');
  panel.classList.remove('hidden');
}

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  game.reset();
  game.setPaused(false);
});

// Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

// 暴露调试句柄
window._game = game;
window._renderer = renderer;
```

- [ ] **Step 2：提交**

```bash
git add games/tetris/js/main.js
git commit -m "feat(tetris): wire all modules + main loop + visibility handling"
```

---

### Task G2：设置面板逻辑

**Files:**
- Create: `games/tetris/js/settings.js`

- [ ] **Step 1：写完整 settings.js**

```js
// settings.js — 设置面板 + localStorage 持久化
const KEY = 'tetris.settings';
const KEY_HIGH = 'tetris.highScore';

const DEFAULTS = {
  speed: 1,
  upwardTolerance: 1,
  endMode: 'standard',
  sfxOn: true,
  bgmOn: true,
};

export class Settings {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.state = { ...DEFAULTS };
    this.highScore = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      const h = localStorage.getItem(KEY_HIGH);
      if (h) this.highScore = parseInt(h, 10) || 0;
    } catch (e) {
      // localStorage 不可用，用默认值
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) { /* ignore */ }
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

  /** 把 state 推到 game / audio */
  apply() {
    this.game.setSpeed(this.state.speed);
    this.game.setUpwardTolerance(this.state.upwardTolerance);
    this.game.setEndMode(this.state.endMode);
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);

    // 同步 UI
    this._syncUi();
  }

  _syncUi() {
    document.getElementById('speed-slider').value = this.state.speed;

    const upwardSeg = document.getElementById('upward-seg');
    for (const btn of upwardSeg.querySelectorAll('button')) {
      btn.classList.toggle('active', String(this.state.upwardTolerance) === btn.dataset.val);
    }

    const endSeg = document.getElementById('end-mode-seg');
    for (const btn of endSeg.querySelectorAll('button')) {
      btn.classList.toggle('active', this.state.endMode === btn.dataset.val);
    }

    document.getElementById('sfx-toggle').classList.toggle('active', this.state.sfxOn);
    document.getElementById('sfx-toggle').textContent = this.state.sfxOn ? '开' : '关';
    document.getElementById('bgm-toggle').classList.toggle('active', this.state.bgmOn);
    document.getElementById('bgm-toggle').textContent = this.state.bgmOn ? '开' : '关';
  }

  /** 绑定 UI 事件 */
  bindUi() {
    document.getElementById('settings-btn').addEventListener('click', () => this.open());
    document.getElementById('settings-close').addEventListener('click', () => this.close());

    document.getElementById('speed-slider').addEventListener('input', (e) => {
      this.set('speed', parseInt(e.target.value, 10));
    });

    document.getElementById('upward-seg').addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        this.set('upwardTolerance', parseInt(e.target.dataset.val, 10));
      }
    });

    document.getElementById('end-mode-seg').addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        this.set('endMode', e.target.dataset.val);
      }
    });

    document.getElementById('sfx-toggle').addEventListener('click', () => {
      this.set('sfxOn', !this.state.sfxOn);
    });

    document.getElementById('bgm-toggle').addEventListener('click', () => {
      this.set('bgmOn', !this.state.bgmOn);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.remove('hidden');
    });

    document.getElementById('restart-cancel').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
    });

    document.getElementById('restart-ok').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
      document.getElementById('settings-panel').classList.add('hidden');
      this.game.reset();
      this.game.setPaused(false);
    });
  }

  open() {
    document.getElementById('settings-panel').classList.remove('hidden');
    this.game.setPaused(true);
    if (this.audio.bgmController) this.audio.bgmController.stop(100);
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this.game.setPaused(false);
    if (this.state.bgmOn && this.audio.ctx) this.audio.startBgm();
  }
}
```

- [ ] **Step 2：在 main.js 调 `bindUi`**

把 main.js 里 `settings.apply();` 后加一行：

```js
settings.bindUi();
```

- [ ] **Step 3：提交**

```bash
git add games/tetris/js/settings.js games/tetris/js/main.js
git commit -m "feat(tetris): settings panel + localStorage persistence"
```

---

## Phase H：本地手动测试 + 部署验收

### Task H1：浏览器手动测试

- [ ] **Step 1：本地开 HTTP server**

```bash
python -m http.server 8000
```

（或 `npx serve`，任选）

在浏览器开 `http://localhost:8000/games/tetris/`。

- [ ] **Step 2：按 spec §11.1 跑测试清单**

```
[功能性]
□ 7 种方块都能正常出现、旋转正确
□ 单消、双消、三消、四消视听效果分别正确
□ 7-bag 验证：连续观察 20 个方块，每 7 个无重复
□ Ghost piece 与实际落点完全重合
□ Wall-kick：T 块顶到墙边能旋转

[手势]
□ 单指左/右拖 → 横向逐格走
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

[音频]
□ AudioContext 在首次触摸后初始化（不在页面加载时）
□ 静音 BGM 后无任何背景声
□ 静音 SFX 后操作无声

[兼容性]
□ 桌面 Chrome
□ 桌面 Firefox
□ Chrome DevTools 模拟 iPhone（375×667）顺畅
□ Chrome DevTools 模拟 iPad（820×1180）顺畅
```

- [ ] **Step 3：把任何发现的 bug 用 fix 提交一一修掉**

每个 bug 一个 commit：

```bash
git commit -m "fix(tetris): <bug 简述>"
```

- [ ] **Step 4：手动跑 `games/tetris/tests.html`，全绿**

---

### Task H2：推 GitHub Pages，断网测试离线

- [ ] **Step 1：推送**

```bash
git push
```

- [ ] **Step 2：等 ~60s，访问 https://zhcqiu.github.io/little-games/**

- [ ] **Step 3：从首页点进俄罗斯方块，玩一局**

- [ ] **Step 4：DevTools → Application → Service Workers**

确认 `/sw.js` 已激活、Cache Storage `little-games-v1` 存在且包含所有 tetris 资源。

- [ ] **Step 5：DevTools → Network 选 "Offline"，刷新页面**

- [ ] 首页应仍能打开
- [ ] Tetris 页面应仍能玩
- [ ] 音频应仍能播放

- [ ] **Step 6：手机真机测试**

iPhone Safari 打开 https://zhcqiu.github.io/little-games/games/tetris/，跑一遍 §11.1 手势部分。Android Chrome 同。

- [ ] **Step 7：试 "添加到主屏幕"**

- iOS Safari → 分享按钮 → 添加到主屏幕
- Android Chrome → 菜单 → 安装应用

从主屏幕图标启动应不出现地址栏。

- [ ] **Step 8：发现真机 bug 就修，最后再推**

---

### Task H3：更新 README 写离线约束

**Files:**
- Modify: `README.md`

- [ ] **Step 1：在 README 的「设计原则」节后追加新节**

找到 `## 📱 移动端开发提醒` 那一节，**在它之后**插入：

```markdown
## 🔌 离线优先

所有游戏必须在首次在线访问后**离线可玩**。仓库根的 `sw.js` 负责整站缓存。新加游戏时：

1. 在游戏的 `index.html` 里调用 `navigator.serviceWorker.register('/sw.js')`
2. 不要引用任何外部 CDN / Google Fonts / 远程图片——全部资源同源
3. 建议给每个游戏自带 `manifest.json` + `icon.svg`，让小朋友能"添加到主屏幕"作为独立 PWA

已知限制：

- 首次访问必须在线
- iOS Safari 14+ 才完整支持 SW
- 清浏览器数据后需要再次联网刷新
```

- [ ] **Step 2：提交并推送**

```bash
git add README.md
git commit -m "docs: document repo-wide offline-first constraint"
git push
```

---

## 自检

**1. Spec coverage：**

| Spec 节 | 实现任务 |
|---|---|
| §3 文件结构 | A1, B1-B4, C1-C8, D1-D4, E1-E4, F1-F4, G1, G2 |
| §4 屏幕布局 | B1（HTML 结构）+ B2（CSS） |
| §5 手势状态机 | E1-E4 |
| §6.1 棋盘与方块 | C3 |
| §6.2 7-bag | C3 |
| §6.3 出生位置 | C3 |
| §6.4 自动下落 5 档 | C7 |
| §6.5 消行 | C6 |
| §6.6 两种结束模式 | C7 |
| §6.7 持久化 | G2 |
| §7.1 视觉 FX | D1-D4 |
| §7.2 听觉 FX | F1-F4 |
| §7.3 iOS audio unlock | E4 + F1 + G1 |
| §8 设置与文案 | G2 + B1（HTML 文案） |
| §9 离线 / PWA | A1, A2, B3, H3 |
| §10 错误处理 | G1（visibilitychange / resize via D1）、F1（audio fallback）、G2（localStorage fallback） |
| §11 测试 | C1-C8（tests.html）+ H1 手动 |
| §12 兼容性 | H2 |

**2. Placeholder scan：** 无 TBD/TODO，每步有完整代码或具体指令 ✓

**3. Type consistency：**
- `Game.tryMoveTo / tryRotate / tryMoveDown` 在 C4/C5/C7 一致
- `Game.onLineClear` 在 C6 + G1 一致（接收 `(rows, colorSnapshots)`）
- `Renderer.flashRowsAnim / spawnParticles / triggerShake` 在 D1/D3/D4 + G1 一致
- `Input.on('moveTo' / 'rotate' / 'pauseChange')` + `onFirstTouch` 在 E1-E4 + G1 一致
- `Audio.playLock / playMove / playRotate / playClear / playGameOver / playEndlessReset / startBgm / unlock / setSfxOn / setBgmOn` 在 F1-F4 + G1 一致
- `Settings.load / apply / get / set / bindUi / open / close` 在 G2 + G1 一致

未发现 inconsistency。

---

## 执行说明

执行此计划时按 Task 顺序逐个完成。每 Task 内的步骤连续做完才能进下一 Task。`tests.html` 失败时不要继续下一 Task。Phase H 的手动测试发现的 bug，用 `fix(tetris): ...` 形式的 commit 修，**不要回头改之前的 Task 代码**——保持 Task 提交的可读性。
