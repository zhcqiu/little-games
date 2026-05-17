// render.js — Canvas 绘制 + FX
import { getCells, PIECES } from './pieces.js';
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  constructor(canvas, nextCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.cellSize = 30;
    this.particles = [];
    this.shake = null;          // { amplitude, duration, elapsed }
    this.flashRows = [];        // [{ rows, elapsed, duration }]
    this.settling = null;       // { ghostBoard, clearedRows, elapsed, duration }
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

    if (this.settling) this.settling.elapsed += dt;

    // 屏幕抖动
    let offsetX = 0, offsetY = 0;
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) {
        this.shake = null;
      } else {
        const e = this.shake.elapsed;
        const d = this.shake.duration;
        const amp = this.shake.amplitude * (1 - e / d);
        offsetX = Math.sin(e * 0.06) * amp;
        offsetY = Math.cos(e * 0.065) * amp;
      }
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offsetX, offsetY);

    this._drawBoard(game);
    this._drawGhost(game);
    this._drawCurrent(game);
    this._drawFlashes(dt);
    this._drawParticles(dt);

    ctx.restore();

    this._drawNext(game);
  }

  _drawBoard(game) {
    const ctx = this.ctx;
    const s = this.cellSize;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, s * BOARD_WIDTH, s * BOARD_HEIGHT);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

    if (this.settling && this.settling.elapsed < this.settling.duration) {
      this._drawSettlingBoard();
    } else {
      if (this.settling) this.settling = null;
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
    const settling = this.settling;
    const t = settling.elapsed / settling.duration;
    // easeInOutQuad: 加速然后减速
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    for (let r = 0; r < BOARD_HEIGHT; r++) {
      if (settling.clearedRows.includes(r)) continue;
      // 这一行原本要往下落多少格 = 它下方被消的行数
      let shift = 0;
      for (const cr of settling.clearedRows) if (cr > r) shift++;
      const visualRow = r + shift * ease;
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = settling.ghostBoard[r][c];
        if (color) this._drawCell(c * s, visualRow * s, color, 1.0);
      }
    }
  }

  startSettling(clearedRows, boardSnapshot) {
    this.settling = {
      ghostBoard: boardSnapshot,
      clearedRows: clearedRows.slice(),
      elapsed: 0,
      duration: 250,
    };
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

  _drawFlashes(dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    for (let i = this.flashRows.length - 1; i >= 0; i--) {
      const f = this.flashRows[i];
      f.elapsed += dt;
      if (f.elapsed >= f.duration) {
        this.flashRows.splice(i, 1);
        continue;
      }
      const alpha = 0.85 * (1 - f.elapsed / f.duration);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      for (const r of f.rows) {
        ctx.fillRect(0, r * s, s * BOARD_WIDTH, s);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  _drawParticles(dt) {
    const ctx = this.ctx;
    const gravity = 980 / 1000;  // px/ms²

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.elapsed += dt;
      if (p.elapsed >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const dts = dt / 1000;
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += gravity * dt;
      const alpha = 1 - p.elapsed / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
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

  triggerShake(amplitude, duration) {
    this.shake = { amplitude, duration, elapsed: 0 };
  }

  spawnParticles(rows, rowSnapshots) {
    const s = this.cellSize;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const colors = rowSnapshots[i];
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = colors[c] || '#ffffff';
        for (let k = 0; k < 8; k++) {
          this.particles.push({
            x: c * s + s / 2,
            y: r * s + s / 2,
            vx: (Math.random() - 0.5) * 400,
            vy: -300 - Math.random() * 200,
            color,
            life: 800,
            elapsed: 0,
            size: 4 + Math.random() * 4,
          });
        }
      }
    }
  }

  flashRowsAnim(rows) {
    this.flashRows.push({ rows: rows.slice(), elapsed: 0, duration: 200 });
  }
}
