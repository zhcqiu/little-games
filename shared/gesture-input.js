// shared/gesture-input.js — 手势 + 键盘统一输入状态机
// 可被任何游戏复用：构造时注入 canvas / cellSize getter / piece-state getter
// 通过 .on('moveTo' | 'rotate' | 'pauseChange', cb) 订阅语义事件
const STATE_IDLE = 0;
const STATE_DRAG = 1;
const STATE_ROTATE = 2;

export class Input {
  constructor(canvas, getCellSize, getPieceState) {
    this.canvas = canvas;
    this.getCellSize = getCellSize;
    this.getPieceState = getPieceState;
    this.state = STATE_IDLE;
    this.fingers = new Map();    // pointerId → {x, y}
    this.dragOrigin = null;
    this.rotateAngle0 = 0;
    this.rotateAccumulator = 0;
    this.swipeOrigin = null;
    this._firstTouchHandler = null;
    this.handlers = {
      moveTo: () => {},
      rotate: () => {},
      pauseChange: () => {},
      hardDrop: () => {},
      swipe: () => {},
    };

    canvas.addEventListener('pointerdown', this._onDown.bind(this));
    canvas.addEventListener('pointermove', this._onMove.bind(this));
    canvas.addEventListener('pointerup', this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));

    // 键盘支持（PC 用）：方向键移动 + 上/W/Space 旋转 CW + Z 旋转 CCW
    window.addEventListener('keydown', this._onKeyDown.bind(this));
  }

  _onKeyDown(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (this._firstTouchHandler) {
      this._firstTouchHandler();
      this._firstTouchHandler = null;
    }

    const piece = this.getPieceState();
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        this.handlers.swipe('left');
        if (piece) this.handlers.moveTo(piece.row, piece.col - 1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        this.handlers.swipe('right');
        if (piece) this.handlers.moveTo(piece.row, piece.col + 1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.handlers.swipe('down');
        if (piece) {
          if (e.shiftKey) this.handlers.hardDrop();
          else this.handlers.moveTo(piece.row + 1, piece.col);
        }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        this.handlers.swipe('up');
        this.handlers.rotate(+1);
        break;
      case ' ':
        e.preventDefault();
        this.handlers.rotate(+1);
        break;
      case 'z':
      case 'Z':
        e.preventDefault();
        this.handlers.rotate(-1);
        break;
    }
  }

  on(event, fn) { this.handlers[event] = fn; }
  onFirstTouch(fn) { this._firstTouchHandler = fn; }

  _onDown(e) {
    if (this._firstTouchHandler) {
      this._firstTouchHandler();
      this._firstTouchHandler = null;
    }
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._updateStateOnTouchChange();
  }

  _onMove(e) {
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._tick();
  }

  _onUp(e) {
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.fingers.delete(e.pointerId);
    this._updateStateOnTouchChange();
  }

  _updateStateOnTouchChange() {
    const n = this.fingers.size;
    const prev = this.state;
    if (n === 0) this.state = STATE_IDLE;
    else if (n === 1) this.state = STATE_DRAG;
    else this.state = STATE_ROTATE;

    if (this.state !== prev) {
      this._enterState(this.state);
      this.handlers.pauseChange(n > 0);
    }
  }

  _enterState(s) {
    if (s === STATE_DRAG) {
      const f = this.fingers.values().next().value;
      if (f) {
        this.swipeOrigin = { x: f.x, y: f.y };  // swipe 检测起点（与 piece state 无关）
      }
      const piece = this.getPieceState();
      if (piece && f) {
        this.dragOrigin = {
          touchX: f.x,
          touchY: f.y,
          pieceCol: piece.col,
          pieceRow: piece.row,
        };
      }
    } else if (s === STATE_ROTATE) {
      const fingers = Array.from(this.fingers.values());
      if (fingers.length < 2) return;
      this.rotateAngle0 = Math.atan2(
        fingers[1].y - fingers[0].y,
        fingers[1].x - fingers[0].x
      );
      this.rotateAccumulator = 0;
    } else {
      this.dragOrigin = null;
      this.swipeOrigin = null;
    }
  }

  _tick() {
    if (this.state === STATE_DRAG) {
      const f = this.fingers.values().next().value;
      if (!f) return;
      const cell = this.getCellSize();

      // swipe 检测：与 piece state 无关，蛇游戏单独订阅
      if (this.swipeOrigin) {
        const dx = f.x - this.swipeOrigin.x;
        const dy = f.y - this.swipeOrigin.y;
        const threshold = Math.max(20, cell * 0.6);
        if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) {
          const dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'right' : 'left')
            : (dy > 0 ? 'down' : 'up');
          this.handlers.swipe(dir);
          this.swipeOrigin = { x: f.x, y: f.y };  // 锚点跟随，支持连续多次
        }
      }

      // Tetris 用的 moveTo（蛇游戏不订阅，但保留 Tetris 行为）
      if (this.dragOrigin && cell > 0) {
        const targetCol = this.dragOrigin.pieceCol + Math.round((f.x - this.dragOrigin.touchX) / cell);
        const targetRow = this.dragOrigin.pieceRow + Math.round((f.y - this.dragOrigin.touchY) / cell);
        this.handlers.moveTo(targetRow, targetCol);
      }
    } else if (this.state === STATE_ROTATE) {
      this._rotateTick();
    }
  }

  _rotateTick() {
    const fingers = Array.from(this.fingers.values());
    if (fingers.length < 2) return;
    const cur = Math.atan2(
      fingers[1].y - fingers[0].y,
      fingers[1].x - fingers[0].x
    );
    let delta = cur - this.rotateAngle0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    this.rotateAccumulator += delta;
    this.rotateAngle0 = cur;

    const threshold = Math.PI / 9;  // 20°
    while (this.rotateAccumulator > threshold) {
      this.handlers.rotate(+1);
      this.rotateAccumulator -= threshold;
    }
    while (this.rotateAccumulator < -threshold) {
      this.handlers.rotate(-1);
      this.rotateAccumulator += threshold;
    }
  }
}
