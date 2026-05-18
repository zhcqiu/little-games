// main.js — 打砖块入口
import { GameLogic } from './game.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';
import { Input } from './input.js';
import { brickCssVar } from './bricks.js';

const SAVE_KEY = 'breakout.saveGame';

const canvas = document.getElementById('game-canvas');
const game = new GameLogic();
const effects = new Effects();
const renderer = new Renderer(canvas, effects);
const audio = new Audio();
const settings = new Settings(game, audio, effects);
settings.load();
settings.apply();
settings.bindUi();

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('high-score');
const comboEl = document.getElementById('combo');
const comboBlock = document.getElementById('combo-block');

function vibrate(pattern) {
  if (settings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function updateScoreUi() {
  scoreEl.textContent = String(game.score);
  highEl.textContent = String(settings.get('highScore'));
  comboEl.textContent = String(game.combo);
  comboBlock.classList.toggle('hidden', game.combo <= 1);
}

// 事件接线
game.onPaddleHit(() => { audio.playPaddle(); vibrate([15]); });
game.onBrick(({ col, row, value }) => {
  audio.playBrick(value);
  const cssVar = brickCssVar(value);
  const color = getComputedStyle(document.body).getPropertyValue(cssVar).trim() || '#fff';
  effects.spawnBrickParticles(col, row, color);
  updateScoreUi();
});
game.onComboChange(() => updateScoreUi());
game.onScoreChange(() => updateScoreUi());
game.onDrop(() => {
  audio.playDrop();
  effects.triggerShake(4, 200);
  effects.triggerFlash('#ff5252', 0.35, 200);
  vibrate([60, 30, 30]);
  updateScoreUi();
});
game.onPowerup((type) => {
  audio.playPowerup();
  effects.spawnPaddleGlow();
  vibrate([20, 30, 40]);
});
game.onTopOut(() => {
  audio.playTopOut();
  effects.triggerShake(8, 400);
  effects.triggerFlash('#ffffff', 0.5, 220);
  vibrate([40, 20, 40, 20, 80]);
  showEncourageToast();
  updateScoreUi();
});

// 高分基线（破纪录庆祝一次）
let highScoreBaseline = settings.get('highScore');
let highScoreCelebrated = false;
function resetHighScoreTracker() {
  highScoreBaseline = settings.get('highScore');
  highScoreCelebrated = false;
}

// 游戏结束
const gameoverPanel = document.getElementById('gameover-panel');
const finalScoreEl = document.getElementById('final-score');
const finalHighEl = document.getElementById('final-high');
const replayBtn = document.getElementById('replay-btn');
const shareBtn = document.getElementById('share-btn');

game.onGameOver((mode) => {
  finalScoreEl.textContent = String(game.score);
  finalHighEl.textContent = String(settings.get('highScore'));
  gameoverPanel.classList.remove('hidden');
});

replayBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  gameoverPanel.classList.add('hidden');
  game.reset();   // 包含 paused=false
  resetHighScoreTracker();
  clearSave();
  updateScoreUi();
  // 重启 BGM（之前 game-over / 设置面板可能停过 BGM）
  audio.unlock();
  if (!manualPaused && settings.get('bgmOn')) audio.startBgm();
});

// 输入
const input = new Input(
  canvas,
  () => renderer.cellSize,
  () => ({ row: 0, col: game.paddle.col })   // gesture-input 用 piece state，对打砖块只关心 col
);
input.on('moveTo', (_row, col) => game.setPaddleCol(col));
input.on('pauseChange', (paused) => game.setPaused(paused));
input.onFirstTouch(() => {
  audio.unlock();
  if (settings.get('bgmOn')) audio.startBgm();
});

// 桌面方向板 ← → ⏯
const padLeft = document.getElementById('pad-left');
const padRight = document.getElementById('pad-right');
const padPause = document.getElementById('pad-pause');
let padHoldTimer = null;
function startHoldMove(delta) {
  game.setPaddleCol(game.paddle.col + delta);
  if (padHoldTimer) return;
  padHoldTimer = setInterval(() => {
    game.setPaddleCol(game.paddle.col + delta);
  }, 40);
}
function stopHoldMove() { if (padHoldTimer) { clearInterval(padHoldTimer); padHoldTimer = null; } }
padLeft.addEventListener('pointerdown', () => startHoldMove(-0.5));
padLeft.addEventListener('pointerup', stopHoldMove);
padLeft.addEventListener('pointercancel', stopHoldMove);
padLeft.addEventListener('pointerleave', stopHoldMove);
padRight.addEventListener('pointerdown', () => startHoldMove(0.5));
padRight.addEventListener('pointerup', stopHoldMove);
padRight.addEventListener('pointercancel', stopHoldMove);
padRight.addEventListener('pointerleave', stopHoldMove);
padPause.addEventListener('pointerdown', () => toggleManualPause());

// 键盘
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.key === 'p' || e.key === 'P') { e.preventDefault(); toggleManualPause(); }
  else if (e.key === 'Escape') { closeAllPanels(); }
});

// 手动暂停 overlay
const pauseOverlay = document.getElementById('pause-overlay');
let manualPaused = false;
function setManualPause(p) {
  manualPaused = p;
  pauseOverlay.classList.toggle('hidden', !manualPaused);
  game.setPaused(p);
  if (p) audio.stopBgm(120);
  else if (settings.get('bgmOn')) audio.startBgm();
}
function toggleManualPause() { setManualPause(!manualPaused); }
document.getElementById('pause-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleManualPause(); });
pauseOverlay.addEventListener('pointerdown', () => { if (manualPaused) setManualPause(false); });

// 帮助 / 设置面板开关
const helpPanel = document.getElementById('help-panel');
const settingsPanel = document.getElementById('settings-panel');

function openPanel(panel) {
  closeAllPanels();
  panel.classList.remove('hidden');
  game.setPaused(true);
  audio.stopBgm(120);
}
function closePanel(panel) {
  panel.classList.add('hidden');
  // 若没有别的暂停理由，恢复
  if (!manualPaused && [helpPanel, settingsPanel, gameoverPanel].every((p) => p.classList.contains('hidden'))) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
}
function closeAllPanels() {
  helpPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  document.getElementById('restart-confirm').classList.add('hidden');
  if (!manualPaused && gameoverPanel.classList.contains('hidden')) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
}

document.getElementById('help-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); openPanel(helpPanel); });
document.getElementById('help-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePanel(helpPanel); });
document.getElementById('settings-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); openPanel(settingsPanel); });
document.getElementById('settings-close').addEventListener('pointerdown', (e) => { e.preventDefault(); closePanel(settingsPanel); });

// 重启确认
const restartConfirm = document.getElementById('restart-confirm');
document.getElementById('restart-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.remove('hidden');
});
document.getElementById('restart-cancel').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.add('hidden');
});
document.getElementById('restart-ok').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  restartConfirm.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  game.reset();
  resetHighScoreTracker();
  clearSave();
  updateScoreUi();
  if (!manualPaused) {
    game.setPaused(false);
    if (settings.get('bgmOn')) audio.startBgm();
  }
});

// 续玩
const resumePopup = document.getElementById('resume-popup');
let resumePending = false;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
function persistSave() {
  if (resumePending || game.gameOver) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}
window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistSave();
  else audio.resume();   // iOS Safari 切后台后 AudioContext suspended，前台时显式恢复
});

const snap = loadSave();
if (snap && snap.score > 0) {
  resumePending = true;
  game.setPaused(true);
  resumePopup.classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!game.restore(snap)) {
      // 存档损坏（手动改 localStorage / 跨版本不兼容）→ 当作新开
      clearSave();
      resumePopup.classList.add('hidden');
      resumePending = false;
      resetHighScoreTracker();
      audio.unlock();
      if (settings.get('bgmOn')) audio.startBgm();
      if (!manualPaused) game.setPaused(false);
      return;
    }
    resumePopup.classList.add('hidden');
    resumePending = false;
    resetHighScoreTracker();
    updateScoreUi();
    // 续玩按钮本身就是首个用户手势 — 趁机解锁音频 + 起 BGM
    audio.unlock();
    if (settings.get('bgmOn')) audio.startBgm();
    if (!manualPaused) game.setPaused(false);
  });
  document.getElementById('resume-discard').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    clearSave();
    resumePopup.classList.add('hidden');
    resumePending = false;
    audio.unlock();
    if (settings.get('bgmOn')) audio.startBgm();
    if (!manualPaused) game.setPaused(false);
  });
}

// 浮字 toast（无尽压顶）
const encourageToast = document.getElementById('encourage-toast');
function showEncourageToast() {
  encourageToast.classList.remove('hidden');
  encourageToast.style.animation = 'none';
  // reflow trigger
  void encourageToast.offsetWidth;
  encourageToast.style.animation = '';
  setTimeout(() => encourageToast.classList.add('hidden'), 1200);
}

// 主题切换需要重读 canvas variables
const observer = new MutationObserver(() => renderer.refreshTheme());
observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

// 破纪录庆祝
function celebrateHighScore() {
  audio.playHighScore();
  effects.triggerFlash('#ffeb3b', 0.4, 600);
  vibrate([50, 20, 60, 20, 80, 30, 120]);
}

// 分享
function buildShareText() {
  return `🎯 ${game.score}\n🧨 我在小游戏乐园打砖块得了 ${game.score} 分！\nhttps://zhcqiu.github.io/little-games/`;
}
async function shareScore() {
  const text = buildShareText();
  if (navigator.share) {
    try { await navigator.share({ title: '打砖块', text }); return; } catch (e) {}
  }
  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = '📋 已复制';
    setTimeout(() => { shareBtn.textContent = '📤 分享成绩'; }, 1200);
  } catch (e) {}
}
if (navigator.share || navigator.clipboard) {
  shareBtn.classList.remove('hidden');
}
shareBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); shareScore(); });

// 主循环
updateScoreUi();
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(100, now - lastTime);
  lastTime = now;
  game.step(dt);
  effects.step(dt);
  renderer.draw(game);

  // 高分追踪
  if (game.score > settings.get('highScore')) {
    settings.set('highScore', game.score);
    highEl.textContent = String(game.score);
  }
  if (!highScoreCelebrated && highScoreBaseline > 0 && game.score > highScoreBaseline) {
    highScoreCelebrated = true;
    celebrateHighScore();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
