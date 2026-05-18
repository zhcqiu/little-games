// main.js — 最小可玩版（无音效 / 无设置面板）
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

const boardEl = document.getElementById('board');
const overlayEl = document.getElementById('overlay');

const game = new Game('novice');
const renderer = new Renderer(boardEl, overlayEl);
renderer.mount(game);

const input = new Input(boardEl);
input.onTap((r, c) => {
  const result = game.tap(r, c);
  switch (result.kind) {
    case 'select':
      renderer.setSelection(r, c);
      break;
    case 'deselect':
      renderer.setSelection(null);
      break;
    case 'flip':
      renderer.setFaceUp(result.cell.r, result.cell.c, game.board.get(result.cell.r, result.cell.c));
      break;
    case 'match':
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      if (result.shuffled) {
        setTimeout(() => renderer.refreshAll(), 300);
      }
      break;
    case 'mismatch':
      renderer.flashMiss(result.prev.r, result.prev.c);
      renderer.flashMiss(result.current.r, result.current.c);
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
    case 'win':
      renderer.setSelection(null);
      if (result.path) renderer.drawPath(result.path, '#ff7043');
      renderer.clearTiles(result.a, result.b);
      setTimeout(() => alert('🏆 通关！'), 600);
      break;
  }
});

// rAF 驱动 overlay
function loop(now) {
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
