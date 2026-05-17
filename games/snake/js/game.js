// game.js — 贪吃蛇核心逻辑

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 16;

const FOOD_EMOJI_POOL = ['🍎', '🍓', '🍒', '🍇', '🍌', '🍑', '🥕', '🌽', '🍄'];

const TICK_INTERVALS = [400, 300, 220, 160, 110];  // 5 档

const DIR_VECTORS = {
  up:    { dr: -1, dc:  0 },
  down:  { dr: +1, dc:  0 },
  left:  { dr:  0, dc: -1 },
  right: { dr:  0, dc: +1 },
};

const OPPOSITE = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

export class Game {
  constructor() {
    this.snake = [
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 8, col: 5 },
      { row: 8, col: 4 },
    ];
    this.currentDirection = 'right';
    this.nextDirection = null;
    this.score = 0;
    this.dead = false;
    this.paused = false;
    this.endMode = 'standard';     // standard | wrap | revive
    this.tickInterval = TICK_INTERVALS[0];
    this.accumulator = 0;
    this.reviveInvincibleMs = 0;   // > 0 表示无敌期内
    this.foodEmoji = '🍎';
    this.food = this._spawnFood();

    this._onEat = null;
    this._onDie = null;
    this._onRevive = null;
    this._onWrap = null;
  }

  _spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.row},${s.col}`));
    const empty = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (!occupied.has(`${r},${c}`)) empty.push({ row: r, col: c });
      }
    }
    if (empty.length === 0) {
      this.foodEmoji = null;
      return null;
    }
    this.foodEmoji = FOOD_EMOJI_POOL[Math.floor(Math.random() * FOOD_EMOJI_POOL.length)];
    return empty[Math.floor(Math.random() * empty.length)];
  }

  setSpeed(level) {
    const i = Math.max(0, Math.min(4, (level | 0) - 1));
    this.tickInterval = TICK_INTERVALS[i];
  }
  setEndMode(m) {
    if (m === 'standard' || m === 'wrap' || m === 'revive') this.endMode = m;
  }
  setPaused(p) { this.paused = !!p; }

  onEat(cb)    { this._onEat = cb; }
  onDie(cb)    { this._onDie = cb; }
  onRevive(cb) { this._onRevive = cb; }
  onWrap(cb)   { this._onWrap = cb; }
}
