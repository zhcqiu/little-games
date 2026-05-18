// render.js — Canvas 绘制
import { brickCssVar } from './bricks.js';
import {
  COLS, ROWS, BALL_RADIUS,
  PADDLE_Y, PADDLE_HALF_HEIGHT,
} from './game.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 24;
    this._theme = this._readTheme();
    this._resize();
    window.addEventListener('resize', this._resize.bind(this));
  }

  _resize() {
    const wrap = this.canvas.parentElement;
    const maxW = wrap.clientWidth - 16;
    const maxH = wrap.clientHeight - 16;
    const cell = Math.min(Math.floor(maxW / COLS), Math.floor(maxH / ROWS));
    this.cellSize = Math.max(8, cell);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = COLS * this.cellSize * dpr;
    this.canvas.height = ROWS * this.cellSize * dpr;
    this.canvas.style.width = COLS * this.cellSize + 'px';
    this.canvas.style.height = ROWS * this.cellSize + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _readTheme() {
    const styles = getComputedStyle(document.body);
    const read = (key, fallback) => styles.getPropertyValue(key).trim() || fallback;
    return {
      bg:      read('--canvas-bg',  '#ffffff'),
      grid:    read('--canvas-grid','rgba(0,0,0,0.06)'),
      brick1:  read('--brick-1',    '#4fc3f7'),
      brick2:  read('--brick-2',    '#81c784'),
      brick3:  read('--brick-3',    '#fff176'),
      brick5:  read('--brick-5',    '#e57373'),
      paddle:  read('--paddle',     '#ff7043'),
      ball:    read('--ball',       '#3e2723'),
      ballStroke: read('--ball-stroke', '#ffffff'),
    };
  }

  refreshTheme() { this._theme = this._readTheme(); }

  _cssVarValue(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  draw(game) {
    const ctx = this.ctx;
    const w = COLS * this.cellSize;
    const h = ROWS * this.cellSize;

    // 抖动
    const shake = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 背景
    ctx.fillStyle = this._theme.bg;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = this._theme.grid;
    ctx.lineWidth = 1;
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellSize + 0.5);
      ctx.lineTo(w, r * this.cellSize + 0.5);
      ctx.stroke();
    }

    // 砖块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = game.board[r][c];
        if (v === 0) continue;
        const key = brickCssVar(v);
        const color = this._cssVarValue(key) || this._theme.brick1;
        this._drawBrick(c, r, color);
      }
    }

    // 板拍
    this._drawPaddle(game);

    // 球
    for (const b of game.balls) this._drawBall(b);

    // 道具
    if (game.fallingItem) this._drawFallingItem(game.fallingItem);

    // ⚠️ 砖块下移预警：descent timer 进入最后 600ms 时顶部闪 ⚠️，让玩家心理预期
    if (game.brickDescentTimer > 0 && game.brickDescentTimer < 600) {
      const t = (600 - game.brickDescentTimer) / 600;   // 0 → 1 越来越急
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * Math.PI * 6);
      ctx.font = `${this.cellSize * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('⚠️', w / 2, 4);
      ctx.globalAlpha = 1;
    }

    // 球贴板倒计时数字
    if (game.ballRespawnTimer > 0) {
      const sec = Math.ceil(game.ballRespawnTimer / 1000);
      ctx.fillStyle = this._theme.paddle;
      ctx.font = `bold ${this.cellSize * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sec), game.paddle.col * this.cellSize, (PADDLE_Y - 2) * this.cellSize);
    }

    // 特效层（粒子 + 闪烁）
    if (this.effects) {
      this.effects.drawParticles(ctx, this.cellSize);
      this.effects.drawFlashes(ctx, w, h);
    }

    ctx.restore();
  }

  _drawBrick(col, row, color) {
    const ctx = this.ctx;
    const x = col * this.cellSize + 1;
    const y = row * this.cellSize + 1;
    const s = this.cellSize - 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, 4);
    else ctx.rect(x, y, s, s);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 2, y + 2, s - 4, 3);
  }

  _drawPaddle(game) {
    const ctx = this.ctx;
    const halfW = (3 * game.paddle.widthMul) / 2;
    const x = (game.paddle.col - halfW) * this.cellSize;
    const y = (PADDLE_Y - PADDLE_HALF_HEIGHT) * this.cellSize;
    const w = 2 * halfW * this.cellSize;
    const h = 2 * PADDLE_HALF_HEIGHT * this.cellSize;
    ctx.fillStyle = this._theme.paddle;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  _drawBall(ball) {
    const ctx = this.ctx;
    const r = BALL_RADIUS * this.cellSize;
    const cx = ball.x * this.cellSize;
    const cy = ball.y * this.cellSize;
    // 投影增加立体感
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = this._theme.ball;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // 高对比描边：保证球在任何主题/砖块色背景下都不被吞
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.strokeStyle = this._theme.ballStroke;
    ctx.stroke();
  }

  _drawFallingItem(item) {
    const ctx = this.ctx;
    const emoji = { wider: '🟪', multi: '🌟', slow: '🐌' }[item.type] || '?';
    ctx.font = `${this.cellSize * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, item.x * this.cellSize, item.y * this.cellSize);
  }
}
