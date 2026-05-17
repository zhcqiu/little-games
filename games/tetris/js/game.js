// game.js — 核心游戏逻辑
import { PIECES, PIECE_TYPES, getCells, getPieceWidth } from './pieces.js';

const PIECES_COLOR = Object.fromEntries(
  PIECE_TYPES.map((t) => [t, PIECES[t].color])
);

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

/** Fisher-Yates 洗 7 种方块 */
export function createBag() {
  const bag = PIECE_TYPES.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

const SPEEDS = [1500, 1000, 700, 450, 250];

export class Game {
  constructor() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () =>
      Array(BOARD_WIDTH).fill(null)
    );
    this.score = 0;
    this.bag = createBag();
    this.nextBag = createBag();
    this.current = this._spawnNext();
    this.next = this._peekNext();

    this.fallSpeed = 1500;
    this.fallAccumulator = 0;
    this.paused = false;
    this._lockTimer = null;
    this._onLineClear = null;
    this._onGameOver = null;
    this._onLock = null;
    this._endMode = 'standard';
    this.upwardTolerance = 1;
  }

  _drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = this.nextBag;
      this.nextBag = createBag();
    }
    return this.bag.shift();
  }

  _peekNext() {
    if (this.bag.length === 0) {
      this.bag = this.nextBag;
      this.nextBag = createBag();
    }
    return this.bag[0];
  }

  _spawnNext() {
    const type = this._drawFromBag();
    const rotation = 0;
    const width = getPieceWidth(type, rotation);
    const col = Math.floor((BOARD_WIDTH - width) / 2);
    const row = -1;
    return {
      type,
      rotation,
      row,
      col,
      lowWaterMark: row,
    };
  }

  /**
   * 在 (row, col, rotation) 放置 type 是否与棋盘或边界冲突
   */
  _collides(row, col, rotation, type) {
    const cells = getCells(type, rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = row + dr;
      const c = col + dc;
      if (c < 0 || c >= BOARD_WIDTH) return true;
      if (r >= BOARD_HEIGHT) return true;
      if (r < 0) continue;  // spawn buffer 上方，不算冲突
      if (this.board[r][c] !== null) return true;
    }
    return false;
  }

  /**
   * 尝试把当前方块移到 (targetRow, targetCol)。
   * 横向纵向各自从当前位置朝目标方向逐格挪，碰撞就停。
   * @returns {boolean} 是否发生任何移动
   */
  tryMoveTo(targetRow, targetCol) {
    if (!this.current) return false;
    const p = this.current;
    const startRow = p.row;
    const startCol = p.col;

    const colStep = Math.sign(targetCol - startCol);
    while (p.col !== targetCol) {
      const nextCol = p.col + colStep;
      if (this._collides(p.row, nextCol, p.rotation, p.type)) break;
      p.col = nextCol;
    }

    const rowStep = Math.sign(targetRow - p.row);
    while (p.row !== targetRow && rowStep !== 0) {
      const nextRow = p.row + rowStep;
      if (this._collides(nextRow, p.col, p.rotation, p.type)) break;
      p.row = nextRow;
    }

    if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;

    const moved = p.row !== startRow || p.col !== startCol;
    if (moved) this.resetLockTimerIfApplicable();
    return moved;
  }

  /**
   * 尝试旋转。dir = +1 顺时针，-1 逆时针。
   * 旋转后若冲突，按顺序尝试 wall-kick：原位、左 1、右 1、下 1
   * @returns {boolean}
   */
  tryRotate(dir) {
    if (!this.current) return false;
    const p = this.current;
    const newRot = ((p.rotation + dir) % 4 + 4) % 4;
    const kicks = [
      { dr: 0, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: +1 },
      { dr: +1, dc: 0 },
    ];
    for (const { dr, dc } of kicks) {
      if (!this._collides(p.row + dr, p.col + dc, newRot, p.type)) {
        p.row += dr;
        p.col += dc;
        p.rotation = newRot;
        if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;
        this.resetLockTimerIfApplicable();
        return true;
      }
    }
    return false;
  }

  /** 尝试下移一格。失败返回 false。 */
  tryMoveDown() {
    if (!this.current) return false;
    const p = this.current;
    if (this._collides(p.row + 1, p.col, p.rotation, p.type)) return false;
    p.row++;
    if (p.row > p.lowWaterMark) p.lowWaterMark = p.row;
    this.resetLockTimerIfApplicable();
    return true;
  }

  _color(type) {
    return PIECES_COLOR[type];
  }

  /** 把当前方块写入 board，发新块 */
  lockPiece() {
    if (!this.current) return;
    const p = this.current;
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0 && r < BOARD_HEIGHT && c >= 0 && c < BOARD_WIDTH) {
        this.board[r][c] = this._color(p.type);
      }
    }
    this.current = this._spawnNext();
    this.next = this._peekNext();
  }

  _findFullRows() {
    const rows = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (this.board[r].every((c) => c !== null)) rows.push(r);
    }
    return rows;
  }

  _clearRows(rows) {
    rows = rows.slice().sort((a, b) => a - b);
    for (const r of rows.reverse()) {
      this.board.splice(r, 1);
      this.board.unshift(Array(BOARD_WIDTH).fill(null));
    }
    this.score += rows.length;
  }

  setSpeed(level) {
    this.fallSpeed = SPEEDS[Math.max(0, Math.min(4, level - 1))];
  }

  setPaused(p) { this.paused = !!p; }
  setEndMode(m) { this._endMode = m; }
  setUpwardTolerance(n) {
    this.upwardTolerance = Math.max(0, Math.min(2, n | 0));
  }

  onLineClear(cb) { this._onLineClear = cb; }
  onGameOver(cb) { this._onGameOver = cb; }
  onLock(cb) { this._onLock = cb; }

  step(dt) {
    if (this.paused || !this.current) return;

    if (this._lockTimer !== null) {
      this._lockTimer += dt;
      if (this._lockTimer >= 500) {
        this._performLock();
      }
      return;
    }

    this.fallAccumulator += dt;
    while (this.fallAccumulator >= this.fallSpeed) {
      this.fallAccumulator -= this.fallSpeed;
      const moved = this.tryMoveDown();
      if (!moved) {
        this._lockTimer = 0;
        break;
      }
    }
  }

  resetLockTimerIfApplicable() {
    if (this._lockTimer === null) return;
    const p = this.current;
    if (p && !this._collides(p.row + 1, p.col, p.rotation, p.type)) {
      this._lockTimer = null;
    } else {
      this._lockTimer = 0;
    }
  }

  _performLock() {
    if (this._onLock) this._onLock(this.current);
    const p = this.current;
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0 && r < BOARD_HEIGHT && c >= 0 && c < BOARD_WIDTH) {
        this.board[r][c] = this._color(p.type);
      }
    }
    this._lockTimer = null;

    const fullRows = this._findFullRows();
    if (fullRows.length > 0) {
      const colorSnapshots = fullRows.map((r) => this.board[r].slice());
      if (this._onLineClear) this._onLineClear(fullRows, colorSnapshots);
      this._clearRows(fullRows);
    }

    this.current = this._spawnNext();
    this.next = this._peekNext();

    if (this._collides(this.current.row, this.current.col, this.current.rotation, this.current.type)) {
      this._handleGameOver();
    }
  }

  _handleGameOver() {
    if (this._endMode === 'endless') {
      for (let r = 10; r < BOARD_HEIGHT; r++) {
        this.board[r] = Array(BOARD_WIDTH).fill(null);
      }
      this.current = this._spawnNext();
      this.next = this._peekNext();
      if (this._onGameOver) this._onGameOver('endless-reset');
      if (this._collides(this.current.row, this.current.col, this.current.rotation, this.current.type)) {
        if (this._onGameOver) this._onGameOver('standard');
        this.current = null;
      }
    } else {
      if (this._onGameOver) this._onGameOver('standard');
      this.current = null;
    }
  }

  reset() {
    this.board = Array.from({ length: BOARD_HEIGHT }, () =>
      Array(BOARD_WIDTH).fill(null)
    );
    this.score = 0;
    this.bag = createBag();
    this.nextBag = createBag();
    this.current = this._spawnNext();
    this.next = this._peekNext();
    this._lockTimer = null;
    this.fallAccumulator = 0;
  }

  /** 返回当前方块"硬落到底"会在哪一行（不修改状态） */
  computeGhostRow() {
    if (!this.current) return null;
    const p = this.current;
    let r = p.row;
    while (!this._collides(r + 1, p.col, p.rotation, p.type)) r++;
    return r;
  }
}
