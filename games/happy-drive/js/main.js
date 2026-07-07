import { Game } from './game.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';

const canvas = document.getElementById('game-canvas');
const game = new Game();
const effects = new Effects();
const renderer = new Renderer(canvas, effects);
const audio = new Audio();
const settings = new Settings(game, audio, effects);

settings.load();
settings.apply();
settings.bindUi();

const pauseReasons = new Set();
function acquirePause(reason) {
  const wasEmpty = pauseReasons.size === 0;
  pauseReasons.add(reason);
  if (wasEmpty) {
    game.setPaused(true);
    audio.stopBgm();
  }
}
function releasePause(reason) {
  if (!pauseReasons.has(reason)) return;
  pauseReasons.delete(reason);
  if (pauseReasons.size === 0) {
    game.setPaused(false);
    if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
  }
}

settings.onOpen(() => acquirePause('settings'));
settings.onClose(() => releasePause('settings'));
settings.onHelpOpen(() => acquirePause('help'));
settings.onHelpClose(() => releasePause('help'));
settings.onReset(() => resetHighScoreTracker());

const TUTORIAL_KEY = 'happyDrive.tutorialSeen';
try {
  if (localStorage.getItem(TUTORIAL_KEY) !== '1') {
    document.getElementById('tutorial-popup').classList.remove('hidden');
    acquirePause('tutorial');
  }
} catch (e) {}
document.getElementById('tutorial-ok')?.addEventListener('click', () => {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
  document.getElementById('tutorial-popup').classList.add('hidden');
  releasePause('tutorial');
  unlockAudio();
});

function unlockAudio() {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
}

function drive(action) {
  unlockAudio();
  let moved = false;
  if (action === 'left') moved = game.moveLeft();
  if (action === 'right') moved = game.moveRight();
  if (action === 'up') game.accelerate();
  if (action === 'down') game.decelerate();
  if (moved) {
    audio.playMove();
    vibrate([8]);
  }
}

let touchStart = null;
canvas.addEventListener('pointerdown', (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture?.(e.pointerId);
  unlockAudio();
});
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx)) {
    drive(dy < 0 ? 'up' : 'down');
  } else if (Math.abs(dx) > 30) {
    drive(dx < 0 ? 'left' : 'right');
  } else {
    const rect = canvas.getBoundingClientRect();
    drive(e.clientX < rect.left + rect.width / 2 ? 'left' : 'right');
  }
});

document.getElementById('pad-left').addEventListener('click', () => drive('left'));
document.getElementById('pad-right').addEventListener('click', () => drive('right'));
document.getElementById('pad-accelerate').addEventListener('click', () => drive('up'));
document.getElementById('pad-slow').addEventListener('click', () => drive('down'));

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') drive('left');
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') drive('right');
  else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') drive('up');
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') drive('down');
  else if (e.key === 'p' || e.key === 'P') setManualPause(!manualPause);
  else if (e.key === 'Escape') closeTopPanel();
  else return;
  e.preventDefault();
});

function closeTopPanel() {
  if (!document.getElementById('settings-panel').classList.contains('hidden')) settings.close();
  if (!document.getElementById('help-panel').classList.contains('hidden')) {
    document.getElementById('help-panel').classList.add('hidden');
    releasePause('help');
  }
  document.getElementById('restart-confirm').classList.add('hidden');
}

game.on('fruit', ({ fruit, combo }) => {
  audio.playFruit();
  const p = renderer.objectPoint(fruit.lane, game.laneCount, fruit.z);
  effects.burst(p.x, p.y, ['#ffeb3b', '#ff7043', '#66bb6a', '#42a5f5'], 16);
  showClearToast(combo >= 3 ? '🌈' + combo : fruit.emoji);
  vibrate([15]);
});
game.on('crash', ({ damage }) => {
  audio.playCrash();
  const p = renderer.playerPoint(game);
  effects.crash(p.x, p.y, damage);
  showToast(damage >= 2 ? '⚠️💥' : '💥');
  vibrate(damage >= 2 ? [70, 25, 70, 25, 45] : [55, 25, 45]);
});
game.on('gameOver', () => {
  audio.playRepair();
  showGameOverPanel();
});

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(now - lastTime, 200);
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game, dt);
  updateHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function updateHud() {
  document.getElementById('score').textContent = game.score;
  document.getElementById('high-score').textContent = settings.get('highScore');
  document.getElementById('damage').textContent = `${game.damage}/${game.maxHits}`;
  if (!highScoreCelebrated && highScoreBaseline > 0 && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    audio.playHighScore();
    showClearToast('🏆');
  }
  if (game.score > settings.get('highScore')) settings.set('highScore', game.score);
}

let manualPause = false;
const pauseOverlay = document.getElementById('pause-overlay');
function setManualPause(paused) {
  manualPause = !!paused;
  pauseOverlay.classList.toggle('hidden', !manualPause);
  if (manualPause) acquirePause('manual');
  else releasePause('manual');
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) acquirePause('visibility');
  else releasePause('visibility');
});

function showGameOverPanel() {
  acquirePause('gameover');
  const panel = document.getElementById('gameover-panel');
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-high').textContent = settings.get('highScore');
  panel.classList.remove('hidden');
  const shareBtn = document.getElementById('share-btn');
  shareBtn.classList.toggle('hidden', !navigator.share);
}

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  releasePause('gameover');
  game.reset();
  resetHighScoreTracker();
});

document.getElementById('share-btn').addEventListener('click', async () => {
  const text = `🚗 我在快乐开车里收集了 ${game.score} 分水果！`;
  try { await navigator.share({ title: '快乐开车', text, url: location.href }); }
  catch (e) {}
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

let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
}

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
