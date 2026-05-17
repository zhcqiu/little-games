# 🎮 小游戏乐园 (Little Games)

为 10 岁以下小朋友精心制作的网页小游戏合集，全部用纯 HTML / CSS / JS 编写，无需安装，打开即玩。

## 🌐 在线游玩

👉 **https://zhcqiu.github.io/little-games/**

## 📁 仓库结构

```
little-games/
├── index.html          # 首页（游戏入口列表）
├── games/              # 所有游戏存放在这里
│   └── <game-name>/
│       ├── index.html  # 游戏主文件
│       ├── style.css   # （可选）
│       └── script.js   # （可选）
└── README.md
```

## ➕ 添加新游戏

1. 在 `games/` 下新建一个文件夹，例如 `games/puzzle/`。
2. 在该文件夹里放一个 `index.html`，写好你的游戏。
3. 打开根目录的 `index.html`，在脚本里的 `games` 数组添加一项：

   ```js
   { title: "拼图游戏", desc: "拖动方块拼出图案", emoji: "🧩", path: "games/puzzle/" },
   ```

4. 提交并推送到 GitHub，几十秒后 GitHub Pages 就会自动更新。

## 🎯 设计原则

- **简体中文**：所有界面文字使用简体中文。
- **移动端优先**：主要目标设备是手机和平板，必须完整支持触摸操作（不能依赖鼠标 hover、右键、键盘）。
- **响应式**：横竖屏都能用，按钮足够大便于小朋友点击。
- **简单**：一两分钟就能上手。
- **安全**：无广告、无外链、无追踪。
- **离线可玩**：纯静态资源，不依赖网络。

## 📱 移动端开发提醒

- 使用 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`。
- 用 `pointerdown` / `pointerup` 或 `touchstart` / `touchend`，而不是只用 `click`。
- 用 CSS `touch-action` 控制手势，避免页面被意外滚动或缩放。
- 互动元素最小尺寸建议 44×44px。
- 在真实手机或浏览器开发者工具的设备模拟器里测试。

## 🔌 离线优先

所有游戏必须在首次在线访问后**离线可玩**。仓库根的 `sw.js` 负责整站缓存。加新游戏时：

1. 在游戏的 `index.html` 里调用 `navigator.serviceWorker.register('/sw.js')`
2. 不要引用任何外部 CDN / Google Fonts / 远程图片——全部资源同源
3. 建议给每个游戏自带 `manifest.json` + `icon.svg`，让小朋友能"添加到主屏幕"作为独立 PWA

已知限制：

- 首次访问必须在线
- iOS Safari 14+ 才完整支持 SW
- 清浏览器数据后需要再次联网刷新

## 📚 文档

加新游戏前必读三件套：

- [docs/architecture.md](docs/architecture.md) — 仓库结构、硬约束、共享工具 API
- [docs/adding-a-new-game.md](docs/adding-a-new-game.md) — 从零做新游戏的实操流程 + checklist
- [docs/lessons-learned.md](docs/lessons-learned.md) — Tetris 踩过的坑 + 沉淀的模式

每款游戏的设计 / 实施文档：

- 设计文档 `docs/superpowers/specs/`
- 实施计划 `docs/superpowers/plans/`
