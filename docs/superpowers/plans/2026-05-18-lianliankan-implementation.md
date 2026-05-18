# 连连看实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 little-games 仓库的第四款游戏（连连看），沿用 snake/tetris/breakout 范本，复用 shared/ 工具和 CSS 主题系统。

**Architecture:** 纯静态 HTML/CSS/JS，原生 ES Modules。`games/lianliankan/` 子目录拆为 `index.html` + `style.css` + 8 个 JS 模块（main / game / board / render / effects / input / audio / settings）。**渲染采用 DOM tiles + Canvas overlay（spec 方案 B）** —— CSS Grid 摆 `<button class="tile">`，单独一个绝对定位 canvas 画路径线和粒子。不动 `shared/` 现有模块，不动 `sw.js`（runtime caching 自动覆盖）。

**Tech Stack:** ES2020+ JavaScript（modules）、CSS Grid、Canvas 2D、Web Audio API、Service Worker（已存在）、localStorage、PWA manifest。零依赖，零构建。

**Spec:** `docs/superpowers/specs/2026-05-18-lianliankan-design.md`

**测试策略：** 为 `board.js`（findPath / hasAnySolvable / reshuffle）和 `game.js`（状态机 / combo / 计分 / serialize）写纯函数测试。浏览器侧 `tests.html` 用 `window.assertEq` 全局；同样断言再 inline 到仓库根 `tests/run-tests.mjs` 让 CI 跑。UI / 音频 / Canvas 用 spec §8.4 的手动清单。

**分段验收（建议每段提交一次）：**

| 阶段 | Phase | 完成时玩家看到 |
|---|---|---|
| Part 1：骨架空跑 | A | 打开 `games/lianliankan/`：页面加载、空棋盘居中、顶栏 / 底栏图标在位、面板能开关 |
| Part 2：纯逻辑全绿 | B + C | `node tests/run-tests.mjs` 包含连连看所有断言并全绿 |
| Part 3：能玩 | D + E + F | DOM tile 渲染、点击消除、连线动画、4 档难度切换、提示 / 洗牌、计时模式 |
| Part 4：好玩 | G | 音效 + 粒子 + combo toast + 入门档翻牌、设置 / 帮助 / 续玩 / 引导 / gameover 面板全装上 |
| Part 5：上线 | H + I | 首页卡片 + 真机 + 离线手测 + 文档同步 |

---

## 文件结构

```
little-games/
├── index.html                    H1 修改：games 数组追加连连看卡片
├── tests/
│   └── run-tests.mjs             H2 修改：import + 加连连看断言
└── games/
    └── lianliankan/              本计划主目录
        ├── index.html            A1：DOM 骨架 + 模块入口
        ├── style.css             A2：6 主题 + 棋盘 grid + tile + 面板
        ├── manifest.json         A3：PWA 清单
        ├── icon.svg              A3：游戏图标
        ├── tests.html            B0：纯函数测试入口
        ├── tests/
        │   ├── board.spec.js     B1-B5：findPath / hasAnySolvable / reshuffle / generate
        │   ├── game.spec.js      C1-C4：状态机 / combo / Memory / 计分 / 序列化
        │   └── generation.spec.js B5：各档棋盘对数 + 直方图 + 初始有解
        └── js/
            ├── board.js          B1-B5：Int8Array + findPath + hasAnySolvable + reshuffle + generate
            ├── game.js           C1-C4：状态机 / combo / 计分 / 计时 / serialize / 事件回调
            ├── render.js         D1-D3：DOM tiles mount + 状态 class + canvas overlay
            ├── input.js          D4：pointerdown 命中 → tile event
            ├── effects.js        E1：粒子 + 路径折线绘制 + fxLevel 联动
            ├── audio.js          E2：select / match / miss / combo / hint / shuffle / win 音效
            ├── settings.js       F1：设置面板 + lianliankan.settings + difficulty / timed
            └── main.js           F2-F4, G*：入口 + 暂停理由计数 + 存盘 / 续玩 + 面板 + 引导
```

---

## Phase A：骨架（页面 + 主题 + 空棋盘）

**目标：** 打开 `games/lianliankan/`，看到空棋盘容器 + 顶栏 + 底栏 + 各面板（点按钮能开关，玩不了游戏）。

### Task A1：写 `games/lianliankan/index.html`

**Files:**
- Create: `games/lianliankan/index.html`

- [ ] **Step 1：建目录**

```bash
mkdir games/lianliankan && mkdir games/lianliankan/js && mkdir games/lianliankan/tests
```

- [ ] **Step 2：写 `games/lianliankan/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>连连看 · 小游戏乐园</title>
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
      <div title="连击" id="combo-block" class="hidden"><span class="emoji">🔥</span> <span id="combo">0</span>连</div>
      <div title="用时" id="timer-block" class="hidden"><span class="emoji">⏱</span> <span id="timer">0:00</span></div>
    </div>
    <button id="pause-btn" aria-label="暂停">⏸</button>
    <button id="help-btn" aria-label="帮助">？</button>
    <button id="settings-btn" aria-label="设置">⚙</button>
  </header>

  <main>
    <div id="board-wrap">
      <div id="board"></div>
      <canvas id="overlay"></canvas>
    </div>
  </main>

  <footer id="bottom-bar">
    <button id="hint-btn">💡 提示</button>
    <button id="shuffle-btn">🔀 洗牌</button>
  </footer>

  <!-- 帮助面板 -->
  <div id="help-panel" class="panel hidden" aria-hidden="true">
    <div class="panel-header">
      <h2>怎么玩</h2>
      <button id="help-close" aria-label="关闭帮助">✕</button>
    </div>
    <div class="help-section">
      <h3>🎮 目标</h3>
      <p>🌱 入门档：翻 2 张相同的图案就消除！</p>
      <p>⭐ 初级 / 🔥 进阶 / 💎 高手：用 ≤ 2 拐弯的折线连接 2 张相同图案</p>
    </div>
    <div class="help-section">
      <h3>📱 手机和平板</h3>
      <ul>
        <li>点 1 张图 → 再点另 1 张相同的</li>
        <li><b>💡 提示</b> — 高亮一对可消的（无限次）</li>
        <li><b>🔀 洗牌</b> — 重排剩下的图案（无限次）</li>
      </ul>
    </div>
    <div class="help-section">
      <h3>🌈 设置里有啥</h3>
      <ul>
        <li>难度 / 计时</li>
        <li>🎨 主题 / 🔊 音效 / 🎵 音乐 / 🎬 动效请在主菜单 ⚙️ 里设置</li>
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
      <label>🎯 难度</label>
      <div class="seg" id="difficulty-seg">
        <button data-val="beginner">🌱 入门</button>
        <button data-val="novice">⭐ 初级</button>
        <button data-val="advanced">🔥 进阶</button>
        <button data-val="master">💎 高手</button>
      </div>
    </div>
    <div class="setting-row toggle-row" id="timed-row">
      <label>⏱ 计时模式</label>
      <button class="toggle" id="timed-toggle">⏱</button>
    </div>
    <p class="hint">🎨 主题 / 🔊 音效 / 🎵 音乐 / 🎬 动效请在主菜单 ⚙️ 里设置</p>
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

  <!-- 新手引导气泡 -->
  <div id="tutorial-popup" class="popup hidden">
    <p style="font-size: 20px; margin: 0 0 12px;">👋 嗨！欢迎玩连连看</p>
    <p style="margin: 0 0 8px;">👆 <b>点 2 张相同图案</b></p>
    <p style="margin: 0 0 16px;">⭐ 全部消掉就赢了！</p>
    <div class="popup-buttons">
      <button id="tutorial-ok" class="primary">✅ 开始玩</button>
    </div>
  </div>

  <!-- 重启确认 -->
  <div id="restart-confirm" class="popup hidden">
    <p>⚠️ 当前进度会丢失</p>
    <div class="popup-buttons">
      <button id="restart-cancel">❌ 取消</button>
      <button id="restart-ok" class="primary">✅ 确认</button>
    </div>
  </div>

  <!-- 游戏结束 -->
  <div id="gameover-panel" class="panel hidden">
    <div class="gameover-emoji" id="gameover-emoji">🏆</div>
    <p class="gameover-stat">🎯 <span id="final-score">0</span></p>
    <p class="gameover-stat" id="final-time-row">⏱ <span id="final-time">0:00</span></p>
    <button id="replay-btn" class="primary">▶️ 再玩一局</button>
    <button id="share-btn" class="secondary hidden">📤 分享成绩</button>
  </div>

  <!-- 浮字 toast -->
  <div id="event-toast" class="toast hidden">✨</div>
  <div id="clear-toast" class="clear-toast hidden">✨</div>

  <!-- 暂停 overlay -->
  <div id="pause-overlay" class="pause-overlay hidden">
    <div class="pause-icon">⏸</div>
    <div class="pause-hint">点屏幕 / 按 P 继续</div>
  </div>

  <div id="version-tag" class="version-tag">v1.0</div>

  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3：建一个临时空 `main.js` 让 module 加载不报错**

写 `games/lianliankan/js/main.js`：

```js
// 占位，后续 Phase F 填充
console.log('lianliankan loaded');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
```

### Task A2：写 `games/lianliankan/style.css`

**Files:**
- Create: `games/lianliankan/style.css`

- [ ] **Step 1：写 style.css**

```css
@import url('../../shared/themes.css');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  height: 100%;
  font-family: "Comic Sans MS", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--panel-text);
  overscroll-behavior: none;
}

body {
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* ───── 顶栏 ───── */
#top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-2);
  color: var(--text);
  min-height: 56px;
}
.score-block { display: flex; gap: 14px; font-weight: bold; font-size: 18px; }
.score-block .emoji { margin-right: 2px; }
.score-block .hidden { display: none; }
#top-bar button {
  width: 44px; height: 44px; margin-left: 4px;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid transparent; border-radius: 8px;
  font-size: 22px; cursor: pointer;
}

/* ───── 棋盘 ───── */
main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  min-height: 0;
}
#board-wrap {
  position: relative;
  width: 100%;
  max-width: min(95vw, 95vh);
  /* aspect-ratio 由 JS 按棋盘维度设置 */
}
#board {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  touch-action: manipulation;
}
.tile {
  background: var(--canvas-bg);
  color: var(--panel-text);
  border: 2px solid var(--canvas-border);
  border-radius: 8px;
  font-size: clamp(20px, 6vmin, 56px);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: transform 120ms ease, opacity 200ms ease, border-color 80ms ease, background 80ms ease;
  min-width: 0;
  min-height: 0;
}
.tile.empty { background: transparent; border-color: transparent; cursor: default; pointer-events: none; }
.tile.selected { transform: scale(1.08); border-color: var(--primary-dark); background: var(--panel-bg); }
.tile.hint { animation: hint-pulse 800ms ease-in-out infinite; }
.tile.miss { animation: miss-flash 200ms ease; }
.tile.clearing { transform: scale(0.2); opacity: 0; pointer-events: none; }
.tile.face-down { background: var(--primary); color: var(--text); }
.tile.face-down::after { content: "❓"; }
.tile.face-down { font-size: 0; }
.tile.face-down::after { font-size: clamp(20px, 6vmin, 56px); }

@keyframes hint-pulse {
  0%, 100% { background: var(--canvas-bg); }
  50% { background: #ffeb3b; }
}
@keyframes miss-flash {
  0%, 100% { background: var(--canvas-bg); }
  50% { background: #ff5252; }
}

#overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ───── 底栏 ───── */
#bottom-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 8px;
  background: var(--bg-2);
}
#bottom-bar button {
  min-width: 100px; min-height: 44px;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid transparent; border-radius: 8px;
  font-size: 16px; cursor: pointer;
}
#bottom-bar button.hidden { display: none; }

/* ───── 面板 ───── */
.panel {
  position: fixed;
  inset: 0;
  background: var(--panel-bg);
  color: var(--panel-text);
  z-index: 100;
  padding: 1.25rem;
  padding-top: calc(1.25rem + env(safe-area-inset-top));
  overflow-y: auto;
}
.panel.hidden { display: none; }
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1rem;
}
.panel-header h2 { margin: 0; font-size: 1.5rem; }
.panel-header button {
  width: 44px; height: 44px; font-size: 22px;
  background: transparent; color: var(--panel-text);
  border: none; cursor: pointer;
}
.help-section { margin-bottom: 1.25rem; }
.help-section h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.help-section p, .help-section ul { margin: 0.25rem 0; line-height: 1.5; }
.setting-row { margin-bottom: 1.25rem; }
.setting-row > label { display: block; font-weight: bold; margin-bottom: 0.5rem; }
.setting-row.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
}
.seg {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.seg button {
  flex: 1 1 calc((100% - 8px) / 2); min-height: 44px;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid transparent; border-radius: 8px;
  font-size: 0.95rem; cursor: pointer;
}
.seg button.active {
  background: var(--button-active); color: var(--text);
  border-color: var(--button-active);
}
.toggle {
  min-width: 72px; min-height: 44px;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid transparent; border-radius: 22px;
  font-size: 1rem; cursor: pointer;
}
.toggle.active {
  background: var(--button-active); color: var(--text);
  border-color: var(--button-active);
}
.hint {
  font-size: 0.85rem; opacity: 0.7; margin-top: 0.5rem;
}
#restart-btn, .primary {
  width: 100%; min-height: 56px; margin-top: 1rem;
  background: var(--primary); color: var(--text);
  border: none; border-radius: 8px;
  font-size: 1.1rem; font-weight: bold; cursor: pointer;
}
.secondary {
  width: 100%; min-height: 56px; margin-top: 0.5rem;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid var(--primary); border-radius: 8px;
  font-size: 1rem; cursor: pointer;
}

/* ───── popup（小尺寸面板） ───── */
.popup {
  position: fixed;
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: var(--panel-bg); color: var(--panel-text);
  border-radius: 12px; padding: 1.25rem;
  box-shadow: var(--shadow); z-index: 110;
  max-width: 90vw;
}
.popup.hidden { display: none; }
.popup-buttons { display: flex; gap: 8px; margin-top: 12px; }
.popup-buttons button {
  flex: 1; min-height: 44px;
  background: var(--button-bg); color: var(--button-bg-text);
  border: 2px solid transparent; border-radius: 8px;
  font-size: 1rem; cursor: pointer;
}
.popup-buttons button.primary { background: var(--primary); color: var(--text); }

/* ───── gameover ───── */
.gameover-emoji { text-align: center; font-size: 5rem; margin: 1rem 0; }
.gameover-stat { text-align: center; font-size: 1.5rem; margin: 0.5rem 0; }

/* ───── toast ───── */
.toast, .clear-toast {
  position: fixed;
  top: 30%; left: 50%; transform: translate(-50%, -50%);
  font-size: 4rem;
  pointer-events: none;
  z-index: 120;
  animation: toast-pop 1000ms ease-out;
}
.clear-toast { font-size: 5rem; }
.toast.hidden, .clear-toast.hidden { display: none; }
@keyframes toast-pop {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  20% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

/* ───── 暂停 overlay ───── */
.pause-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5); color: var(--text);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  z-index: 90; cursor: pointer;
}
.pause-overlay.hidden { display: none; }
.pause-icon { font-size: 5rem; }
.pause-hint { margin-top: 1rem; }

/* ───── 版本号 ───── */
.version-tag {
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0); right: 4px;
  font-size: 10px; color: var(--panel-text);
  opacity: 0.4; pointer-events: none; z-index: 1;
}
```

### Task A3：写 `manifest.json` + `icon.svg`

**Files:**
- Create: `games/lianliankan/manifest.json`
- Create: `games/lianliankan/icon.svg`

- [ ] **Step 1：写 `games/lianliankan/manifest.json`**

```json
{
  "name": "连连看",
  "short_name": "连连看",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#fff8e1",
  "theme_color": "#ff7043",
  "orientation": "any",
  "icons": [
    { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2：写 `games/lianliankan/icon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#fff8e1"/>
  <rect x="80"  y="80"  width="160" height="160" rx="20" fill="#ff7043"/>
  <rect x="272" y="80"  width="160" height="160" rx="20" fill="#42a5f5"/>
  <rect x="80"  y="272" width="160" height="160" rx="20" fill="#42a5f5"/>
  <rect x="272" y="272" width="160" height="160" rx="20" fill="#ff7043"/>
  <text x="160" y="200" font-size="120" text-anchor="middle" fill="white">🍎</text>
  <text x="352" y="200" font-size="120" text-anchor="middle" fill="white">🐱</text>
  <text x="160" y="392" font-size="120" text-anchor="middle" fill="white">🐱</text>
  <text x="352" y="392" font-size="120" text-anchor="middle" fill="white">🍎</text>
</svg>
```

### Task A4：本地启动验证 + 提交 Part 1

- [ ] **Step 1：本地启动**

```bash
python -m http.server 8765
```

浏览器打开 `http://127.0.0.1:8765/games/lianliankan/`。

预期：
- 顶栏 / 底栏 / 空棋盘容器渲染（棋盘空白没事，还没生成）
- 控制台只有 "lianliankan loaded"（无 404 / 报错）
- 点 ⚙ 按钮应**没反应**（事件还没接，先确认元素都在）

- [ ] **Step 2：在 DevTools 用 hand 触发面板**

DevTools console 跑：
```js
document.getElementById('help-panel').classList.remove('hidden')
```

应能看到帮助面板内容（说明 CSS 正常）。再：
```js
document.getElementById('help-panel').classList.add('hidden')
```

关闭。

- [ ] **Step 3：把 `games/lianliankan/` 加进 git 并提交 Part 1**

```bash
git add games/lianliankan/
git commit -m "feat(lianliankan): Part 1 骨架（HTML/CSS/manifest/icon）"
```

---

## Phase B：board.js + 单测（纯逻辑，TDD）

**目标：** `board.js` 含 `Board` 类、`findPath` / `hasAnySolvable` / `reshuffle` / 生成器，覆盖率高的浏览器侧测试与 Node 侧测试都全绿。

### Task B0：建测试入口

**Files:**
- Create: `games/lianliankan/tests.html`

- [ ] **Step 1：写 `games/lianliankan/tests.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>连连看测试</title>
  <style>
    body { font-family: monospace; padding: 20px; }
    .ok { color: green; } .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h1>连连看 · 测试</h1>
  <div id="results"></div>
  <script>
    let passed = 0, failed = 0;
    const out = document.getElementById('results');
    window.assertEq = (label, actual, expected) => {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      const div = document.createElement('div');
      div.className = ok ? 'ok' : 'fail';
      div.textContent = ok
        ? '✓ ' + label
        : `✗ ${label}  expected=${JSON.stringify(expected)}  got=${JSON.stringify(actual)}`;
      out.appendChild(div);
      ok ? passed++ : failed++;
    };
    window.assertTrue = (label, cond) => assertEq(label, !!cond, true);
    window.addEventListener('load', () => {
      const sum = document.createElement('h2');
      sum.textContent = `${passed} passed, ${failed} failed`;
      sum.className = failed === 0 ? 'ok' : 'fail';
      out.appendChild(sum);
    });
  </script>
  <script type="module" src="./tests/board.spec.js"></script>
  <script type="module" src="./tests/game.spec.js"></script>
  <script type="module" src="./tests/generation.spec.js"></script>
</body>
</html>
```

### Task B1：Board 类基础 + `_idx` / `get` / `set` / `countRemaining`

**Files:**
- Create: `games/lianliankan/js/board.js`
- Create: `games/lianliankan/tests/board.spec.js`

- [ ] **Step 1：先写失败测试 `tests/board.spec.js`**

```js
import { Board, DIFFICULTIES, EMOJI_POOL } from '../js/board.js';

// ───── B1：Board 基础 ─────
assertEq('DIFFICULTIES 4 档', Object.keys(DIFFICULTIES).sort(),
  ['advanced', 'beginner', 'master', 'novice']);
assertEq('beginner 4x4', [DIFFICULTIES.beginner.rows, DIFFICULTIES.beginner.cols], [4, 4]);
assertEq('master 10x12', [DIFFICULTIES.master.rows, DIFFICULTIES.master.cols], [10, 12]);
assertTrue('EMOJI_POOL ≥ 30', EMOJI_POOL.length >= 30);

const b = new Board('novice');
assertEq('novice rows', b.rows, 6);
assertEq('novice cols', b.cols, 6);
assertEq('novice data length (rows+2)*(cols+2)', b.data.length, 8 * 8);
assertEq('novice countRemaining = 36', b.countRemaining(), 36);

// 哨兵外圈应全 0
const allSentinelsZero = (() => {
  for (let c = 0; c < b.cols + 2; c++) {
    if (b.get(0, c) !== 0) return false;
    if (b.get(b.rows + 1, c) !== 0) return false;
  }
  for (let r = 0; r < b.rows + 2; r++) {
    if (b.get(r, 0) !== 0) return false;
    if (b.get(r, b.cols + 1) !== 0) return false;
  }
  return true;
})();
assertTrue('哨兵外圈全 0', allSentinelsZero);
```

- [ ] **Step 2：浏览器跑 `http://127.0.0.1:8765/games/lianliankan/tests.html`**

预期：所有断言失败（红色），因为 `board.js` 还没写。控制台应有 `Failed to resolve module specifier`。

- [ ] **Step 3：写最小 `js/board.js` 让 B1 测试通过**

```js
// board.js — 棋盘表示 + 路径算法 + 无解检测 + 洗牌 + 生成器
// 数据结构：Int8Array size (rows+2)*(cols+2)，外圈一圈 0 作哨兵。
// 内部值 0=空，1..N = emoji 索引。

export const DIFFICULTIES = {
  beginner: { rows: 4,  cols: 4,  emojiTypes: 8,  memory: true,  timed: false },
  novice:   { rows: 6,  cols: 6,  emojiTypes: 9,  memory: false, timed: false },
  advanced: { rows: 8,  cols: 10, emojiTypes: 10, memory: false, timed: false },
  master:   { rows: 10, cols: 12, emojiTypes: 12, memory: false, timed: true },
};

export const EMOJI_POOL = [
  '🍎','🍌','🍇','🍉','🍓','🍑','🥕','🥑','🥦','🌽',
  '🐱','🐶','🐰','🐻','🐼','🦊','🐨','🐯','🦁','🐮',
  '🚗','🚕','🚌','🚒','🚑','🚓','🚜','🛵','🚲','✈️',
  '⭐','🌟','🌈','🌸','🌻','❄️',
];

export class Board {
  constructor(difficulty, rng = Math.random) {
    if (!DIFFICULTIES[difficulty]) throw new Error('unknown difficulty: ' + difficulty);
    this.difficulty = difficulty;
    const d = DIFFICULTIES[difficulty];
    this.rows = d.rows;
    this.cols = d.cols;
    this.memory = d.memory;
    this.timed = d.timed;
    this.emojiTypes = d.emojiTypes;
    this.rng = rng;
    this.data = new Int8Array((this.rows + 2) * (this.cols + 2));
    this.flipped = this.memory ? new Uint8Array((this.rows + 2) * (this.cols + 2)) : null;
    this._generate();
  }

  _idx(r, c) { return r * (this.cols + 2) + c; }
  get(r, c) { return this.data[this._idx(r, c)]; }
  set(r, c, v) { this.data[this._idx(r, c)] = v; }
  isFlipped(r, c) { return this.flipped ? this.flipped[this._idx(r, c)] === 1 : false; }
  setFlipped(r, c, v) { if (this.flipped) this.flipped[this._idx(r, c)] = v ? 1 : 0; }

  countRemaining() {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== 0) n++;
    return n;
  }

  _generate() {
    // Phase B5 完成；先放 placeholder：填满 1..emojiTypes 重复
    const innerCells = this.rows * this.cols;
    const pairs = innerCells / 2;
    const types = Math.min(this.emojiTypes, EMOJI_POOL.length);
    const arr = new Array(innerCells);
    let i = 0;
    for (let p = 0; p < pairs; p++) {
      const v = (p % types) + 1;
      arr[i++] = v;
      arr[i++] = v;
    }
    // 简单乱序（B5 会换成 Fisher-Yates + 重洗保证）
    for (let k = arr.length - 1; k > 0; k--) {
      const j = Math.floor(this.rng() * (k + 1));
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    let k = 0;
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        this.set(r, c, arr[k++]);
      }
    }
  }
}
```

- [ ] **Step 4：刷新 tests.html，B1 应全绿（其他测试还红没关系）**

### Task B2：`findPath`（3 段折线穷举）+ 详尽测试

**Files:**
- Modify: `games/lianliankan/js/board.js`
- Modify: `games/lianliankan/tests/board.spec.js`

- [ ] **Step 1：在 `board.spec.js` 末尾追加 findPath 测试**

```js
// ───── B2：findPath ─────
// 用 helper 直接造棋盘
function makeBoard(rows, cols) {
  const b = Object.create(Board.prototype);
  b.rows = rows; b.cols = cols;
  b.data = new Int8Array((rows + 2) * (cols + 2));
  b.memory = false; b.flipped = null;
  return b;
}

// 同行无阻挡
{
  const b = makeBoard(2, 4);
  b.set(1, 1, 5); b.set(1, 4, 5);
  const p = b.findPath({r:1, c:1}, {r:1, c:4});
  assertTrue('同行无阻挡 有解', p !== null);
  assertEq('同行 2 顶点', p.length, 2);
}

// 同列无阻挡
{
  const b = makeBoard(4, 2);
  b.set(1, 1, 5); b.set(4, 1, 5);
  const p = b.findPath({r:1, c:1}, {r:4, c:1});
  assertTrue('同列无阻挡 有解', p !== null);
  assertEq('同列 2 顶点', p.length, 2);
}

// 同行有阻挡
{
  const b = makeBoard(2, 4);
  b.set(1, 1, 5); b.set(1, 4, 5); b.set(1, 2, 7);
  const p = b.findPath({r:1, c:1}, {r:1, c:4});
  // 但 2 拐弯可能仍能绕：(1,1)->(0,1)->(0,4)->(1,4)
  assertTrue('同行阻挡仍可绕外', p !== null);
}

// 1 拐弯
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 5);
  const p = b.findPath({r:1, c:1}, {r:3, c:3});
  assertTrue('1 拐弯有解', p !== null);
  assertTrue('1 拐弯 ≥ 3 顶点', p.length >= 3);
}

// 2 拐弯
{
  const b = makeBoard(3, 5);
  b.set(2, 1, 5); b.set(2, 5, 5);
  b.set(1, 2, 7); b.set(1, 3, 7); b.set(1, 4, 7);  // 上挡
  b.set(3, 2, 7); b.set(3, 3, 7); b.set(3, 4, 7);  // 下挡（但哨兵 row 0 / row 4 应仍空）
  // 同行被挡 → 走哨兵行
  // 但 row 0 空 → 应能 (2,1)->(0,1)->(0,5)->(2,5)
  const p = b.findPath({r:2, c:1}, {r:2, c:5});
  assertTrue('2 拐弯走哨兵 有解', p !== null);
}

// 完全不可达
{
  const b = makeBoard(3, 5);
  b.set(2, 1, 5); b.set(2, 5, 5);
  // 把所有可能路径上的格都堵死（含哨兵）— 难造，跳过这种极端

  // 用更直接的：两个相邻但都被四周围住
  const b2 = makeBoard(5, 5);
  b2.set(3, 3, 5); b2.set(3, 1, 5);
  // 在 (3,3) 和 (3,1) 之间所有连通可能挡掉
  b2.set(3, 2, 7);  // 直挡
  b2.set(2, 2, 7); b2.set(2, 1, 7); b2.set(2, 3, 7);  // 上挡
  b2.set(4, 2, 7); b2.set(4, 1, 7); b2.set(4, 3, 7);  // 下挡
  // 仍能绕去 row 0 或 row 5（哨兵）—— 所以不可达极少见
  // 改造：把 row 1/row 5/col 0/col 5 也挡（但哨兵在 row 0 和 col 0 那是外圈）
  // 简单点：直接造一个例子是不同 emoji
  const b3 = makeBoard(2, 2);
  b3.set(1, 1, 5); b3.set(2, 2, 7);
  assertEq('不同 emoji 返回 null', b3.findPath({r:1, c:1}, {r:2, c:2}), null);
}

// 自身 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  assertEq('a==b 返回 null', b.findPath({r:1, c:1}, {r:1, c:1}), null);
}

// 越界 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  assertEq('越界 r 返回 null', b.findPath({r:1, c:1}, {r:99, c:1}), null);
  assertEq('越界 c 返回 null', b.findPath({r:1, c:1}, {r:1, c:99}), null);
}

// 空格 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  // (1,2) 是空
  assertEq('对方为空 返回 null', b.findPath({r:1, c:1}, {r:1, c:2}), null);
}
```

- [ ] **Step 2：浏览器刷新 tests.html，B2 应全失败**

- [ ] **Step 3：在 `js/board.js` Board 类里实现 `findPath`**

```js
  /**
   * 返回 [{r,c}, ...] 顶点数组（含 a 和 b）；不可连返回 null。
   * 不修改棋盘。
   */
  findPath(a, b) {
    if (!a || !b) return null;
    if (a.r === b.r && a.c === b.c) return null;
    if (a.r < 1 || a.r > this.rows || a.c < 1 || a.c > this.cols) return null;
    if (b.r < 1 || b.r > this.rows || b.c < 1 || b.c > this.cols) return null;
    const va = this.get(a.r, a.c);
    const vb = this.get(b.r, b.c);
    if (va === 0 || vb === 0 || va !== vb) return null;

    // 情形 1：同行/同列，中间全空
    if (a.r === b.r && this._hLineClear(a.r, a.c, b.c)) {
      return [a, b];
    }
    if (a.c === b.c && this._vLineClear(a.c, a.r, b.r)) {
      return [a, b];
    }

    // 情形 2：1 拐弯——两个角点
    for (const corner of [{r: a.r, c: b.c}, {r: b.r, c: a.c}]) {
      if (this.get(corner.r, corner.c) !== 0) continue;
      // a 到 corner：同行（情形 a.r===corner.r）或同列
      // corner 到 b：另一边
      if (this._segmentClear(a, corner) && this._segmentClear(corner, b)) {
        return [a, corner, b];
      }
    }

    // 情形 3：2 拐弯——枚举中间行 / 中间列
    // 中间行 r（除 a.r 和 b.r 自身）
    for (let r = 0; r <= this.rows + 1; r++) {
      if (r === a.r || r === b.r) continue;
      // 中间行需在 r 行的 [a.c..b.c] 都空（含两端两个枢点）
      const p1 = {r, c: a.c};
      const p2 = {r, c: b.c};
      if (this.get(p1.r, p1.c) !== 0) continue;
      if (this.get(p2.r, p2.c) !== 0) continue;
      // a → p1（同列）
      if (!this._vLineClear(a.c, a.r, r)) continue;
      // p1 → p2（同行）
      if (!this._hLineClear(r, a.c, b.c)) continue;
      // p2 → b（同列）
      if (!this._vLineClear(b.c, r, b.r)) continue;
      return [a, p1, p2, b];
    }
    // 中间列 c
    for (let c = 0; c <= this.cols + 1; c++) {
      if (c === a.c || c === b.c) continue;
      const p1 = {r: a.r, c};
      const p2 = {r: b.r, c};
      if (this.get(p1.r, p1.c) !== 0) continue;
      if (this.get(p2.r, p2.c) !== 0) continue;
      if (!this._hLineClear(a.r, a.c, c)) continue;
      if (!this._vLineClear(c, a.r, b.r)) continue;
      if (!this._hLineClear(b.r, c, b.c)) continue;
      return [a, p1, p2, b];
    }

    return null;
  }

  /** 在 row 行 col1..col2 之间（不含两端）所有格为空 */
  _hLineClear(row, col1, col2) {
    const [lo, hi] = col1 < col2 ? [col1, col2] : [col2, col1];
    for (let c = lo + 1; c < hi; c++) {
      if (this.get(row, c) !== 0) return false;
    }
    return true;
  }
  _vLineClear(col, row1, row2) {
    const [lo, hi] = row1 < row2 ? [row1, row2] : [row2, row1];
    for (let r = lo + 1; r < hi; r++) {
      if (this.get(r, col) !== 0) return false;
    }
    return true;
  }
  /** segment 必须同行或同列 */
  _segmentClear(p1, p2) {
    if (p1.r === p2.r) return this._hLineClear(p1.r, p1.c, p2.c);
    if (p1.c === p2.c) return this._vLineClear(p1.c, p1.r, p2.r);
    return false;
  }
```

- [ ] **Step 4：刷新 tests.html，B1+B2 应全绿**

如有失败请检查算法（特别注意 `_hLineClear` 不含两端、`_segmentClear` 只处理同行/同列）。

### Task B3：`hasAnySolvable`

**Files:**
- Modify: `games/lianliankan/js/board.js`
- Modify: `games/lianliankan/tests/board.spec.js`

- [ ] **Step 1：在 `board.spec.js` 追加测试**

```js
// ───── B3：hasAnySolvable ─────
{
  const b = makeBoard(3, 3);
  assertEq('全空棋盘 无解', b.hasAnySolvable(), null);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5);
  assertEq('单一格 无解', b.hasAnySolvable(), null);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(1, 3, 5);
  const sol = b.hasAnySolvable();
  assertTrue('有 1 对 应有解', sol !== null);
  assertTrue('有解返回路径', Array.isArray(sol.path) && sol.path.length >= 2);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 7);  // 不同 emoji
  assertEq('全不同 emoji 无解', b.hasAnySolvable(), null);
}
```

- [ ] **Step 2：实现 `hasAnySolvable`**

在 Board 类里追加：

```js
  /**
   * 返回 { a, b, path } 或 null。
   * a / b 是格坐标 {r, c}；path 是 findPath 的返回值。
   */
  hasAnySolvable() {
    // group by emoji value
    const groups = new Map();
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        const v = this.get(r, c);
        if (v === 0) continue;
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push({r, c});
      }
    }
    for (const cells of groups.values()) {
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const path = this.findPath(cells[i], cells[j]);
          if (path) return { a: cells[i], b: cells[j], path };
        }
      }
    }
    return null;
  }
```

- [ ] **Step 3：刷新 tests.html，B1-B3 应全绿**

### Task B4：`reshuffle`

**Files:**
- Modify: `games/lianliankan/js/board.js`
- Modify: `games/lianliankan/tests/board.spec.js`

- [ ] **Step 1：追加测试**

```js
// ───── B4：reshuffle ─────
{
  // 造一个"无解但有多对"的棋盘：5 个相同 emoji 围一圈把第 6 个困住
  const b = makeBoard(5, 5);
  // 简单：放 4 对 5，洗牌后应仍 4 对且有解
  b.set(1, 1, 5); b.set(1, 2, 5);
  b.set(1, 3, 7); b.set(1, 4, 7);
  b.set(2, 1, 9); b.set(2, 2, 9);
  b.set(2, 3, 11); b.set(2, 4, 11);
  const beforeHist = histogram(b);
  const ok = b.reshuffle();
  assertEq('reshuffle 成功', ok, true);
  const afterHist = histogram(b);
  assertEq('reshuffle 保留直方图', afterHist, beforeHist);
  assertTrue('reshuffle 后有解', b.hasAnySolvable() !== null);
}
{
  // 剩 1 对 → 跳过
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 5);
  const before = JSON.stringify(Array.from(b.data));
  const ok = b.reshuffle();
  assertEq('1 对跳过 reshuffle 仍 true', ok, true);
  assertEq('棋盘不变', JSON.stringify(Array.from(b.data)), before);
}

function histogram(b) {
  const h = {};
  for (let r = 1; r <= b.rows; r++) {
    for (let c = 1; c <= b.cols; c++) {
      const v = b.get(r, c);
      if (v) h[v] = (h[v] || 0) + 1;
    }
  }
  return h;
}
```

- [ ] **Step 2：在 Board 类里实现 `reshuffle`**

```js
  /**
   * 原地 Fisher-Yates 洗剩余非空格的 emoji，最多重试 5 次直到 hasAnySolvable。
   * 返回 true 表示成功（含"剩 ≤ 1 对跳过"）；false 表示 5 次后仍无解。
   */
  reshuffle() {
    const cells = [];
    const values = [];
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        const v = this.get(r, c);
        if (v !== 0) {
          cells.push({r, c});
          values.push(v);
        }
      }
    }
    if (values.length <= 2) return true;  // 剩 ≤ 1 对，无意义

    for (let attempt = 0; attempt < 5; attempt++) {
      // Fisher-Yates 洗 values
      for (let k = values.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [values[k], values[j]] = [values[j], values[k]];
      }
      // 写回
      for (let i = 0; i < cells.length; i++) {
        this.set(cells[i].r, cells[i].c, values[i]);
      }
      if (this.hasAnySolvable() !== null) return true;
    }
    return false;
  }
```

- [ ] **Step 3：刷新 tests.html，B1-B4 全绿**

### Task B5：用真生成器替换 `_generate` + generation 测试

**Files:**
- Modify: `games/lianliankan/js/board.js`
- Create: `games/lianliankan/tests/generation.spec.js`

- [ ] **Step 1：把 `_generate` 改成"按对铺 + Fisher-Yates 全棋盘洗 + 重洗保证有解"**

替换 board.js 里的 `_generate`：

```js
  _generate() {
    const innerCells = this.rows * this.cols;
    const pairs = innerCells / 2;
    if (pairs * 2 !== innerCells) throw new Error('内部格数必须是偶数');
    const types = Math.min(this.emojiTypes, EMOJI_POOL.length);

    // 每种 emoji 应放对数 = floor(pairs / types)，多余对随机分配 1 对
    const perType = Math.floor(pairs / types);
    let extra = pairs - perType * types;

    const values = [];
    for (let i = 0; i < types; i++) {
      const count = perType + (i < extra ? 1 : 0);
      for (let p = 0; p < count; p++) {
        values.push(i + 1);
        values.push(i + 1);
      }
    }
    // 兜底：保证 values.length === innerCells
    if (values.length !== innerCells) {
      throw new Error('生成器算错对数 ' + values.length + ' vs ' + innerCells);
    }

    // 多次重洗直到有初始解
    let attempt = 0;
    while (attempt < 20) {
      attempt++;
      for (let k = values.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [values[k], values[j]] = [values[j], values[k]];
      }
      let i = 0;
      for (let r = 1; r <= this.rows; r++) {
        for (let c = 1; c <= this.cols; c++) {
          this.set(r, c, values[i++]);
        }
      }
      if (this.hasAnySolvable() !== null) return;
    }
    // 20 次仍失败几乎不可能；不抛，让 caller 用 reshuffle 兜
  }
```

> **Note:** B1 的 placeholder `_generate` 用了固定 `(p % types) + 1` 顺序，新版生成器换成"每种 emoji 算应放对数，确保偶数对" —— 在 emojiTypes 不整除 pairs 时更鲁棒。

- [ ] **Step 2：写 `games/lianliankan/tests/generation.spec.js`**

```js
import { Board, DIFFICULTIES } from '../js/board.js';

// 各档对数 + emoji 直方图全偶数 + 初始有解
for (const diff of ['beginner', 'novice', 'advanced', 'master']) {
  const b = new Board(diff);
  const innerCells = b.rows * b.cols;
  assertEq(`${diff} 对数 = innerCells/2`, b.countRemaining(), innerCells);

  const hist = {};
  for (let r = 1; r <= b.rows; r++) {
    for (let c = 1; c <= b.cols; c++) {
      const v = b.get(r, c);
      if (v) hist[v] = (hist[v] || 0) + 1;
    }
  }
  for (const [k, count] of Object.entries(hist)) {
    assertEq(`${diff} emoji ${k} 偶数`, count % 2, 0);
  }
  assertTrue(`${diff} 初始有解`, b.hasAnySolvable() !== null);
}

// 注入 seed 可复现
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
{
  const b1 = new Board('novice', seededRng(1234));
  const b2 = new Board('novice', seededRng(1234));
  assertEq('注入相同 seed 棋盘一致', Array.from(b1.data), Array.from(b2.data));
}
```

- [ ] **Step 3：刷新 tests.html，B1-B5 应全绿**

### Task B6：提交 Phase B

- [ ] **Step 1：跑一次完整浏览器测试确认全绿**

```bash
# 刷新 http://127.0.0.1:8765/games/lianliankan/tests.html
# 期待：底部出现绿色 "N passed, 0 failed"
```

- [ ] **Step 2：提交**

```bash
git add games/lianliankan/js/board.js games/lianliankan/tests/ games/lianliankan/tests.html
git commit -m "feat(lianliankan): Part 2a board.js + 单测（findPath / hasAnySolvable / reshuffle / generate）"
```

---

## Phase C：game.js + 单测（状态机 / combo / Memory / 计分 / 序列化）

### Task C1：`Game` 类基础 + 选择状态机（连线模式）

**Files:**
- Create: `games/lianliankan/js/game.js`
- Create: `games/lianliankan/tests/game.spec.js`

- [ ] **Step 1：写 `tests/game.spec.js` 状态机测试**

```js
import { Game } from '../js/game.js';

// ───── C1：状态机（连线模式）─────
{
  const g = new Game('novice', () => 0.5);
  assertEq('初始 score 0', g.score, 0);
  assertEq('初始 combo 0', g.combo, 0);
  assertEq('初始 selection null', g.selection, null);
  assertEq('初始 dead false', g.dead, false);
  assertEq('初始 won false', g.won, false);
}

// 选中一个非空 tile
{
  const g = new Game('novice', () => 0.5);
  // 找一个非空
  let target = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { target = {r, c}; break outer; }
    }
  }
  const ok = g.tap(target.r, target.c);
  assertEq('tap 非空格 selection = 自身', g.selection, target);
  assertEq('tap 非空格返回类型', ok.kind, 'select');
}

// 点同一格 → 取消
{
  const g = new Game('novice', () => 0.5);
  let target = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { target = {r, c}; break outer; }
    }
  }
  g.tap(target.r, target.c);
  const r2 = g.tap(target.r, target.c);
  assertEq('再点同一格 selection null', g.selection, null);
  assertEq('再点同一格返回 deselect', r2.kind, 'deselect');
}

// 点空格 → ignore
{
  const g = new Game('novice', () => 0.5);
  let empty = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) === 0) { empty = {r, c}; break outer; }
    }
  }
  // novice 满 36 格无空——跳过
  if (!empty) assertTrue('novice 满格，跳过 empty tap 测试', true);
  else {
    const r = g.tap(empty.r, empty.c);
    assertEq('点空格 ignore', r.kind, 'ignore');
  }
}

// 配对成功（造一个有解棋盘）
{
  const g = new Game('novice', () => 0.5);
  // 改棋盘：清空 → 放两个相同 emoji
  g.board.data.fill(0);
  g.board.set(1, 1, 7);
  g.board.set(1, 3, 7);
  const r1 = g.tap(1, 1);
  assertEq('first select', r1.kind, 'select');
  const r2 = g.tap(1, 3);
  assertEq('match!', r2.kind, 'match');
  assertTrue('match 返回 path', Array.isArray(r2.path));
  assertEq('match 后 board (1,1) 清空', g.board.get(1, 1), 0);
  assertEq('match 后 board (1,3) 清空', g.board.get(1, 3), 0);
  assertEq('match 后 score +10', g.score, 10);
  assertEq('match 后 combo = 1', g.combo, 1);
  assertEq('match 后 selection null', g.selection, null);
}

// 配对失败（不同 emoji）
{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7);
  g.board.set(1, 3, 9);
  g.tap(1, 1);
  const r = g.tap(1, 3);
  assertEq('不同 emoji mismatch', r.kind, 'mismatch');
  assertEq('mismatch 后 selection = T2', g.selection, {r:1, c:3});
  assertEq('mismatch 后 score 不变', g.score, 0);
  assertEq('mismatch 后 combo 0', g.combo, 0);
}
```

- [ ] **Step 2：写最小 `js/game.js` 让 C1 通过**

```js
// game.js — 游戏状态机 + combo + 计分 + 计时 + serialize
import { Board, DIFFICULTIES } from './board.js';

export class Game {
  constructor(difficulty = 'novice', rng = Math.random) {
    this.difficulty = difficulty;
    this.rng = rng;
    this.board = new Board(difficulty, rng);
    this.score = 0;
    this.combo = 0;
    this.lastMatchAtMs = -10000;
    this.elapsedMs = 0;
    this.dead = false;
    this.won = false;
    this.paused = false;
    this.selection = null;
    this.timed = DIFFICULTIES[difficulty].timed;
    this.memory = DIFFICULTIES[difficulty].memory;

    // 事件回调
    this._cb = { match: null, mismatch: null, combo: null, shuffle: null, win: null, lose: null, hint: null };

    if (this.memory) {
      // 翻牌模式：所有格背面朝上
      for (let r = 1; r <= this.board.rows; r++) {
        for (let c = 1; c <= this.board.cols; c++) {
          if (this.board.get(r, c) !== 0) this.board.setFlipped(r, c, false);
        }
      }
    }
  }

  // 事件订阅
  onMatch(cb)    { this._cb.match = cb; }
  onMismatch(cb) { this._cb.mismatch = cb; }
  onCombo(cb)    { this._cb.combo = cb; }
  onShuffle(cb)  { this._cb.shuffle = cb; }
  onWin(cb)      { this._cb.win = cb; }
  onLose(cb)     { this._cb.lose = cb; }
  onHint(cb)     { this._cb.hint = cb; }

  setPaused(p) { this.paused = !!p; }

  /**
   * 推进 dt 毫秒（计时模式用）。不暂停时累加 elapsedMs。
   * timed 模式下到达限时触发 lose。
   */
  step(dt) {
    if (this.paused || this.dead || this.won) return;
    this.elapsedMs += dt;
    if (this.timed && this.elapsedMs >= this._timeLimitMs()) {
      this.dead = true;
      this._cb.lose && this._cb.lose('timeout');
    }
  }

  _timeLimitMs() {
    // advanced: 4 分钟；master: 5 分钟
    return this.difficulty === 'master' ? 300_000 : 240_000;
  }

  /**
   * 玩家点一个格子 (r, c)（1-based 内部坐标）。
   * 返回 { kind: 'ignore' | 'select' | 'deselect' | 'match' | 'mismatch' | 'flip' | 'win' | 'shuffle', ... }
   */
  tap(r, c) {
    if (this.dead || this.won || this.paused) return { kind: 'ignore' };
    if (this.memory) return this._tapMemory(r, c);
    return this._tapConnect(r, c);
  }

  _tapConnect(r, c) {
    const v = this.board.get(r, c);
    if (v === 0) return { kind: 'ignore' };
    // 同格 → 取消
    if (this.selection && this.selection.r === r && this.selection.c === c) {
      this.selection = null;
      return { kind: 'deselect' };
    }
    if (!this.selection) {
      this.selection = { r, c };
      return { kind: 'select' };
    }
    const a = this.selection;
    const b = { r, c };
    const va = this.board.get(a.r, a.c);
    if (va !== v) {
      // 不同 emoji
      this.combo = 0;
      const prev = this.selection;
      this.selection = b;
      this._cb.mismatch && this._cb.mismatch(prev, b);
      return { kind: 'mismatch', prev, current: b };
    }
    const path = this.board.findPath(a, b);
    if (!path) {
      // 同 emoji 但不可达
      this.combo = 0;
      const prev = this.selection;
      this.selection = b;
      this._cb.mismatch && this._cb.mismatch(prev, b);
      return { kind: 'mismatch', prev, current: b };
    }
    // 配对成功
    this.board.set(a.r, a.c, 0);
    this.board.set(b.r, b.c, 0);
    this.selection = null;

    // combo 判定（2500ms 窗口）
    const inCombo = this.elapsedMs - this.lastMatchAtMs <= 2500;
    this.combo = inCombo ? this.combo + 1 : 1;
    this.lastMatchAtMs = this.elapsedMs;
    const pairScore = Math.round(10 * (1 + 0.5 * Math.max(0, this.combo - 1)));
    this.score += pairScore;

    this._cb.match && this._cb.match(a, b, path, pairScore);
    if (this.combo >= 2) this._cb.combo && this._cb.combo(this.combo);

    // 检查胜利 / 无解
    if (this.board.countRemaining() === 0) {
      this.won = true;
      this._cb.win && this._cb.win(this.score, this.elapsedMs);
      return { kind: 'win', a, b, path, pairScore };
    }
    if (this.board.hasAnySolvable() === null) {
      const ok = this.board.reshuffle();
      if (!ok) {
        // 兜底判赢
        this.won = true;
        this._cb.win && this._cb.win(this.score, this.elapsedMs);
        return { kind: 'win', a, b, path, pairScore, escape: true };
      }
      this._cb.shuffle && this._cb.shuffle();
      return { kind: 'match', a, b, path, pairScore, shuffled: true };
    }
    return { kind: 'match', a, b, path, pairScore };
  }

  _tapMemory(r, c) {
    // Phase C3 实现
    return { kind: 'ignore' };
  }

  /** 找一对可消的，触发 hint 事件，返回 {a, b, path} 或 null */
  useHint() {
    const sol = this.board.hasAnySolvable();
    if (!sol) return null;
    this._cb.hint && this._cb.hint(sol.a, sol.b, sol.path);
    return sol;
  }

  /** 强制洗牌 */
  forceShuffle() {
    const ok = this.board.reshuffle();
    if (ok) this._cb.shuffle && this._cb.shuffle();
    return ok;
  }

  // C4 实现
  serialize() { throw new Error('not yet'); }
  restore(snap) { throw new Error('not yet'); }
  reset() { throw new Error('not yet'); }
}
```

- [ ] **Step 3：刷新 tests.html，C1 应全绿**

### Task C2：Combo 时间窗口

**Files:**
- Modify: `games/lianliankan/tests/game.spec.js`

- [ ] **Step 1：追加测试**

```js
// ───── C2：combo 时间窗口 ─────
{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);

  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  assertEq('combo=1', g.combo, 1);
  assertEq('score=10', g.score, 10);

  // 2 秒内再消 → combo+1
  g.elapsedMs = 2500;
  g.tap(2, 1); g.tap(2, 3);
  assertEq('combo=2', g.combo, 2);
  // 第 2 对得分 = 10 * (1 + 0.5*1) = 15
  assertEq('score=25', g.score, 25);
}

{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);

  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  // 4 秒后再消 → combo 重置
  g.elapsedMs = 5000;
  g.tap(2, 1); g.tap(2, 3);
  assertEq('combo 重置 1', g.combo, 1);
  assertEq('score=20（无 bonus）', g.score, 20);
}
```

- [ ] **Step 2：跑测试，C2 应直接绿（C1 实现已含 combo 逻辑）**

### Task C3：Memory 模式

**Files:**
- Modify: `games/lianliankan/js/game.js`
- Modify: `games/lianliankan/tests/game.spec.js`

- [ ] **Step 1：追加 Memory 测试**

```js
// ───── C3：Memory 模式 ─────
{
  const g = new Game('beginner', () => 0.5);
  assertEq('beginner memory=true', g.memory, true);
  // 找两个相同 emoji 的格
  const find = (val) => {
    const found = [];
    for (let r = 1; r <= g.board.rows; r++) {
      for (let c = 1; c <= g.board.cols; c++) {
        if (g.board.get(r, c) === val) found.push({r, c});
      }
    }
    return found;
  };
  // 找第一个 emoji 值的两张
  let v = 0;
  for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { v = g.board.get(r, c); break; }
    }
    if (v) break;
  }
  const pair = find(v);
  assertTrue('找到一对', pair.length >= 2);

  // tap 第 1 张 → flip
  const r1 = g.tap(pair[0].r, pair[0].c);
  assertEq('memory tap1 = flip', r1.kind, 'flip');
  assertEq('翻开状态', g.board.isFlipped(pair[0].r, pair[0].c), true);
  assertEq('flippedFirst 指向 T1', g.flippedFirst, pair[0]);

  // tap 第 2 张 (相同) → match
  const r2 = g.tap(pair[1].r, pair[1].c);
  assertEq('memory tap2 = match', r2.kind, 'match');
  assertEq('match 后 board 清', g.board.get(pair[0].r, pair[0].c), 0);
}

// memory 翻不同 → 返回 mismatch（需 caller 延迟回 flip）
{
  const g = new Game('beginner', () => 0.5);
  g.board.data.fill(0);
  if (g.board.flipped) g.board.flipped.fill(0);
  g.board.set(1, 1, 5);
  g.board.set(2, 2, 7);
  g.tap(1, 1);
  const r = g.tap(2, 2);
  assertEq('memory 不同 emoji = mismatch', r.kind, 'mismatch');
  assertEq('两张都翻开', g.board.isFlipped(1, 1) && g.board.isFlipped(2, 2), true);
  // caller 调 resolveMemoryMismatch() 把它们翻回
  g.resolveMemoryMismatch();
  assertEq('翻回 1,1', g.board.isFlipped(1, 1), false);
  assertEq('翻回 2,2', g.board.isFlipped(2, 2), false);
  assertEq('flippedFirst null', g.flippedFirst, null);
}
```

- [ ] **Step 2：在 `game.js` 实现 `_tapMemory` + `resolveMemoryMismatch` + `constructor` 加 `this.flippedFirst = null`**

在 game.js 构造函数末尾加：
```js
    this.flippedFirst = null;
    this._pendingMismatch = null;
```

替换 `_tapMemory` 占位为：

```js
  _tapMemory(r, c) {
    const v = this.board.get(r, c);
    if (v === 0) return { kind: 'ignore' };
    if (this.board.isFlipped(r, c)) return { kind: 'ignore' };  // 已翻开（含 mismatch 显示中）

    // 翻开当前
    this.board.setFlipped(r, c, true);

    if (!this.flippedFirst) {
      this.flippedFirst = { r, c };
      return { kind: 'flip', cell: { r, c } };
    }
    const first = this.flippedFirst;
    const va = this.board.get(first.r, first.c);
    if (va === v) {
      // 配对成功
      this.board.set(first.r, first.c, 0);
      this.board.set(r, c, 0);
      this.board.setFlipped(first.r, first.c, false);
      this.board.setFlipped(r, c, false);
      this.flippedFirst = null;
      // combo + 计分
      const inCombo = this.elapsedMs - this.lastMatchAtMs <= 2500;
      this.combo = inCombo ? this.combo + 1 : 1;
      this.lastMatchAtMs = this.elapsedMs;
      const pairScore = Math.round(10 * (1 + 0.5 * Math.max(0, this.combo - 1)));
      this.score += pairScore;
      this._cb.match && this._cb.match(first, { r, c }, null, pairScore);
      if (this.combo >= 2) this._cb.combo && this._cb.combo(this.combo);
      if (this.board.countRemaining() === 0) {
        this.won = true;
        this._cb.win && this._cb.win(this.score, this.elapsedMs);
        return { kind: 'win', a: first, b: { r, c }, pairScore };
      }
      return { kind: 'match', a: first, b: { r, c }, pairScore };
    }
    // 不同 → mismatch（两张暂时保持翻开，caller 延迟 600ms 后调 resolveMemoryMismatch）
    this.combo = 0;
    const prev = first;
    this._pendingMismatch = { a: prev, b: { r, c } };
    this.flippedFirst = null;
    this._cb.mismatch && this._cb.mismatch(prev, { r, c });
    return { kind: 'mismatch', prev, current: { r, c } };
  }

  /** caller 在 mismatch 后等 600ms 调用，把两张翻回背面 */
  resolveMemoryMismatch() {
    if (!this._pendingMismatch) return;
    const { a, b } = this._pendingMismatch;
    if (this.board.get(a.r, a.c) !== 0) this.board.setFlipped(a.r, a.c, false);
    if (this.board.get(b.r, b.c) !== 0) this.board.setFlipped(b.r, b.c, false);
    this._pendingMismatch = null;
  }
```

- [ ] **Step 3：刷新 tests.html，C1-C3 应全绿**

### Task C4：Serialize / Restore / Reset

**Files:**
- Modify: `games/lianliankan/js/game.js`
- Modify: `games/lianliankan/tests/game.spec.js`

- [ ] **Step 1：追加测试**

```js
// ───── C4：serialize / restore / reset ─────
{
  const g = new Game('novice', () => 0.5);
  g.score = 50; g.combo = 3; g.elapsedMs = 12345; g.lastMatchAtMs = 12000;
  g.board.set(1, 1, 0);  // 改一下
  const snap = g.serialize();
  assertEq('snap version', snap.version, 1);
  assertEq('snap difficulty', snap.difficulty, 'novice');
  assertEq('snap rows', snap.rows, 6);
  assertEq('snap cols', snap.cols, 6);
  assertEq('snap score', snap.score, 50);
  assertEq('snap combo', snap.combo, 3);
  assertEq('snap elapsedMs', snap.elapsedMs, 12345);
  assertEq('snap boardData length', snap.boardData.length, 8 * 8);

  const g2 = new Game('novice', () => 0.5);
  const ok = g2.restore(snap);
  assertEq('restore ok', ok, true);
  assertEq('restore score', g2.score, 50);
  assertEq('restore combo', g2.combo, 3);
  assertEq('restore elapsedMs', g2.elapsedMs, 12345);
  assertEq('restore boardData', Array.from(g2.board.data), snap.boardData);
}

// restore 失败：version 不符
{
  const g = new Game('novice', () => 0.5);
  assertEq('restore null', g.restore(null), false);
  assertEq('restore version 99', g.restore({ version: 99 }), false);
}

// restore 失败：尺寸不符
{
  const g = new Game('novice', () => 0.5);
  const snap = g.serialize();
  snap.rows = 4;  // novice 应 6
  assertEq('restore rows 不符', g.restore(snap), false);
}

// reset 清状态
{
  const g = new Game('novice', () => 0.5);
  g.score = 50; g.combo = 3; g.elapsedMs = 12345; g.selection = { r: 1, c: 1 };
  g.reset();
  assertEq('reset score 0', g.score, 0);
  assertEq('reset combo 0', g.combo, 0);
  assertEq('reset elapsedMs 0', g.elapsedMs, 0);
  assertEq('reset selection null', g.selection, null);
  assertEq('reset countRemaining = innerCells', g.board.countRemaining(), 36);
}
```

- [ ] **Step 2：在 `game.js` 实现 `serialize` / `restore` / `reset`**

替换占位：

```js
  serialize() {
    return {
      version: 1,
      difficulty: this.difficulty,
      rows: this.board.rows,
      cols: this.board.cols,
      boardData: Array.from(this.data || this.board.data),
      flippedData: this.board.flipped ? Array.from(this.board.flipped) : null,
      score: this.score,
      combo: this.combo,
      elapsedMs: this.elapsedMs,
      lastMatchAtMs: this.lastMatchAtMs,
    };
  }

  restore(snap) {
    if (!snap || snap.version !== 1) return false;
    if (!DIFFICULTIES[snap.difficulty]) return false;
    const d = DIFFICULTIES[snap.difficulty];
    if (snap.rows !== d.rows || snap.cols !== d.cols) return false;
    const expectedLen = (d.rows + 2) * (d.cols + 2);
    if (!Array.isArray(snap.boardData) || snap.boardData.length !== expectedLen) return false;

    this.difficulty = snap.difficulty;
    this.memory = d.memory;
    this.timed = d.timed;
    this.board = new Board(snap.difficulty, this.rng);  // 重建以取尺寸
    for (let i = 0; i < snap.boardData.length; i++) this.board.data[i] = snap.boardData[i];
    if (this.board.flipped && Array.isArray(snap.flippedData)) {
      for (let i = 0; i < snap.flippedData.length; i++) this.board.flipped[i] = snap.flippedData[i];
    }
    this.score = snap.score | 0;
    this.combo = snap.combo | 0;
    this.elapsedMs = snap.elapsedMs | 0;
    this.lastMatchAtMs = snap.lastMatchAtMs | 0;
    this.selection = null;
    this.flippedFirst = null;
    this._pendingMismatch = null;
    this.dead = false;
    this.won = false;
    return true;
  }

  reset() {
    this.board = new Board(this.difficulty, this.rng);
    this.score = 0;
    this.combo = 0;
    this.elapsedMs = 0;
    this.lastMatchAtMs = -10000;
    this.selection = null;
    this.flippedFirst = null;
    this._pendingMismatch = null;
    this.dead = false;
    this.won = false;
    this.paused = false;
  }
```

- [ ] **Step 3：刷新 tests.html，C1-C4 应全绿**

### Task C5：提交 Phase C

- [ ] **Step 1：完整跑一次浏览器测试**

打开 `http://127.0.0.1:8765/games/lianliankan/tests.html`，确认全绿。

- [ ] **Step 2：提交**

```bash
git add games/lianliankan/js/game.js games/lianliankan/tests/game.spec.js
git commit -m "feat(lianliankan): Part 2b game.js + 单测（状态机 / combo / Memory / 序列化）"
```

---

## Phase D：render.js + input.js（DOM tiles + canvas overlay + 点击）

**目标：** 棋盘真正画到屏幕，能点击、能消除（无音效无粒子）。

### Task D1：render.js — DOM tiles mount

**Files:**
- Create: `games/lianliankan/js/render.js`

- [ ] **Step 1：写 `js/render.js`**

```js
// render.js — DOM 棋盘渲染 + canvas overlay
import { EMOJI_POOL } from './board.js';

export class Renderer {
  /**
   * @param {HTMLElement} boardEl - #board (CSS grid)
   * @param {HTMLCanvasElement} overlayEl - #overlay
   */
  constructor(boardEl, overlayEl) {
    this.boardEl = boardEl;
    this.overlayEl = overlayEl;
    this.ctx = overlayEl.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.tileEls = [];  // 1D index = r * (cols+2) + c；只用内部坐标
    this.game = null;
    this._overlayDrawables = [];  // {kind:'path', vertices, startMs, durMs} 之类
  }

  mount(game) {
    this.game = game;
    this.boardEl.innerHTML = '';
    const rows = game.board.rows, cols = game.board.cols;
    this.boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.boardEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    // aspect ratio
    const wrap = this.boardEl.parentElement;
    wrap.style.aspectRatio = `${cols} / ${rows}`;

    this.tileEls = new Array((rows + 2) * (cols + 2)).fill(null);
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const v = game.board.get(r, c);
        const tile = document.createElement('button');
        tile.className = 'tile';
        tile.dataset.r = String(r);
        tile.dataset.c = String(c);
        if (v === 0) {
          tile.classList.add('empty');
          tile.textContent = '';
        } else if (game.memory) {
          tile.classList.add('face-down');
        } else {
          tile.textContent = EMOJI_POOL[v - 1] || '?';
        }
        this.boardEl.appendChild(tile);
        this.tileEls[r * (cols + 2) + c] = tile;
      }
    }
    this._resizeOverlay();
    window.addEventListener('resize', () => this._resizeOverlay());
  }

  _resizeOverlay() {
    const rect = this.boardEl.getBoundingClientRect();
    this.overlayEl.width = rect.width * this.dpr;
    this.overlayEl.height = rect.height * this.dpr;
  }

  /** 高亮选中 */
  setSelection(r, c) {
    this.boardEl.querySelectorAll('.tile.selected').forEach((el) => el.classList.remove('selected'));
    if (r != null) {
      const el = this._tile(r, c);
      if (el) el.classList.add('selected');
    }
  }

  /** 标记一对为 hint 高亮（800ms 后由调度方移除） */
  applyHint(a, b) {
    [a, b].forEach((p) => {
      const el = this._tile(p.r, p.c);
      if (el) el.classList.add('hint');
    });
  }
  clearHint() {
    this.boardEl.querySelectorAll('.tile.hint').forEach((el) => el.classList.remove('hint'));
  }

  /** 闪红一格 */
  flashMiss(r, c) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.remove('miss');
    void el.offsetWidth;  // reflow
    el.classList.add('miss');
    setTimeout(() => el.classList.remove('miss'), 220);
  }

  /** 翻牌：背面 ↔ 正面 */
  setFaceUp(r, c, v) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.remove('face-down');
    el.textContent = EMOJI_POOL[v - 1] || '?';
  }
  setFaceDown(r, c) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.add('face-down');
    el.textContent = '';
  }

  /** 消除：250ms 后变 empty */
  clearTiles(a, b) {
    [a, b].forEach((p) => {
      const el = this._tile(p.r, p.c);
      if (!el) return;
      el.classList.add('clearing');
      setTimeout(() => {
        el.className = 'tile empty';
        el.textContent = '';
      }, 250);
    });
  }

  /** 整盘重排（reshuffle 后）— 简单粗暴重写所有 tile 的内容 */
  refreshAll() {
    if (!this.game) return;
    const rows = this.game.board.rows, cols = this.game.board.cols;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const el = this._tile(r, c);
        if (!el) continue;
        const v = this.game.board.get(r, c);
        if (v === 0) {
          el.className = 'tile empty'; el.textContent = '';
        } else if (this.game.memory && !this.game.board.isFlipped(r, c)) {
          el.className = 'tile face-down'; el.textContent = '';
        } else {
          el.className = 'tile'; el.textContent = EMOJI_POOL[v - 1] || '?';
        }
      }
    }
  }

  _tile(r, c) {
    if (!this.game) return null;
    return this.tileEls[r * (this.game.board.cols + 2) + c];
  }

  /** 在 overlay 画路径（顶点是格坐标 {r,c}，1-based） */
  drawPath(vertices, color, durMs = 400) {
    this._overlayDrawables.push({
      kind: 'path',
      vertices: vertices.slice(),
      color,
      startMs: performance.now(),
      durMs,
    });
  }

  /** rAF 调用：清 overlay 重画当前所有 drawables */
  step(nowMs) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.overlayEl.width, this.overlayEl.height);

    const rect = this.boardEl.getBoundingClientRect();
    const rows = this.game?.board.rows ?? 0, cols = this.game?.board.cols ?? 0;
    if (rows === 0 || cols === 0) return;
    const gap = 4;
    const cellW = (rect.width - gap * (cols - 1)) / cols;
    const cellH = (rect.height - gap * (rows - 1)) / rows;
    const pxPerCellX = (cellW + gap) * this.dpr;
    const pxPerCellY = (cellH + gap) * this.dpr;
    const tileCenter = (r, c) => ({
      x: (c - 1 + 0.5) * pxPerCellX,
      y: (r - 1 + 0.5) * pxPerCellY,
    });

    this._overlayDrawables = this._overlayDrawables.filter((d) => {
      const t = nowMs - d.startMs;
      if (t > d.durMs) return false;
      const alpha = 1 - t / d.durMs;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 8 * this.dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 20 * this.dpr;
      ctx.beginPath();
      d.vertices.forEach((v, i) => {
        const p = tileCenter(v.r, v.c);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }
}
```

### Task D2：input.js

**Files:**
- Create: `games/lianliankan/js/input.js`

- [ ] **Step 1：写 `js/input.js`**

```js
// input.js — pointerdown 命中 tile 转 (r, c) 事件
export class Input {
  /**
   * @param {HTMLElement} boardEl
   */
  constructor(boardEl) {
    this.boardEl = boardEl;
    this._cb = { tap: null, firstTouch: null };
    this._gotFirst = false;
    this._onPointerDown = this._onPointerDown.bind(this);
    boardEl.addEventListener('pointerdown', this._onPointerDown);
  }

  onTap(cb) { this._cb.tap = cb; }
  onFirstTouch(cb) { this._cb.firstTouch = cb; }

  _onPointerDown(e) {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (tile.classList.contains('empty')) return;
    if (tile.classList.contains('clearing')) return;
    const r = parseInt(tile.dataset.r, 10);
    const c = parseInt(tile.dataset.c, 10);
    if (!this._gotFirst) {
      this._gotFirst = true;
      this._cb.firstTouch && this._cb.firstTouch();
    }
    this._cb.tap && this._cb.tap(r, c);
  }
}
```

### Task D3：把 D1 / D2 接进 main.js（占位最小版）

**Files:**
- Modify: `games/lianliankan/js/main.js`

- [ ] **Step 1：替换 `js/main.js`**

```js
// main.js — 最小可玩版（无音效 / 无设置面板）
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

const boardEl = document.getElementById('board');
const overlayEl = document.getElementById('overlay');

const game = new Game('novice');
const renderer = new Renderer(boardEl, overlayEl);
renderer.mount(game);

const input = new Input(boardEl);
input.onTap((r, c) => {
  const result = game.tap(r, c);
  switch (result.kind) {
    case 'select':
      renderer.setSelection(r, c);
      break;
    case 'deselect':
      renderer.setSelection(null);
      break;
    case 'match':
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      if (result.shuffled) {
        setTimeout(() => renderer.refreshAll(), 300);
      }
      break;
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.setSelection(result.current.r, result.current.c);
      break;
    case 'win':
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      setTimeout(() => alert('🏆 通关！'), 600);
      break;
  }
});

// rAF 驱动 overlay
function loop(now) {
  renderer.step(now);
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
```

- [ ] **Step 2：浏览器手测**

打开 `http://127.0.0.1:8765/games/lianliankan/`：
- 6×6 棋盘出现 36 个 emoji tile
- 点一个 → 描边变色 + scale 放大
- 再点同一个 → 取消
- 点另一个相同的 emoji（路径能连）→ 路径线短暂闪过 + 两 tile 淡出 + 消失
- 点不同 → 闪红 + 第二个变 selected
- 全消 → 弹 alert "🏆 通关！"

如有问题：F12 看控制台 + 检查 board.js / game.js / render.js 串联。

- [ ] **Step 3：提交 Part 3a**

```bash
git add games/lianliankan/js/
git commit -m "feat(lianliankan): Part 3a 渲染 + 输入（DOM tiles + canvas overlay + 点击消除）"
```

### Task D4：手测 4 档难度切换（手工切 main.js）

- [ ] **Step 1：临时改 main.js 第 N 行**

```js
const game = new Game('beginner');  // 试 4×4 翻牌
```

刷新页面，应看到 4×4 全 ❓ 背面。点 → 翻开。点对了消除，错了 600ms 后翻回（注意：还没接 resolveMemoryMismatch，下一步加）。

- [ ] **Step 2：给 main.js 加 mismatch 翻回处理**

在 `case 'mismatch':` 分支替换为：

```js
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.flashMiss(result.current.r, result.current.c);
      if (game.memory) {
        // 等 600ms 翻回
        setTimeout(() => {
          game.resolveMemoryMismatch();
          renderer.setFaceDown(result.prev.r, result.prev.c);
          renderer.setFaceDown(result.current.r, result.current.c);
        }, 600);
      } else {
        renderer.setSelection(result.current.r, result.current.c);
      }
      break;
```

并在 `case 'flip':` 之前加：

```js
    case 'flip':
      renderer.setFaceUp(result.cell.r, result.cell.c, game.board.get(result.cell.r, result.cell.c));
      break;
```

- [ ] **Step 3：刷新页面，试 beginner / novice / advanced / master 4 档手切**

每档都应：
- 棋盘尺寸 / aspect-ratio 正确
- 能点能消
- novice 满 36 格，advanced 80 格，master 120 格

测完把 main.js 的 difficulty 改回 'novice' 作为默认。

---

## Phase E：effects.js + audio.js（粒子 + 音效）

### Task E1：effects.js

**Files:**
- Create: `games/lianliankan/js/effects.js`

- [ ] **Step 1：写 `js/effects.js`**

```js
// effects.js — 粒子 + fxLevel 联动
export class Effects {
  constructor() {
    this.particles = [];
    this.intensity = 1.0;  // 1.0=strong, 0.4=mild, 0=off
  }

  setIntensity(v) { this.intensity = v; }

  /** 在某像素坐标 spawn 一批粒子 */
  spawnBurst(x, y, colors, count = 8) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * (this.intensity >= 1 ? 1 : 0.5)));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600,
        maxLife: 600,
        color: colors[i % colors.length],
        size: 4 + Math.random() * 4,
      });
    }
  }

  /** 全屏胜利彩屑（在 boardWidth 上喷） */
  spawnCelebrate(boardWidth, boardHeight) {
    if (this.intensity === 0) return;
    const colors = ['#ff7043','#ffeb3b','#4caf50','#42a5f5','#9c27b0','#f44336'];
    const n = Math.round(40 * (this.intensity >= 1 ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * boardWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 100,
        vy: 80 + Math.random() * 120,
        life: 1500,
        maxLife: 1500,
        color: colors[i % colors.length],
        size: 6 + Math.random() * 6,
      });
    }
  }

  step(dt) {
    const dtSec = dt / 1000;
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 240 * dtSec;  // 重力
      p.life -= dt;
      return p.life > 0;
    });
  }

  draw(ctx, dpr) {
    if (this.intensity === 0) return;
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
```

- [ ] **Step 2：把 Effects 接进 Renderer**

修改 `js/render.js`，构造函数加参数：

```js
  constructor(boardEl, overlayEl, effects) {
    // ... 原有
    this.effects = effects;
  }
```

`step(nowMs)` 末尾加：

```js
    // 粒子
    if (this.effects) {
      this.effects.draw(this.ctx, this.dpr);
    }
```

> 注意 effects 自己的 step(dt) 由 main.js 在主循环里调，而不是 renderer.step。

- [ ] **Step 3：把 Effects + spawn 接到 main.js**

修改 main.js：

```js
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Effects } from './effects.js';

const boardEl = document.getElementById('board');
const overlayEl = document.getElementById('overlay');

const effects = new Effects();
const game = new Game('novice');
const renderer = new Renderer(boardEl, overlayEl, effects);
renderer.mount(game);

// ... input / onTap 同上

// match 分支加粒子
function spawnMatchBurst(a, b) {
  const rect = boardEl.getBoundingClientRect();
  const cellW = rect.width / game.board.cols;
  const cellH = rect.height / game.board.rows;
  const ax = (a.c - 0.5) * cellW;
  const ay = (a.r - 0.5) * cellH;
  const bx = (b.c - 0.5) * cellW;
  const by = (b.r - 0.5) * cellH;
  const colors = ['#ffeb3b','#ff9800','#4caf50','#f44336'];
  effects.spawnBurst(ax, ay, colors, 8);
  effects.spawnBurst(bx, by, colors, 8);
}

// 在 case 'match' 里调 spawnMatchBurst(result.a, result.b);
// 在 case 'win' 里调 effects.spawnCelebrate(rect.width, rect.height);
```

完整 main.js 改动放进 Phase F 一并改，先验证 effects 框架不报错。

- [ ] **Step 4：手测：消一对应看到粒子飞出**

### Task E2：audio.js

**Files:**
- Create: `games/lianliankan/js/audio.js`

- [ ] **Step 1：写 `js/audio.js`**

```js
// audio.js — 连连看音效（extends AudioEngine）
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = false;  // 连连看 v1 暂不做 BGM
  }
  setBgmOn(on) { this.bgmOn = on; }
  startBgm() {}
  stopBgm() {}

  playSelect() {
    this.playTone({ freq: 880, type: 'sine', duration: 70, gain: 0.18 });
  }
  playMatch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.scheduleNote(659, t,         100, 0.3, 'sine');
    this.scheduleNote(784, t + 0.05,  100, 0.3, 'sine');
    this.scheduleNote(988, t + 0.10,  140, 0.3, 'sine');
  }
  playMiss() {
    this.playThump({ fromFreq: 220, toFreq: 90, duration: 160, gain: 0.4 });
  }
  playCombo() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.scheduleNote(523, t,        80, 0.35, 'triangle');
    this.scheduleNote(659, t + 0.06, 80, 0.35, 'triangle');
    this.scheduleNote(784, t + 0.12, 80, 0.35, 'triangle');
    this.scheduleNote(1046, t + 0.18, 160, 0.4, 'triangle');
  }
  playHint() {
    this.playTone({ freq: 1320, type: 'sine', duration: 120, gain: 0.25 });
  }
  playShuffle() {
    this.playNoiseSweep({ fromFreq: 1500, toFreq: 300, duration: 350, gain: 0.3 });
  }
  playWin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melody = [523, 659, 784, 1046, 1318];
    melody.forEach((f, i) => this.scheduleNote(f, t + i * 0.10, 200, 0.4, 'square'));
  }
}
```

- [ ] **Step 2：试听**

main.js 临时加：

```js
import { Audio } from './audio.js';
const audio = new Audio();
// input.onFirstTouch(() => audio.unlock());
// 在 case 'match' 加 audio.playMatch()，'mismatch' 加 audio.playMiss() 等
```

刷新，点 → 应能听到音效（第一次手势后才解锁，可能要点空白处一次）。

- [ ] **Step 3：提交 Part 3b**

```bash
git add games/lianliankan/js/effects.js games/lianliankan/js/audio.js games/lianliankan/js/render.js games/lianliankan/js/main.js
git commit -m "feat(lianliankan): Part 3b 粒子 + 音效"
```

---

## Phase F：settings.js + main.js（整线 + 面板逻辑）

### Task F1：settings.js

**Files:**
- Create: `games/lianliankan/js/settings.js`

- [ ] **Step 1：写 `js/settings.js`**

```js
// settings.js — 设置面板 + lianliankan.settings + 最高分
import { GlobalSettings } from '../../../shared/global-settings.js';
import { DIFFICULTIES } from './board.js';

const KEY = 'lianliankan.settings';
const KEY_HIGH = 'lianliankan.highScore';

const DEFAULTS = {
  difficulty: 'novice',
  timed: false,
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };

export class Settings {
  constructor(game, audio, effects, callbacks = {}) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS };
    this.highScore = { beginner:{bestScore:0,fastestMs:0}, novice:{bestScore:0,fastestMs:0},
                       advanced:{bestScore:0,fastestMs:0}, master:{bestScore:0,fastestMs:0} };
    this._cb = callbacks;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      const rawHi = localStorage.getItem(KEY_HIGH);
      if (rawHi) this.highScore = { ...this.highScore, ...JSON.parse(rawHi) };
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, JSON.stringify(this.highScore));
    } catch (e) {}
  }

  get(key) {
    // 全局字段走 GlobalSettings
    if (['theme','sfxOn','bgmOn','fxLevel'].includes(key)) return GlobalSettings.get(key);
    if (key === 'highScore') return this.highScore;
    return this.state[key];
  }

  set(key, value) {
    if (['theme','sfxOn','bgmOn','fxLevel'].includes(key)) {
      GlobalSettings.set(key, value);
    } else {
      this.state[key] = value;
      this.save();
    }
    this.apply();
  }

  apply() {
    this.audio.setSfxOn(GlobalSettings.get('sfxOn'));
    this.effects.setIntensity(FX_INTENSITY[GlobalSettings.get('fxLevel')] ?? 1.0);
    document.body.dataset.theme = GlobalSettings.get('theme');
    // 同步 PWA 状态栏
    const bg2 = getComputedStyle(document.body).getPropertyValue('--bg-2').trim();
    if (bg2) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg2);
    this._syncUi();
  }

  recordHighScore(difficulty, score, elapsedMs) {
    const cur = this.highScore[difficulty] || { bestScore: 0, fastestMs: 0 };
    let changed = false;
    if (score > cur.bestScore) { cur.bestScore = score; changed = true; }
    if (cur.fastestMs === 0 || elapsedMs < cur.fastestMs) {
      cur.fastestMs = elapsedMs; changed = true;
    }
    this.highScore[difficulty] = cur;
    if (changed) this.save();
    return changed;
  }

  _syncUi() {
    // 难度 seg
    for (const btn of document.querySelectorAll('#difficulty-seg button')) {
      btn.classList.toggle('active', btn.dataset.val === this.state.difficulty);
    }
    // timed toggle 仅在 advanced / master 显示；master 强制 timed=true 且禁用切换
    const timedRow = document.getElementById('timed-row');
    const showTimed = this.state.difficulty === 'advanced' || this.state.difficulty === 'master';
    if (timedRow) timedRow.style.display = showTimed ? '' : 'none';
    const timedBtn = document.getElementById('timed-toggle');
    if (timedBtn) {
      const isMaster = this.state.difficulty === 'master';
      const on = isMaster ? true : !!this.state.timed;
      timedBtn.classList.toggle('active', on);
      timedBtn.textContent = on ? '⏱' : '⏱️ 关';
      timedBtn.disabled = isMaster;
    }
  }

  bindUi() {
    document.getElementById('difficulty-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn?.dataset.val) return;
      const prev = this.state.difficulty;
      if (prev === btn.dataset.val) return;
      // 切难度 → 弹确认
      const confirmEl = document.getElementById('restart-confirm');
      this._cb.onDifficultyChange?.(btn.dataset.val);
    });
    document.getElementById('timed-toggle')?.addEventListener('click', () => {
      this.set('timed', !this.state.timed);
    });
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      this._cb.onRestart?.();
    });
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      document.getElementById('settings-panel').classList.remove('hidden');
      this._cb.onOpen?.();
      this._syncUi();
    });
    document.getElementById('settings-close')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('help-btn')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.remove('hidden');
      this._cb.onHelpOpen?.();
    });
    document.getElementById('help-close')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.add('hidden');
      this._cb.onHelpClose?.();
    });
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this._cb.onClose?.();
  }
}
```

### Task F2：完整 main.js（接所有线）

**Files:**
- Modify: `games/lianliankan/js/main.js`

- [ ] **Step 1：替换为完整版**

```js
// main.js — 完整入口：游戏 + 渲染 + 输入 + 效果 + 音频 + 设置 + 面板 + 续玩 + 引导
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';
import { GlobalSettings } from '../../../shared/global-settings.js';
import { DIFFICULTIES, EMOJI_POOL } from './board.js';

const boardEl    = document.getElementById('board');
const overlayEl  = document.getElementById('overlay');
const scoreEl    = document.getElementById('score');
const comboEl    = document.getElementById('combo');
const comboBlock = document.getElementById('combo-block');
const timerEl    = document.getElementById('timer');
const timerBlock = document.getElementById('timer-block');

const effects = new Effects();
const audio = new Audio();
let game = new Game(loadInitialDifficulty());
const renderer = new Renderer(boardEl, overlayEl, effects);
renderer.mount(game);

const settings = new Settings(game, audio, effects, {
  onOpen: () => acquirePause('settings'),
  onClose: () => releasePause('settings'),
  onHelpOpen: () => acquirePause('help'),
  onHelpClose: () => releasePause('help'),
  onRestart: askRestart,
  onDifficultyChange: askDifficultyChange,
});
settings.load();
settings.apply();
settings.bindUi();

// 暂停理由计数
const pauseReasons = new Set();
function acquirePause(reason) {
  const wasEmpty = pauseReasons.size === 0;
  pauseReasons.add(reason);
  if (wasEmpty) game.setPaused(true);
}
function releasePause(reason) {
  if (!pauseReasons.has(reason)) return;
  pauseReasons.delete(reason);
  if (pauseReasons.size === 0) game.setPaused(false);
}

// 续玩
const SAVE_KEY = 'lianliankan.saveGame';
const TUTORIAL_KEY = 'lianliankan.tutorialSeen';
let resumePending = false;

function loadInitialDifficulty() {
  try {
    const raw = localStorage.getItem('lianliankan.settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (DIFFICULTIES[s.difficulty]) return s.difficulty;
    }
  } catch (e) {}
  return 'novice';
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persistSave() {
  if (resumePending) return;
  try {
    if (game.dead || game.won) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

const savedSnap = loadSave();
if (savedSnap) {
  resumePending = true;
  acquirePause('resume');
  document.getElementById('resume-popup').classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('click', () => {
    if (game.restore(savedSnap)) {
      renderer.mount(game);
    } else {
      clearSave();
    }
    resumePending = false;
    document.getElementById('resume-popup').classList.add('hidden');
    releasePause('resume');
  });
  document.getElementById('resume-discard').addEventListener('click', () => {
    clearSave();
    resumePending = false;
    document.getElementById('resume-popup').classList.add('hidden');
    releasePause('resume');
  });
} else {
  maybeShowTutorial();
}

function maybeShowTutorial() {
  try {
    if (localStorage.getItem(TUTORIAL_KEY) === '1') return;
  } catch (e) { return; }
  const p = document.getElementById('tutorial-popup');
  if (!p) return;
  p.classList.remove('hidden');
  acquirePause('tutorial');
  document.getElementById('tutorial-ok').addEventListener('click', () => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
    p.classList.add('hidden');
    releasePause('tutorial');
  }, { once: true });
}

window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);

// 输入
const input = new Input(boardEl);
input.onFirstTouch(() => audio.unlock());
input.onTap((r, c) => {
  if (resumePending) return;
  const result = game.tap(r, c);
  handleTapResult(result);
});

function handleTapResult(result) {
  switch (result.kind) {
    case 'select':
      renderer.setSelection(result.cell?.r ?? game.selection.r, result.cell?.c ?? game.selection.c);
      audio.playSelect();
      vibrate([5]);
      break;
    case 'deselect':
      renderer.setSelection(null);
      break;
    case 'flip':
      renderer.setFaceUp(result.cell.r, result.cell.c, game.board.get(result.cell.r, result.cell.c));
      audio.playSelect();
      vibrate([5]);
      break;
    case 'match':
      renderer.setSelection(null);
      if (result.path) {
        const color = getThemeColor();
        renderer.drawPath(result.path, color, 350);
      }
      audio.playMatch();
      vibrate([15]);
      spawnMatchBurst(result.a, result.b);
      renderer.clearTiles(result.a, result.b);
      if (game.combo >= 2) {
        showToast('🔥' + game.combo + '连');
        audio.playCombo();
      }
      if (result.shuffled) {
        setTimeout(() => {
          renderer.refreshAll();
          showToast('🔀 自动洗牌');
          audio.playShuffle();
        }, 320);
      }
      break;
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.flashMiss(result.current.r, result.current.c);
      audio.playMiss();
      vibrate([30]);
      if (game.memory) {
        setTimeout(() => {
          game.resolveMemoryMismatch();
          renderer.setFaceDown(result.prev.r, result.prev.c);
          renderer.setFaceDown(result.current.r, result.current.c);
        }, 600);
      } else {
        renderer.setSelection(result.current.r, result.current.c);
      }
      break;
    case 'win':
      renderer.setSelection(null);
      if (result.path) {
        const color = getThemeColor();
        renderer.drawPath(result.path, color, 350);
      }
      spawnMatchBurst(result.a, result.b);
      renderer.clearTiles(result.a, result.b);
      audio.playWin();
      vibrate([100, 50, 100, 50, 200]);
      setTimeout(() => {
        const rect = boardEl.getBoundingClientRect();
        effects.spawnCelebrate(rect.width, rect.height);
        showWinPanel();
      }, 500);
      break;
  }
  scoreEl.textContent = String(game.score);
  syncComboUi();
}

function getThemeColor() {
  return getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ff7043';
}

function spawnMatchBurst(a, b) {
  const rect = boardEl.getBoundingClientRect();
  const cellW = rect.width / game.board.cols;
  const cellH = rect.height / game.board.rows;
  const ax = (a.c - 0.5) * cellW;
  const ay = (a.r - 0.5) * cellH;
  const bx = (b.c - 0.5) * cellW;
  const by = (b.r - 0.5) * cellH;
  const colors = ['#ffeb3b','#ff9800','#4caf50','#f44336'];
  effects.spawnBurst(ax, ay, colors, 8);
  effects.spawnBurst(bx, by, colors, 8);
}

function syncComboUi() {
  if (game.combo >= 2) {
    comboBlock.classList.remove('hidden');
    comboEl.textContent = String(game.combo);
  } else {
    comboBlock.classList.add('hidden');
  }
}

function syncTimerUi() {
  if (!game.timed && game.difficulty !== 'master' && !settings.get('timed')) {
    timerBlock.classList.add('hidden');
    return;
  }
  timerBlock.classList.remove('hidden');
  const sec = Math.max(0, Math.floor(game.elapsedMs / 1000));
  const min = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  timerEl.textContent = `${min}:${ss}`;
}

// 提示 / 洗牌
document.getElementById('hint-btn').addEventListener('click', () => {
  if (game.memory) return;  // 入门档不显示但兜底
  audio.unlock();
  const sol = game.useHint();
  if (sol) {
    audio.playHint();
    renderer.clearHint();
    renderer.applyHint(sol.a, sol.b);
    setTimeout(() => renderer.clearHint(), 800);
  }
});
document.getElementById('shuffle-btn').addEventListener('click', () => {
  if (game.memory) return;
  audio.unlock();
  const ok = game.forceShuffle();
  if (ok) {
    audio.playShuffle();
    renderer.refreshAll();
    showToast('🔀');
    vibrate([50]);
  }
});

// 入门档隐藏底栏按钮
function syncBottomBar() {
  document.getElementById('hint-btn').classList.toggle('hidden', game.memory);
  document.getElementById('shuffle-btn').classList.toggle('hidden', game.memory);
}
syncBottomBar();

// 暂停按钮 + overlay
let manualPause = false;
const pauseOverlay = document.getElementById('pause-overlay');
function setManualPause(p) {
  manualPause = !!p;
  pauseOverlay.classList.toggle('hidden', !manualPause);
  if (manualPause) acquirePause('manual'); else releasePause('manual');
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

// 重启确认
function askRestart() {
  document.getElementById('restart-confirm').classList.remove('hidden');
  document.getElementById('restart-cancel').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
  };
  document.getElementById('restart-ok').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
    settings.close();
    restartGame(settings.state.difficulty);
  };
}
function askDifficultyChange(newDiff) {
  document.getElementById('restart-confirm').classList.remove('hidden');
  document.getElementById('restart-cancel').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
    settings._syncUi();
  };
  document.getElementById('restart-ok').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
    settings.state.difficulty = newDiff;
    settings.save();
    restartGame(newDiff);
  };
}

function restartGame(difficulty) {
  game = new Game(difficulty);
  game.timed = settings.state.timed || DIFFICULTIES[difficulty].timed;
  renderer.mount(game);
  syncBottomBar();
  syncComboUi();
  syncTimerUi();
  scoreEl.textContent = '0';
  clearSave();
}

// gameover
function showWinPanel() {
  acquirePause('gameover');
  const panel = document.getElementById('gameover-panel');
  document.getElementById('gameover-emoji').textContent = '🏆';
  document.getElementById('final-score').textContent = String(game.score);
  const sec = Math.max(0, Math.floor(game.elapsedMs / 1000));
  const min = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  document.getElementById('final-time').textContent = `${min}:${ss}`;
  document.getElementById('final-time-row').style.display = '';
  settings.recordHighScore(game.difficulty, game.score, game.elapsedMs);
  panel.classList.remove('hidden');
  const share = document.getElementById('share-btn');
  if (navigator.share) share.classList.remove('hidden'); else share.classList.add('hidden');
}
function showLosePanel() {
  acquirePause('gameover');
  const panel = document.getElementById('gameover-panel');
  document.getElementById('gameover-emoji').textContent = '⏰';
  document.getElementById('final-score').textContent = String(game.score);
  document.getElementById('final-time-row').style.display = 'none';
  panel.classList.remove('hidden');
}
game.onLose && game.onLose(showLosePanel);

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  releasePause('gameover');
  restartGame(game.difficulty);
});
document.getElementById('share-btn').addEventListener('click', async () => {
  const text = `🎯 我在连连看（${diffLabel(game.difficulty)}）通关，用时 ${formatTime(game.elapsedMs)}！`;
  try {
    await navigator.share({ title: '连连看', text, url: location.href });
  } catch (e) {
    try {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast('📋');
    } catch (err) {}
  }
});
function diffLabel(d) {
  return { beginner:'🌱 入门', novice:'⭐ 初级', advanced:'🔥 进阶', master:'💎 高手' }[d] || d;
}
function formatTime(ms) {
  const sec = Math.max(0, Math.floor(ms/1000));
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

// 主循环
let last = performance.now();
function loop(now) {
  const dt = now - last;
  last = now;
  game.step(dt);
  effects.step(dt);
  renderer.step(now);
  syncTimerUi();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 切后台 → 暂停 + 存盘
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    acquirePause('visibility');
    persistSave();
  } else {
    releasePause('visibility');
  }
});

// 键盘快捷键（桌面）
window.addEventListener('keydown', (e) => {
  if ((e.target.tagName || '').toLowerCase() === 'input') return;
  if (e.key === 'Escape') {
    const s = document.getElementById('settings-panel');
    const h = document.getElementById('help-panel');
    const rc = document.getElementById('restart-confirm');
    if (!rc.classList.contains('hidden')) { rc.classList.add('hidden'); return; }
    if (!s.classList.contains('hidden')) { settings.close(); return; }
    if (!h.classList.contains('hidden')) { h.classList.add('hidden'); releasePause('help'); return; }
  } else if (e.key === 'p' || e.key === 'P') {
    const open = !document.getElementById('settings-panel').classList.contains('hidden')
              || !document.getElementById('help-panel').classList.contains('hidden')
              || !document.getElementById('gameover-panel').classList.contains('hidden');
    if (!open) setManualPause(!manualPause);
  }
});

// toast 工具
let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('clear-toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1000);
}

function vibrate(pattern) {
  if (GlobalSettings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

// PWA
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

- [ ] **Step 2：浏览器全功能手测**

- 开局 novice 6×6，能点能消
- 主菜单（首页）改主题 → 进游戏应自动用对应主题
- ⚙ 进设置 → 切难度 → 弹确认 → 棋盘变 4×4 / 6×6 / 8×10 / 10×12
- ? 帮助面板能开关
- 💡 提示按钮高亮一对（800ms 后消）
- 🔀 洗牌按钮重排
- 配对成功有路径线 + 粒子 + 音效
- 全清 → win 面板 + 彩屑 + 分享按钮（如浏览器支持）
- 切后台 → 切回 → 应保持位置和分数
- 关页 → 刷新 → 弹"📋 上次玩到一半"

- [ ] **Step 3：提交 Part 4**

```bash
git add games/lianliankan/js/settings.js games/lianliankan/js/main.js
git commit -m "feat(lianliankan): Part 4 设置 / 面板 / 续玩 / 引导 / win-share 完整"
```

---

## Phase G：接入仓库

### Task G1：首页 games 数组

**Files:**
- Modify: `index.html`

- [ ] **Step 1：在根 `index.html` 的 `games` 数组里加连连看**

找到约第 301-305 行：

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
  { title: "打砖块",     desc: "弹球连击打砖，无尽模式越打越快", emoji: "🏓", path: "games/breakout/", highScoreKey: "breakout.highScore" },
  { title: "贪吃蛇",     desc: "滑动转向，吃越多越长", emoji: "🐍", path: "games/snake/", highScoreKey: "snake.highScore" },
];
```

改为：

```js
const games = [
  { title: "俄罗斯方块", desc: "经典玩法，单指移动 + 双指旋转", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
  { title: "打砖块",     desc: "弹球连击打砖，无尽模式越打越快", emoji: "🏓", path: "games/breakout/", highScoreKey: "breakout.highScore" },
  { title: "贪吃蛇",     desc: "滑动转向，吃越多越长", emoji: "🐍", path: "games/snake/", highScoreKey: "snake.highScore" },
  { title: "连连看",     desc: "点 2 张相同图案连接消除，4 档难度", emoji: "🀄", path: "games/lianliankan/", highScoreKey: "lianliankan.highScore" },
];
```

> **Note:** 首页 `readHighScore` 读 `parseInt`，但连连看的 `lianliankan.highScore` 存的是嵌套对象。需要主页适配，或我们让连连看额外存一个标量 key 给首页用。

- [ ] **Step 2：在 `settings.js` 的 `recordHighScore` 末尾追加，写一个汇总标量**

打开 `games/lianliankan/js/settings.js`，在 `recordHighScore` 方法末尾（返回 `changed` 之前）插入：

```js
    // 给首页卡片用：所有档的 bestScore 之最大值（标量）
    try {
      let max = 0;
      for (const d of Object.keys(this.highScore)) {
        if (this.highScore[d].bestScore > max) max = this.highScore[d].bestScore;
      }
      localStorage.setItem('lianliankan.highScore.scalar', String(max));
    } catch (e) {}
```

并把首页 `highScoreKey` 改为 `"lianliankan.highScore.scalar"`：

```js
  { title: "连连看", desc: "...", emoji: "🀄", path: "games/lianliankan/", highScoreKey: "lianliankan.highScore.scalar" },
```

### Task G2：CI tests/run-tests.mjs

**Files:**
- Modify: `tests/run-tests.mjs`

- [ ] **Step 1：在 `tests/run-tests.mjs` 顶部 import 区加**

```js
import { Board, DIFFICULTIES, EMOJI_POOL } from '../games/lianliankan/js/board.js';
import { Game as LianGame } from '../games/lianliankan/js/game.js';
```

- [ ] **Step 2：在 `// ───── result ─────` 块之前加连连看断言**

```js
// ───── lianliankan ─────
eq('lian DIFFICULTIES 4 档', Object.keys(DIFFICULTIES).sort(), ['advanced','beginner','master','novice']);
truthy('lian EMOJI_POOL ≥ 30', EMOJI_POOL.length >= 30);

// Board 生成
{
  const b = new Board('novice');
  eq('lian novice cells', b.countRemaining(), 36);
  // 直方图全偶数
  const hist = {};
  for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) {
    const v = b.get(r, c); if (v) hist[v] = (hist[v] || 0) + 1;
  }
  let allEven = true;
  for (const k of Object.keys(hist)) if (hist[k] % 2 !== 0) { allEven = false; break; }
  truthy('lian novice 直方图全偶', allEven);
  truthy('lian novice 初始有解', b.hasAnySolvable() !== null);
}

// findPath 同行
{
  const b = Object.create(Board.prototype);
  b.rows = 2; b.cols = 4;
  b.data = new Int8Array(4 * 6);
  b.memory = false; b.flipped = null;
  b.set(1, 1, 5); b.set(1, 4, 5);
  const p = b.findPath({r:1,c:1}, {r:1,c:4});
  truthy('lian findPath 同行', p !== null);
}

// Game 状态机
{
  const g = new LianGame('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.tap(1, 1);
  const r = g.tap(1, 3);
  eq('lian match', r.kind, 'match');
  eq('lian score 10', g.score, 10);
  eq('lian combo 1', g.combo, 1);
}

// combo 时间窗口
{
  const g = new LianGame('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);
  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  g.elapsedMs = 2500;
  g.tap(2, 1); g.tap(2, 3);
  eq('lian combo 2', g.combo, 2);
  eq('lian score 25', g.score, 25);
}

// serialize / restore
{
  const g = new LianGame('novice', () => 0.5);
  g.score = 50;
  const snap = g.serialize();
  eq('lian snap version', snap.version, 1);
  const g2 = new LianGame('novice', () => 0.5);
  eq('lian restore ok', g2.restore(snap), true);
  eq('lian restore score', g2.score, 50);
  eq('lian restore reject null', g2.restore(null), false);
  eq('lian restore reject wrong version', g2.restore({version:99}), false);
}

// Memory 模式
{
  const g = new LianGame('beginner', () => 0.5);
  truthy('lian beginner memory', g.memory === true);
  truthy('lian beginner has flipped', g.board.flipped !== null);
}
```

- [ ] **Step 2：跑 Node 测试**

```bash
node tests/run-tests.mjs
```

预期：底部 `N passed, 0 failed`。如失败，按错信定位修。

- [ ] **Step 3：跑 node --check**

```bash
node --check games/lianliankan/js/board.js
node --check games/lianliankan/js/game.js
node --check games/lianliankan/js/render.js
node --check games/lianliankan/js/effects.js
node --check games/lianliankan/js/audio.js
node --check games/lianliankan/js/input.js
node --check games/lianliankan/js/settings.js
node --check games/lianliankan/js/main.js
```

每条都应静默退出（0）。

### Task G3：提交 Phase G

```bash
git add index.html tests/run-tests.mjs games/lianliankan/js/settings.js
git commit -m "feat(lianliankan): Part 5a 接入首页 + CI 测试"
```

---

## Phase H：最终验收 + 真机 + 离线

### Task H1：本地全功能手测清单

打开 `http://127.0.0.1:8765/`：

- [ ] 首页：连连看卡片可见、点进入正常
- [ ] 入门档 4×4 翻牌：点 → 翻开 → 翻对消除 / 翻错 600ms 翻回；底栏 💡/🔀 隐藏
- [ ] 初级 6×6 连线：点 → 选中 → 点同 emoji → 连线 + 粒子 + 淡出；提示 / 洗牌可用
- [ ] 进阶 8×10：⚙ → 切难度 → 弹确认；切后棋盘变 8×10
- [ ] 高手 10×12：默认计时 5 分钟；顶栏 ⏱ 显示
- [ ] combo：2.5s 内连消两对 → 顶栏 🔥 出现 + toast `🔥2连`
- [ ] 6 主题：去主菜单 ⚙️ 切主题 → 回连连看应自动用对应主题色
- [ ] fxLevel：主菜单切 mild / off → 粒子 / 路径线相应减弱 / 消失
- [ ] 音效：sfxOn 关 → 无声
- [ ] 续玩：玩到一半关页 → 重开 → 弹"📋 继续吗"
- [ ] 暂停：⏸ → overlay 出现 → 点 / P → 继续
- [ ] 切后台：手机切其它 app → 切回 → 时间不增、状态保持
- [ ] 横竖屏：旋转设备 → 棋盘 aspect 正确（10×12 横屏更舒服）
- [ ] 安全区：iPhone 模拟器底部 home indicator 不挡 ⏰ / 底栏

### Task H2：离线手测

DevTools → Network → Throttling → Offline → 刷新页面 → 应仍能进入连连看并完整可玩。

### Task H3：真机

- [ ] iPhone Safari：触屏点 / 设置 / 添加到主屏；从主屏启动应全屏无地址栏
- [ ] Android Chrome：同上

### Task H4：CI 准备

```bash
git status
# 应只剩"待提交"= 无（之前已分段 commit）
git log --oneline -5
# 应看到 5 个连连看相关 commit + 之前的 spec commit
git push
gh run watch  # 看 CI 是否绿
```

### Task H5：写收尾 commit + docs 更新

- [ ] **Step 1：可选——在 `docs/architecture.md` 第 49 行 `games/` 子目录树里追加 `└── lianliankan/`**

打开 `docs/architecture.md` 找到 `games/` 块（约 47 行），在 `tetris/` 后追加一行（保持目录形态）。

- [ ] **Step 2：commit 文档**

```bash
git add docs/architecture.md
git commit -m "docs(lianliankan): architecture.md 加进 games/ 子目录树"
```

- [ ] **Step 3：发布**

```bash
git push
```

等 CI 绿 → GitHub Pages 自动部署 → 真机最终验证 → done。

---

## 完成自检清单

发布前过一遍（参考 `docs/adding-a-new-game.md §12`）：

```
[ ] 界面 100% 简体中文，emoji 优先
[ ] 触屏完整可玩（不需要键盘 / 鼠标）
[ ] 所有按钮 ≥ 44×44
[ ] iPhone 刘海 / 底部 home indicator 不挡 UI
[ ] 离线模式（DevTools Offline）能完整玩
[ ] iOS Safari AudioContext 首次触摸才创建
[ ] localStorage 不可用时游戏仍能玩（默认值兜底）
[ ] 主题切换无需刷新页面立即生效（注：主题在主菜单切，回游戏会自动应用）
[ ] 断线续玩不会被切后台覆盖（resumePending 守卫）
[ ] 4 档难度切换都正常
[ ] 计时模式超时正确触发 lose 面板
[ ] 提示 / 洗牌按钮在入门档隐藏
[ ] node tests/run-tests.mjs 全绿
[ ] CI 跑过
[ ] 真机 iOS + Android 至少各试 1 局
```
