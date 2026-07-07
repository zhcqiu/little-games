export class Effects {
  constructor() {
    this.particles = [];
    this.shakeMs = 0;
    this.shakeAmp = 0;
    this.intensity = 1;
  }

  setIntensity(value) {
    this.intensity = Number(value) || 0;
  }

  step(dt) {
    this.shakeMs = Math.max(0, this.shakeMs - dt);
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

  offset() {
    if (this.shakeMs <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shakeAmp,
      y: (Math.random() * 2 - 1) * this.shakeAmp,
    };
  }

  draw(ctx) {
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
}
