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
    this._firstTouchHandler = null;
    this.handlers = {
      moveTo: () => {},
      rotate: () => {},
      pauseChange: () => {},
      hardDrop: () => {},
    };
    this._lastSpacePress = 0;

    canvas.addEventListener('pointerdown', this._onDown.bind(this));
    canvas.addEventListener('pointermove', this._onMove.bind(this));
    canvas.addEventListener('pointerup', this._onUp.bind(this));
    canvas.addEventListener('pointercancel', this._onUp.bind(this));

    // 键盘支持（PC 用）：方向键移动 + 上/W/Space 旋转 CW + Z 旋转 CCW
    window.addEventListener('keydown', this._onKeyDown.bind(this));
  }

  _onKeyDown(e) {
    // 忽略输入控件里的按键（设置面板里的滑条等）
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
        if (piece) { e.preventDefault(); this.handlers.moveTo(piece.row, piece.col - 1); }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (piece) { e.preventDefault(); this.handlers.moveTo(piece.row, piece.col + 1); }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (piece) {
          e.preventDefault();
          // Shift + 下 = 硬落下
          if (e.shiftKey) this.handlers.hardDrop();
          else this.handlers.moveTo(piece.row + 1, piece.col);
        }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        this.handlers.rotate(+1);
        break;
      case ' ': {
        e.preventDefault();
        // 空格单击 = 旋转；500ms 内连按两次 = 硬落下
        const now = Date.now();
        if (now - this._lastSpacePress < 500) {
          this.handlers.hardDrop();
          this._lastSpacePress = 0;
        } else {
          this.handlers.rotate(+1);
          this._lastSpacePress = now;
        }
        break;
      }
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
      const piece = this.getPieceState();
      if (!piece || !f) return;
      this.dragOrigin = {
        touchX: f.x,
        touchY: f.y,
        pieceCol: piece.col,
        pieceRow: piece.row,
      };
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
    }
  }

  _tick() {
    if (this.state === STATE_DRAG && this.dragOrigin) {
      const f = this.fingers.values().next().value;
      const cell = this.getCellSize();
      if (cell <= 0) return;
      const targetCol = this.dragOrigin.pieceCol + Math.round((f.x - this.dragOrigin.touchX) / cell);
      const targetRow = this.dragOrigin.pieceRow + Math.round((f.y - this.dragOrigin.touchY) / cell);
      this.handlers.moveTo(targetRow, targetCol);
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
