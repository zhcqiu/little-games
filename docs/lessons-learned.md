# 踩过的坑 + 沉淀的模式

Tetris 开发过程中遇到的 bug 和总结出的模式。建新游戏前看一遍，避免重蹈覆辙。

---

## 一、踩过的坑

### 1. GitHub Pages 子路径破坏所有绝对路径

**症状**：本地（`http://127.0.0.1:8765/`）一切正常，部署到 `https://<user>.github.io/little-games/` 后 SW 注册 404、manifest 拉不到、icon 显示默认。

**Root cause**：`navigator.serviceWorker.register('/sw.js')` 中 `/sw.js` 解析为 `https://<user>.github.io/sw.js`，但实际文件在 `/little-games/sw.js`。

**修复模式**：

| 位置 | 不行 | 要这样 |
|---|---|---|
| HTML `<link rel="manifest">` | `/manifest.json` | `./manifest.json` |
| HTML `<link rel="icon">` | `/icon.svg` | `./icon.svg` |
| 顶层 HTML 注册 SW | `register('/sw.js')` | `register('./sw.js')` |
| 嵌套 JS 注册 SW | `register('/sw.js')` | `register(new URL('../../../sw.js', import.meta.url))` |
| manifest `start_url` | `"/"` | `"./"` |
| manifest `icons.src` | `"/icon.svg"` | `"./icon.svg"` |
| sw.js 内 PRECACHE | `'/'` | `new URL('./', self.location).href` |

**`new URL` 算法**：`new URL('../../../foo.js', base)` 把 base 去掉最后一段（文件名）然后逐 `..` 上溯。从 `games/tetris/js/main.js` 到根 `sw.js` 要**三个** `..`（一个跨 js/ → tetris/，一个跨 tetris/ → games/，一个跨 games/ → 根）。**少了一个就 404**。

**校验方法**：

```js
// DevTools console 跑一下确认路径
new URL('../../../sw.js', import.meta.url).href
// 应该是 'https://<host>/little-games/sw.js'
```

---

### 2. 多行同时消除，bug 只消掉了一行 / 错误的一行

**症状**：填满底部两行，发现 `score` 加 2 但棋盘上只有一行被清空，且清掉的那行甚至不是满行的那行。

**Root cause**（`_clearRows` 原版）：

```js
// ❌ 错的：splice + unshift 交替
_clearRows(rows) {
  rows.sort((a, b) => a - b);
  for (const r of rows.reverse()) {
    this.board.splice(r, 1);          // 这一步索引正确
    this.board.unshift([new empty]);  // ← 这一步把所有索引整体偏移 +1
  }
  // 下次迭代用的索引就错了！
}
```

例：清 [15, 18]。reverse → [18, 15]。
- splice(18) 移除原 row 18 ✓
- unshift 空行 → 现在原 row 0-17 都偏移到 1-18
- splice(15) 想清原 row 15，但**现在索引 15 是原 row 14**

**修复**：一次性 filter，最后再补空：

```js
_clearRows(rows) {
  const cleared = new Set(rows);
  const remaining = this.board.filter((_, i) => !cleared.has(i));
  const empties = Array.from({ length: rows.length },
                             () => Array(BOARD_WIDTH).fill(null));
  this.board = [...empties, ...remaining];
  this.score += rows.length;
}
```

**通用教训**：任何 `splice + insert` 循环都要小心索引漂移。能用 `filter / map` 一次性变换就别迭代式 mutate。

---

### 3. BGM controller 不 null，改设置后 BGM 就丢了

**症状**：玩家进游戏 BGM 正常，打开设置面板（任何 toggle）→ 关掉面板 → BGM 没了。只有手动关再开 BGM toggle 才恢复。

**Root cause**：

```js
// 设置面板 open() 调用
audio.bgmController.stop(100);  // ← 只停了，没 null 控制器

// 后续 close() 调用
audio.startBgm();  // 内部检查 !this.bgmController → 还是 truthy → 跳过
```

**修复模式**：所有 stop 调用必须配套置 null，封装成一个方法防止漏掉：

```js
stopBgm(fadeMs = 200) {
  if (this.bgmController) {
    this.bgmController.stop(fadeMs);
    this.bgmController = null;   // 关键！
  }
}
```

外部统一用 `audio.stopBgm()`，不直接碰 `bgmController`。

**通用教训**：资源生命周期对象（controller / handle / subscription）"停止"和"清引用"必须一起做。

---

### 4. 无尽模式根本走不下去

**症状**：无尽模式堆到顶后，应该清半区继续，但实际是弹了"游戏结束"面板。

**Root cause**：spec 设计漏洞 + 实现照搬。

```js
// ❌ 原版：只清 row 10-19，不下移
for (let r = 10; r < BOARD_HEIGHT; r++) {
  this.board[r] = Array(BOARD_WIDTH).fill(null);
}
this.current = this._spawnNext();  // 新方块 spawn 在 row -1
if (this._collides(...)) {         // 但 row 0-9 还满着！
  this._onGameOver('standard');     // 直接跳标准结束
}
```

实际游戏：玩家堆栈 0-19 全填了 → 清 10-19 → 0-9 还满 → 新 spawn 必碰 → game over。无尽模式形同虚设。

**修复**：清下半区**同时上半区下移 10 格**，spawn 位必然腾空：

```js
const upper = this.board.slice(0, 10).map((row) => row.slice());
const emptyRows = Array.from({ length: 10 },
                             () => Array(BOARD_WIDTH).fill(null));
this.board = [...emptyRows, ...upper];
this.current = this._spawnNext();  // 现在 row 0-9 全空，新方块出生 OK
```

**通用教训**：spec 里写 "继续游戏" 要立刻问"游戏能不能真的继续"，画出极端状态（满板）模拟一遍。文字描述会骗人。

---

### 5. 续玩存盘竞态：弹窗未点就被新局覆盖

（这条是 Codex adversarial review 找出来的高优先级 bug）

**症状**：玩家上次进度被存进 localStorage。重开页面 → 看到"继续上局？"弹窗 → 还没点就切到别的 app → 回来发现存盘没了 / 进度变成空白局。

**Root cause**：

```js
// 启动
const game = new Game();         // ← 立刻 spawn 了第一个新方块
const savedSnap = loadSave();
if (savedSnap) {
  game.setPaused(true);
  popup.show();                  // 弹"继续？"
  // ↓ 等待用户点击 ↓
}

// 同时注册的生命周期 handler
window.addEventListener('pagehide', persistSave);
function persistSave() {
  // 检查 game.current 非空就存
  localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
}
```

用户切后台 → `pagehide` → `persistSave` 看到 game.current（新 spawn 的）非空 → 写入。**新空白局覆盖了旧存盘**。

**修复**：加 `resumePending` 守卫：

```js
let resumePending = false;

function persistSave() {
  if (resumePending) return;  // 用户没决定前不要写
  // ... 正常写
}

if (savedSnap) {
  resumePending = true;
  popup.show();
  continueBtn.onclick = () => {
    if (!game.restore(savedSnap)) return;  // 失败保持锁定
    resumePending = false;
    popup.hide();
  };
  discardBtn.onclick = () => {
    clearSave();
    resumePending = false;
    popup.hide();
  };
}
```

**通用教训**：自动持久化 + 启动时确认弹窗 = 经典竞态。任何"等用户决定"的状态都要 gate 后台行为。

---

### 6. iOS Safari 不让你提前创建 AudioContext

**症状**：页面加载就 `new AudioContext()`，iPhone 上音频根本不响。

**Root cause**：iOS Safari 要求 AudioContext 在用户手势事件（pointerdown / keydown / click）回调里创建，否则 context 直接进入 suspended 状态且无法 resume。

**修复模式**：

```js
class AudioEngine {
  constructor() {
    this.ctx = null;  // 不要在这里 new
  }

  unlock() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // ...
  }

  playFoo() {
    if (!this.ctx) return;  // 用户还没点过任何东西，静默 return
    // ...
  }
}

// 在 input 模块里
input.onFirstTouch(() => audio.unlock());
```

`gesture-input.js` 已经内置 `onFirstTouch` 钩子，新游戏直接用。

---

### 7. Service Worker 老缓存版本不更新

**症状**：明明改了代码也 push 了，用户访问还是老版本。

**Root cause**：SW 用 cache-first 策略，永远从缓存读。不更新 `CACHE_NAME` 永不刷新。

**修复**：每次发布要改代码后，bump 缓存版本：

```js
const CACHE_NAME = 'little-games-vN';  // N 加 1
```

`activate` 事件会自动清掉旧版本：

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
```

**通用教训**：cache-first SW + 版本号是简单可靠的部署模式。每次 git push 之前问自己"要不要 bump 缓存"。

---

### 8. CSS `box-sizing: border-box` 让 canvas 边框侵蚀绘图区

**症状**：给 canvas 加 `border: 3px solid` 后，画面看起来略微缩小、cell 不对齐。

**Root cause**：项目用了 `* { box-sizing: border-box }`。Canvas style.width = "300px" 意味着 BOX 是 300px（包括 6px 边框）→ 内容是 294px → 但 canvas 内部 `width` 属性绑定的绘图缓冲是 300×dpr，被压缩到 294 显示。

**修复**：用 `outline` 替代 `border`：

```css
#game-canvas {
  outline: 3px solid var(--canvas-border);
  outline-offset: 0;
  /* outline 不占布局空间，绘图区不被侵蚀 */
}
```

---

## 二、沉淀的模式

### A. 设置面板的"立即生效 + 持久化"模式

```js
class Settings {
  set(key, value) {
    this.state[key] = value;
    this.apply();   // 推送到 game / audio / effects / DOM
    this.save();    // 写 localStorage
  }

  apply() {
    this.game.setSpeed(this.state.speed);
    this.audio.setSfxOn(this.state.sfxOn);
    this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel]);
    document.body.dataset.theme = this.state.theme;
    this._syncUi();  // 把 state 反映到按钮 active class
  }
}
```

任何 UI 改动都走 `set(key, value)`：
- DOM 事件 `onclick` / `oninput` → `settings.set(...)`
- 自动调 apply + save
- 不存在"应用按钮"的概念，改完立即生效

### B. 续玩三重保险存盘

```js
window.addEventListener('beforeunload', persistSave);  // 桌面浏览器关闭
window.addEventListener('pagehide', persistSave);      // iOS Safari 切 app
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistSave();                  // 切标签 / 锁屏
});
```

任何一个事件触发都存。iOS 上 `beforeunload` 不可靠所以 `pagehide` 是必须的。

### C. 主题用 CSS variables + data-attribute 切换

CSS：

```css
:root { --bg: cream; --primary: orange; --canvas-bg: white; /* ... */ }
body[data-theme="candy"] { --bg: pink; --primary: magenta; /* ... */ }
body[data-theme="night"] { --bg: navy; --primary: blue; /* ... */ }
```

JS：

```js
document.body.dataset.theme = 'candy';  // 立即整套切换
```

Canvas 那边读：

```js
getComputedStyle(document.body).getPropertyValue('--canvas-bg').trim();
```

加新主题 = CSS 加一个 `body[data-theme="xxx"]` 块 + HTML 加一个按钮。零 JS 逻辑改动。

### D. 减动效模式的 intensity 旋钮

```js
class Effects {
  setIntensity(v) { this.intensity = v; }  // 0..1

  spawnParticles(...) {
    if (this.intensity === 0) return;
    const perCell = Math.max(1, Math.round(14 * this.intensity));
    // ...
  }

  triggerShake(amp, dur) {
    if (this.intensity === 0) return;
    this.shake = { amplitude: amp * this.intensity, duration: dur };
  }
}
```

设置面板提供"强 / 弱 / 关"三档 → 映射到 1.0 / 0.4 / 0。同样 vibrate 也读这个值决定要不要震。

### E. 桌面方向板 / 手机隐藏：CSS media query 控制

```css
#control-pad {
  display: none;
}

@media (hover: hover) and (pointer: fine) {
  #control-pad { display: flex; }
}
```

`(hover: hover) and (pointer: fine)` 是"有鼠标的设备"。触屏只有 `(pointer: coarse)`。零 JS 检测。

### F. 输入状态机的多源汇聚

`shared/gesture-input.js` 把触摸 / 鼠标 / 键盘 / 屏幕方向板按钮统一翻译成 `moveTo / rotate / hardDrop / pauseChange` 几个语义事件。游戏代码只需要订阅事件，**完全不关心输入源**。

新游戏想加新键 / 手势？改 `/shared/gesture-input.js`，所有游戏自动受益。

### G. 破纪录庆祝的"baseline 锁定"

```js
let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;

function loop() {
  // ...
  if (!highScoreCelebrated && highScoreBaseline > 0
      && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    celebrateHighScore();
  }
  // 同步更新最高分（每帧覆盖）
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
  }
}

// reset 时
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
}
```

**关键**：baseline 是 _本局开始时_ 的旧最高分，不是动态。否则每帧都比"刚被超过的当前最高分"会重复触发。

### H. 触觉反馈分级模式

```js
function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// 不同事件用不同 pattern
game.onLock(() => vibrate([20]));               // 单次轻触
game.onLineClear((rows) => {
  const patterns = [
    [40],                            // 单消
    [30, 30, 60],                    // 双消
    [30, 20, 50, 20, 80],            // 三消
    [50, 20, 60, 20, 80, 30, 120],   // 四消（高潮）
  ];
  vibrate(patterns[Math.min(rows.length, 4) - 1]);
});
```

pattern 是 `[on, off, on, off, ...]` 毫秒，越多越复杂越爽。`fxLevel === 'off'` 时所有触觉一并关。

### I. Web Share + 剪贴板兜底

```js
async function share(text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) { /* 用户取消 / fail */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋');  // 复制成功
  } catch (e) {}
}
```

仅当 `navigator.share` 存在时显示分享按钮（feature detection）。不支持的浏览器看不到，不报错。

### J. 离线兜底链

每条用户数据都要假设 localStorage 不可用：

```js
function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) { return null; }
}
function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { /* 隐私模式 / 满 / 禁用 */ }
}
```

绝不要让 `localStorage` 异常崩游戏。最坏情况 = 当局有效但下次重新开始用默认值。

---

## 三、可选 / 下次开新游戏前考虑

这些是 Tetris 没做但下次可以考虑的：

- **类型检查**：用 JSDoc + `// @ts-check` 注释，VSCode 自动报错，不引入 TS 编译
- **render.js 进一步拆分**：当前 render 还做 ghost / next 预览，可以再独立成 PiecePreview / GhostRenderer
- **录像 / 回放**：每帧操作可序列化，能"播回"高分局
- **多人本地对战**：屏幕一分为二，两套 input + 两套 game
- **联机榜单**：违反离线优先约束，但可作为可选功能（设置里"上传"按钮）

不强制做。先把游戏做出来再说。

---

## 四、回望

Tetris 从 spec 到 V1.5 共做了 ~15 个 commit。**一半是修 bug 和加细节体验**。教训：

1. **首次实现刻意做最小**：spec 写得细，第一版尽量少加功能，把"能玩"做扎实
2. **每个迭代用户反馈再加**：每轮 2-6 项小改动一次提交，比一次性大改稳得多
3. **不会"完工"**：始终有 V1.X / V1.Y。每次发布只锁当下版本，下次接着改
4. **Codex / 自审找 bug**：用户测不出来的（如 resume 竞态）让对抗 review 找
5. **CI 早于规模**：即使 1 个游戏也建 CI，扩展时白送护栏
