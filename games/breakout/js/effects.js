// effects.js — 粒子 / 抖动 / 闪烁 / 道具光环（受 intensity 控制）

export class Effects {
  constructor() {
    this.intensity = 1.0;
    this.particles = [];
    this.shake = null;            // { amp, dur, t }
    this.flashes = [];            // [{ color, alpha, life, dur }]
    this.brickBreaks = [];        // [{ col, row, color, t, dur }] — 砖块碎裂膨胀消散
    this.paddleHit = null;        // { t, dur, offset } — 板拍压扁短动画
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

    for (const b of this.brickBreaks) b.t += dt;
    this.brickBreaks = this.brickBreaks.filter((b) => b.t < b.dur);

    if (this.paddleHit) {
      this.paddleHit.t += dt;
      if (this.paddleHit.t >= this.paddleHit.dur) this.paddleHit = null;
    }
  }

  spawnBrickBreak(col, row, color) {
    if (this.intensity === 0) return;
    this.brickBreaks.push({ col, row, color, t: 0, dur: 180 });
  }

  spawnPaddleHit(offset) {
    if (this.intensity === 0) return;
    this.paddleHit = { t: 0, dur: 140, offset: Math.max(-1, Math.min(1, offset || 0)) };
  }

  /** 返回当前板拍压扁状态 {squish: 0..0.4, offset: -1..1}，未触发返回 null */
  getPaddleHitDeform() {
    if (!this.paddleHit) return null;
    const phase = this.paddleHit.t / this.paddleHit.dur;
    return {
      squish: Math.sin(phase * Math.PI) * 0.35 * this.intensity,
      offset: this.paddleHit.offset,
    };
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
    // 接道具时一道柔和的全屏白闪 — 用现有 'screen' flash 通道，避免引入需要 game 状态的特殊渲染
    this.flashes.push({ kind: 'screen', color: '#ffffff', alpha: 0.25 * this.intensity, life: 400, dur: 400 });
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

  drawBrickBreaks(ctx, cellSize) {
    for (const b of this.brickBreaks) {
      const phase = b.t / b.dur;            // 0 → 1
      const scale = 1 + phase * 0.4;        // 砖块膨胀到 1.4×
      const alpha = 1 - phase;
      const wobble = (b.col % 2 === 0 ? 1 : -1) * phase * 0.6;   // 小扰动旋转 ~ ±34°
      const cx = (b.col + 0.5) * cellSize;
      const cy = (b.row + 0.5) * cellSize;
      const s = cellSize - 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(wobble);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = b.color;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, 4);
        ctx.fill();
      } else {
        ctx.fillRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
