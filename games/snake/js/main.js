// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Effects } from './effects.js';
import { Settings } from './settings.js';

const gameCanvas = document.getElementById('game-canvas');
const game = new Game();
const effects = new Effects();
const renderer = new Renderer(gameCanvas, effects);
const audio = new Audio();

const settings = new Settings(game, audio, effects);
settings.load();
settings.apply();
settings.bindUi();

const input = new Input(
  gameCanvas,
  () => renderer.cellSize,
  () => null   // 蛇没有 "piece" 概念
);

input.on('swipe', (dir) => {
  game.queueDirection(dir);
  audio.playTurn();
  vibrate([8]);
});
input.on('pauseChange', (paused) => {
  game.setPaused(paused);
});
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});

// 桌面方向板
function padDir(dir) {
  audio.unlock();
  game.queueDirection(dir);
  audio.playTurn();
  vibrate([8]);
}
document.getElementById('pad-up').addEventListener('click',    () => padDir('up'));
document.getElementById('pad-down').addEventListener('click',  () => padDir('down'));
document.getElementById('pad-left').addEventListener('click',  () => padDir('left'));
document.getElementById('pad-right').addEventListener('click', () => padDir('right'));

// 主循环
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  requestAnimationFrame(loop);
}

game.onEat(() => {
  audio.playEat();
  const head = game.snake[0];
  effects.spawnBurst(head.col, head.row, renderer.cellSize,
    ['#ffeb3b', '#ff9800', '#4caf50', '#f44336'], 8);
  effects.triggerShake(3, 80);
  showClearToast('✨');
  vibrate([15]);
});
game.onDie(() => {
  audio.playDie();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#f44336', '#ff9800', '#ffeb3b'], 16, 250);
  effects.triggerShake(14, 240);
  showClearToast('😵');
  vibrate([40, 40, 80, 40, 120]);
});
game.onRevive(() => {
  audio.playRevive();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#ec407a', '#b388ff', '#42a5f5'], 12, 180);
  effects.triggerShake(8, 180);
  showClearToast('💖');
  vibrate([20, 30, 60]);
});
game.onWrap(() => {
  audio.playWrap();
  showToast('✨');
});

requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}

window._game = game;
// 切后台暂停
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.setPaused(true);
    audio.stopBgm(100);
  } else {
    if (input.fingers && input.fingers.size === 0) game.setPaused(false);
    if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
  }
});

// 暂停按钮 + overlay
let manualPause = false;
const pauseOverlay = document.getElementById('pause-overlay');
function setManualPause(p) {
  manualPause = p;
  game.setPaused(p);
  pauseOverlay.classList.toggle('hidden', !p);
  if (p) audio.stopBgm(100);
  else if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'p' || e.key === 'P') {
    setManualPause(!manualPause);
    e.preventDefault();
  }
});

let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('event-toast');
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

function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

window._renderer = renderer;
