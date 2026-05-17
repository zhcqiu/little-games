// main.js — 入口与主循环
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const gameCanvas = document.getElementById('game-canvas');
const game = new Game();
const renderer = new Renderer(gameCanvas, null);
const audio = new Audio();

const input = new Input(
  gameCanvas,
  () => renderer.cellSize,
  () => null   // 蛇没有 "piece" 概念
);

input.on('swipe', (dir) => {
  game.queueDirection(dir);
  audio.playTurn();
});
input.on('pauseChange', (paused) => {
  game.setPaused(paused);
});
input.onFirstTouch(() => {
  audio.unlock();
  if (audio.bgmOn) audio.startBgm();
});

// 桌面方向板
function padDir(dir) {
  audio.unlock();
  game.queueDirection(dir);
  audio.playTurn();
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
  renderer.draw(game, dt);
  document.getElementById('score').textContent = game.score;
  requestAnimationFrame(loop);
}

game.onEat(() => {
  audio.playEat();
});
game.onDie(() => {
  audio.playDie();
});
game.onRevive(() => {
  audio.playRevive();
});
game.onWrap(() => {
  audio.playWrap();
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
window._renderer = renderer;
