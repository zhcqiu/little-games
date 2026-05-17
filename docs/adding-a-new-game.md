# 添加一款新游戏

从零做一款新游戏的实操流程。先读 [docs/architecture.md](./architecture.md) 知道仓库约束。

## TL;DR Checklist

每款新游戏要走完这些步骤：

```
设计阶段
[ ] 用 superpowers:brainstorming skill 跟用户对齐需求 → 输出 spec.md
[ ] 用 superpowers:writing-plans skill 把 spec 拆成可执行 plan
[ ] 在 docs/superpowers/specs/ 和 plans/ 各落一份

实现阶段
[ ] mkdir games/<name>/  + games/<name>/js/
[ ] 写 index.html 骨架（参考下面模板）
[ ] 写 style.css（参考 Tetris 的 CSS variables + 主题）
[ ] 写 manifest.json + icon.svg
[ ] 写游戏 JS 模块（game / render / audio / settings 等）
[ ] 用 /shared/ 工具（gesture-input, audio-engine）

接入仓库
[ ] 把游戏卡加进首页 index.html 的 games 数组（带 highScoreKey）
[ ] 把纯函数测试 import 进 tests/run-tests.mjs
[ ] 改 sw.js 的 CACHE_NAME（bump 版本）

上线验证
[ ] node tests/run-tests.mjs 本地全绿
[ ] python -m http.server 本地浏览器手测
[ ] git push → 等 CI 绿 → Pages 部署
[ ] 在线 + 离线（DevTools → Offline）都能玩
[ ] 真机至少 iOS Safari + Android Chrome 各测一遍
```

## 1. 设计阶段（spec + plan）

直接 `/brainstorming`，让 skill 引导对齐：目标用户、核心玩法、操作方式、视听反馈、辅助功能、关卡 / 计分、结束条件、设置项。然后 `/writing-plans` 拆任务。

参考样例：
- [docs/superpowers/specs/2026-05-17-tetris-design.md](./superpowers/specs/2026-05-17-tetris-design.md)
- [docs/superpowers/plans/2026-05-17-tetris-implementation.md](./superpowers/plans/2026-05-17-tetris-implementation.md)

## 2. 实现：HTML 骨架模板

`games/<name>/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>游戏名 · 小游戏乐园</title>
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

  <!-- 桌面用方向板（CSS 限定 hover/fine pointer 才显示）-->
  <div id="control-pad">
    <!-- 5 个按钮：↺ ← ↓ → ↻ 或按本游戏需要 -->
  </div>

  <!-- 各种面板：help / settings / gameover / popup / toast / pause overlay -->
  <!-- 见 Tetris 的 index.html 作参考 -->

  <div id="version-tag" class="version-tag">v1.0</div>

  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

## 3. 实现：main.js 入口模板

```js
import { GameLogic } from './game.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { Input } from '../../../shared/gesture-input.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';

const gameCanvas = document.getElementById('game-canvas');

const game = new GameLogic();
const effects = new Effects();
const renderer = new Renderer(gameCanvas, /* extra canvases */, effects);
const audio = new Audio();
const settings = new Settings(game, audio, effects);
settings.load();
settings.apply();
settings.bindUi();

const input = new Input(
  gameCanvas,
  () => renderer.cellSize,
  () => game.activeObject  // 返回 {row, col} 或类似坐标
);
input.on('moveTo', (row, col) => game.tryMoveTo(row, col));
input.on('rotate', (dir) => game.tryRotate(dir));
input.on('hardDrop', () => game.hardDrop?.());
input.on('pauseChange', (paused) => game.setPaused(paused));
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});

// 游戏事件 → audio / effects / 触觉
game.onScore?.(/* ... */);
game.onLock?.(() => {
  audio.playLock();
  vibrate([20]);
});
// ...

// 主循环
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game, dt);
  // 更新分数显示 + 最高分追踪 + 破纪录庆祝
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 持久化：续玩
// ... 参考 Tetris main.js 的 saveSnap / persistSave / resumePending 模式

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}
```

## 4. 实现：CSS 主题接入

`games/<name>/style.css` 在顶部声明 CSS variables（同 Tetris 命名）：

```css
:root {
  /* 默认 = 童趣（明快暖色） */
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
}

body[data-theme="candy"]  { /* 粉色 */ }
body[data-theme="forest"] { /* 绿色 */ }
body[data-theme="ocean"]  { /* 青色 */ }
body[data-theme="space"]  { /* 深紫 */ }
body[data-theme="night"]  { /* 深蓝 */ }
```

具体颜色直接复制 Tetris 的 [style.css](../games/tetris/style.css) 顶部块。

Canvas 中读 CSS variables：

```js
_readTheme() {
  const styles = getComputedStyle(document.body);
  return {
    canvasBg: styles.getPropertyValue('--canvas-bg').trim() || '#16213e',
    canvasGrid: styles.getPropertyValue('--canvas-grid').trim() || 'rgba(255,255,255,0.04)',
  };
}
```

## 5. 实现：核心游戏逻辑

新建 `games/<name>/js/game.js`。基本契约：

```js
export class GameLogic {
  constructor() {
    this.state = /* ... */;
    this.score = 0;
    this.paused = false;
    this._onLock = null;
    this._onGameOver = null;
    this._onScoreChange = null;
  }

  // 输入接口（input.js 调）
  tryMoveTo(row, col) { /* 返回是否移动了 */ }
  tryRotate(dir) { /* 返回是否旋转了 */ }
  hardDrop() { /* 一键到底 + 锁定 */ }
  setPaused(p) { this.paused = !!p; }

  // 主循环驱动
  step(dt) {
    if (this.paused) return;
    // ... 推进游戏 dt 毫秒
  }

  // 状态查询（render 读）
  // state 字段直接 public，render 自取

  // 事件回调（main.js 注册）
  onLock(cb) { this._onLock = cb; }
  onGameOver(cb) { this._onGameOver = cb; }
  onScoreChange(cb) { this._onScoreChange = cb; }

  // 续玩
  serialize() { return { /* 可 JSON 化的状态 */ }; }
  restore(snap) { /* 返回是否成功 */ return true; }
  reset() { /* 清空、重新发牌 */ }
}
```

## 6. 实现：渲染 + 特效

`render.js` 只负责绘制。`effects.js` 管粒子 / 抖动 / 闪烁 / settling 等动效状态。`main.js` 把两者接起来：

```js
// effects.js
export class Effects {
  constructor() {
    this.particles = [];
    this.shake = null;
    this.intensity = 1.0;  // 受设置控制
  }
  setIntensity(v) { this.intensity = v; }
  step(dt) { /* 推进各动效计时器 */ }
  spawnParticles(...) { if (this.intensity === 0) return; /* ... */ }
  triggerShake(amp, dur) { if (this.intensity === 0) return; /* ... */ }
  getShakeOffset() { /* 返回 {x, y} */ }
  drawParticles(ctx, dt) { /* 物理 + 绘制 */ }
}
```

`render.js` 在 draw() 里：
1. `effects.getShakeOffset()` 得屏幕偏移，`ctx.translate`
2. 画背景 / 棋盘 / 当前物件 / ghost / 已落子
3. `effects.drawFlashes(ctx, ...)`
4. `effects.drawParticles(ctx, dt)`
5. restore

## 7. 实现：音效

`audio.js`：

```js
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
  }

  setBgmOn(on) {
    this.bgmOn = on;
    if (!on) this.stopBgm(200);
    else if (!this.bgmController && this.ctx) this._startBgm();
  }

  stopBgm(fadeMs = 200) {
    if (this.bgmController) {
      this.bgmController.stop(fadeMs);
      this.bgmController = null;  // ⚠️ 必须 null，否则下次 startBgm 会跳过
    }
  }

  playMyEvent() {
    this.playTone({ freq: 440, type: 'sine', duration: 80 });
  }

  _startBgm() {
    // 用 AudioContext.currentTime 调度，不要用 setInterval 控制音符
    // 参考 games/tetris/js/audio.js 的实现
  }

  startBgm() {
    if (this.bgmOn && !this.bgmController) this._startBgm();
  }
}
```

## 8. 实现：设置面板

`settings.js`：

```js
const KEY = '<name>.settings';
const KEY_HIGH = '<name>.highScore';

const DEFAULTS = {
  sfxOn: true,
  bgmOn: true,
  theme: 'cheery',
  fxLevel: 'strong',
  // ... 游戏自己的设置
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
    this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1.0);
    document.body.dataset.theme = this.state.theme;
    this._syncUi();
  }

  _syncUi() { /* 把 state 反映到 DOM 按钮 active 状态 */ }
  bindUi() { /* 绑定按钮 / 滑条 click / input → set() */ }
  open() { /* 显示面板 + 暂停 + 停 BGM */ }
  close() { /* 隐藏 + 恢复 + 重启 BGM */ }
}
```

## 9. 接入仓库

### 9.1 首页加卡片

编辑根 `index.html` 的 `games` 数组：

```js
const games = [
  { title: "俄罗斯方块", desc: "...", emoji: "🧱", path: "games/tetris/", highScoreKey: "tetris.highScore" },
  // 加你的：
  { title: "新游戏名", desc: "一句话描述", emoji: "🎮", path: "games/<name>/", highScoreKey: "<name>.highScore" },
];
```

`highScoreKey` 让首页卡片底部自动显示 `🏆 N`。

### 9.2 加进 CI 测试

编辑 `tests/run-tests.mjs`，在顶部加 import + 在底部加断言：

```js
import { GameLogic } from '../games/<name>/js/game.js';
// ...
const g = new GameLogic();
eq('initial state', g.score, 0);
// ... 你的纯函数测试
```

### 9.3 bump SW 缓存版本

编辑 `sw.js`：

```js
const CACHE_NAME = 'little-games-vN';  // N 加 1
```

让老用户下次访问自动拿到新版。

## 10. 测试与发布

### 10.1 本地

```bash
node --check $(find . -name "*.js" -not -path "./node_modules/*")
node tests/run-tests.mjs                  # 应该全绿
python -m http.server 8765                # 起本地 server
# 浏览器开 http://127.0.0.1:8765/         打开首页 + 进入新游戏
```

### 10.2 真机

部署到 GitHub Pages 后：
- iPhone Safari + iPad Safari + Android Chrome 各试一遍
- "添加到主屏幕"按一次，从主屏启动应全屏无地址栏
- DevTools → Network → Offline，刷新仍能玩

### 10.3 上线

```bash
git add . && git commit -m "feat(<name>): 新游戏 v1.0"
git push
gh run watch  # 等 CI 绿
```

## 11. 通用功能模板（直接复用 Tetris 的）

下面这些 Tetris 已经实现，新游戏建议直接抄过来（核心代码模式见 [docs/lessons-learned.md](./lessons-learned.md) 详述）：

| 功能 | Tetris 文件位置 |
|---|---|
| 暂停按钮 + overlay | main.js `setManualPause` |
| 帮助面板 | index.html `#help-panel` + main.js help 按钮 |
| 设置面板 + localStorage | settings.js + index.html `#settings-panel` |
| 重启确认气泡 | index.html `#restart-confirm` |
| 游戏结束面板 | index.html `#gameover-panel` |
| 分享成绩按钮 | main.js `share-btn` (Web Share API + clipboard 兜底) |
| 续玩（启动检测 + 关页保存） | main.js `loadSave / persistSave / resumePending` |
| 破纪录庆祝 | main.js `celebrateHighScore` |
| 减动效模式 | settings.js fxLevel + effects.setIntensity |
| 触觉反馈 | main.js `vibrate()` |
| 主题切换 | style.css `:root` + `body[data-theme=*]` |
| 安全区适配 | style.css `env(safe-area-inset-*)` |
| 桌面方向板 | index.html `#control-pad` + CSS `@media (hover:hover) and (pointer:fine)` |

## 12. 完成自检

发布前过一遍：

```
[ ] 界面 100% 简体中文，emoji 优先
[ ] 触屏完整可玩（不需要键盘 / 鼠标）
[ ] 所有按钮 ≥ 44×44
[ ] iPhone 刘海 / 底部 home indicator 不挡 UI
[ ] 离线模式（DevTools Offline）能完整玩
[ ] iOS Safari AudioContext 首次触摸才创建
[ ] localStorage 不可用时游戏仍能玩（默认值兜底）
[ ] 主题切换无需刷新页面立即生效
[ ] 断线续玩不会被切后台覆盖（resumePending 守卫）
[ ] BGM 改任何设置后不会丢
[ ] 多行 / 多目标同时消除时计数正确（_clearRows 用 filter 不要 splice+unshift）
[ ] 顶栏 / 设置 / 帮助 / 重启 / 游戏结束面板间状态切换干净
[ ] node tests/run-tests.mjs 全绿
[ ] CI 跑过
[ ] 真机 iOS + Android 至少各试 1 局
```
