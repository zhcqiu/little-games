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
}
