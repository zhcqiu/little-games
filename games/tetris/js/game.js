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

    return p.row !== startRow || p.col !== startCol;
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
    return true;
  }
}
