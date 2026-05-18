// physics.test.js — physics 模块纯函数测试
import {
  reflectFromBrick,
  paddleReflectionAngle,
  sweepAgainstBrick,
} from '../js/physics.js';

// reflectFromBrick：球从四方向进入矩形，速度分量反转
{
  const r = reflectFromBrick({ vx: 0.3, vy: -0.5 }, 'top');
  assertEq('reflectFromBrick top: vx unchanged', r.vx, 0.3);
  assertEq('reflectFromBrick top: vy flipped',   r.vy, 0.5);
}
{
  const r = reflectFromBrick({ vx: 0.3, vy: 0.5 }, 'bottom');
  assertEq('reflectFromBrick bottom: vy flipped', r.vy, -0.5);
}
{
  const r = reflectFromBrick({ vx: -0.4, vy: 0.2 }, 'right');
  assertEq('reflectFromBrick right: vx flipped', r.vx, 0.4);
  assertEq('reflectFromBrick right: vy unchanged', r.vy, 0.2);
}
{
  const r = reflectFromBrick({ vx: 0.4, vy: 0.2 }, 'left');
  assertEq('reflectFromBrick left: vx flipped', r.vx, -0.4);
}

// paddleReflectionAngle：命中中心 → 几乎竖直；两端 → ±60°
{
  const cur = { vx: 0, vy: 5 };
  const r = paddleReflectionAngle(cur, 0);
  assertTrue('paddle center: vx≈0',       Math.abs(r.vx) < 0.01);
  assertTrue('paddle center: vy negative', r.vy < 0);
}
{
  const cur = { vx: 0, vy: 5 };
  const right = paddleReflectionAngle(cur, 1);
  assertTrue('paddle right end: vx > 0', right.vx > 0);
  assertTrue('paddle right end: vy < 0', right.vy < 0);
  const left = paddleReflectionAngle(cur, -1);
  assertTrue('paddle left end: vx < 0', left.vx < 0);
}
{
  const cur = { vx: 0, vy: 5 };
  const r1 = paddleReflectionAngle(cur, 0.7);
  const r2 = paddleReflectionAngle(cur, -0.7);
  const s1 = Math.hypot(r1.vx, r1.vy);
  const s2 = Math.hypot(r2.vx, r2.vy);
  assertTrue('paddle reflection conserves speed',
             Math.abs(s1 - 5) < 0.01 && Math.abs(s2 - 5) < 0.01);
  assertTrue('paddle reflection is symmetric',
             Math.abs(r1.vx + r2.vx) < 0.01 && Math.abs(r1.vy - r2.vy) < 0.01);
}

// sweepAgainstBrick：球从位置 A 到位置 B，AABB 命中
{
  // 球从砖下方（y=6.5，外于扩展 AABB 上界 6.3）干净接近砖底沿
  const ball = { x: 4.5, y: 6.5 };
  const next = { x: 4.5, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);  // brickCol=4, brickRow=5, radius=0.3
  assertTrue('sweep top hit detected', hit !== null);
  assertEq('sweep top side',           hit.side, 'bottom');  // 球从下进，命中砖下沿
}

// 幽灵命中守卫（regression: Codex review C-1）：
// 球刚反射离开邻砖（如 col=3 右面），现球心位于 x=4.3、扩展 AABB 重叠区域
// 中。即使速度朝邻砖方向，也应被识别为"已在内部"，不算命中。
{
  const ball = { x: 4.3, y: 5.5 };   // 已在 col=4 砖扩展 AABB [3.7, 5.3] 内
  const next = { x: 4.6, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  assertEq('phantom adjacent-brick rejected', hit, null);
}
{
  const ball = { x: 3.5, y: 5.5 };
  const next = { x: 4.5, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  assertTrue('sweep horizontal hit detected', hit !== null);
  assertEq('sweep horizontal side', hit.side, 'left');
}
{
  const ball = { x: 1, y: 1 };
  const next = { x: 1.2, y: 1.2 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  assertEq('sweep no hit', hit, null);
}
