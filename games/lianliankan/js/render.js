// render.js — DOM 棋盘渲染 + canvas overlay
import { EMOJI_POOL } from './board.js';

export class Renderer {
  /**
   * @param {HTMLElement} boardEl - #board (CSS grid)
   * @param {HTMLCanvasElement} overlayEl - #overlay
   * @param {object} [effects] - 可选 Effects 实例（粒子）
   */
  constructor(boardEl, overlayEl, effects) {
    this.boardEl = boardEl;
    this.overlayEl = overlayEl;
    this.ctx = overlayEl.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.tileEls = [];  // 1D index = r * (cols+2) + c；只用内部坐标
    this.game = null;
    this._overlayDrawables = [];  // {kind:'path', vertices, startMs, durMs} 之类
    this.effects = effects;
    this._onResize = () => this._resizeOverlay();
    this._resizeBound = false;
  }

  mount(game) {
    this.game = game;
    this.boardEl.innerHTML = '';
    const rows = game.board.rows, cols = game.board.cols;
    this.boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.boardEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    // aspect ratio
    const wrap = this.boardEl.parentElement;
    wrap.style.aspectRatio = `${cols} / ${rows}`;

    this.tileEls = new Array((rows + 2) * (cols + 2)).fill(null);
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const v = game.board.get(r, c);
        const tile = document.createElement('button');
        tile.className = 'tile';
        tile.dataset.r = String(r);
        tile.dataset.c = String(c);
        if (v === 0) {
          tile.classList.add('empty');
          tile.textContent = '';
        } else if (game.memory) {
          tile.classList.add('face-down');
        } else {
          tile.textContent = EMOJI_POOL[v - 1] || '?';
        }
        this.boardEl.appendChild(tile);
        this.tileEls[r * (cols + 2) + c] = tile;
      }
    }
    this._resizeOverlay();
    if (!this._resizeBound) {
      window.addEventListener('resize', this._onResize);
      this._resizeBound = true;
    }
  }

  _resizeOverlay() {
    const rect = this.boardEl.getBoundingClientRect();
    this.overlayEl.width = rect.width * this.dpr;
    this.overlayEl.height = rect.height * this.dpr;
  }

  /** 高亮选中 */
  setSelection(r, c) {
    this.boardEl.querySelectorAll('.tile.selected').forEach((el) => el.classList.remove('selected'));
    if (r != null) {
      const el = this._tile(r, c);
      if (el) el.classList.add('selected');
    }
  }

  /** 标记一对为 hint 高亮（800ms 后由调度方移除） */
  applyHint(a, b) {
    [a, b].forEach((p) => {
      const el = this._tile(p.r, p.c);
      if (el) el.classList.add('hint');
    });
  }
  clearHint() {
    this.boardEl.querySelectorAll('.tile.hint').forEach((el) => el.classList.remove('hint'));
  }

  /** 闪红一格 */
  flashMiss(r, c) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.remove('miss');
    void el.offsetWidth;  // reflow
    el.classList.add('miss');
    setTimeout(() => el.classList.remove('miss'), 220);
  }

  /** 翻牌：背面 ↔ 正面 */
  setFaceUp(r, c, v) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.remove('face-down');
    el.textContent = EMOJI_POOL[v - 1] || '?';
  }
  setFaceDown(r, c) {
    const el = this._tile(r, c);
    if (!el) return;
    el.classList.add('face-down');
    el.textContent = '';
  }

  /** 消除：250ms 后变 empty */
  clearTiles(a, b) {
    [a, b].forEach((p) => {
      const el = this._tile(p.r, p.c);
      if (!el) return;
      el.classList.add('clearing');
      setTimeout(() => {
        el.className = 'tile empty';
        el.textContent = '';
      }, 250);
    });
  }

  /** 整盘重排（reshuffle 后）— 简单粗暴重写所有 tile 的内容 */
  refreshAll() {
    if (!this.game) return;
    const rows = this.game.board.rows, cols = this.game.board.cols;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const el = this._tile(r, c);
        if (!el) continue;
        const v = this.game.board.get(r, c);
        if (v === 0) {
          el.className = 'tile empty'; el.textContent = '';
        } else if (this.game.memory && !this.game.board.isFlipped(r, c)) {
          el.className = 'tile face-down'; el.textContent = '';
        } else {
          el.className = 'tile'; el.textContent = EMOJI_POOL[v - 1] || '?';
        }
      }
    }
  }

  _tile(r, c) {
    if (!this.game) return null;
    return this.tileEls[r * (this.game.board.cols + 2) + c];
  }

  /** 在 overlay 画路径（顶点是格坐标 {r,c}，1-based） */
  drawPath(vertices, color, durMs = 400) {
    this._overlayDrawables.push({
      kind: 'path',
      vertices: vertices.slice(),
      color,
      startMs: performance.now(),
      durMs,
    });
  }

  /** rAF 调用：清 overlay 重画当前所有 drawables */
  step(nowMs) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.overlayEl.width, this.overlayEl.height);

    // 只在有路径要画时才算坐标（避免空闲态每帧 getBoundingClientRect 触发 reflow）
    if (this._overlayDrawables.length > 0) {
      const rect = this.boardEl.getBoundingClientRect();
      const rows = this.game?.board.rows ?? 0, cols = this.game?.board.cols ?? 0;
      if (rows > 0 && cols > 0) {
        const gap = 4;
        const cellW = (rect.width - gap * (cols - 1)) / cols;
        const cellH = (rect.height - gap * (rows - 1)) / rows;
        const pxPerCellX = (cellW + gap) * this.dpr;
        const pxPerCellY = (cellH + gap) * this.dpr;
        const tileCenter = (r, c) => ({
          x: (c - 1 + 0.5) * pxPerCellX,
          y: (r - 1 + 0.5) * pxPerCellY,
        });

        this._overlayDrawables = this._overlayDrawables.filter((d) => {
          const t = nowMs - d.startMs;
          if (t > d.durMs) return false;
          const alpha = 1 - t / d.durMs;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 8 * this.dpr;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = d.color;
          ctx.shadowBlur = 20 * this.dpr;
          ctx.beginPath();
          d.vertices.forEach((v, i) => {
            const p = tileCenter(v.r, v.c);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
          ctx.restore();
          return true;
        });
      }
    }

    // 粒子（放在守卫块之外，无路径但有粒子时也能画）
    if (this.effects) {
      this.effects.draw(this.ctx, this.dpr);
    }
  }
}
