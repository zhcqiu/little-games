export class Effects {
  constructor() {
    this.particles = [];
    this.shakeMs = 0;
    this.shakeAmp = 0;
    this.flashMs = 0;
    this.flashMax = 0;
    this.impactMs = 0;
    this.impactMax = 0;
    this.impactX = 0;
    this.impactY = 0;
    this.impactLevel = 1;
    this.intensity = 1;
  }

  setIntensity(value) {
    this.intensity = Number(value) || 0;
  }

  step(dt) {
    this.shakeMs = Math.max(0, this.shakeMs - dt);
    this.flashMs = Math.max(0, this.flashMs - dt);
    this.impactMs = Math.max(0, this.impactMs - dt);
    for (const p of this.particles) {
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vy += 260 * dt / 1000;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  burst(x, y, colors, count = 14) {
    if (this.intensity <= 0) return;
    const n = Math.max(4, Math.round(count * this.intensity));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 80,
        r: 4 + Math.random() * 7,
        color: colors[i % colors.length],
        life: 450 + Math.random() * 320,
        maxLife: 770,
      });
    }
  }

  shake(amp, ms) {
    if (this.intensity <= 0) return;
    this.shakeAmp = amp * this.intensity;
    this.shakeMs = ms;
  }

  crash(x, y, level = 1) {
    if (this.intensity <= 0) return;
    const n = Math.max(1, Number(level) || 1);
    this.impactX = x;
    this.impactY = y;
    this.impactLevel = n;
    this.flashMax = 260 + n * 80;
    this.flashMs = this.flashMax;
    this.impactMax = 620 + n * 120;
    this.impactMs = this.impactMax;
    this.shake(16 + n * 4, 340 + n * 90);
    this.burst(x, y, ['#ffca28', '#ff7043', '#f44336', '#263238', '#ffffff'], 34 + n * 10);
  }

  offset() {
    if (this.shakeMs <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shakeAmp,
      y: (Math.random() * 2 - 1) * this.shakeAmp,
    };
  }

  draw(ctx) {
    this._drawCrashFlash(ctx);
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawCrashFlash(ctx) {
    const canvas = ctx.canvas;
    if (this.flashMs > 0) {
      const t = this.flashMs / Math.max(1, this.flashMax);
      ctx.save();
      ctx.globalAlpha = Math.min(0.42, 0.16 + t * 0.28) * this.intensity;
      ctx.fillStyle = '#e53935';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.min(0.72, t * 0.72) * this.intensity;
      ctx.lineWidth = Math.max(8, canvas.width * 0.018);
      ctx.strokeStyle = '#b71c1c';
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
      ctx.restore();
    }

    if (this.impactMs > 0) {
      const t = this.impactMs / Math.max(1, this.impactMax);
      const grow = 1 - t;
      const r = (34 + this.impactLevel * 14) * (1 + grow * 1.8);
      ctx.save();
      ctx.globalAlpha = Math.min(0.95, t * 1.1) * this.intensity;
      ctx.lineWidth = Math.max(5, 8 * this.intensity);
      ctx.strokeStyle = '#ff3d00';
      ctx.beginPath();
      ctx.arc(this.impactX, this.impactY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d50000';
      ctx.font = `${Math.round(42 + this.impactLevel * 9)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', this.impactX, this.impactY - r * 0.06);
      ctx.restore();
    }
  }
}
