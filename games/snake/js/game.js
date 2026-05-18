// game.js — 贪吃蛇核心逻辑

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 16;

const FOOD_EMOJI_POOL = ['🍎', '🍓', '🍒', '🍇', '🍌', '🍑', '🥕', '🌽', '🍄'];

const HEAD_POOLS = {
  cheery: ['🐲', '🐯', '🦁', '🐹'],
  candy:  ['🐷', '🐱', '🐰', '🦄'],
  forest: ['🐸', '🐻', '🦊', '🐗'],
  ocean:  ['🐙', '🦀', '🐡', '🐬'],
  space:  ['👽', '🤖', '👾', '🛸'],
  night:  ['🦇', '🦉', '👻', '🐺'],
};

const HEAD_POOLS_TIER2 = {  // ≥100 eats
  cheery: ['🐵'], candy: ['🐶'], forest: ['🦝'],
  ocean:  ['🐳'], space: ['🐍'], night: ['🐈‍⬛'],
};
const HEAD_POOLS_TIER3 = {  // ≥500 eats
  cheery: ['🐴'], candy: ['🐨'], forest: ['🐢'],
  ocean:  ['🦞'], space: ['🌚'], night: ['🦡'],
};

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
    this.theme = 'cheery';
    this.totalFoodEver = 0;
    this.foodEdgeMargin = 1;
    this.tickInterval = TICK_INTERVALS[0];
    this.accumulator = 0;
    this.reviveInvincibleMs = 0;   // > 0 表示无敌期内
    this.foodEmoji = '🍎';
    this.food = this._spawnFood();
    this.headEmoji = this._pickHead();
    this.foodSpawnAt = performance.now();   // 食物刚生成的时间戳，给 render 做弹出动画
    this.lastEatAt = -10000;                // 上次吃食物时间，给 render 做波纹
    this.comboCount = 0;                    // 连吃 combo 计数
    this.comboLastEatMs = -10000;           // 上次吃食物时间戳，combo 窗口判断用
    this.gameTimeMs = 0;                    // 游戏内累计活动时间（暂停/死亡不计），combo 用

    this._onEat = null;
    this._onDie = null;
    this._onRevive = null;
    this._onWrap = null;
    this._onCombo = null;
    this._onWin = null;
  }

  _spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.row},${s.col}`));
    const margin = this.foodEdgeMargin || 0;

    // 先在"内部区域"找空格（离边 margin 格内不刷）
    const inner = [];
    if (margin > 0
        && BOARD_HEIGHT - margin * 2 > 0
        && BOARD_WIDTH - margin * 2 > 0) {
      for (let r = margin; r < BOARD_HEIGHT - margin; r++) {
        for (let c = margin; c < BOARD_WIDTH - margin; c++) {
          if (!occupied.has(`${r},${c}`)) inner.push({ row: r, col: c });
        }
      }
    }

    if (inner.length > 0) {
      this.foodEmoji = FOOD_EMOJI_POOL[Math.floor(Math.random() * FOOD_EMOJI_POOL.length)];
      this.foodSpawnAt = performance.now();
      return inner[Math.floor(Math.random() * inner.length)];
    }

    // fallback：内部区域全占 / margin=0 → 用全板
    const empty = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (!occupied.has(`${r},${c}`)) empty.push({ row: r, col: c });
      }
    }
    if (empty.length === 0) {
      this.foodEmoji = null;
      this.foodSpawnAt = performance.now();
      return null;
    }
    this.foodEmoji = FOOD_EMOJI_POOL[Math.floor(Math.random() * FOOD_EMOJI_POOL.length)];
    this.foodSpawnAt = performance.now();
    return empty[Math.floor(Math.random() * empty.length)];
  }

  _pickHead() {
    const base = HEAD_POOLS[this.theme] || HEAD_POOLS.cheery;
    let pool = base.slice();
    const total = this.totalFoodEver || 0;
    if (total >= 100 && HEAD_POOLS_TIER2[this.theme]) {
      pool = pool.concat(HEAD_POOLS_TIER2[this.theme]);
    }
    if (total >= 500 && HEAD_POOLS_TIER3[this.theme]) {
      pool = pool.concat(HEAD_POOLS_TIER3[this.theme]);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  setTotalFood(n) {
    this.totalFoodEver = Math.max(0, n | 0);
  }

  setFoodEdgeMargin(n) {
    const v = Math.max(0, Math.min(3, n | 0));
    this.foodEdgeMargin = v;
  }

  setTheme(theme) {
    if (!HEAD_POOLS[theme]) return;
    const themeChanged = this.theme !== theme;
    this.theme = theme;
    // 仅当"无进度初始状态"时切主题才换头（开局前）；
    // 否则等下次 reset() 再洗，避免玩家中途切主题时蛇头突变
    if (themeChanged && this.score === 0 && this.snake.length === 4
        && this.snake[0].row === 8 && this.snake[0].col === 7) {
      this.headEmoji = this._pickHead();
    }
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
  onCombo(cb)  { this._onCombo = cb; }
  onWin(cb)    { this._onWin = cb; }

  queueDirection(dir) {
    if (!DIR_VECTORS[dir]) return;
    // 拒绝 180° 反向：以"队列里下一个"为基准，没有就用 currentDirection
    const ref = this.nextDirection || this.currentDirection;
    if (OPPOSITE[ref] === dir) return;
    this.nextDirection = dir;
  }

  _nextHeadCell() {
    const head = this.snake[0];
    const dir = DIR_VECTORS[this.currentDirection];
    return { row: head.row + dir.dr, col: head.col + dir.dc };
  }

  _hitWall(cell) {
    return cell.row < 0 || cell.row >= BOARD_HEIGHT
        || cell.col < 0 || cell.col >= BOARD_WIDTH;
  }

  /** 检查 cell 是否与蛇身(不含即将弹出的尾)重合 */
  _hitSelf(cell) {
    // 若不吃食物，下一 tick 尾巴会弹出，所以 snake[length-1] 不算冲突
    const eating = this.food && cell.row === this.food.row && cell.col === this.food.col;
    const limit = eating ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].row === cell.row && this.snake[i].col === cell.col) return true;
    }
    return false;
  }

  _advance() {
    if (this.dead) return;

    if (this.nextDirection) {
      this.currentDirection = this.nextDirection;
      this.nextDirection = null;
    }

    let nextHead = this._nextHeadCell();
    const invincible = this.reviveInvincibleMs > 0;

    // 边界处理
    if (this._hitWall(nextHead)) {
      if (this.endMode === 'wrap' || invincible) {
        nextHead = {
          row: (nextHead.row + BOARD_HEIGHT) % BOARD_HEIGHT,
          col: (nextHead.col + BOARD_WIDTH) % BOARD_WIDTH,
        };
        if (this._onWrap) this._onWrap();
      } else if (this.endMode === 'revive') {
        this._triggerRevive();
        return;
      } else {
        this._triggerDie();
        return;
      }
    }

    // 自撞
    let invincibleAteOwnBody = false;
    if (this._hitSelf(nextHead)) {
      if (invincible) {
        // 无敌期穿身体：把身体里跟 nextHead 重合的节段去掉，避免重叠
        this.snake = this.snake.filter(s => !(s.row === nextHead.row && s.col === nextHead.col));
        invincibleAteOwnBody = true;
      } else if (this.endMode === 'revive') {
        this._triggerRevive();
        return;
      } else {
        this._triggerDie();
        return;
      }
    }

    const ate = this.food && nextHead.row === this.food.row && nextHead.col === this.food.col;
    this.snake.unshift(nextHead);
    if (ate) {
      this.score += 1;
      this.lastEatAt = performance.now();
      // combo: 5 秒（游戏内时间）内续吃累加，超过则重置为 1
      if (this.gameTimeMs - this.comboLastEatMs < 5000) this.comboCount++;
      else this.comboCount = 1;
      this.comboLastEatMs = this.gameTimeMs;
      this.food = this._spawnFood();   // 可能 null（棋盘填满）
      if (this._onEat) this._onEat();
      // 每 3 连吃奖励 +1 并触发 combo 回调
      if (this.comboCount >= 3 && this.comboCount % 3 === 0) {
        this.score += 1;
        if (this._onCombo) this._onCombo(this.comboCount);
      }
      // 棋盘填满 → 胜利
      if (!this.food && this.snake.length >= BOARD_WIDTH * BOARD_HEIGHT) {
        this.dead = true;
        if (this._onWin) this._onWin();
        else if (this._onDie) this._onDie();
      }
    } else if (invincibleAteOwnBody) {
      // filter 已移除重合节，不再 pop（保持长度）
    } else {
      this.snake.pop();
    }
  }

  _triggerDie() {
    this.dead = true;
    if (this._onDie) this._onDie();
  }

  _triggerRevive() {
    // 回滚致死那一步：蛇头保持在上一 tick 末位置（什么都不做就是回滚）
    // 砍前 max(2, floor(length/2)) 节
    const keep = Math.max(2, Math.floor(this.snake.length / 2));
    this.snake = this.snake.slice(0, keep);
    // 清队列方向，玩家想转就重新滑
    this.nextDirection = null;
    // 1 秒无敌期
    this.reviveInvincibleMs = 1000;
    if (this._onRevive) this._onRevive();
  }

  _tickInvincibility(dt) {
    if (this.reviveInvincibleMs > 0) {
      this.reviveInvincibleMs = Math.max(0, this.reviveInvincibleMs - dt);
    }
  }

  step(dt) {
    if (this.paused || this.dead) return;
    this._tickInvincibility(dt);
    this.gameTimeMs += dt;
    this.accumulator += dt;
    while (this.accumulator >= this.tickInterval && !this.dead) {
      this.accumulator -= this.tickInterval;
      this._advance();
    }
  }

  reset() {
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
    this.accumulator = 0;
    this.reviveInvincibleMs = 0;
    this.comboCount = 0;
    this.comboLastEatMs = -10000;
    this.gameTimeMs = 0;
    this.food = this._spawnFood();
    this.headEmoji = this._pickHead();
  }

  serialize() {
    return {
      v: 1,
      snake: this.snake.map((s) => ({ row: s.row, col: s.col })),
      currentDirection: this.currentDirection,
      nextDirection: this.nextDirection,
      food: this.food ? { row: this.food.row, col: this.food.col } : null,
      foodEmoji: this.foodEmoji,
      score: this.score,
      reviveInvincibleMs: this.reviveInvincibleMs,
      theme: this.theme,
      headEmoji: this.headEmoji,
      comboCount: this.comboCount,
      comboLastEatMs: this.comboLastEatMs,
      foodEdgeMargin: this.foodEdgeMargin,
      gameTimeMs: this.gameTimeMs,
    };
  }

  restore(snap) {
    if (!snap || snap.v !== 1 || !Array.isArray(snap.snake)) return false;
    try {
      this.snake = snap.snake.map((s) => ({ row: s.row | 0, col: s.col | 0 }));
      this.currentDirection = snap.currentDirection || 'right';
      this.nextDirection = snap.nextDirection || null;
      this.food = snap.food ? { row: snap.food.row | 0, col: snap.food.col | 0 } : null;
      this.foodEmoji = snap.foodEmoji || '🍎';
      this.score = snap.score | 0;
      this.dead = false;
      this.accumulator = 0;
      this.reviveInvincibleMs = Math.max(0, snap.reviveInvincibleMs | 0);
      this.theme = HEAD_POOLS[snap.theme] ? snap.theme : this.theme;
      this.headEmoji = snap.headEmoji || this._pickHead();
      this.comboCount = Number.isFinite(snap.comboCount) ? (snap.comboCount | 0) : 0;
      this.comboLastEatMs = Number.isFinite(snap.comboLastEatMs) ? snap.comboLastEatMs : -10000;
      if (typeof snap.foodEdgeMargin === 'number') {
        this.foodEdgeMargin = Math.max(0, Math.min(3, snap.foodEdgeMargin | 0));
      }
      if (typeof snap.gameTimeMs === 'number' && Number.isFinite(snap.gameTimeMs)) {
        this.gameTimeMs = Math.max(0, snap.gameTimeMs);
      }
      return true;
    } catch (e) {
      console.warn('restore failed:', e);
      return false;
    }
  }
}
