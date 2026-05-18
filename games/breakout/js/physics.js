// physics.js — 纯函数物理：AABB sweep、反射几何
// 单位：列（cell）。所有坐标 / 速度都用 cell 单位，render 层乘 cellSize。
// 球：x, y 是中心；radius 0.3 cell。
// 砖块：(row, col) → 包围盒 [col, col+1] × [row, row+1]。

/** 砖块命中后反弹速度，side ∈ 'top' | 'bottom' | 'left' | 'right' */
export function reflectFromBrick(vel, side) {
  if (side === 'top'    || side === 'bottom') return { vx:  vel.vx, vy: -vel.vy };
  if (side === 'left'   || side === 'right')  return { vx: -vel.vx, vy:  vel.vy };
  return { ...vel };
}

/**
 * 板拍角度反射。
 * @param {{vx, vy}} vel 当前速度
 * @param {number} hitOffsetRatio 命中点偏移占板拍半宽的比例（-1 = 最左，+1 = 最右）
 * @returns {{vx, vy}} 反射后速度（速度大小守恒）
 */
export function paddleReflectionAngle(vel, hitOffsetRatio) {
  const speed = Math.hypot(vel.vx, vel.vy);
  const t = Math.max(-1, Math.min(1, hitOffsetRatio));
  const angleDeg = t * 60;
  const angleRad = angleDeg * Math.PI / 180;
  return {
    vx: speed * Math.sin(angleRad),
    vy: -speed * Math.abs(Math.cos(angleRad)),
  };
}

/**
 * 球从 ball 移到 next 期间是否命中砖 (brickCol, brickRow)。
 * 命中则返回 { t, side, contactX, contactY }；未命中返回 null。
 */
export function sweepAgainstBrick(ball, next, brickCol, brickRow, radius) {
  const boxL = brickCol     - radius;
  const boxR = brickCol + 1 + radius;
  const boxT = brickRow     - radius;
  const boxB = brickRow + 1 + radius;

  const dx = next.x - ball.x;
  const dy = next.y - ball.y;

  if (Math.min(ball.x, next.x) > boxR || Math.max(ball.x, next.x) < boxL) return null;
  if (Math.min(ball.y, next.y) > boxB || Math.max(ball.y, next.y) < boxT) return null;

  let tEnterX = -Infinity, tExitX = Infinity;
  if (Math.abs(dx) > 1e-9) {
    const t1 = (boxL - ball.x) / dx;
    const t2 = (boxR - ball.x) / dx;
    tEnterX = Math.min(t1, t2);
    tExitX  = Math.max(t1, t2);
  } else {
    if (ball.x < boxL || ball.x > boxR) return null;
  }

  let tEnterY = -Infinity, tExitY = Infinity;
  if (Math.abs(dy) > 1e-9) {
    const t1 = (boxT - ball.y) / dy;
    const t2 = (boxB - ball.y) / dy;
    tEnterY = Math.min(t1, t2);
    tExitY  = Math.max(t1, t2);
  } else {
    if (ball.y < boxT || ball.y > boxB) return null;
  }

  const tEnter = Math.max(tEnterX, tEnterY);
  const tExit  = Math.min(tExitX, tExitY);

  if (tEnter > tExit || tEnter > 1 || tExit < 0) return null;
  // 拒绝"已经在 AABB 内"的幽灵命中：ball 刚反射离开邻砖后，下一子步起点在
  // 当前砖的扩展 AABB 内（因 radius 让相邻 AABB 必然重叠 2×radius）。
  // 这种情况下 tEnter 显著为负，应判定为非命中。
  if (tEnter < -1e-3) return null;
  const t = Math.max(0, tEnter);

  let side;
  if (tEnterX > tEnterY) {
    side = dx > 0 ? 'left' : 'right';
  } else {
    side = dy > 0 ? 'top' : 'bottom';
  }

  return {
    t,
    side,
    contactX: ball.x + dx * t,
    contactY: ball.y + dy * t,
  };
}
