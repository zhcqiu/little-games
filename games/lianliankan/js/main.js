// main.js — 完整入口：游戏 + 渲染 + 输入 + 效果 + 音频 + 设置 + 面板 + 续玩 + 引导
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Settings } from './settings.js';
import { GlobalSettings } from '../../../shared/global-settings.js';
import { DIFFICULTIES, EMOJI_POOL } from './board.js';

const boardEl    = document.getElementById('board');
const overlayEl  = document.getElementById('overlay');
const scoreEl    = document.getElementById('score');
const comboEl    = document.getElementById('combo');
const comboBlock = document.getElementById('combo-block');
const timerEl    = document.getElementById('timer');
const timerBlock = document.getElementById('timer-block');

const effects = new Effects();
const audio = new Audio();
let game = new Game(loadInitialDifficulty());
const renderer = new Renderer(boardEl, overlayEl, effects);
renderer.mount(game);

const settings = new Settings(game, audio, effects, {
  onOpen: () => acquirePause('settings'),
  onClose: () => releasePause('settings'),
  onHelpOpen: () => acquirePause('help'),
  onHelpClose: () => releasePause('help'),
  onRestart: askRestart,
  onDifficultyChange: askDifficultyChange,
  onTimedChange: (timed) => {
    // 计时切换实时生效到当前 game（master 永远 timed=true，不受 toggle 影响）
    game.timed = DIFFICULTIES[game.difficulty].timed || timed;
  },
  onRelaxedChange: (relaxed) => {
    // 宽松模式实时生效
    game.relaxed = !!relaxed;
  },
});
settings.load();
settings.apply();
settings.bindUi();
// 把 load 后的 timed/relaxed 同步到当前 game（game 在 settings.load 前实例化的）
game.timed = settings.state.timed || DIFFICULTIES[game.difficulty].timed;
game.relaxed = !!settings.state.relaxed;

// 暂停理由计数
const pauseReasons = new Set();
function acquirePause(reason) {
  const wasEmpty = pauseReasons.size === 0;
  pauseReasons.add(reason);
  if (wasEmpty) game.setPaused(true);
}
function releasePause(reason) {
  if (!pauseReasons.has(reason)) return;
  pauseReasons.delete(reason);
  if (pauseReasons.size === 0) game.setPaused(false);
}

// 续玩
const SAVE_KEY = 'lianliankan.saveGame';
const TUTORIAL_KEY = 'lianliankan.tutorialSeen';
let resumePending = false;

function loadInitialDifficulty() {
  try {
    const raw = localStorage.getItem('lianliankan.settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (DIFFICULTIES[s.difficulty]) return s.difficulty;
    }
  } catch (e) {}
  return 'novice';
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function persistSave() {
  if (resumePending) return;
  try {
    if (game.dead || game.won) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch (e) {}
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

const savedSnap = loadSave();
if (savedSnap) {
  resumePending = true;
  acquirePause('resume');
  document.getElementById('resume-popup').classList.remove('hidden');
  document.getElementById('resume-continue').addEventListener('click', () => {
    if (game.restore(savedSnap)) {
      renderer.mount(game);
    } else {
      clearSave();
    }
    resumePending = false;
    document.getElementById('resume-popup').classList.add('hidden');
    releasePause('resume');
  });
  document.getElementById('resume-discard').addEventListener('click', () => {
    clearSave();
    resumePending = false;
    document.getElementById('resume-popup').classList.add('hidden');
    releasePause('resume');
  });
} else {
  maybeShowTutorial();
}

function maybeShowTutorial() {
  try {
    if (localStorage.getItem(TUTORIAL_KEY) === '1') return;
  } catch (e) { return; }
  const p = document.getElementById('tutorial-popup');
  if (!p) return;
  p.classList.remove('hidden');
  acquirePause('tutorial');
  document.getElementById('tutorial-ok').addEventListener('click', () => {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
    p.classList.add('hidden');
    releasePause('tutorial');
  }, { once: true });
}

window.addEventListener('beforeunload', persistSave);
window.addEventListener('pagehide', persistSave);

// 输入
const input = new Input(boardEl);
input.onFirstTouch(() => audio.unlock());
input.onTap((r, c) => {
  if (resumePending) return;
  const result = game.tap(r, c);
  handleTapResult(result);
});

function handleTapResult(result) {
  switch (result.kind) {
    case 'ignore':
      return;
    case 'select':
      renderer.setSelection(game.selection.r, game.selection.c);
      audio.playSelect();
      vibrate([5]);
      break;
    case 'deselect':
      renderer.setSelection(null);
      break;
    case 'flip':
      renderer.setFaceUp(result.cell.r, result.cell.c, game.board.get(result.cell.r, result.cell.c));
      audio.playSelect();
      vibrate([5]);
      break;
    case 'match':
      renderer.setSelection(null);
      if (result.path) {
        const color = getThemeColor();
        renderer.drawPath(result.path, color, 350);
      }
      audio.playMatch();
      vibrate([15]);
      spawnMatchBurst(result.a, result.b);
      renderer.clearTiles(result.a, result.b);
      if (game.combo >= 2) {
        showToast('🔥' + game.combo + '连');
        audio.playCombo();
      }
      if (result.shuffled) {
        setTimeout(() => {
          renderer.refreshAll();
          showToast('🔀 自动洗牌');
          audio.playShuffle();
        }, 320);
      }
      break;
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.flashMiss(result.current.r, result.current.c);
      audio.playMiss();
      vibrate([30]);
      if (game.memory) {
        setTimeout(() => {
          game.resolveMemoryMismatch();
          renderer.setFaceDown(result.prev.r, result.prev.c);
          renderer.setFaceDown(result.current.r, result.current.c);
        }, 600);
      } else {
        renderer.setSelection(result.current.r, result.current.c);
      }
      break;
    case 'win':
      renderer.setSelection(null);
      if (result.path) {
        const color = getThemeColor();
        renderer.drawPath(result.path, color, 350);
      }
      spawnMatchBurst(result.a, result.b);
      renderer.clearTiles(result.a, result.b);
      audio.playWin();
      vibrate([100, 50, 100, 50, 200]);
      setTimeout(() => {
        const rect = boardEl.getBoundingClientRect();
        effects.spawnCelebrate(rect.width, rect.height);
        showWinPanel();
      }, 500);
      break;
  }
  scoreEl.textContent = String(game.score);
  syncComboUi();
}

function getThemeColor() {
  return getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#ff7043';
}

function spawnMatchBurst(a, b) {
  const rect = boardEl.getBoundingClientRect();
  const cellW = rect.width / game.board.cols;
  const cellH = rect.height / game.board.rows;
  const ax = (a.c - 0.5) * cellW;
  const ay = (a.r - 0.5) * cellH;
  const bx = (b.c - 0.5) * cellW;
  const by = (b.r - 0.5) * cellH;
  const colors = ['#ffeb3b','#ff9800','#4caf50','#f44336'];
  effects.spawnBurst(ax, ay, colors, 8);
  effects.spawnBurst(bx, by, colors, 8);
}

function syncComboUi() {
  if (game.combo >= 2) {
    comboBlock.classList.remove('hidden');
    comboEl.textContent = String(game.combo);
  } else {
    comboBlock.classList.add('hidden');
  }
}

function syncTimerUi() {
  if (!game.timed) {
    timerBlock.classList.add('hidden');
    timerBlock.classList.remove('warn');
    return;
  }
  timerBlock.classList.remove('hidden');
  // 计时模式显示倒计时（剩余），不显示已用时间——对小朋友更直观
  const limitMs = game._timeLimitMs();
  const remainMs = Math.max(0, limitMs - game.elapsedMs);
  const sec = Math.ceil(remainMs / 1000);
  const min = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  timerEl.textContent = `${min}:${ss}`;
  // 最后 30s 变红警示
  timerBlock.classList.toggle('warn', remainMs <= 30_000 && remainMs > 0);
}

// 提示 / 洗牌
const HINT_COOLDOWN_MS = 4000;
let hintCooldownUntil = 0;
const hintBtn = document.getElementById('hint-btn');
hintBtn.addEventListener('click', () => {
  if (game.memory) return;  // 入门档不显示但兜底
  const now = performance.now();
  if (now < hintCooldownUntil) return;  // 冷却中
  audio.unlock();
  const sol = game.useHint();
  if (sol) {
    audio.playHint();
    renderer.clearHint();
    renderer.applyHint(sol.a, sol.b);
    setTimeout(() => renderer.clearHint(), 800);
    // 启动冷却：按钮变灰 + 不可点 4s
    hintCooldownUntil = now + HINT_COOLDOWN_MS;
    hintBtn.disabled = true;
    setTimeout(() => { hintBtn.disabled = false; }, HINT_COOLDOWN_MS);
  }
});
document.getElementById('shuffle-btn').addEventListener('click', () => {
  if (game.memory) return;
  audio.unlock();
  const ok = game.forceShuffle();
  if (ok) {
    audio.playShuffle();
    renderer.refreshAll();
    showToast('🔀');
    vibrate([50]);
  }
});

// 入门档隐藏底栏按钮
function syncBottomBar() {
  document.getElementById('hint-btn').classList.toggle('hidden', game.memory);
  document.getElementById('shuffle-btn').classList.toggle('hidden', game.memory);
}
syncBottomBar();

// 暂停按钮 + overlay
let manualPause = false;
const pauseOverlay = document.getElementById('pause-overlay');
function setManualPause(p) {
  manualPause = !!p;
  pauseOverlay.classList.toggle('hidden', !manualPause);
  if (manualPause) acquirePause('manual'); else releasePause('manual');
}
pauseOverlay.addEventListener('click', () => setManualPause(false));
document.getElementById('pause-btn').addEventListener('click', () => setManualPause(!manualPause));

// 重启确认
function askRestart() {
  document.getElementById('restart-confirm').classList.remove('hidden');
  document.getElementById('restart-cancel').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
  };
  document.getElementById('restart-ok').onclick = () => {
    document.getElementById('restart-confirm').classList.add('hidden');
    settings.close();
    restartGame(settings.state.difficulty);
  };
}
function askDifficultyChange(newDiff) {
  // 切难度直接生效——已经在设置面板里二次点击了，再加确认是冗余
  settings.state.difficulty = newDiff;
  settings.save();
  settings._syncUi();
  restartGame(newDiff);
}

function restartGame(difficulty) {
  game = new Game(difficulty);
  game.timed = settings.state.timed || DIFFICULTIES[difficulty].timed;
  game.relaxed = !!settings.state.relaxed;
  game.onLose(showLosePanel);  // 新 Game 实例需要重新挂回调
  renderer.mount(game);
  syncBottomBar();
  syncComboUi();
  syncTimerUi();
  scoreEl.textContent = '0';
  clearSave();
}

// gameover
function showWinPanel() {
  acquirePause('gameover');
  const panel = document.getElementById('gameover-panel');
  document.getElementById('gameover-emoji').textContent = '🏆';
  document.getElementById('final-score').textContent = String(game.score);
  const sec = Math.max(0, Math.floor(game.elapsedMs / 1000));
  const min = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  document.getElementById('final-time').textContent = `${min}:${ss}`;
  document.getElementById('final-time-row').style.display = '';
  settings.recordHighScore(game.difficulty, game.score, game.elapsedMs);
  panel.classList.remove('hidden');
  const share = document.getElementById('share-btn');
  if (navigator.share) share.classList.remove('hidden'); else share.classList.add('hidden');
}
function showLosePanel() {
  acquirePause('gameover');
  const panel = document.getElementById('gameover-panel');
  document.getElementById('gameover-emoji').textContent = '⏰';
  document.getElementById('final-score').textContent = String(game.score);
  document.getElementById('final-time-row').style.display = 'none';
  panel.classList.remove('hidden');
}
game.onLose && game.onLose(showLosePanel);

document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('gameover-panel').classList.add('hidden');
  releasePause('gameover');
  restartGame(game.difficulty);
});
document.getElementById('share-btn').addEventListener('click', async () => {
  const text = `🎯 我在连连看（${diffLabel(game.difficulty)}）通关，用时 ${formatTime(game.elapsedMs)}！`;
  try {
    await navigator.share({ title: '连连看', text, url: location.href });
  } catch (e) {
    try {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast('📋');
    } catch (err) {}
  }
});
function diffLabel(d) {
  return { beginner:'🌱 入门', novice:'⭐ 初级', advanced:'🔥 进阶', master:'💎 高手' }[d] || d;
}
function formatTime(ms) {
  const sec = Math.max(0, Math.floor(ms/1000));
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

// 主循环
let last = performance.now();
function loop(now) {
  const dt = now - last;
  last = now;
  game.step(dt);
  effects.step(dt);
  renderer.step(now);
  syncTimerUi();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 切后台 → 暂停 + 存盘
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    acquirePause('visibility');
    persistSave();
  } else {
    releasePause('visibility');
  }
});

// 键盘快捷键（桌面）
window.addEventListener('keydown', (e) => {
  if ((e.target.tagName || '').toLowerCase() === 'input') return;
  if (e.key === 'Escape') {
    const s = document.getElementById('settings-panel');
    const h = document.getElementById('help-panel');
    const rc = document.getElementById('restart-confirm');
    if (!rc.classList.contains('hidden')) { rc.classList.add('hidden'); return; }
    if (!s.classList.contains('hidden')) { settings.close(); return; }
    if (!h.classList.contains('hidden')) { h.classList.add('hidden'); releasePause('help'); return; }
  } else if (e.key === 'p' || e.key === 'P') {
    const open = !document.getElementById('settings-panel').classList.contains('hidden')
              || !document.getElementById('help-panel').classList.contains('hidden')
              || !document.getElementById('gameover-panel').classList.contains('hidden');
    if (!open) setManualPause(!manualPause);
  }
});

// toast 工具
let toastTimer = null;
function showToast(text) {
  const t = document.getElementById('clear-toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  t.offsetHeight;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 1000);
}

function vibrate(pattern) {
  if (GlobalSettings.get('fxLevel') === 'off') return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

// PWA
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
