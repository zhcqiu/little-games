// main.js — Phase E：接入粒子 + 音效（仍无 settings 面板 / 续玩 / hint / shuffle）
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';

const boardEl = document.getElementById('board');
const overlayEl = document.getElementById('overlay');

const effects = new Effects();
const audio = new Audio();
const game = new Game('novice');
const renderer = new Renderer(boardEl, overlayEl, effects);
renderer.mount(game);

const input = new Input(boardEl);
input.onFirstTouch(() => audio.unlock());

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

input.onTap((r, c) => {
  const result = game.tap(r, c);
  switch (result.kind) {
    case 'select':
      renderer.setSelection(r, c);
      audio.playSelect();
      break;
    case 'deselect':
      renderer.setSelection(null);
      break;
    case 'flip':
      renderer.setFaceUp(result.cell.r, result.cell.c, game.board.get(result.cell.r, result.cell.c));
      audio.playSelect();
      break;
    case 'match':
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      audio.playMatch();
      spawnMatchBurst(result.a, result.b);
      if (result.shuffled) {
        setTimeout(() => renderer.refreshAll(), 300);
      }
      break;
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.flashMiss(result.current.r, result.current.c);
      audio.playMiss();
      if (game.memory) {
        // 等 600ms 翻回
        setTimeout(() => {
          game.resolveMemoryMismatch();
          renderer.setFaceDown(result.prev.r, result.prev.c);
          renderer.setFaceDown(result.current.r, result.current.c);
        }, 600);
      } else {
        renderer.setSelection(result.current.r, result.current.c);
      }
      break;
    case 'win': {
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      audio.playWin();
      const rect = boardEl.getBoundingClientRect();
      effects.spawnCelebrate(rect.width, rect.height);
      setTimeout(() => alert('🏆 通关！'), 600);
      break;
    }
  }
});

// rAF 驱动 overlay + 粒子
let lastFrame = performance.now();
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  effects.step(dt);
  renderer.step(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
