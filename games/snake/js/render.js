// render.js — Canvas 绘制
import { BOARD_WIDTH, BOARD_HEIGHT } from './game.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.cellSize = 30;
    this._deadStartMs = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const containerW = parent.clientWidth;
    const containerH = parent.clientHeight;

    this.cellSize = Math.max(8, Math.floor(Math.min(
      containerW / (BOARD_WIDTH + 1),
      containerH / (BOARD_HEIGHT + 1)
    )));

    const w = this.cellSize * BOARD_WIDTH;
    const h = this.cellSize * BOARD_HEIGHT;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _readTheme() {
    const s = getComputedStyle(document.body);
    return {
      canvasBg:    s.getPropertyValue('--canvas-bg').trim()   || '#ffffff',
      canvasGrid:  s.getPropertyValue('--canvas-grid').trim() || 'rgba(0,0,0,0.05)',
      primary:     s.getPropertyValue('--primary').trim()     || '#ff7043',
      primaryDark: s.getPropertyValue('--primary-dark').trim()|| '#e64a19',
    };
  }

  draw(game, dt) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const w = s * BOARD_WIDTH;
    const h = s * BOARD_HEIGHT;
    const offset = this.effects ? this.effects.getShakeOffset() : { x: 0, y: 0 };
    const theme = this._readTheme();

    // 死亡塌陷动画：跟踪 dead 状态从 false → true 的瞬间
    if (game.dead && this._deadStartMs === null) {
      this._deadStartMs = performance.now();
    } else if (!game.dead) {
      this._deadStartMs = null;
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = theme.canvasGrid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * s);
      ctx.lineTo(w, r * s);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * s, 0);
      ctx.lineTo(c * s, h);
      ctx.stroke();
    }

    this._drawSnake(game, theme);
    this._drawFood(game);

    if (this.effects) this.effects.drawParticles(ctx, dt);

    // 死亡淡化：蛇 dead 时整画面再蒙一层灰
    if (game.dead) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();

    // 危险预警：蛇头下一格是墙或自身（非穿墙、非无敌、非死亡、非暂停）
    if (this._isHeadInDanger(game)) {
      const pulse = (Math.sin(performance.now() / 100) + 1) / 2;
      ctx.save();
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }
  }

  _isHeadInDanger(game) {
    if (game.dead || game.paused) return false;
    if (game.reviveInvincibleMs > 0) return false;
    if (!game.snake || game.snake.length === 0) return false;
    const head = game.snake[0];
    const dirs = {
      up:    { dr: -1, dc:  0 },
      down:  { dr: +1, dc:  0 },
      left:  { dr:  0, dc: -1 },
      right: { dr:  0, dc: +1 },
    };
    const d = dirs[game.currentDirection];
    if (!d) return false;
    const r = head.row + d.dr;
    const c = head.col + d.dc;
    // 墙：穿墙模式不算危险
    if (r < 0 || r >= BOARD_HEIGHT || c < 0 || c >= BOARD_WIDTH) {
      return game.endMode !== 'wrap';
    }
    // 自身：排除尾巴（下 tick 会让位）
    for (let i = 0; i < game.snake.length - 1; i++) {
      const s = game.snake[i];
      if (s.row === r && s.col === c) return true;
    }
    return false;
  }

  _drawSnake(game, theme) {
    const ctx = this.ctx;
    const s = this.cellSize;
    const len = game.snake.length;
    const invincible = game.reviveInvincibleMs > 0;
    const flashOn = invincible
      ? (Math.floor(performance.now() / 100) % 2 === 0)
      : true;
    const baseAlpha = flashOn ? 1.0 : 0.4;

    // 死亡塌陷：tail 段先消失，每 50ms 一节
    let deadVis = null;
    if (game.dead && this._deadStartMs !== null) {
      deadVis = (segIndex) => {
        const orderFromTail = len - 1 - segIndex;  // tail=0, head=len-1
        const segStart = orderFromTail * 50;
        const segAge = (performance.now() - this._deadStartMs) - segStart;
        if (segAge < 0) return { visible: true, scale: 1, alpha: 1 };
        if (segAge < 100) {
          const t = segAge / 100;
          return { visible: true, scale: 1 - t, alpha: 1 - t };
        }
        return { visible: false };
      };
    }

    // 吃食物波纹：500ms 内一个亮白脉冲从 head→tail 扫过
    const sinceEat = performance.now() - (game.lastEatAt ?? -10000);
    const rippleActive = sinceEat >= 0 && sinceEat < 500 && !game.dead;
    const rippleProgress = rippleActive ? sinceEat / 500 : -1;

    ctx.fillStyle = theme.primary;
    for (let i = 0; i < len; i++) {
      const seg = game.snake[i];
      const tailFade = 1 - (i / Math.max(len, 1)) * 0.15;
      let segAlpha = baseAlpha * tailFade;
      let segScale = 1;

      if (deadVis) {
        const dv = deadVis(i);
        if (!dv.visible) continue;
        segAlpha *= dv.alpha;
        segScale *= dv.scale;
      }

      ctx.globalAlpha = segAlpha;

      // 蛇尾摆动：最后一节微微 wobble（不死时）
      const isTail = i === len - 1;
      if (isTail && !game.dead) {
        const wob = Math.sin(performance.now() / 200) * 0.05;
        const cx = seg.col * s + s / 2;
        const cy = seg.row * s + s / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1 + wob, 1 - wob);
        ctx.translate(-cx, -cy);
        this._drawRoundedCell(seg.col * s, seg.row * s, s * segScale, s * 0.25);
        ctx.restore();
      } else if (segScale !== 1) {
        // 死亡塌陷期间收缩
        const cx = seg.col * s + s / 2;
        const cy = seg.row * s + s / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(segScale, segScale);
        ctx.translate(-cx, -cy);
        this._drawRoundedCell(seg.col * s, seg.row * s, s, s * 0.25);
        ctx.restore();
      } else {
        this._drawRoundedCell(seg.col * s, seg.row * s, s, s * 0.25);
      }

      // 吃食物波纹：每节按位置接波
      if (rippleActive) {
        const segPos = i / Math.max(len - 1, 1);
        const dist = Math.abs(segPos - rippleProgress);
        const intensity = Math.max(0, 1 - dist * 5);
        if (intensity > 0) {
          ctx.globalAlpha = intensity * 0.5;
          ctx.fillStyle = '#ffffff';
          this._drawRoundedCell(seg.col * s, seg.row * s, s, s * 0.25);
          ctx.fillStyle = theme.primary;
        }
      }
    }
    ctx.globalAlpha = 1;

    // 蛇头表情
    if (len > 0) {
      const head = game.snake[0];
      // 死亡塌陷里 head 自己也按规则消
      let headVisible = true;
      let headScale = 1;
      let headAlpha = baseAlpha;
      if (deadVis) {
        const dv = deadVis(0);
        if (!dv.visible) headVisible = false;
        else { headAlpha *= dv.alpha; headScale *= dv.scale; }
      }

      if (headVisible) {
        const cx = head.col * s + s / 2;
        const cy = head.row * s + s / 2;
        let angle = {
          right: 0,
          down: Math.PI / 2,
          left: Math.PI,
          up: -Math.PI / 2,
        }[game.currentDirection] || 0;

        // 暂停时蛇头四处看
        if (game.paused && !game.dead) {
          angle += Math.sin(performance.now() / 800) * (Math.PI / 12);
        }

        // 眨眼：每 5 秒一次，150ms 内 scaleY 从 1 → 0.1 → 1
        let blinkScaleY = 1;
        if (!game.dead) {
          const blinkPeriod = 5000;
          const tBlink = performance.now() % blinkPeriod;
          if (tBlink < 150) {
            blinkScaleY = 1 - Math.sin((tBlink / 150) * Math.PI) * 0.9;
          }
        }

        ctx.save();
        ctx.globalAlpha = headAlpha;
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.scale(headScale, headScale * blinkScaleY);
        ctx.font = `${s * 0.85}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(game.headEmoji || '🐍', 0, 0);
        ctx.restore();
      }
    }
  }

  _drawRoundedCell(x, y, size, radius) {
    const ctx = this.ctx;
    const inset = 1;
    const w = size - inset * 2;
    const h = size - inset * 2;
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w, h, radius);
    ctx.fill();
  }

  _drawFood(game) {
    if (!game.food) return;
    const ctx = this.ctx;
    const s = this.cellSize;
    const cx = game.food.col * s + s / 2;
    const cy = game.food.row * s + s / 2;

    // 弹出动画：220ms 内 ease-out-back
    const age = performance.now() - (game.foodSpawnAt ?? 0);
    let spawnScale = 1;
    if (age >= 0 && age < 220) {
      const t = age / 220;
      // ease-out-back: c1=1.7
      const c1 = 1.7, c3 = c1 + 1;
      spawnScale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    // 脉冲（弹出动画结束后才启用）
    const pulse = age > 220 ? 1 + Math.sin(performance.now() / 700 * Math.PI * 2) * 0.05 : 1;

    const totalScale = spawnScale * pulse;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(totalScale, totalScale);
    ctx.font = `${s * 0.9}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.foodEmoji || '🍎', 0, 0);
    ctx.restore();
  }
}
