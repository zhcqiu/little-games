// effects.js — 粒子 / 抖动 / 闪烁 / 道具光环（受 intensity 控制）

export class Effects {
  constructor() {
    this.intensity = 1.0;
    this.particles = [];
    this.shake = null;            // { amp, dur, t }
    this.flashes = [];            // [{ color, alpha, life, dur }]
  }

  setIntensity(v) { this.intensity = v; }

  step(dt) {
    // particles
    const dtSec = dt / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 30 * dtSec;          // gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.shake) {
      this.shake.t += dt;
      if (this.shake.t >= this.shake.dur) this.shake = null;
    }

    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }

  spawnBrickParticles(col, row, color) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(8 * this.intensity));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: col + 0.5,
        y: row + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 500 + Math.random() * 300,
        maxLife: 500,
      });
    }
  }

  spawnPaddleGlow() {
    if (this.intensity === 0) return;
    this.flashes.push({ kind: 'paddle', color: '#ffffff', alpha: 0.6, life: 500, dur: 500 });
  }

  triggerShake(amp = 6, dur = 240) {
    if (this.intensity === 0) return;
    this.shake = { amp: amp * this.intensity, dur, t: 0 };
  }

  triggerFlash(color = '#ff0000', alpha = 0.4, dur = 180) {
    if (this.intensity === 0) return;
    this.flashes.push({ kind: 'screen', color, alpha, life: dur, dur });
  }

  getShakeOffset() {
    if (!this.shake) return { x: 0, y: 0 };
    const r = this.shake.amp * (1 - this.shake.t / this.shake.dur);
    return {
      x: (Math.random() * 2 - 1) * r,
      y: (Math.random() * 2 - 1) * r,
    };
  }

  drawParticles(ctx, cellSize) {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * cellSize, p.y * cellSize, 2 + alpha * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlashes(ctx, w, h) {
    for (const f of this.flashes) {
      if (f.kind !== 'screen') continue;
      ctx.globalAlpha = f.alpha * (f.life / f.dur);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }
}
