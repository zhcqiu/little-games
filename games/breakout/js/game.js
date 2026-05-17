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
