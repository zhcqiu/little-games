// render.js — Canvas 棋盘绘制；特效交给 effects.js
import { getCells, PIECES } from './pieces.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - 主棋盘画布
   * @param {HTMLCanvasElement} nextCanvas - "下一块"预览
   * @param {import('./effects.js').Effects} effects - 特效系统
   */
  constructor(canvas, nextCanvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 30;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const containerW = this.canvas.parentElement.clientWidth;
    const containerH = this.canvas.parentElement.clientHeight;

    this.cellSize = Math.floor(Math.min(
      containerW / (BOARD_WIDTH + 2),
      containerH / (BOARD_HEIGHT + 2)
    ));

    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;

    const offset = this.effects.getShakeOffset();

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offset.x, offset.y);

    this._drawBoard(game);
    this._drawGhost(game);
    this._drawCurrent(game);
    this.effects.drawFlashes(ctx, this.cellSize, dt);
    this.effects.drawParticles(ctx, dt);

    ctx.restore();

    this._drawNext(game);
  }

  _drawBoard(game) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const theme = this._readTheme();
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, s * BOARD_WIDTH, s * BOARD_HEIGHT);
    ctx.strokeStyle = theme.canvasGrid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(s * BOARD_WIDTH, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, s * BOARD_HEIGHT);
      ctx.stroke();
    }

    if (this.effects.settling) {
      this._drawSettlingBoard();
    } else {
      for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          const color = game.board[r][c];
          if (color) this._drawCell(c * s, r * s, color, 1.0);
        }
      }
    }
  }

  _drawSettlingBoard() {
    const s = this.cellSize;
    const settling = this.effects.settling;
    const t = settling.elapsed / settling.duration;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (settling.clearedRows.includes(r)) continue;
      let shift = 0;
      for (const cr of settling.clearedRows) if (cr > r) shift++;
      const visualRow = r + shift * ease;
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = settling.ghostBoard[r][c];
        if (color) this._drawCell(c * s, visualRow * s, color, 1.0);
      }
    }
  }

  _drawCell(x, y, color, alpha = 1.0) {
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 2, y + 2, s - 4, 3);
    ctx.fillRect(x + 2, y + 2, 3, s - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 2, y + s - 5, s - 4, 3);
    ctx.fillRect(x + s - 5, y + 2, 3, s - 4);
    ctx.globalAlpha = 1.0;
  }

  _drawCurrent(game) {
    if (!game.current) return;
    const p = game.current;
    const color = this._pieceColor(p.type);
    const cells = getCells(p.type, p.rotation);
    for (const { row: dr, col: dc } of cells) {
      const r = p.row + dr;
      const c = p.col + dc;
      if (r >= 0) {
        this._drawCell(c * this.cellSize, r * this.cellSize, color, 1.0);
      }
    }
  }

  _pieceColor(type) {
    return PIECES[type].color;
  }

  _drawGhost(game) {
    if (!game.current) return;
    const ghostRow = game.computeGhostRow();
    if (ghostRow === null || ghostRow === game.current.row) return;
    const p = game.current;
    const color = this._pieceColor(p.type);
    const cells = getCells(p.type, p.rotation);
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const { row: dr, col: dc } of cells) {
      const r = ghostRow + dr;
      const c = p.col + dc;
      if (r >= 0) {
        ctx.strokeRect(c * s + 2, r * s + 2, s - 4, s - 4);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  _drawNext(game) {
    const ctx = this.nextCtx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    if (!game.next) return;
    const cells = getCells(game.next, 0);
    const color = this._pieceColor(game.next);
    const s = 12;
    const xOff = (this.nextCanvas.width - 4 * s) / 2;
    const yOff = (this.nextCanvas.height - 4 * s) / 2;
    for (const { row, col } of cells) {
      ctx.fillStyle = color;
      ctx.fillRect(xOff + col * s + 1, yOff + row * s + 1, s - 2, s - 2);
    }
  }

  _readTheme() {
    const styles = getComputedStyle(document.body);
    return {
      canvasBg: styles.getPropertyValue('--canvas-bg').trim() || '#16213e',
      canvasGrid: styles.getPropertyValue('--canvas-grid').trim() || 'rgba(255,255,255,0.04)',
    };
  }
}
