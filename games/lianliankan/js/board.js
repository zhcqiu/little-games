// board.js — 棋盘表示 + 路径算法 + 无解检测 + 洗牌 + 生成器
// 数据结构：Int8Array size (rows+2)*(cols+2)，外圈一圈 0 作哨兵。
// 内部值 0=空，1..N = emoji 索引。

export const DIFFICULTIES = {
  beginner: { rows: 4,  cols: 4,  emojiTypes: 8,  memory: true,  timed: false },
  novice:   { rows: 6,  cols: 6,  emojiTypes: 9,  memory: false, timed: false },
  advanced: { rows: 8,  cols: 10, emojiTypes: 10, memory: false, timed: false },
  master:   { rows: 10, cols: 12, emojiTypes: 12, memory: false, timed: true },
};

export const EMOJI_POOL = [
  '🍎','🍌','🍇','🍉','🍓','🍑','🥕','🥑','🥦','🌽',
  '🐱','🐶','🐰','🐻','🐼','🦊','🐨','🐯','🦁','🐮',
  '🚗','🚕','🚌','🚒','🚑','🚓','🚜','🛵','🚲','✈️',
  '⭐','🌟','🌈','🌸','🌻','❄️',
];

export class Board {
  constructor(difficulty, rng = Math.random) {
    if (!DIFFICULTIES[difficulty]) throw new Error('unknown difficulty: ' + difficulty);
    this.difficulty = difficulty;
    const d = DIFFICULTIES[difficulty];
    this.rows = d.rows;
    this.cols = d.cols;
    this.memory = d.memory;
    this.timed = d.timed;
    this.emojiTypes = d.emojiTypes;
    this.rng = rng;
    this.data = new Int8Array((this.rows + 2) * (this.cols + 2));
    this.flipped = this.memory ? new Uint8Array((this.rows + 2) * (this.cols + 2)) : null;
    this._generate();
  }

  _idx(r, c) { return r * (this.cols + 2) + c; }
  get(r, c) { return this.data[this._idx(r, c)]; }
  set(r, c, v) { this.data[this._idx(r, c)] = v; }
  isFlipped(r, c) { return this.flipped ? this.flipped[this._idx(r, c)] === 1 : false; }
  setFlipped(r, c, v) { if (this.flipped) this.flipped[this._idx(r, c)] = v ? 1 : 0; }

  countRemaining() {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== 0) n++;
    return n;
  }

  /**
   * 返回 [{r,c}, ...] 顶点数组（含 a 和 b）；不可连返回 null。
   * 不修改棋盘。
   */
  findPath(a, b) {
    if (!a || !b) return null;
    if (a.r === b.r && a.c === b.c) return null;
    if (a.r < 1 || a.r > this.rows || a.c < 1 || a.c > this.cols) return null;
    if (b.r < 1 || b.r > this.rows || b.c < 1 || b.c > this.cols) return null;
    const va = this.get(a.r, a.c);
    const vb = this.get(b.r, b.c);
    if (va === 0 || vb === 0 || va !== vb) return null;

    // 情形 1：同行/同列，中间全空
    if (a.r === b.r && this._hLineClear(a.r, a.c, b.c)) {
      return [a, b];
    }
    if (a.c === b.c && this._vLineClear(a.c, a.r, b.r)) {
      return [a, b];
    }

    // 情形 2：1 拐弯——两个角点
    for (const corner of [{r: a.r, c: b.c}, {r: b.r, c: a.c}]) {
      if (this.get(corner.r, corner.c) !== 0) continue;
      // a 到 corner：同行（情形 a.r===corner.r）或同列
      // corner 到 b：另一边
      if (this._segmentClear(a, corner) && this._segmentClear(corner, b)) {
        return [a, corner, b];
      }
    }

    // 情形 3：2 拐弯——枚举中间行 / 中间列
    // 中间行 r（除 a.r 和 b.r 自身）
    for (let r = 0; r <= this.rows + 1; r++) {
      if (r === a.r || r === b.r) continue;
      // 中间行需在 r 行的 [a.c..b.c] 都空（含两端两个枢点）
      const p1 = {r, c: a.c};
      const p2 = {r, c: b.c};
      if (this.get(p1.r, p1.c) !== 0) continue;
      if (this.get(p2.r, p2.c) !== 0) continue;
      // a → p1（同列）
      if (!this._vLineClear(a.c, a.r, r)) continue;
      // p1 → p2（同行）
      if (!this._hLineClear(r, a.c, b.c)) continue;
      // p2 → b（同列）
      if (!this._vLineClear(b.c, r, b.r)) continue;
      return [a, p1, p2, b];
    }
    // 中间列 c
    for (let c = 0; c <= this.cols + 1; c++) {
      if (c === a.c || c === b.c) continue;
      const p1 = {r: a.r, c};
      const p2 = {r: b.r, c};
      if (this.get(p1.r, p1.c) !== 0) continue;
      if (this.get(p2.r, p2.c) !== 0) continue;
      if (!this._hLineClear(a.r, a.c, c)) continue;
      if (!this._vLineClear(c, a.r, b.r)) continue;
      if (!this._hLineClear(b.r, c, b.c)) continue;
      return [a, p1, p2, b];
    }

    return null;
  }

  /** 在 row 行 col1..col2 之间（不含两端）所有格为空 */
  _hLineClear(row, col1, col2) {
    const [lo, hi] = col1 < col2 ? [col1, col2] : [col2, col1];
    for (let c = lo + 1; c < hi; c++) {
      if (this.get(row, c) !== 0) return false;
    }
    return true;
  }
  _vLineClear(col, row1, row2) {
    const [lo, hi] = row1 < row2 ? [row1, row2] : [row2, row1];
    for (let r = lo + 1; r < hi; r++) {
      if (this.get(r, col) !== 0) return false;
    }
    return true;
  }
  /** segment 必须同行或同列 */
  _segmentClear(p1, p2) {
    if (p1.r === p2.r) return this._hLineClear(p1.r, p1.c, p2.c);
    if (p1.c === p2.c) return this._vLineClear(p1.c, p1.r, p2.r);
    return false;
  }

  /**
   * 返回 { a, b, path } 或 null。
   * a / b 是格坐标 {r, c}；path 是 findPath 的返回值。
   */
  hasAnySolvable() {
    // group by emoji value
    const groups = new Map();
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        const v = this.get(r, c);
        if (v === 0) continue;
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push({r, c});
      }
    }
    for (const cells of groups.values()) {
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const path = this.findPath(cells[i], cells[j]);
          if (path) return { a: cells[i], b: cells[j], path };
        }
      }
    }
    return null;
  }

  /**
   * 原地 Fisher-Yates 洗剩余非空格的 emoji，最多重试 5 次直到 hasAnySolvable。
   * 返回 true 表示成功（含"剩 ≤ 1 对跳过"）；false 表示 5 次后仍无解。
   */
  reshuffle() {
    const cells = [];
    const values = [];
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        const v = this.get(r, c);
        if (v !== 0) {
          cells.push({r, c});
          values.push(v);
        }
      }
    }
    if (values.length <= 2) return true;  // 剩 ≤ 1 对，无意义

    for (let attempt = 0; attempt < 5; attempt++) {
      // Fisher-Yates 洗 values
      for (let k = values.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [values[k], values[j]] = [values[j], values[k]];
      }
      // 写回
      for (let i = 0; i < cells.length; i++) {
        this.set(cells[i].r, cells[i].c, values[i]);
      }
      if (this.hasAnySolvable() !== null) return true;
    }
    return false;
  }

  _generate() {
    const innerCells = this.rows * this.cols;
    const pairs = innerCells / 2;
    if (pairs * 2 !== innerCells) throw new Error('内部格数必须是偶数');
    const types = Math.min(this.emojiTypes, EMOJI_POOL.length);

    // 每种 emoji 应放对数 = floor(pairs / types)，多余对分配给前 extra 种各 1 对
    const perType = Math.floor(pairs / types);
    let extra = pairs - perType * types;

    const values = [];
    for (let i = 0; i < types; i++) {
      const count = perType + (i < extra ? 1 : 0);
      for (let p = 0; p < count; p++) {
        values.push(i + 1);
        values.push(i + 1);
      }
    }
    // 兜底：保证 values.length === innerCells
    if (values.length !== innerCells) {
      throw new Error('生成器算错对数 ' + values.length + ' vs ' + innerCells);
    }

    // 多次重洗直到有初始解
    let attempt = 0;
    while (attempt < 20) {
      attempt++;
      for (let k = values.length - 1; k > 0; k--) {
        const j = Math.floor(this.rng() * (k + 1));
        [values[k], values[j]] = [values[j], values[k]];
      }
      let i = 0;
      for (let r = 1; r <= this.rows; r++) {
        for (let c = 1; c <= this.cols; c++) {
          this.set(r, c, values[i++]);
        }
      }
      if (this.hasAnySolvable() !== null) return;
    }
    // 20 次仍失败几乎不可能；不抛让 caller 用 reshuffle 兜，但留个信号便于排查
    console.warn('[lianliankan] _generate 20 attempts no solvable board, leaving as-is');
  }
}
