const PLAYER_Z = 0.02;

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
    return { x: this.projectLane(game.playerOffset, game.laneCount, PLAYER_Z), y: this._roadAt(PLAYER_Z).y };
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
      const y = road.y;
      if (s.kind === 'tree') {
        const x = s.side === 'left' ? road.left - this.w * 0.05 * scale : road.right + this.w * 0.05 * scale;
        this._drawTree(ctx, x, y, scale);
      } else {
        this._drawBuilding(ctx, road, y, scale, s, t);
      }
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

  _drawBuilding(ctx, road, y, scale, item, t) {
    const sideSign = item.side === 'left' ? -1 : 1;
    const baseW = 52 * scale * (item.widthMul || 1);
    const baseH = 82 * scale * (item.heightMul || 1);
    const gap = 10 * scale;
    const edge = item.side === 'left' ? road.left : road.right;
    const nearEdge = edge + sideSign * gap;
    const farEdge = nearEdge + sideSign * baseW;
    const left = Math.min(nearEdge, farEdge);
    const right = Math.max(nearEdge, farEdge);
    const bottom = y + 2 * scale;
    const top = bottom - baseH;
    const roofSlant = sideSign * 5 * scale;

    ctx.fillStyle = item.wall || '#ffe0b2';
    ctx.beginPath();
    ctx.moveTo(left + roofSlant * 0.25, top);
    ctx.lineTo(right + roofSlant * 0.25, top + 4 * scale);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = item.roof || t.primary;
    ctx.beginPath();
    ctx.moveTo(left - 2 * scale, top);
    ctx.lineTo(right + 2 * scale, top + 4 * scale);
    ctx.lineTo(right + roofSlant, top - 8 * scale);
    ctx.lineTo(left + roofSlant, top - 10 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = item.window || '#42a5f5';
    const floors = item.floors || 3;
    const cols = Math.max(1, Math.min(3, Math.floor(baseW / (16 * scale))));
    const marginX = baseW * 0.18;
    const usableW = Math.max(10 * scale, baseW - marginX * 2);
    for (let r = 0; r < floors; r++) {
      const wy = top + baseH * 0.18 + r * (baseH * 0.62 / floors);
      for (let c = 0; c < cols; c++) {
        const wx = left + marginX + c * (usableW / cols) + sideSign * 2 * scale;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(wx, wy, 7 * scale, 9 * scale);
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeRect(left, top + 4 * scale, right - left, bottom - top - 4 * scale);
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
      if (v.z <= 0) continue;
      const p = this.objectPoint(v.lane, game.laneCount, v.z);
      const road = this._roadAt(v.z);
      const sideLean = this._sideLean(p.x, road);
      this._drawCar(ctx, p.x, p.y, this._scale(v.z), v.model, v.direction === 'toward', 0, v.z, sideLean);
    }
  }

  _drawPlayer(ctx, game, t) {
    const p = this.playerPoint(game);
    const model = { color: t.primary, roof: '#ffe0b2' };
    const road = this._roadAt(PLAYER_Z);
    this._drawCar(ctx, p.x, p.y, this._scale(PLAYER_Z) * 1.02, model, false, game.damage, PLAYER_Z, this._sideLean(p.x, road));
  }

  _drawCar(ctx, x, y, scale, model, toward, damage = 0, z = 0.2, sideLean = 0) {
    const w = 34 * scale;
    const h = 56 * scale;
    const perspective = 1 - Math.max(0, Math.min(1, z));
    const lean = Math.max(-0.38, Math.min(0.38, sideLean || 0));
    const topW = w * (0.54 + perspective * 0.08);
    const midW = w * (0.76 + perspective * 0.08);
    const bottomW = w * (1.0 + perspective * 0.08);
    const topY = -h * 0.52;
    const hoodY = toward ? -h * 0.08 : -h * 0.2;
    const bottomY = h * 0.48;
    const topShift = lean * w * 0.7;
    const midShift = lean * w * 0.35;
    const bottomShift = -lean * w * 0.12;
    ctx.save();
    ctx.translate(x, y - h * 0.35);

    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.52, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = {
      tl: { x: -topW / 2 + topShift, y: topY },
      tr: { x: topW / 2 + topShift, y: topY },
      br: { x: bottomW / 2 + bottomShift, y: bottomY },
      bl: { x: -bottomW / 2 + bottomShift, y: bottomY },
    };

    ctx.fillStyle = model.color;
    ctx.beginPath();
    ctx.moveTo(body.tl.x, body.tl.y);
    ctx.lineTo(body.tr.x, body.tr.y);
    ctx.lineTo(body.br.x, body.br.y);
    ctx.quadraticCurveTo(bottomShift, bottomY + h * 0.06, body.bl.x, body.bl.y);
    ctx.closePath();
    ctx.fill();

    if (Math.abs(lean) > 0.04) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      if (lean > 0) {
        ctx.moveTo(body.tl.x, body.tl.y);
        ctx.lineTo(body.bl.x, body.bl.y);
        ctx.lineTo(body.bl.x + w * 0.18, body.bl.y - h * 0.08);
        ctx.lineTo(body.tl.x + w * 0.1, body.tl.y + h * 0.08);
      } else {
        ctx.moveTo(body.tr.x, body.tr.y);
        ctx.lineTo(body.br.x, body.br.y);
        ctx.lineTo(body.br.x - w * 0.18, body.br.y - h * 0.08);
        ctx.lineTo(body.tr.x - w * 0.1, body.tr.y + h * 0.08);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.beginPath();
    ctx.moveTo(body.tl.x, body.tl.y);
    ctx.lineTo(body.bl.x, body.bl.y);
    ctx.moveTo(body.tr.x, body.tr.y);
    ctx.lineTo(body.br.x, body.br.y);
    ctx.stroke();

    ctx.fillStyle = model.roof;
    ctx.beginPath();
    ctx.moveTo(-topW * 0.34 + topShift, topY + h * 0.1);
    ctx.lineTo(topW * 0.34 + topShift, topY + h * 0.1);
    ctx.lineTo(midW * 0.28 + midShift, topY + h * 0.34);
    ctx.lineTo(-midW * 0.28 + midShift, topY + h * 0.34);
    ctx.closePath();
    ctx.fill();

    if (toward) {
      ctx.fillStyle = 'rgba(187, 222, 251, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-midW * 0.34 + midShift, topY + h * 0.38);
      ctx.lineTo(midW * 0.34 + midShift, topY + h * 0.38);
      ctx.lineTo(midW * 0.24 + bottomShift, hoodY + h * 0.2);
      ctx.lineTo(-midW * 0.24 + bottomShift, hoodY + h * 0.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#263238';
      ctx.fillRect(-bottomW * 0.22 + bottomShift, h * 0.22, bottomW * 0.44, h * 0.06);
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.ellipse(-bottomW * 0.32 + bottomShift, h * 0.27, w * 0.09, h * 0.045, 0, 0, Math.PI * 2);
      ctx.ellipse(bottomW * 0.32 + bottomShift, h * 0.27, w * 0.09, h * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(38, 50, 56, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-midW * 0.3 + midShift, topY + h * 0.36);
      ctx.lineTo(midW * 0.3 + midShift, topY + h * 0.36);
      ctx.lineTo(midW * 0.24 + bottomShift, topY + h * 0.58);
      ctx.lineTo(-midW * 0.24 + bottomShift, topY + h * 0.58);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(-bottomW * 0.38 + bottomShift, h * 0.28, w * 0.14, h * 0.06);
      ctx.fillRect(bottomW * 0.24 + bottomShift, h * 0.28, w * 0.14, h * 0.06);
      ctx.fillStyle = 'rgba(38,50,56,0.5)';
      ctx.fillRect(-bottomW * 0.24 + bottomShift, h * 0.21, bottomW * 0.48, h * 0.035);
    }

    ctx.fillStyle = '#263238';
    ctx.fillRect(-bottomW * 0.48 + bottomShift, h * 0.02, w * 0.08, h * 0.25);
    ctx.fillRect(bottomW * 0.4 + bottomShift, h * 0.02, w * 0.08, h * 0.25);

    if (damage > 0) {
      ctx.font = (18 * scale) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(damage >= 2 ? '💨' : '🩹', w * 0.06, -h * 0.02);
    }
    ctx.restore();
  }

  _sideLean(x, road) {
    const half = Math.max(1, road.width / 2);
    return Math.max(-0.38, Math.min(0.38, -((x - this.w / 2) / half) * 0.4));
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
    const horizonY = this.h * 0.27;
    const nearY = this.h * 0.97;
    const nearD = 0.32;
    const farD = 5.6;
    const d = nearD + zz * (farD - nearD);
    const inv = 1 / d;
    const k = (inv - 1 / farD) / (1 / nearD - 1 / farD);
    const y = horizonY + k * (nearY - horizonY);
    const farWidth = this.w * 0.16;
    const nearWidth = this.w * 1.18;
    const width = farWidth + k * (nearWidth - farWidth);
    return { y, width, left: this.w / 2 - width / 2, right: this.w / 2 + width / 2, k };
  }

  _scale(z) {
    const road = this._roadAt(z);
    return (0.13 + road.k * 1.24) * this.dpr;
  }
}
