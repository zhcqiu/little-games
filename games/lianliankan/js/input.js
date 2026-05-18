// input.js — pointerdown 命中 tile 转 (r, c) 事件
export class Input {
  /**
   * @param {HTMLElement} boardEl
   */
  constructor(boardEl) {
    this.boardEl = boardEl;
    this._cb = { tap: null, firstTouch: null };
    this._gotFirst = false;
    this._onPointerDown = this._onPointerDown.bind(this);
    boardEl.addEventListener('pointerdown', this._onPointerDown);
  }

  onTap(cb) { this._cb.tap = cb; }
  onFirstTouch(cb) { this._cb.firstTouch = cb; }

  _onPointerDown(e) {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (tile.classList.contains('empty')) return;
    if (tile.classList.contains('clearing')) return;
    const r = parseInt(tile.dataset.r, 10);
    const c = parseInt(tile.dataset.c, 10);
    if (!this._gotFirst) {
      this._gotFirst = true;
      this._cb.firstTouch && this._cb.firstTouch();
    }
    this._cb.tap && this._cb.tap(r, c);
  }
}
