// game.js — 打砖块核心逻辑
// 坐标系：cell 单位，原点左上。row=0 顶部，row=17 底部。
// board[r][c] = 砖块 value（0 = 空），by 4.2 BRICK_DEFS。
// 球：{x, y, vx, vy} 浮点 cell。
// 板拍：{ col: 中心列(浮点), widthMul, widthRemainMs }

import { randomBrickValue } from './bricks.js';
import {
  reflectFromBrick,
  paddleReflectionAngle,
  sweepAgainstBrick,
} from './physics.js';

export const COLS = 12;
export const ROWS = 18;
export const BALL_RADIUS = 0.3;
export const PADDLE_BASE_WIDTH = 3;       // cell
export const PADDLE_Y = 16;                // 板拍中心行（距底 2 格）
export const PADDLE_HALF_HEIGHT = 0.25;   // cell
export const INITIAL_BRICK_ROWS = 4;
export const SPEED_TABLE   = [6, 8, 10, 12, 14];   // 球速 cell/s（档位 1-5）
export const DESCENT_TABLE = [8000, 7000, 5000, 4000, 3000];  // 砖块下移间隔 ms

export class GameLogic {
  constructor() {
    this.cols = COLS;
    this.rows = ROWS;
    this.score = 0;
    this.combo = 1;
    this.paused = false;
    this.gameOver = false;
    this.endMode = 'endless';     // 'standard' | 'endless'
    this.speedLevel = 2;

    this.board = this._newBoard();
    this._seedInitialBricks();

    this.paddle = {
      col: COLS / 2,
      widthMul: 1,
      widthRemainMs: 0,
    };

    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;   // ms 倒计时，到 0 后随机角度发射
    this.brickDescentTimer = DESCENT_TABLE[this.speedLevel - 1];
    this.slowRemainMs = 0;
    this.fallingItem = null;

    this._onLock = null;
    this._onBrick = null;
    this._onDrop = null;
    this._onGameOver = null;
    this._onPaddleHit = null;
    this._onPowerup = null;
    this._onTopOut = null;
    this._onScoreChange = null;
    this._onComboChange = null;

    this._rng = Math.random;
  }

  _newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  _seedInitialBricks() {
    for (let r = 0; r < INITIAL_BRICK_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.board[r][c] = randomBrickValue(this._rng);
      }
    }
  }

  _spawnBall() {
    return {
      x: this.paddle ? this.paddle.col : COLS / 2,
      y: PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05,
      vx: 0,
      vy: 0,
    };
  }

  _paddleWidth() {
    return PADDLE_BASE_WIDTH * this.paddle.widthMul;
  }

  _paddleHalfWidth() {
    return this._paddleWidth() / 2;
  }

  setPaddleCol(col) {
    const half = this._paddleHalfWidth();
    this.paddle.col = Math.max(half, Math.min(COLS - half, col));
  }

  setPaused(p) { this.paused = !!p; }

  step(dt) {
    if (this.paused || this.gameOver) return;

    if (this.slowRemainMs > 0) this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
    if (this.paddle.widthRemainMs > 0) {
      this.paddle.widthRemainMs = Math.max(0, this.paddle.widthRemainMs - dt);
      if (this.paddle.widthRemainMs === 0) {
        this.paddle.widthMul = 1;
        this.setPaddleCol(this.paddle.col);
      }
    }

    if (this.ballRespawnTimer > 0) {
      this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - dt);
      for (const b of this.balls) {
        b.x = this.paddle.col;
        b.y = PADDLE_Y - PADDLE_HALF_HEIGHT - BALL_RADIUS - 0.05;
        b.vx = 0;
        b.vy = 0;
      }
      if (this.ballRespawnTimer === 0) this._launchAllBalls();
      return;
    }

    // 推进所有球
    const dtSec = dt / 1000;
    for (const ball of this.balls) {
      this._stepBall(ball, dtSec);
    }
    // 移除掉底的球
    const survivors = this.balls.filter((b) => b.y < ROWS);
    if (survivors.length < this.balls.length) {
      this.balls = survivors;
      if (this.balls.length === 0) {
        this._handleDrop();
      }
    }
  }

  _stepBall(ball, dtSec) {
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dtSec / 0.4));
    const subDt = dtSec / steps;
    for (let i = 0; i < steps; i++) {
      const prev = { x: ball.x, y: ball.y };
      let nx = ball.x + ball.vx * subDt;
      let ny = ball.y + ball.vy * subDt;

      if (nx < BALL_RADIUS) { nx = BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
      else if (nx > COLS - BALL_RADIUS) { nx = COLS - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }

      if (ny < BALL_RADIUS) { ny = BALL_RADIUS; ball.vy = Math.abs(ball.vy); }

      ball.x = nx;
      ball.y = ny;

      // 板拍命中（仅当球向下移动）
      if (ball.vy > 0) {
        const half = this._paddleHalfWidth();
        const padL = this.paddle.col - half;
        const padR = this.paddle.col + half;
        const padT = PADDLE_Y - PADDLE_HALF_HEIGHT;
        const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
        // 球底沿（球中心 + radius）越过板拍上沿
        if (ball.y + BALL_RADIUS >= padT && ball.y - BALL_RADIUS <= padB
            && ball.x >= padL && ball.x <= padR) {
          const hitOffset = (ball.x - this.paddle.col) / half;
          const r = paddleReflectionAngle({ vx: ball.vx, vy: ball.vy }, hitOffset);
          ball.vx = r.vx;
          ball.vy = r.vy;
          ball.y = padT - BALL_RADIUS - 0.01;   // 推出板拍上沿，防止反复命中
          if (this._onPaddleHit) this._onPaddleHit();
        }
      }
    }
  }

  _handleDrop() {
    this.combo = 1;
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onDrop) this._onDrop();
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
  }

  _launchAllBalls() {
    const baseSpeed = SPEED_TABLE[this.speedLevel - 1];
    const mul = this.slowRemainMs > 0 ? 0.7 : 1;
    for (const b of this.balls) {
      // 向上 ±45° 随机
      const angle = (this._rng() * 90 - 45) * Math.PI / 180;
      const sp = baseSpeed * mul;
      b.vx = sp * Math.sin(angle);
      b.vy = -sp * Math.cos(angle);
    }
  }

  // 事件钩子
  onLock(fn)        { this._onLock = fn; }
  onBrick(fn)       { this._onBrick = fn; }
  onDrop(fn)        { this._onDrop = fn; }
  onPaddleHit(fn)   { this._onPaddleHit = fn; }
  onPowerup(fn)     { this._onPowerup = fn; }
  onTopOut(fn)      { this._onTopOut = fn; }
  onGameOver(fn)    { this._onGameOver = fn; }
  onScoreChange(fn) { this._onScoreChange = fn; }
  onComboChange(fn) { this._onComboChange = fn; }
}
