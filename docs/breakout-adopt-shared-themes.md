# breakout 接入 `shared/themes.css` 的 4 步操作

**面向对象**：完成 breakout V1 后下手做收尾清理的人或会话。
**前置背景**：tetris 和 snake 已经在 commit `ab70da5` 把 6 主题 CSS 变量抽到 `shared/themes.css` 了。breakout 当时还在开发中，没动。本文是补做指南。
**目标**：breakout 的 `style.css` 用 `@import` 引用 shared 主题，删掉重复的 16×6 个 CSS 变量，保留 breakout 专属的 `--brick-*` / `--paddle` 等增量。

---

## 当前状态（接入前）

`games/breakout/style.css` 头部约 130 行是这种结构：

```css
:root {
  /* 默认 = 童趣 */
  --bg: #fff8e1;
  --bg-2: #ff8a65;
  --primary: #ff7043;
  /* ...12 个通用变量... */
  --brick-1: #4fc3f7;    /* ← breakout 专属 */
  --brick-2: #81c784;    /* ← breakout 专属 */
  --brick-3: #fff176;
  --brick-5: #e57373;
  --paddle: #ff7043;
}

body[data-theme="candy"] {
  /* 同上：12 个通用 + 4-5 个 breakout 专属 */
}

/* ...另外 4 个主题块... */
```

通用变量跟 `shared/themes.css` **完全一致**，复制贴的。breakout 专属变量（`--brick-*`、`--paddle` 等）穿插在每个主题块里。

---

## 接入步骤

### Step 1：在文件顶部加 @import

`games/breakout/style.css` 的**第一行**改为：

```css
@import url('../../shared/themes.css');
```

CSS `@import` 必须在最前面（`@charset` 之外不能有其他 rule 在前），这步要先做。

### Step 2：删掉每个主题块里的"通用"变量

通用变量定义在 `shared/themes.css`，重复写会覆盖（虽然值一样，但维护负担和误改风险增加）。从每个主题块（`:root`、`body[data-theme="candy"]`、`forest`、`ocean`、`space`、`night`）删掉这 16 个变量：

```
--bg              --text             --button-bg-text   --canvas-bg
--bg-2            --text-dim         --button-active    --canvas-grid
--primary         --panel-bg         --shadow           --canvas-border
--primary-dark    --panel-text       --button-bg
```

**保留**所有 breakout 专属变量（`--brick-*`、`--paddle`、`--ball` 之类）。

例：candy 主题改造后只剩：

```css
body[data-theme="candy"] {
  --brick-1: #f48fb1;
  --brick-2: #ce93d8;
  --brick-3: #fff176;
  --brick-5: #ef9a9a;
  --paddle: #ec407a;
}
```

那 16 个通用变量从 `shared/themes.css` 自动来，cascade 顺序保证了 shared 在前、breakout 自家定义在后——cascade 同优先级、后定义胜出，所以增量的 brick 颜色不会被覆盖。

### Step 3：删掉所有主题块前的注释 / `*` 装饰

如果 breakout 的 style.css 有类似这种注释：

```css
/* 6 主题颜色变量 */
```

可以一起删掉，主题来源现在写在 shared/themes.css 的头部注释里了。但**不强制**——留着也没事。

### Step 4：视觉手测 6 主题

```bash
python -m http.server 8000
# 浏览器开 http://localhost:8000/games/breakout/
```

清单：

```
□ 默认童趣主题：背景米色、砖块多彩、球拍橙
□ 切糖果：背景粉、砖块粉紫黄、球拍洋红
□ 切森林：背景浅绿、砖块绿系
□ 切海洋：背景青、砖块青系
□ 切太空：背景深紫、砖块亮色
□ 切夜空：背景深蓝、砖块亮色
□ 帮助 / 设置面板背景跟着主题换
□ 顶栏背景跟着主题换
□ 没有任何变量"undefined"导致的黑色 / 透明降级
```

如果某个主题颜色看起来"丢了一层"（比如砖块全成同一色），说明对应的 brick 变量被你不小心一起删了——回到 Step 2 检查那个主题块。

### Step 5：commit

```bash
git add games/breakout/style.css
git commit -m "refactor(breakout): use shared/themes.css, keep brick/paddle deltas"
```

如果你顺便也改了 `games/breakout/js/audio.js` 来用 `shared/bgm-themes.js`（breakout 完工后想要 BGM 主题变体），跟这个 commit 合并或分开都可以，按你的偏好。

---

## 验证：commit 后的预期 diff

`games/breakout/style.css` 的变化应该是：

- **+1 行**：开头加 `@import`
- **−15~20 行 × 6 主题**：每个主题块删掉 16 个通用变量（保留 brick/paddle 部分）
- 净 −95 ~ −115 行

---

## 不需要做的事

- **不用动** `sw.js` —— `shared/themes.css` 已经在 v12 缓存里
- **不用动** `index.html` —— `<link rel="stylesheet" href="./style.css">` 通过 `@import` 自动拉 shared
- **不用动** `shared/themes.css` 本身——breakout 的 brick 颜色不能加进通用主题（它们是 breakout 专属语义，加进通用会污染其他游戏）

---

## 如果想顺便接 `shared/bgm-themes.js`

仅当 breakout 的 audio 已经有 BGM 实现时考虑。参考 `games/snake/js/audio.js` 的 `_startBgm()` 实现方式：

1. `import { BGM_THEMES } from '../../../shared/bgm-themes.js';`
2. 在 `_startBgm()` 里 `const cfg = BGM_THEMES[this.bgmTheme] || BGM_THEMES.cheery;`
3. 在 `setBgmTheme(theme)` 里切主题时停 + 重启 BGM（同 snake 模式）
4. `settings.apply()` 末尾调 `audio.setBgmTheme(this.state.theme);`

如果 breakout 现在还没 BGM，**先不要做这步**——等真的需要 BGM 时再接入。

---

## 风险点

- **@import 必须是第一条 CSS 规则**——除了 `@charset` 之外不能有其他 rule 在前面。`* { box-sizing: ... }` 这种 reset 要在 @import 之后。
- **删变量时务必逐主题对照**——breakout 的某主题可能比 tetris/snake 多了"自定义版"通用变量（例如 night 主题里如果 breakout 把 `--canvas-bg` 单独调过色），那种**就不能删**。从 `shared/themes.css` 拉的值跟原值不一样会有视觉差。

完成后可以删掉本文档，留着也不大碍。
