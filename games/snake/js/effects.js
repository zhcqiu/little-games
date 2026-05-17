// effects.js — 视觉特效（粒子 + 屏幕抖动）
export class Effects {
  constructor() {
    this.particles = [];
    this.shake = null;            // { amplitude, duration, elapsed }
    this.intensity = 1.0;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  step(dt) {
    if (this.shake) {
      this.shake.elapsed += dt;
      if (this.shake.elapsed >= this.shake.duration) this.shake = null;
    }
  }

  triggerShake(amplitude, duration) {
    if (this.intensity === 0) return;
    this.shake = { amplitude: amplitude * this.intensity, duration, elapsed: 0 };
  }

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

  /** 在某 (cellX, cellY) 中心喷一拨粒子 */
  spawnBurst(cellX, cellY, cellSize, palette, count = 8, vyRange = [-400, -200]) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * this.intensity));
    const cx = cellX * cellSize + cellSize / 2;
    const cy = cellY * cellSize + cellSize / 2;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 600,
        vy: vyRange[0] + Math.random() * (vyRange[1] - vyRange[0]),
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 700 + Math.random() * 200,
        elapsed: 0,
        size: 4 + Math.random() * 5,
      });
    }
  }

  /** 圆形散射（死亡 / 复活用） */
  spawnRadial(cellX, cellY, cellSize, palette, count = 16, speed = 250) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * this.intensity));
    const cx = cellX * cellSize + cellSize / 2;
    const cy = cellY * cellSize + cellSize / 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: 800,
        elapsed: 0,
        size: 5 + Math.random() * 6,
      });
    }
  }

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
}
