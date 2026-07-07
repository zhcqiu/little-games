export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.time = 0;
  }

  draw(game, dt) {
    this._resize();
    this.time += dt || 0;
    const ctx = this.ctx;
    const off = this.effects.offset();
    ctx.save();
    ctx.translate(off.x, off.y);
    this._drawWorld(ctx, game);
    this.effects.draw(ctx);
    ctx.restore();
  }

  projectLane(lane, laneCount, z) {
    const road = this._roadAt(z);
    const laneWidth = road.width / laneCount;
    return road.left + laneWidth * (lane + 0.5);
  }

  playerPoint(game) {
    const z = 0.08;
    return { x: this.projectLane(game.playerOffset, game.laneCount, z), y: this._roadAt(z).y };
  }

  objectPoint(lane, laneCount, z) {
    return { x: this.projectLane(lane, laneCount, z), y: this._roadAt(z).y };
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(240, Math.floor(rect.width * dpr));
    const h = Math.max(320, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dpr = dpr;
      this.w = w;
      this.h = h;
    }
  }

  _theme() {
    const s = getComputedStyle(document.body);
    return {
      bg: s.getPropertyValue('--bg').trim() || '#fff8e1',
      bg2: s.getPropertyValue('--bg-2').trim() || '#ff8a65',
      primary: s.getPropertyValue('--primary').trim() || '#ff7043',
      primaryDark: s.getPropertyValue('--primary-dark').trim() || '#e64a19',
      canvasBg: s.getPropertyValue('--canvas-bg').trim() || '#fff',
      canvasGrid: s.getPropertyValue('--canvas-grid').trim() || 'rgba(255,112,67,.16)',
      sky: s.getPropertyValue('--road-sky').trim() || '#b3e5fc',
    };
  }

  _drawWorld(ctx, game) {
    const t = this._theme();
    this._drawSky(ctx, game, t);
    this._drawScenery(ctx, game, t);
    this._drawRoad(ctx, game, t);
    this._drawFruits(ctx, game);
    this._drawVehicles(ctx, game);
    this._drawPlayer(ctx, game, t);
    if (game.gameOver) this._drawRepairOverlay(ctx);
  }

  _drawSky(ctx, game, t) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.h * 0.62);
    grad.addColorStop(0, t.sky);
    grad.addColorStop(1, t.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    const sunX = this.w * 0.78;
    const sunY = this.h * 0.11;
    const r = this.w * 0.06;
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2, this.w * 0.006);
    ctx.strokeStyle = '#f57f17';
    ctx.beginPath();
    ctx.arc(sunX - r * 0.28, sunY - r * 0.08, r * 0.08, 0, Math.PI * 2);
    ctx.arc(sunX + r * 0.28, sunY - r * 0.08, r * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sunX, sunY + r * 0.08, r * 0.42, 0, Math.PI);
    ctx.stroke();

    const px = (game.planeMs < 0 ? -game.planeMs / 3800 : 0) * (this.w + 180) - 90;
    if (game.planeMs < 0) {
      ctx.font = `${Math.round(this.w * 0.045)}px sans-serif`;
      ctx.fillText('✈️', px, this.h * 0.16);
      ctx.font = `${Math.round(this.w * 0.026)}px sans-serif`;
      ctx.fillText('加油', px - this.w * 0.055, this.h * 0.16 + this.w * 0.045);
    }
  }

  _drawRoad(ctx, game, t) {
    const horizon = this._roadAt(1);
    const near = this._roadAt(0);
    ctx.fillStyle = '#8d99a6';
    ctx.beginPath();
    ctx.moveTo(horizon.left, horizon.y);
    ctx.lineTo(horizon.right, horizon.y);
    ctx.lineTo(near.right, near.y);
    ctx.lineTo(near.left, near.y);
    ctx.closePath();
    ctx.fill();

    const danger = game.getDangerLane();
    if (danger !== null) {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(this.time / 160) * 0.08;
      ctx.fillStyle = '#fff176';
      this._lanePath(ctx, danger, game.laneCount, 0.13, 0.5);
      ctx.fill();
      ctx.restore();
    }

    ctx.lineWidth = Math.max(2, this.w * 0.006);
    ctx.strokeStyle = '#ffffff';
    for (let i = 1; i < game.laneCount; i++) {
      ctx.setLineDash([18 * this.dpr, 16 * this.dpr]);
      ctx.beginPath();
      const a = this.projectLane(i - 0.5, game.laneCount, 1);
      const b = this.projectLane(i - 0.5, game.laneCount, 0);
      ctx.moveTo(a, horizon.y);
      ctx.lineTo(b, near.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = t.primary;
    ctx.lineWidth = Math.max(4, this.w * 0.009);
    ctx.beginPath();
    ctx.moveTo(horizon.left, horizon.y);
    ctx.lineTo(near.left, near.y);
    ctx.moveTo(horizon.right, horizon.y);
    ctx.lineTo(near.right, near.y);
    ctx.stroke();
  }

  _lanePath(ctx, lane, laneCount, zNear, zFar) {
    const a = this._roadAt(zFar);
    const b = this._roadAt(zNear);
    const lwA = a.width / laneCount;
    const lwB = b.width / laneCount;
    ctx.beginPath();
    ctx.moveTo(a.left + lwA * lane, a.y);
    ctx.lineTo(a.left + lwA * (lane + 1), a.y);
    ctx.lineTo(b.left + lwB * (lane + 1), b.y);
    ctx.lineTo(b.left + lwB * lane, b.y);
    ctx.closePath();
  }

  _drawScenery(ctx, game, t) {
    for (const s of game.scenery.slice().sort((a, b) => b.z - a.z)) {
      const road = this._roadAt(s.z);
      const scale = this._scale(s.z);
      const x = s.side === 'left' ? road.left - this.w * 0.08 * scale : road.right + this.w * 0.08 * scale;
      const y = road.y;
      if (s.kind === 'tree') this._drawTree(ctx, x, y, scale);
      else this._drawHouse(ctx, x, y, scale, t);
    }
  }

  _drawTree(ctx, x, y, scale) {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(x - 5 * scale, y - 34 * scale, 10 * scale, 34 * scale);
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(x, y - 44 * scale, 20 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawHouse(ctx, x, y, scale, t) {
    ctx.fillStyle = '#fff3e0';
    ctx.fillRect(x - 22 * scale, y - 36 * scale, 44 * scale, 36 * scale);
    ctx.fillStyle = t.primary;
    ctx.beginPath();
    ctx.moveTo(x - 26 * scale, y - 36 * scale);
    ctx.lineTo(x, y - 60 * scale);
    ctx.lineTo(x + 26 * scale, y - 36 * scale);
    ctx.closePath();
    ctx.fill();
  }

  _drawFruits(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of game.fruits.slice().sort((a, b) => b.z - a.z)) {
      const p = this.objectPoint(f.lane, game.laneCount, f.z);
      const scale = this._scale(f.z);
      ctx.font = `${Math.max(14, 42 * scale * this.dpr)}px sans-serif`;
      ctx.fillText(f.emoji, p.x, p.y - Math.sin(f.bob) * 5 * scale);
    }
  }

  _drawVehicles(ctx, game) {
    for (const v of game.vehicles.slice().sort((a, b) => b.z - a.z)) {
      const p = this.objectPoint(v.lane, game.laneCount, v.z);
      this._drawCar(ctx, p.x, p.y, this._scale(v.z), v.model, v.direction === 'toward');
    }
  }

  _drawPlayer(ctx, game, t) {
    const p = this.playerPoint(game);
    const model = { color: t.primary, roof: '#ffe0b2' };
    this._drawCar(ctx, p.x, p.y, 1.35 * this.dpr, model, false, game.damage);
  }

  _drawCar(ctx, x, y, scale, model, toward, damage = 0) {
    const w = 44 * scale;
    const h = 68 * scale;
    ctx.save();
    ctx.translate(x, y - h * 0.35);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.58, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = model.color;
    this._roundRect(ctx, -w / 2, -h / 2, w, h, 10 * scale);
    ctx.fill();
    ctx.fillStyle = model.roof;
    this._roundRect(ctx, -w * 0.32, -h * 0.28, w * 0.64, h * 0.28, 7 * scale);
    ctx.fill();
    ctx.fillStyle = toward ? '#fff59d' : '#263238';
    ctx.fillRect(-w * 0.38, h * 0.24, w * 0.18, h * 0.08);
    ctx.fillRect(w * 0.2, h * 0.24, w * 0.18, h * 0.08);
    if (damage > 0) {
      ctx.font = `${18 * scale}px sans-serif`;
      ctx.fillText(damage >= 2 ? '💨' : '🩹', w * 0.06, -h * 0.02);
    }
    ctx.restore();
  }

  _drawRepairOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 248, 225, 0.72)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(this.w * 0.12)}px sans-serif`;
    ctx.fillText('🛠️', this.w / 2, this.h * 0.43);
    ctx.font = `${Math.round(this.w * 0.046)}px sans-serif`;
    ctx.fillStyle = '#4e342e';
    ctx.fillText('小车修一修', this.w / 2, this.h * 0.54);
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _roadAt(z) {
    const zz = Math.max(0, Math.min(1, z));
    const horizonY = this.h * 0.26;
    const nearY = this.h * 0.96;
    const k = 1 - zz;
    const y = horizonY + k * (nearY - horizonY);
    const farWidth = this.w * 0.18;
    const nearWidth = this.w * 1.22;
    const width = farWidth + k * (nearWidth - farWidth);
    return { y, width, left: this.w / 2 - width / 2, right: this.w / 2 + width / 2 };
  }

  _scale(z) {
    const k = 1 - Math.max(0, Math.min(1, z));
    return (0.18 + k * 1.08) * this.dpr;
  }
}
