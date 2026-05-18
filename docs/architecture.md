# 仓库架构

little-games 是面向 10 岁以下儿童的网页小游戏合集。本文档描述仓库级的结构与约束，是新加游戏前必读。

## 1. 硬性约束（仓库级）

这些是底线，每个游戏都必须遵守。

### 1.1 用户与设备

- **界面文字简体中文**：所有可见文字一律简体中文，**优先用 emoji 图案**代替汉字（参见 [文字 → emoji 化](#34-文字--emoji-化)）。
- **手机 + 平板优先**：主目标设备是触屏移动端。桌面浏览器是次要支持。
- **必须支持触屏**：不允许只靠鼠标 hover、右键、键盘的玩法。
- **大点击区**：互动元素最小 44×44 px。
- **横竖屏自适应**：CSS 用 viewport 单位 + flex/grid，不硬编码尺寸。

### 1.2 技术栈

- **纯静态**：只能用 HTML / CSS / JS。
- **无构建工具**：浏览器原生 `<script type="module">` 加载。不引入 webpack / vite / babel / TS。
- **无外部 CDN**：所有资源同源。Web 字体、远程图片、第三方库一概禁止（否则破坏离线 + Service Worker 缓存策略）。
- **零运行时依赖**：游戏库（Phaser、PixiJS）也不引入，自己写。

### 1.3 离线优先

**首次在线访问后，必须可以离线运行**（仓库根的 Service Worker 负责）。所以：

- 新游戏的 `index.html` 必须注册 `/sw.js`（路径用 `new URL('../../sw.js', import.meta.url)` 解析，兼容 GitHub Pages 子路径）。
- 每个游戏建议自带 `manifest.json` + `icon.svg`，让小朋友能"添加到主屏幕"作为独立 PWA。
- 不要引用任何远程资源（CDN、Google Fonts、远程图片），否则离线时会失败。

详见 [docs/lessons-learned.md §1](./lessons-learned.md)。

## 2. 目录结构

```
little-games/
├── index.html              首页"小游戏乐园"启动器
├── manifest.json           首页 PWA 清单
├── icon.svg                首页图标
├── sw.js                   根 Service Worker（scope = 整个站点）
│
├── shared/                 跨游戏共享工具
│   ├── audio-engine.js     Web Audio 合成原语（AudioEngine 基类）
│   └── gesture-input.js    手势 + 键盘统一输入状态机
│
├── games/                  所有游戏的根目录
│   └── tetris/             第一款游戏：俄罗斯方块
│       ├── index.html
│       ├── style.css
│       ├── manifest.json   该游戏的 PWA 清单
│       ├── icon.svg
│       ├── tests.html      浏览器侧测试入口
│       ├── tests/          纯函数测试断言
│       │   ├── pieces.test.js
│       │   └── game.test.js
│       └── js/
│           ├── main.js     入口 + 主循环
│           ├── game.js     核心游戏逻辑
│           ├── pieces.js   方块定义
│           ├── render.js   Canvas 绘制
│           ├── effects.js  粒子 / 抖动 / 闪烁 / settling 等特效
│           ├── input.js    re-export shim → shared/gesture-input.js
│           ├── audio.js    游戏专属音效（extends AudioEngine）
│           └── settings.js 设置面板 + localStorage 持久化
│
├── tests/                  仓库级测试
│   └── run-tests.mjs       CI 跑的 Node 测试入口
│
├── .github/workflows/
│   └── check.yml           CI: node --check + run-tests.mjs
│
└── docs/
    ├── architecture.md          (本文档)
    ├── adding-a-new-game.md     新游戏 step-by-step
    ├── lessons-learned.md       踩过的坑 + 沉淀模式
    ├── superpowers/specs/       游戏设计文档
    └── superpowers/plans/       实施计划
```

## 3. 模块边界与约定

### 3.1 一个游戏 = 一个 `/games/<name>/` 子目录

完全自包含。不允许跨游戏直接 import（要复用就抽到 `/shared/`）。

### 3.2 模块职责（Tetris 范本）

| 模块 | 职责 | 不该做的事 |
|---|---|---|
| `main.js` | 入口、串联各模块、主循环 | 不写游戏逻辑细节 |
| `game.js` | 棋盘、规则、状态、碰撞、计分 | 不接触 DOM / Canvas |
| `pieces.js`（数据） | 方块定义（颜色 + 形状） | 不含逻辑 |
| `render.js` | Canvas 绘制：棋盘 / 当前方块 / ghost / next 预览 | 不管特效队列 |
| `effects.js` | 粒子、抖动、闪烁、补位动画的状态 + 渲染辅助 | 不管基础棋盘 |
| `input.js` | 当前游戏对 `shared/gesture-input.js` 的 re-export shim | 不重写状态机 |
| `audio.js` | 该游戏所有音效（extends AudioEngine） | 不写通用合成原语 |
| `settings.js` | 设置面板 UI + localStorage 持久化 + apply() 推送到游戏 / audio / effects | 不内联游戏逻辑 |

### 3.3 数据流（Tetris）

```
                       ┌─ pointerdown/keydown
                       ↓
    Input(gesture-input.js) ──── moveTo / rotate / hardDrop / pauseChange
                                       ↓
                          main.js（事件桥接）
                                       ↓
                              Game.tryMoveTo / tryRotate / hardDrop
                                       ↓
                          state（board / current / score）
                       ↓                        ↓
            Audio.playLock/playClear        Effects.spawnParticles
            （由 game.onLock / onLineClear     /flashRowsAnim/
              回调触发）                       triggerShake/
                                              startSettling
                                                 ↓
                                       Renderer.draw（每帧读 game + effects）
```

**核心原则**：
- `input` 不知道有"方块"，只发语义事件
- `game` 不知道画面什么样，只暴露 state
- `render` 不操作 state，只读 + 画
- `audio` / `effects` 由 game 的回调 hook 进来

### 3.4 文字 → emoji 化

跟小朋友设计原则一致：可用 emoji 表达的，**不要用汉字**。仓库内已经把 Tetris 的：

| 场景 | 原汉字 | 改用 emoji |
|---|---|---|
| 消除浮字 | 好棒 / 双消 / 三消 / 四消 | 👍 / 😄 / 🤩 / 🎉 |
| 鼓励 | 继续加油 | 💪 |
| 顶栏 | 本局 / 最高 / 下一块 | 🎯 / 🏆 / ⏭️ |
| 设置项前缀 | （纯文字） | 🎨 ⏱️ ↩️ 🏁 🔊 🎵 🎬 |
| 主题名 | 童趣 / 糖果 / 森林 / 海洋 / 太空 / 夜空 | 🎨 / 🍬 / 🌳 / 🌊 / 🚀 / 🌙 |
| 重启按钮 | 重新开始 / 取消 / 确认 | 🔄 / ❌ / ✅ |

emoji 用大字号 + drop-shadow 比黑体汉字更直觉，对识字量低的小朋友尤其友好。

## 4. 共享工具 `/shared/`

### 4.1 `gesture-input.js` — 手势 + 键盘状态机

支持三种输入源，转成统一语义事件：

| 输入 | 触发事件 |
|---|---|
| 单指拖动（含鼠标拖动） | `moveTo(row, col)` |
| 双指扭转（角度 > 20°） | `rotate(+1)` / `rotate(-1)` |
| 方向键 / WASD | `moveTo` |
| ↑ / W / 空格 | `rotate(+1)` |
| Z | `rotate(-1)` |
| Shift + ↓ | `hardDrop()` |
| 任何手指按下 / 抬起 | `pauseChange(true / false)` |
| 首次触摸 | `firstTouch` 回调（用于 audio.unlock） |

**用法骨架**：

```js
import { Input } from '../../../shared/gesture-input.js';

const input = new Input(
  canvas,
  () => renderer.cellSize,                        // cell size getter
  () => game.current                              // piece state getter
       ? { row: game.current.row, col: game.current.col }
       : null
);

input.on('moveTo', (row, col) => game.tryMoveTo(row, col));
input.on('rotate', (dir) => game.tryRotate(dir));
input.on('hardDrop', () => game.hardDrop());
input.on('pauseChange', (paused) => game.setPaused(paused));
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});
```

**说明**：
- 单指拖动建立 origin 快照（手指起始位置 + 方块起始位置），每帧重算 target 行/列。
- 双指旋转：累计两指连线角度变化，每 20° 触发一次 `rotate`。
- 第二指落下时**不会**触发当前帧的 DRAG step（防误触跳格）。

### 4.2 `audio-engine.js` — Web Audio 基类

`AudioEngine` 类提供：

| 方法 | 用途 |
|---|---|
| `unlock()` | 由首次用户手势调用，懒创建 AudioContext（iOS Safari 要求） |
| `setSfxOn(on)` | 总开关 |
| `playTone({freq, type, duration, gain, attack})` | 单 oscillator + 包络，最常用 |
| `scheduleNote(freq, when, duration, gain, type)` | 按精确时刻调度音符（用于和弦 / 琶音） |
| `playThump({...})` | 频率下扫 + 高通噪声 click — "咚"，落地撞击感 |
| `playNoiseSweep({...})` | 带通滤波扫频噪声 — "哗啦""嗖" |

**用法骨架**：

```js
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  playJump() {
    this.playTone({ freq: 440, type: 'sine', duration: 80, gain: 0.3 });
  }
  playLand() {
    this.playThump({ fromFreq: 200, toFreq: 80, duration: 180, gain: 0.55 });
  }
  playPop() {
    this.playNoiseSweep({ fromFreq: 2000, toFreq: 200, duration: 200 });
  }
}
```

详细 API 见源码内 JSDoc 注释。

### 4.3 `themes.css` — 6 主题 CSS 变量

包含 `:root`（默认童趣）和 5 个 `body[data-theme="..."]` 块，定义 16 个共享 CSS 变量（`--bg`、`--primary`、`--canvas-bg`、`--canvas-border` 等）。

**用法**：游戏的 `style.css` 第一行：

```css
@import url('../../shared/themes.css');
```

之后正常用 `var(--primary)` 即可。需要添加游戏专属变量（如 breakout 的 `--brick-1`）的话，直接在自家 style.css 里追加 `body[data-theme="X"] { --brick-1: ... }` 即可，CSS 后定义优先。

### 4.4 `bgm-themes.js` — 6 主题 BGM 配置

每主题一段独立旋律：melody/bass/beat/wave-type，对应 CSS 主题色调。

**用法**：

```js
import { BGM_THEMES, THEME_NAMES } from '../../../shared/bgm-themes.js';

// 在 audio.js 里：
_startBgm() {
  const cfg = BGM_THEMES[this.bgmTheme] || BGM_THEMES.cheery;
  // 用 cfg.melody / cfg.bass / cfg.beatMs / cfg.melodyType / cfg.bassType
  // 详见 games/snake/js/audio.js 实现
}
```

加新主题：在 `bgm-themes.js` 加键，并在 `shared/themes.css` 加对应 `body[data-theme="X"]` 块。

## 5. PWA 与离线策略

### 5.1 根 Service Worker

`sw.js`（仓库根）是 **唯一** 的 SW，scope 覆盖全站。策略：**cache-first + runtime caching**。

- `install`：预缓存首页核心资源（`/`、`/index.html`、`/icon.svg`、`/manifest.json`）。
- `fetch`：同源 GET 请求 → 先查缓存，命中返回；未命中走网络，成功后写入缓存。
- 加新游戏**不用改 sw.js** —— runtime caching 自动把第一次访问到的资源缓存进去。
- 想强制老用户更新 → 改 `CACHE_NAME = 'little-games-vN'`，activate 时旧缓存被清掉。

### 5.2 PWA Manifest 双层

- `/manifest.json`：首页（启动器）的 PWA。
- `/games/<name>/manifest.json`：每个游戏的独立 PWA。

两个都可"添加到主屏幕"，独立启动。

### 5.3 GitHub Pages 子路径陷阱

仓库通过 GitHub Pages 部署到 `https://<user>.github.io/little-games/`，不是域名根。

**所有路径必须相对**：
- HTML 里：`./sw.js`、`./manifest.json`、`./icon.svg`
- JS 注册 SW：`new URL('../../sw.js', import.meta.url)`（按文件相对位置算）
- manifest 里：`"start_url": "./"`、`"src": "./icon.svg"`

绝对路径 `/sw.js` 会指向 `https://<user>.github.io/sw.js`（404）。

详见 [docs/lessons-learned.md §2](./lessons-learned.md)。

## 6. 持久化约定

每个游戏自己管 localStorage，key 格式：`<game-name>.<field>`。Tetris 用的：

- `tetris.highScore` — 整数最高分
- `tetris.settings` — JSON：`{ speed, upwardTolerance, endMode, sfxOn, bgmOn, theme, fxLevel }`
- `tetris.saveGame` — 断线续玩快照（关闭页面时写，启动时检测）

新游戏自己起 namespace，比如 `puzzle.highScore`、`maze.settings`。

## 7. 测试策略

### 7.1 纯函数测试

碰撞检测、规则判断、状态机这类**无 DOM 依赖**的纯函数：

- 浏览器侧：`games/<name>/tests.html` + `tests/<name>/*.test.js`（用 `window.assertEq` 全局）
- Node 侧：把同样的断言放进仓库根 `tests/run-tests.mjs`，CI 跑

写好 export 接口，浏览器和 Node 共用同一份模块。

### 7.2 UI / 动画 / 音频

无自动化。每次重要改动后跑手测清单（见游戏自己的 spec）。Canvas / Web Audio 没法可靠地 unit test。

### 7.3 CI

`.github/workflows/check.yml` 每个 push 都跑：
1. `node --check` 所有 .js 文件 —— 语法守护
2. `node tests/run-tests.mjs` —— 跨游戏纯函数测试聚合

加新游戏要把新测试 import 进 `run-tests.mjs`。

## 8. 提交 / 版本规范

- Conventional commits 风格：`feat(<game>): …` / `fix(<game>): …` / `chore(<scope>): …`
- 大改动一次性按"part 1 / part 2 / part 3"切提交，每条 commit 自包含可还原。
- 改 SW 内容时，bump `CACHE_NAME` 版本号 —— 否则老用户拿不到新版。

## 9. 设计与实施文档

每个游戏先 spec，后 plan，后实施：

1. **Spec**：`docs/superpowers/specs/<date>-<game>-design.md` — 用 `superpowers:brainstorming` skill 产出
2. **Plan**：`docs/superpowers/plans/<date>-<game>-implementation.md` — 用 `superpowers:writing-plans` skill 产出
3. **实施**：用 `superpowers:executing-plans` 或 `subagent-driven-development` skill 执行 plan

Tetris 的 spec 和 plan 都在仓库里，可作为模板参考。
