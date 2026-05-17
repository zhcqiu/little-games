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
    if (audio.bgmController) audio.bgmController.stop(100);
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 用相对路径解析到仓库根的 sw.js，兼容 GitHub Pages 子路径部署
    const swUrl = new URL('../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

window._game = game;
window._renderer = renderer;
