// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';

const gameCanvas = document.getElementById('game-canvas');
const game = new Game();
const renderer = new Renderer(gameCanvas, null);   // effects 之后接入

let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  game.step(dt);
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
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

window._game = game;
window._renderer = renderer;
