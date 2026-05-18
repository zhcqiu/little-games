// game.js — 游戏状态机 + combo + 计分 + 计时 + serialize
import { Board, DIFFICULTIES } from './board.js';

export class Game {
  constructor(difficulty = 'novice', rng = Math.random) {
    this.difficulty = difficulty;
    this.rng = rng;
    this.board = new Board(difficulty, rng);
    this.score = 0;
    this.combo = 0;
    this.lastMatchAtMs = -10000;
    this.elapsedMs = 0;
    this.dead = false;
    this.won = false;
    this.paused = false;
    this.selection = null;
    this.timed = DIFFICULTIES[difficulty].timed;
    this.memory = DIFFICULTIES[difficulty].memory;

    // 事件回调
    this._cb = { match: null, mismatch: null, combo: null, shuffle: null, win: null, lose: null, hint: null };

    if (this.memory) {
      // 翻牌模式：所有格背面朝上
      for (let r = 1; r <= this.board.rows; r++) {
        for (let c = 1; c <= this.board.cols; c++) {
          if (this.board.get(r, c) !== 0) this.board.setFlipped(r, c, false);
        }
      }
    }

    this.flippedFirst = null;
    this._pendingMismatch = null;
  }

  // 事件订阅
  onMatch(cb)    { this._cb.match = cb; }
  onMismatch(cb) { this._cb.mismatch = cb; }
  onCombo(cb)    { this._cb.combo = cb; }
  onShuffle(cb)  { this._cb.shuffle = cb; }
  onWin(cb)      { this._cb.win = cb; }
  onLose(cb)     { this._cb.lose = cb; }
  onHint(cb)     { this._cb.hint = cb; }

  setPaused(p) { this.paused = !!p; }

  /**
   * 推进 dt 毫秒（计时模式用）。不暂停时累加 elapsedMs。
   * timed 模式下到达限时触发 lose。
   */
  step(dt) {
    if (this.paused || this.dead || this.won) return;
    this.elapsedMs += dt;
    if (this.timed && this.elapsedMs >= this._timeLimitMs()) {
      this.dead = true;
      this._cb.lose && this._cb.lose('timeout');
    }
  }

  _timeLimitMs() {
    // advanced: 4 分钟；master: 5 分钟
    return this.difficulty === 'master' ? 300_000 : 240_000;
  }

  /**
   * 玩家点一个格子 (r, c)（1-based 内部坐标）。
   * 返回 { kind: 'ignore' | 'select' | 'deselect' | 'match' | 'mismatch' | 'flip' | 'win' | 'shuffle', ... }
   */
  tap(r, c) {
    if (this.dead || this.won || this.paused) return { kind: 'ignore' };
    if (this.memory) return this._tapMemory(r, c);
    return this._tapConnect(r, c);
  }

  _tapConnect(r, c) {
    const v = this.board.get(r, c);
    if (v === 0) return { kind: 'ignore' };
    // 同格 → 取消
    if (this.selection && this.selection.r === r && this.selection.c === c) {
      this.selection = null;
      return { kind: 'deselect' };
    }
    if (!this.selection) {
      this.selection = { r, c };
      return { kind: 'select' };
    }
    const a = this.selection;
    const b = { r, c };
    const va = this.board.get(a.r, a.c);
    if (va !== v) {
      // 不同 emoji
      this.combo = 0;
      const prev = this.selection;
      this.selection = b;
      this._cb.mismatch && this._cb.mismatch(prev, b);
      return { kind: 'mismatch', prev, current: b };
    }
    const path = this.board.findPath(a, b);
    if (!path) {
      // 同 emoji 但不可达
      this.combo = 0;
      const prev = this.selection;
      this.selection = b;
      this._cb.mismatch && this._cb.mismatch(prev, b);
      return { kind: 'mismatch', prev, current: b };
    }
    // 配对成功
    this.board.set(a.r, a.c, 0);
    this.board.set(b.r, b.c, 0);
    this.selection = null;

    // combo 判定（2500ms 窗口）
    const inCombo = this.elapsedMs - this.lastMatchAtMs <= 2500;
    this.combo = inCombo ? this.combo + 1 : 1;
    this.lastMatchAtMs = this.elapsedMs;
    const pairScore = Math.round(10 * (1 + 0.5 * Math.max(0, this.combo - 1)));
    this.score += pairScore;

    this._cb.match && this._cb.match(a, b, path, pairScore);
    if (this.combo >= 2) this._cb.combo && this._cb.combo(this.combo);

    // 检查胜利 / 无解
    if (this.board.countRemaining() === 0) {
      this.won = true;
      this._cb.win && this._cb.win(this.score, this.elapsedMs);
      return { kind: 'win', a, b, path, pairScore };
    }
    if (this.board.hasAnySolvable() === null) {
      const ok = this.board.reshuffle();
      if (!ok) {
        // 兜底判赢
        this.won = true;
        this._cb.win && this._cb.win(this.score, this.elapsedMs);
        return { kind: 'win', a, b, path, pairScore, escape: true };
      }
      this._cb.shuffle && this._cb.shuffle();
      return { kind: 'match', a, b, path, pairScore, shuffled: true };
    }
    return { kind: 'match', a, b, path, pairScore };
  }

  _tapMemory(r, c) {
    const v = this.board.get(r, c);
    if (v === 0) return { kind: 'ignore' };
    if (this.board.isFlipped(r, c)) return { kind: 'ignore' };  // 已翻开（含 mismatch 显示中）

    // 翻开当前
    this.board.setFlipped(r, c, true);

    if (!this.flippedFirst) {
      this.flippedFirst = { r, c };
      return { kind: 'flip', cell: { r, c } };
    }
    const first = this.flippedFirst;
    const va = this.board.get(first.r, first.c);
    if (va === v) {
      // 配对成功
      this.board.set(first.r, first.c, 0);
      this.board.set(r, c, 0);
      this.board.setFlipped(first.r, first.c, false);
      this.board.setFlipped(r, c, false);
      this.flippedFirst = null;
      // combo + 计分
      const inCombo = this.elapsedMs - this.lastMatchAtMs <= 2500;
      this.combo = inCombo ? this.combo + 1 : 1;
      this.lastMatchAtMs = this.elapsedMs;
      const pairScore = Math.round(10 * (1 + 0.5 * Math.max(0, this.combo - 1)));
      this.score += pairScore;
      this._cb.match && this._cb.match(first, { r, c }, null, pairScore);
      if (this.combo >= 2) this._cb.combo && this._cb.combo(this.combo);
      if (this.board.countRemaining() === 0) {
        this.won = true;
        this._cb.win && this._cb.win(this.score, this.elapsedMs);
        return { kind: 'win', a: first, b: { r, c }, pairScore };
      }
      return { kind: 'match', a: first, b: { r, c }, pairScore };
    }
    // 不同 → mismatch（两张暂时保持翻开，caller 延迟 600ms 后调 resolveMemoryMismatch）
    this.combo = 0;
    const prev = first;
    this._pendingMismatch = { a: prev, b: { r, c } };
    this.flippedFirst = null;
    this._cb.mismatch && this._cb.mismatch(prev, { r, c });
    return { kind: 'mismatch', prev, current: { r, c } };
  }

  /** caller 在 mismatch 后等 600ms 调用，把两张翻回背面 */
  resolveMemoryMismatch() {
    if (!this._pendingMismatch) return;
    const { a, b } = this._pendingMismatch;
    if (this.board.get(a.r, a.c) !== 0) this.board.setFlipped(a.r, a.c, false);
    if (this.board.get(b.r, b.c) !== 0) this.board.setFlipped(b.r, b.c, false);
    this._pendingMismatch = null;
  }

  /** 找一对可消的，触发 hint 事件，返回 {a, b, path} 或 null */
  useHint() {
    const sol = this.board.hasAnySolvable();
    if (!sol) return null;
    this._cb.hint && this._cb.hint(sol.a, sol.b, sol.path);
    return sol;
  }

  /** 强制洗牌 */
  forceShuffle() {
    const ok = this.board.reshuffle();
    if (ok) this._cb.shuffle && this._cb.shuffle();
    return ok;
  }

  serialize() {
    return {
      version: 1,
      difficulty: this.difficulty,
      rows: this.board.rows,
      cols: this.board.cols,
      boardData: Array.from(this.board.data),
      flippedData: this.board.flipped ? Array.from(this.board.flipped) : null,
      score: this.score,
      combo: this.combo,
      elapsedMs: this.elapsedMs,
      lastMatchAtMs: this.lastMatchAtMs,
    };
  }

  restore(snap) {
    if (!snap || snap.version !== 1) return false;
    if (!DIFFICULTIES[snap.difficulty]) return false;
    const d = DIFFICULTIES[snap.difficulty];
    if (snap.rows !== d.rows || snap.cols !== d.cols) return false;
    const expectedLen = (d.rows + 2) * (d.cols + 2);
    if (!Array.isArray(snap.boardData) || snap.boardData.length !== expectedLen) return false;

    this.difficulty = snap.difficulty;
    this.memory = d.memory;
    this.timed = d.timed;
    this.board = new Board(snap.difficulty, this.rng);  // 重建以取尺寸
    for (let i = 0; i < snap.boardData.length; i++) this.board.data[i] = snap.boardData[i];
    if (this.board.flipped && Array.isArray(snap.flippedData)) {
      for (let i = 0; i < snap.flippedData.length; i++) this.board.flipped[i] = snap.flippedData[i];
    }
    this.score = snap.score | 0;
    this.combo = snap.combo | 0;
    this.elapsedMs = snap.elapsedMs | 0;
    this.lastMatchAtMs = snap.lastMatchAtMs | 0;
    this.selection = null;
    this.flippedFirst = null;
    this._pendingMismatch = null;
    this.dead = false;
    this.won = false;
    return true;
  }

  reset() {
    this.board = new Board(this.difficulty, this.rng);
    this.score = 0;
    this.combo = 0;
    this.elapsedMs = 0;
    this.lastMatchAtMs = -10000;
    this.selection = null;
    this.flippedFirst = null;
    this._pendingMismatch = null;
    this.dead = false;
    this.won = false;
    this.paused = false;
  }
}
