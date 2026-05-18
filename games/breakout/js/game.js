// game.js — 打砖块核心逻辑
// 坐标系：cell 单位，原点左上。row=0 顶部，row=17 底部。
// board[r][c] = 砖块 value（0 = 空），by 4.2 BRICK_DEFS。
// 球：{x, y, vx, vy} 浮点 cell。
// 板拍：{ col: 中心列(浮点), widthMul, widthRemainMs }

import { randomBrickValue, brickMaxHp } from './bricks.js';
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
export const DESCENT_TABLE = [20000, 15000, 12000, 10000, 9000];  // 砖块下移间隔 ms
// 平衡推导：每个 descent 顶部生成 12 块新砖；玩家每 round-trip 平均消 ~1.5 块，
// 平均 round-trip 距离 ≈ 20 cell。目标 6 round-trips/descent → 消 9 砖 vs 新生 12 砖，
// 净 -3 砖/descent（轻度负反馈，挑战 endless）。descent = 6 × (20/球速)。

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
    this._rng = Math.random;     // 必须在 _seedInitialBricks 之前——后者会用

    this.board = this._newBoard();
    this.brickHp = this._newBoard();   // 与 board 同形，存当前 HP（0 = 空 / 已破）
    this._seedInitialBricks();

    this.paddle = {
      col: COLS / 2,
      widthMul: 1,
      widthRemainMs: 0,
    };

    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;   // ms 倒计时，到 0 后随机角度发射
    this.brickDescentTimer = DESCENT_TABLE[this.speedLevel - 1];
    this.descentRateMul = 1.0;   // settings 可调（默认 1.0；UI 默认设 0.6 让初次体验更友好）
    this.slowRemainMs = 0;
    this.fallingItem = null;
    this.sessionSpeedBonus = 1.0;   // 本局得分驱动的球速倍率（1.0 → 1.4 渐增）
    this.comboDecayTimer = 0;        // > 0 时倒计时；归零自动 combo→1（防"闲"）
    this.bricksSinceLastPowerup = 0; // 自适应道具触发器（无道具时累计；满 22 强制掉）
    this._aimRefCol = null;          // 倒计时开始时板拍位置；离基准越远，发射角越偏

    this._onBrick = null;
    this._onDrop = null;
    this._onGameOver = null;
    this._onPaddleHit = null;
    this._onPowerup = null;
    this._onTopOut = null;
    this._onScoreChange = null;
    this._onComboChange = null;
  }

  _newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  /** 稀疏的一行：12 列里随机 7-9 个填砖，其余空格。返回 { values, hps } 同步对。 */
  _makeSparseRow() {
    const count = 7 + Math.floor(this._rng() * 3);   // 7..9
    const positions = Array.from({ length: COLS }, (_, i) => i);
    // Fisher-Yates 随机抽 count 个位置
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const values = Array(COLS).fill(0);
    const hps = Array(COLS).fill(0);
    for (let i = 0; i < count; i++) {
      const v = randomBrickValue(this._rng);
      values[positions[i]] = v;
      hps[positions[i]] = brickMaxHp(v);
    }
    return { values, hps };
  }

  _seedInitialBricks() {
    for (let r = 0; r < INITIAL_BRICK_ROWS; r++) {
      const row = this._makeSparseRow();
      this.board[r] = row.values;
      this.brickHp[r] = row.hps;
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

    if (this.slowRemainMs > 0) {
      this.slowRemainMs = Math.max(0, this.slowRemainMs - dt);
      this._slowWasActive = true;
      if (this.slowRemainMs === 0) {
        // 同帧恢复，避免下一帧才除回去导致一帧仍是慢速
        for (const b of this.balls) { b.vx /= 0.7; b.vy /= 0.7; }
        this._slowWasActive = false;
      }
    } else if (this._slowWasActive) {
      // 兜底：restore() 之类外部直接清 slowRemainMs 时也能恢复
      for (const b of this.balls) { b.vx /= 0.7; b.vy /= 0.7; }
      this._slowWasActive = false;
    }
    if (this.paddle.widthRemainMs > 0) {
      this.paddle.widthRemainMs = Math.max(0, this.paddle.widthRemainMs - dt);
      if (this.paddle.widthRemainMs === 0) {
        this.paddle.widthMul = 1;
        this.setPaddleCol(this.paddle.col);
      }
    }

    // Combo 衰减：超过 4s 没击中砖 → combo 归 1（防玩家"闲游"刷高 combo）
    if (this.comboDecayTimer > 0 && this.combo > 1) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        this.combo = 1;
        if (this._onComboChange) this._onComboChange(this.combo);
      }
    }

    // 砖块下移定时器 —— 三因素叠加节流：
    //   1) 慢球生效 × 0.7（跟球速一致，避免减速包反成负反馈）
    //   2) descentRateMul：玩家在设置里手调的"下移速度"独立倍率
    //   3) （DESCENT_TABLE 自身的档位差异是 reset 时设的，不影响计时器扣减节奏）
    const slowMul = this.slowRemainMs > 0 ? 0.7 : 1;
    const descentMul = slowMul * this.descentRateMul;
    this.brickDescentTimer -= dt * descentMul;
    if (this.brickDescentTimer <= 0) {
      this.brickDescentTimer += DESCENT_TABLE[this.speedLevel - 1];
      this._descendBricks();
    }
    if (this.gameOver) return;

    if (this.ballRespawnTimer > 0) {
      this.ballRespawnTimer = Math.max(0, this.ballRespawnTimer - dt);
      // 倒计时第一帧锚定瞄准基准列；之后玩家拖动板拍偏离基准 = 发射角偏向
      if (this._aimRefCol === null) this._aimRefCol = this.paddle.col;
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

    // 道具下落（板拍接 / 漏接）
    if (this.fallingItem) {
      const itemSpeedY = SPEED_TABLE[this.speedLevel - 1] * 0.5 * (dt / 1000);
      this.fallingItem.y += itemSpeedY;
      const half = this._paddleHalfWidth();
      const padT = PADDLE_Y - PADDLE_HALF_HEIGHT - 0.3;
      const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
      const padL = this.paddle.col - half;
      const padR = this.paddle.col + half;
      if (this.fallingItem.y >= padT && this.fallingItem.y <= padB
          && this.fallingItem.x >= padL && this.fallingItem.x <= padR) {
        this._applyPowerup(this.fallingItem.type);
        this.fallingItem = null;
      } else if (this.fallingItem.y >= ROWS) {
        this.fallingItem = null;
      }
    }
  }

  _stepBall(ball, dtSec) {
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dtSec / 0.4));
    const subDt = dtSec / steps;
    for (let i = 0; i < steps; i++) {
      const prev = { x: ball.x, y: ball.y };
      const next = {
        x: ball.x + ball.vx * subDt,
        y: ball.y + ball.vy * subDt,
      };

      // 1. 砖块碰撞（找最近一个 hit）
      const brickHit = this._findBrickHit(prev, next);
      if (brickHit) {
        const r = reflectFromBrick({ vx: ball.vx, vy: ball.vy }, brickHit.side);
        ball.vx = r.vx;
        ball.vy = r.vy;
        ball.x = brickHit.contactX;
        ball.y = brickHit.contactY;
        this._onBrickHit(brickHit.col, brickHit.row);
        continue;   // 这一子步消耗在砖上，直接进下一子步
      }

      // 2. 没撞砖 → 推进
      let nx = next.x, ny = next.y;

      if (nx < BALL_RADIUS) { nx = BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
      else if (nx > COLS - BALL_RADIUS) { nx = COLS - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }

      if (ny < BALL_RADIUS) { ny = BALL_RADIUS; ball.vy = Math.abs(ball.vy); }

      ball.x = nx;
      ball.y = ny;

      // 3. 板拍
      if (ball.vy > 0) {
        const half = this._paddleHalfWidth();
        const padL = this.paddle.col - half;
        const padR = this.paddle.col + half;
        const padT = PADDLE_Y - PADDLE_HALF_HEIGHT;
        const padB = PADDLE_Y + PADDLE_HALF_HEIGHT;
        if (ball.y + BALL_RADIUS >= padT && ball.y - BALL_RADIUS <= padB
            && ball.x >= padL && ball.x <= padR) {
          const hitOffset = (ball.x - this.paddle.col) / half;
          const r = paddleReflectionAngle({ vx: ball.vx, vy: ball.vy }, hitOffset);
          ball.vx = r.vx;
          ball.vy = r.vy;
          ball.y = padT - BALL_RADIUS - 0.01;
          if (this._onPaddleHit) this._onPaddleHit(hitOffset);
        }
      }
    }
  }

  _findBrickHit(prev, next) {
    // 扫一遍 board 找 sweep 命中（粗剔除：只检查 ball 包围盒覆盖的格子）
    const minR = Math.max(0, Math.floor(Math.min(prev.y, next.y) - BALL_RADIUS) - 1);
    const maxR = Math.min(ROWS - 1, Math.ceil(Math.max(prev.y, next.y) + BALL_RADIUS) + 1);
    const minC = Math.max(0, Math.floor(Math.min(prev.x, next.x) - BALL_RADIUS) - 1);
    const maxC = Math.min(COLS - 1, Math.ceil(Math.max(prev.x, next.x) + BALL_RADIUS) + 1);
    let best = null;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.board[r][c] === 0) continue;
        const h = sweepAgainstBrick(prev, next, c, r, BALL_RADIUS);
        if (h && (best === null || h.t < best.t)) {
          best = { ...h, col: c, row: r };
        }
      }
    }
    return best;
  }

  _onBrickHit(col, row) {
    const value = this.board[row][col];
    if (value === 0) return;   // 已被清空的格不算命中（防 race）
    // HP -1
    this.brickHp[row][col] = Math.max(0, (this.brickHp[row][col] || 1) - 1);
    const killed = this.brickHp[row][col] === 0;

    if (!killed) {
      // 只是磕了一下，没碎：通知，给一点 combo（不归零，但也不进）
      this.comboDecayTimer = 4000;   // 命中算"还在玩"，重置 combo 衰减
      if (this._onBrick) this._onBrick({ col, row, value, killed: false });
      return;
    }

    // killed：与 V1 一致的全套结算
    this.board[row][col] = 0;
    this.score += value * this.combo;
    if (this.combo < 10) this.combo++;
    this.comboDecayTimer = 4000;
    if (this._onScoreChange) this._onScoreChange(this.score);
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onBrick) this._onBrick({ col, row, value, killed: true });

    // 球速本局内随得分缓慢爬升（避免长局机械感）：每 300 分 +5%，上限 1.4×
    const targetBonus = Math.min(1.4, 1 + Math.floor(this.score / 300) * 0.05);
    if (targetBonus !== this.sessionSpeedBonus) {
      const ratio = targetBonus / this.sessionSpeedBonus;
      for (const b of this.balls) { b.vx *= ratio; b.vy *= ratio; }
      this.sessionSpeedBonus = targetBonus;
    }

    // 道具掉落：基础 8% 概率；连续 22 砖没掉过道具时强制掉一个（自适应保底）
    this.bricksSinceLastPowerup++;
    if (this.fallingItem === null) {
      const forced = this.bricksSinceLastPowerup >= 22;
      if (forced || this._rng() < 0.08) {
        const pool = ['wider', 'multi', 'slow'];
        const type = pool[Math.floor(this._rng() * pool.length)];
        this.fallingItem = { type, x: col + 0.5, y: row + 0.5 };
        this.bricksSinceLastPowerup = 0;
      }
    }
  }

  _applyPowerup(type) {
    if (type === 'wider') {
      this.paddle.widthMul = 1.6;
      this.paddle.widthRemainMs = 12000;
      this.setPaddleCol(this.paddle.col);
    } else if (type === 'slow') {
      // 若已经在慢球状态，只延长计时，不二次降速（防止叠加后永久 0.49×）
      const wasActive = this.slowRemainMs > 0;
      this.slowRemainMs = 10000;
      if (!wasActive) {
        for (const b of this.balls) {
          b.vx *= 0.7;
          b.vy *= 0.7;
        }
        this._slowWasActive = true;
      }
    } else if (type === 'multi') {
      const copies = this.balls.map((b) => ({
        x: b.x,
        y: b.y,
        vx: -b.vx || (this._rng() < 0.5 ? -3 : 3),
        vy: b.vy,
      }));
      this.balls = [...this.balls, ...copies];
    }
    if (this._onPowerup) this._onPowerup(type);
  }

  _handleDrop() {
    this.combo = 1;
    this.comboDecayTimer = 0;
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onDrop) this._onDrop();
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
  }

  _descendBricks() {
    // 检查是否会压到板拍（任意砖下沿越过 PADDLE_Y - PADDLE_HALF_HEIGHT）
    // 当前最低有砖的行 + 1 = 下沿
    let lowestBrickRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].some((v) => v > 0)) { lowestBrickRow = r; break; }
    }
    // 下移后最低砖在 lowestBrickRow + 1
    const wouldHitPaddle = lowestBrickRow + 1 + 1 > PADDLE_Y - PADDLE_HALF_HEIGHT;
    if (lowestBrickRow >= 0 && wouldHitPaddle) {
      this._handleTopOut();
      return;
    }
    // 安全：所有砖（含 HP）下移 1 行 + 顶部新生成一行（稀疏）
    for (let r = ROWS - 1; r > 0; r--) {
      for (let c = 0; c < COLS; c++) {
        this.board[r][c] = this.board[r - 1][c];
        this.brickHp[r][c] = this.brickHp[r - 1][c];
      }
    }
    const newRow = this._makeSparseRow();
    this.board[0] = newRow.values;
    this.brickHp[0] = newRow.hps;
  }

  _handleTopOut() {
    if (this.endMode === 'standard') {
      this.gameOver = true;
      if (this._onGameOver) this._onGameOver('standard');
      return;
    }
    // endless：清前 9 行，row 9..17 → row 0..8，row 9..17 清空（含 HP 同步）
    const upper = this.board.slice(9, ROWS).map((row) => row.slice());
    const upperHp = this.brickHp.slice(9, ROWS).map((row) => row.slice());
    const empty = Array.from({ length: 9 }, () => Array(COLS).fill(0));
    const emptyHp = Array.from({ length: 9 }, () => Array(COLS).fill(0));
    this.board = [...upper, ...empty];
    this.brickHp = [...upperHp, ...emptyHp];
    this.combo = 1;
    this.comboDecayTimer = 0;
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
    if (this._onComboChange) this._onComboChange(this.combo);
    if (this._onTopOut) this._onTopOut();
  }

  _launchAllBalls() {
    const baseSpeed = SPEED_TABLE[this.speedLevel - 1];
    const mul = this.slowRemainMs > 0 ? 0.7 : 1;
    // 玩家瞄准：倒计时期间板拍偏离基准位置 → 偏向。max ±1.5 cell 偏移 → ±60°
    const aimDelta = this._aimRefCol === null ? 0 : (this.paddle.col - this._aimRefCol);
    const aimAngleDeg = Math.max(-60, Math.min(60, aimDelta * 40));   // 1 cell 偏移 ≈ 40°
    const aimRad = aimAngleDeg * Math.PI / 180;
    this._aimRefCol = null;   // 用完清零，下次倒计时重新锚定
    for (const b of this.balls) {
      // 基础角度 = 玩家瞄准；多球之间加 ±15° 微随机散开
      const jitter = (this._rng() * 30 - 15) * Math.PI / 180;
      const angle = aimRad + jitter;
      const sp = baseSpeed * mul * this.sessionSpeedBonus;
      b.vx = sp * Math.sin(angle);
      b.vy = -sp * Math.cos(angle);
    }
  }

  serialize() {
    return {
      v: 1,
      score: this.score,
      combo: this.combo,
      endMode: this.endMode,
      speedLevel: this.speedLevel,
      board: this.board.map((row) => row.slice()),
      paddle: { ...this.paddle },
      balls: this.balls.map((b) => ({ ...b })),
      fallingItem: this.fallingItem ? { ...this.fallingItem } : null,
      brickDescentTimer: this.brickDescentTimer,
      ballRespawnTimer: this.ballRespawnTimer,
      slowRemainMs: this.slowRemainMs,
      gameOver: this.gameOver,
      sessionSpeedBonus: this.sessionSpeedBonus,
      comboDecayTimer: this.comboDecayTimer,
      bricksSinceLastPowerup: this.bricksSinceLastPowerup,
      brickHp: this.brickHp.map((row) => row.slice()),
    };
  }

  restore(snap) {
    if (!snap || snap.v !== 1) return false;
    // 维度校验：corrupt 存档（手改 localStorage / 跨版本不兼容）不应让游戏崩
    if (!Array.isArray(snap.board) || snap.board.length !== ROWS) return false;
    if (!snap.board.every((row) => Array.isArray(row) && row.length === COLS)) return false;
    if (!Array.isArray(snap.balls) || snap.balls.length === 0) return false;
    if (!snap.paddle || typeof snap.paddle.col !== 'number') return false;
    this.score = snap.score;
    this.combo = snap.combo;
    this.endMode = snap.endMode === 'standard' ? 'standard' : 'endless';
    this.speedLevel = Math.max(1, Math.min(5, snap.speedLevel | 0)) || 2;
    this.board = snap.board.map((row) => row.slice());
    this.paddle = { ...snap.paddle };
    this.balls = snap.balls.map((b) => ({ ...b }));
    this.fallingItem = snap.fallingItem ? { ...snap.fallingItem } : null;
    this.brickDescentTimer = snap.brickDescentTimer;
    this.ballRespawnTimer = snap.ballRespawnTimer;
    this.slowRemainMs = snap.slowRemainMs;
    this.gameOver = !!snap.gameOver;
    this.sessionSpeedBonus = snap.sessionSpeedBonus || 1.0;
    this.comboDecayTimer = snap.comboDecayTimer || 0;
    this.bricksSinceLastPowerup = snap.bricksSinceLastPowerup || 0;
    // brickHp 在 V1 存档里不存在；缺失时从 board 推算（按 brickMaxHp）兜底
    if (Array.isArray(snap.brickHp) && snap.brickHp.length === ROWS) {
      this.brickHp = snap.brickHp.map((row) => row.slice());
    } else {
      this.brickHp = this.board.map((row) => row.map((v) => v > 0 ? brickMaxHp(v) : 0));
    }
    this._slowWasActive = this.slowRemainMs > 0;
    return true;
  }

  reset() {
    this.score = 0;
    this.combo = 1;
    this.gameOver = false;
    this.paused = false;   // game-over 期间打开过 help/settings 面板会留下 paused=true，replay 后必须清掉
    this.board = this._newBoard();
    this.brickHp = this._newBoard();
    this._seedInitialBricks();
    this.paddle = { col: COLS / 2, widthMul: 1, widthRemainMs: 0 };
    this.balls = [this._spawnBall()];
    this.ballRespawnTimer = 1500;
    this.brickDescentTimer = DESCENT_TABLE[this.speedLevel - 1];
    this.slowRemainMs = 0;
    this._slowWasActive = false;
    this.fallingItem = null;
    this.sessionSpeedBonus = 1.0;
    this.comboDecayTimer = 0;
    this.bricksSinceLastPowerup = 0;
    this._aimRefCol = null;
  }

  setSpeedLevel(level) {
    const newLevel = Math.max(1, Math.min(5, level | 0));
    if (newLevel !== this.speedLevel) {
      // 按比例换速；下移定时器按比例缩放
      const oldDescent = DESCENT_TABLE[this.speedLevel - 1];
      const newDescent = DESCENT_TABLE[newLevel - 1];
      this.brickDescentTimer *= newDescent / oldDescent;
      // 球速也按档位重新算
      const oldSp = SPEED_TABLE[this.speedLevel - 1] * (this.slowRemainMs > 0 ? 0.7 : 1);
      const newSp = SPEED_TABLE[newLevel - 1] * (this.slowRemainMs > 0 ? 0.7 : 1);
      const ratio = newSp / oldSp;
      for (const b of this.balls) { b.vx *= ratio; b.vy *= ratio; }
      this.speedLevel = newLevel;
    }
  }

  setEndMode(mode) {
    if (mode === 'standard' || mode === 'endless') this.endMode = mode;
  }

  /** 设置砖块下移速度倍率。<1 = 慢，1 = 基线，>1 = 快。settings 推过来。 */
  setDescentRateMul(mul) {
    const v = Number(mul);
    if (!Number.isFinite(v) || v <= 0) return;
    this.descentRateMul = Math.max(0.1, Math.min(3, v));
  }

  // 事件钩子
  onBrick(fn)       { this._onBrick = fn; }
  onDrop(fn)        { this._onDrop = fn; }
  onPaddleHit(fn)   { this._onPaddleHit = fn; }
  onPowerup(fn)     { this._onPowerup = fn; }
  onTopOut(fn)      { this._onTopOut = fn; }
  onGameOver(fn)    { this._onGameOver = fn; }
  onScoreChange(fn) { this._onScoreChange = fn; }
  onComboChange(fn) { this._onComboChange = fn; }
}
