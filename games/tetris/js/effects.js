// effects.js — 视觉特效系统（粒子 / 抖动 / 闪烁 / 落行补位）
// 状态归本模块管理，由主循环每帧 step() 推进，并暴露 query 给 renderer 取数据
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.shake = null;          // { amplitude, duration, elapsed }
    this.flashRows = [];        // [{ rows, elapsed, duration }]
    this.settling = null;       // { ghostBoard, clearedRows, elapsed, duration }
    this.intensity = 1.0;       // 0..1 — 受 "减少动效" 设置控制
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  step(dt) {
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) this.shake = null;
    }
    if (this.settling) {
      this.settling.elapsed += dt;
      if (this.settling.elapsed >= this.settling.duration) this.settling = null;
    }
  }

  /** 触发屏幕抖动。amplitude / duration 会乘 intensity */
  triggerShake(amplitude, duration) {
    if (this.intensity === 0) return;
    this.shake = { amplitude: amplitude * this.intensity, duration, elapsed: 0 };
  }

  /** 当前帧抖动偏移 (offsetX, offsetY) */
  getShakeOffset() {
    if (!this.shake) return { x: 0, y: 0 };
    const e = this.shake.elapsed;
    const d = this.shake.duration;
    const amp = this.shake.amplitude * (1 - e / d);
    return {
      x: Math.sin(e * 0.06) * amp,
      y: Math.cos(e * 0.065) * amp,
    };
  }

  /** 喷一拨粒子；rows = 被消行号，rowSnapshots = 那几行的颜色数组 */
  spawnParticles(rows, rowSnapshots, cellSize) {
    if (this.intensity === 0) return;
    const perCell = Math.max(1, Math.round(14 * this.intensity));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const colors = rowSnapshots[i];
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const color = colors[c] || '#ffffff';
        for (let k = 0; k < perCell; k++) {
          this.particles.push({
            x: c * cellSize + cellSize / 2,
            y: r * cellSize + cellSize / 2,
            vx: (Math.random() - 0.5) * 600,
            vy: -350 - Math.random() * 300,
            color,
            life: 1000,
            elapsed: 0,
            size: 5 + Math.random() * 6,
          });
        }
      }
    }
  }

  /** 高亮闪烁某几行 */
  flashRowsAnim(rows) {
    if (this.intensity === 0) return;
    this.flashRows.push({ rows: rows.slice(), elapsed: 0, duration: 300 });
  }

  /** 启动下落补位动画 */
  startSettling(clearedRows, boardSnapshot) {
    if (this.intensity === 0) return;
    this.settling = {
      ghostBoard: boardSnapshot,
      clearedRows: clearedRows.slice(),
      elapsed: 0,
      duration: 250,
    };
  }

  /** 由 renderer 调用：更新 + 绘制粒子 */
  drawParticles(ctx, dt) {
    const gravity = 980 / 1000;
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

  /** 由 renderer 调用：绘制行闪烁白光 */
  drawFlashes(ctx, cellSize, dt) {
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
        ctx.fillRect(0, r * cellSize, cellSize * BOARD_WIDTH, cellSize);
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
