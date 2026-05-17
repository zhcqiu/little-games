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
settings.bindUi();

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
game.onLock(() => audio.playLock());
game.onLineClear((rows, colorRows, boardSnapshot) => {
  audio.playClear(rows.length);
  renderer.flashRowsAnim(rows);
  renderer.spawnParticles(rows, colorRows);
  renderer.startSettling(rows, boardSnapshot);
  const shake = [
    { amp: 8, dur: 120 },
    { amp: 12, dur: 160 },
    { amp: 18, dur: 200 },
    { amp: 28, dur: 280 },
  ][Math.min(rows.length, 4) - 1];
  renderer.triggerShake(shake.amp, shake.dur);
  const cheers = ['好棒!', '双消!', '三消!', '四消!'];
  showClearToast(cheers[Math.min(rows.length, 4) - 1]);
});
game.onGameOver((mode, data) => {
  if (mode === 'endless-reset') {
    audio.playEndlessReset();
    showToast('继续加油！');
    if (data) {
      const colorRows = data.clearedRows.map((r) => data.boardSnapshot[r].slice());
      renderer.flashRowsAnim(data.clearedRows);
      renderer.spawnParticles(data.clearedRows, colorRows);
      renderer.startSettling(data.clearedRows, data.boardSnapshot);
      renderer.triggerShake(24, 280);
    }
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
  document.getElementById('score').textContent = game.score;
  document.getElementById('high-score').textContent = settings.get('highScore');
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.setPaused(true);
    audio.stopBgm(100);
  } else {
    if (input.fingers && input.fingers.size === 0) game.setPaused(false);
    if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
  }
});

let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('encourage-toast');
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

// 屏幕方向板（仅桌面显示，通过 CSS media query 控制可见性；按钮事件无条件绑定）
function padMove(dRow, dCol) {
  if (!game.current) return;
  audio.unlock();  // 首次点击解锁音频
  game.tryMoveTo(game.current.row + dRow, game.current.col + dCol);
}
function padRotate(dir) {
  audio.unlock();
  if (game.tryRotate(dir)) audio.playRotate();
}
document.getElementById('pad-left').addEventListener('click', () => padMove(0, -1));
document.getElementById('pad-right').addEventListener('click', () => padMove(0, +1));
document.getElementById('pad-down').addEventListener('click', () => padMove(+1, 0));
document.getElementById('pad-rotate-cw').addEventListener('click', () => padRotate(+1));
document.getElementById('pad-rotate-ccw').addEventListener('click', () => padRotate(-1));

// 帮助按钮
const helpPanel = document.getElementById('help-panel');
document.getElementById('help-btn').addEventListener('click', () => {
  helpPanel.classList.remove('hidden');
  game.setPaused(true);
  audio.stopBgm(100);
});
document.getElementById('help-close').addEventListener('click', () => {
  helpPanel.classList.add('hidden');
  game.setPaused(false);
  if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
});

// 全局键盘快捷键（ESC/Enter/P）
let manualPause = false;
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  if (e.key === 'Escape') {
    // 关掉任何可见面板
    if (!document.getElementById('restart-confirm').classList.contains('hidden')) {
      document.getElementById('restart-confirm').classList.add('hidden');
      e.preventDefault();
      return;
    }
    if (!document.getElementById('settings-panel').classList.contains('hidden')) {
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
    // 优先确认重启
    const rc = document.getElementById('restart-confirm');
    if (!rc.classList.contains('hidden')) {
      document.getElementById('restart-ok').click();
      e.preventDefault();
      return;
    }
    // 否则游戏结束时按 Enter 再玩一局
    const go = document.getElementById('gameover-panel');
    if (!go.classList.contains('hidden')) {
      document.getElementById('replay-btn').click();
      e.preventDefault();
      return;
    }
  } else if (e.key === 'p' || e.key === 'P') {
    // P 暂停 / 继续。只在没有面板打开时生效
    const panelsOpen = !helpPanel.classList.contains('hidden')
      || !document.getElementById('settings-panel').classList.contains('hidden')
      || !document.getElementById('gameover-panel').classList.contains('hidden');
    if (panelsOpen) return;
    manualPause = !manualPause;
    game.setPaused(manualPause);
    if (manualPause) {
      audio.stopBgm(100);
      showToast('已暂停（按 P 继续）');
    } else {
      if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
    }
    e.preventDefault();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 从 games/tetris/js/main.js 上溯 3 层到仓库根的 sw.js
    // 兼容 GitHub Pages 子路径部署（站点不一定挂在域名根）
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

window._game = game;
window._renderer = renderer;
