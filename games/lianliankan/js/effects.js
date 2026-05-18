// effects.js — 粒子 + fxLevel 联动
export class Effects {
  constructor() {
    this.particles = [];
    this.intensity = 1.0;  // 1.0=strong, 0.4=mild, 0=off
  }

  setIntensity(v) { this.intensity = v; }

  /** 在某像素坐标 spawn 一批粒子 */
  spawnBurst(x, y, colors, count = 8) {
    if (this.intensity === 0) return;
    const n = Math.max(1, Math.round(count * (this.intensity >= 1 ? 1 : 0.5)));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 600,
        maxLife: 600,
        color: colors[i % colors.length],
        size: 4 + Math.random() * 4,
      });
    }
  }

  /** 全屏胜利彩屑（在 boardWidth 上喷） */
  spawnCelebrate(boardWidth, boardHeight) {
    if (this.intensity === 0) return;
    const colors = ['#ff7043','#ffeb3b','#4caf50','#42a5f5','#9c27b0','#f44336'];
    const n = Math.round(40 * (this.intensity >= 1 ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * boardWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 100,
        vy: 80 + Math.random() * 120,
        life: 1500,
        maxLife: 1500,
        color: colors[i % colors.length],
        size: 6 + Math.random() * 6,
      });
    }
  }

  step(dt) {
    const dtSec = dt / 1000;
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 240 * dtSec;  // 重力
      p.life -= dt;
      return p.life > 0;
    });
  }

  draw(ctx, dpr) {
    if (this.intensity === 0) return;
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
