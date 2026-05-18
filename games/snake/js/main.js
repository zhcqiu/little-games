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
settings.onReset(() => resetHighScoreTracker());

// 新手引导（一次性）
const TUTORIAL_KEY = 'snake.tutorialSeen';
function maybeShowTutorial() {
  try {
    if (localStorage.getItem(TUTORIAL_KEY) === '1') return false;
  } catch (e) { return false; }
  const p = document.getElementById('tutorial-popup');
  if (!p) return false;
  p.classList.remove('hidden');
  game.setPaused(true);
  document.getElementById('tutorial-ok').addEventListener('click', () => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
    p.classList.add('hidden');
    if (!resumePending) game.setPaused(false);
  }, { once: true });
  return true;
}

// 续玩存盘
const SAVE_KEY = 'snake.saveGame';
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persistSave() {
  if (resumePending) return;   // 守卫：弹窗未决前不要写
  try {
    if (game.dead) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}

let resumePending = false;
const savedSnap = loadSave();
if (savedSnap) {
  resumePending = true;
  game.setPaused(true);
  const popup = document.getElementById('resume-popup');
  popup.classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('click', () => {
    if (!game.restore(savedSnap)) {
      console.warn('restore failed');
      return;
    }
    resumePending = false;
    popup.classList.add('hidden');
    game.setPaused(false);
  });
  document.getElementById('resume-discard').addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    resumePending = false;
    popup.classList.add('hidden');
    game.setPaused(false);
  });
}

// 第一次玩 → 弹引导（如果没有要恢复的存档）
if (!savedSnap) maybeShowTutorial();

window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistSave();
});

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
  if (settings.get('bgmOn') && audio.ctx && !audio.bgmController) audio.startBgm();
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
  document.getElementById('high-score').textContent = settings.get('highScore');

  if (!highScoreCelebrated && highScoreBaseline > 0 && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    celebrateHighScore();
  }
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
  }
  requestAnimationFrame(loop);
}

const MILESTONES = [10, 15, 20, 30, 50, 75, 100, 150, 200];
let lastMilestone = 0;

game.onEat(() => {
  audio.playEat();
  const head = game.snake[0];
  effects.spawnBurst(head.col, head.row, renderer.cellSize,
    ['#ffeb3b', '#ff9800', '#4caf50', '#f44336'], 8);
  effects.triggerShake(3, 80);
  showClearToast('✨');
  vibrate([15]);

  // 累计食物 + 解锁判定
  const prevTotal = settings.get('totalFood');
  const newTotal = prevTotal + 1;
  settings.set('totalFood', newTotal);
  for (const threshold of [100, 500]) {
    if (prevTotal < threshold && newTotal >= threshold) {
      setTimeout(() => {
        showClearToast('🎁 解锁新蛇头！');
        audio.playMilestone();
        vibrate([50, 30, 50, 30, 80]);
      }, 1200);
      break;
    }
  }

  // 里程碑检测
  const len = game.snake.length;
  for (const m of MILESTONES) {
    if (len >= m && lastMilestone < m) {
      lastMilestone = m;
      // 延迟一帧再弹 milestone toast 避免和 ✨ 重叠
      setTimeout(() => {
        showClearToast('🎖️' + m);
        audio.playMilestone();
        vibrate([30, 40, 50]);
      }, 400);
      break;
    }
  }
});
game.onCombo((n) => {
  audio.playCombo();
  showClearToast('🔥' + n + '连');
  vibrate([20, 20, 60]);
});
game.onDie(() => {
  audio.playDie();
  const head = game.snake[0];
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#f44336', '#ff9800', '#ffeb3b'], 16, 250);
  effects.triggerShake(14, 240);
  showClearToast('😵');
  vibrate([40, 40, 80, 40, 120]);
  showGameOverPanel();
  clearSave();
});
game.onRevive(() => {
  audio.playRevive();
  const head = game.snake[0];
  // 警告色（橙红灰），不再用治愈系粉紫蓝
  effects.spawnRadial(head.col, head.row, renderer.cellSize,
    ['#ff9800', '#f44336', '#9e9e9e'], 12, 180);
  effects.triggerShake(8, 180);
  showClearToast('🩹');           // 绷带：受伤但已处理（之前是 💖 爱心 = 奖励）
  vibrate([80, 50, 30]);          // 下降型：事故后缓和（之前是上升）
});
game.onWrap(() => {
  audio.playWrap();
  showToast('💫');     // 转点点：中性"传送"，避开 ✨ 跟吃食物奖励重叠
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
  const extra = document.getElementById('pause-extra');
  if (p && extra) {
    const score = game.score;
    const high = settings.get('highScore');
    if (score === 0) {
      extra.textContent = '';
    } else if (score < high) {
      extra.textContent = '还差 ' + (high - score + 1) + ' 步破纪录！';
    } else {
      extra.textContent = '已破纪录！继续冲 🔥';
    }
  } else if (extra) {
    extra.textContent = '';
  }
  if (p) audio.stopBgm(100);
  else if (settings.get('bgmOn') && audio.ctx) audio.startBgm();
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  const helpPanel = document.getElementById('help-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const gameoverPanel = document.getElementById('gameover-panel');
  const restartConfirm = document.getElementById('restart-confirm');

  if (e.key === 'Escape') {
    if (!restartConfirm.classList.contains('hidden')) {
      restartConfirm.classList.add('hidden');
      e.preventDefault();
      return;
    }
    if (!settingsPanel.classList.contains('hidden')) {
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
    if (!restartConfirm.classList.contains('hidden')) {
      document.getElementById('restart-ok').click();
      e.preventDefault();
      return;
    }
    if (!gameoverPanel.classList.contains('hidden')) {
      document.getElementById('replay-btn').click();
      e.preventDefault();
      return;
    }
  } else if (e.key === 'p' || e.key === 'P') {
    const panelsOpen = !helpPanel.classList.contains('hidden')
      || !settingsPanel.classList.contains('hidden')
      || !gameoverPanel.classList.contains('hidden');
    if (panelsOpen) return;
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

function showGameOverPanel() {
  game.setPaused(true);
  const panel = document.getElementById('gameover-panel');
  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-high').textContent = settings.get('highScore');
  panel.classList.remove('hidden');
  const shareBtn = document.getElementById('share-btn');
  if (navigator.share) shareBtn.classList.remove('hidden');
  else shareBtn.classList.add('hidden');
}

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  game.reset();
  game.setPaused(false);
  resetHighScoreTracker();
});

document.getElementById('share-btn').addEventListener('click', async () => {
  const score = game.score;
  const text = `🐍 我在贪吃蛇里吃了 ${score} 个！来挑战我吧 🎯`;
  try {
    await navigator.share({ title: '贪吃蛇', text, url: location.href });
  } catch (e) {
    try {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast('📋');
    } catch (err) {}
  }
});

// 占位：续玩 / 破纪录追踪在 Phase I 实现
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
  lastMilestone = 0;
}
function celebrateHighScore() {
  audio.playHighScore();
  vibrate([60, 30, 60, 30, 100]);
  showClearToast('🏆');
  // 顶上撒一拨彩色粒子
  effects.spawnBurst(6, 0, renderer.cellSize,
    ['#ff7043', '#ffeb3b', '#4caf50', '#42a5f5', '#9c27b0', '#f44336', '#ff9800'], 20, [-500, -250]);
  effects.triggerShake(16, 280);
}

window._renderer = renderer;
