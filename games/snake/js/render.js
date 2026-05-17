// render.js — Canvas 绘制
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 30;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const containerW = parent.clientWidth;
    const containerH = parent.clientHeight;

    this.cellSize = Math.max(8, Math.floor(Math.min(
      containerW / (BOARD_WIDTH + 1),
      containerH / (BOARD_HEIGHT + 1)
    )));

    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _readTheme() {
    const s = getComputedStyle(document.body);
    return {
      canvasBg:    s.getPropertyValue('--canvas-bg').trim()   || '#ffffff',
      canvasGrid:  s.getPropertyValue('--canvas-grid').trim() || 'rgba(0,0,0,0.05)',
      primary:     s.getPropertyValue('--primary').trim()     || '#ff7043',
      primaryDark: s.getPropertyValue('--primary-dark').trim()|| '#e64a19',
    };
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const w = s * BOARD_WIDTH;
    const h = s * BOARD_HEIGHT;
    const offset = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    const theme = this._readTheme();

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = theme.canvasGrid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(w, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, h);
      ctx.stroke();
    }

    this._drawSnake(game, theme);
    this._drawFood(game);

    if (this.effects) this.effects.drawParticles(ctx, dt);

    // 死亡淡化：蛇 dead 时整画面再蒙一层灰
    if (game.dead) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  _drawSnake(game, theme) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const len = game.snake.length;
    const invincible = game.reviveInvincibleMs > 0;
    // 无敌期闪烁：100ms 周期
    const flashOn = invincible
      ? (Math.floor(performance.now() / 100) % 2 === 0)
      : true;
    const baseAlpha = flashOn ? 1.0 : 0.4;

    ctx.fillStyle = theme.primary;
    for (let i = 0; i < len; i++) {
      const seg = game.snake[i];
      // 尾段稍微淡
      const tailFade = 1 - (i / Math.max(len, 1)) * 0.15;
      ctx.globalAlpha = baseAlpha * tailFade;
      this._drawRoundedCell(seg.col * s, seg.row * s, s, s * 0.25);
    }
    ctx.globalAlpha = 1;

    // 蛇头表情：emoji 旋转到行进方向
    if (len > 0) {
      const head = game.snake[0];
      const cx = head.col * s + s / 2;
      const cy = head.row * s + s / 2;
      const angle = {
        right: 0,
        down: Math.PI / 2,
        left: Math.PI,
        up: -Math.PI / 2,
      }[game.currentDirection] || 0;

      ctx.save();
      ctx.globalAlpha = baseAlpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.font = `${s * 0.85}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 用一个朝右的表情；旋转后自然朝任意方向
      // 注：emoji 在不同平台渲染略有差，可换为 😋 / 🙂 / 🐲
      ctx.fillText('🐍', 0, 0);
      ctx.restore();
    }
  }

  _drawRoundedCell(x, y, size, radius) {
    const ctx = this.ctx;
    const inset = 1;
    const w = size - inset * 2;
    const h = size - inset * 2;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w, h, radius);
    ctx.fill();
  }

  _drawFood(game) {
    if (!game.food) return;
    const ctx = this.ctx;
    const s = this.cellSize;
    const cx = game.food.col * s + s / 2;
    const cy = game.food.row * s + s / 2;
    // 脉冲 0.95 ↔ 1.05
    const pulse = 1 + Math.sin(performance.now() / 700 * Math.PI * 2) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.font = `${s * 0.9}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.foodEmoji || '🍎', 0, 0);
    ctx.restore();
  }
}
