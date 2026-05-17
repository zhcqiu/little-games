// game.test.js — GameLogic 纯函数测试
import { GameLogic } from '../js/game.js';
import { SPEED_TABLE, PADDLE_Y } from '../js/game.js';

// 初始状态
{
  const g = new GameLogic();
  assertEq('score=0',   g.score,        0);
  assertEq('combo=1',   g.combo,        1);
  assertEq('paused=false', g.paused,    false);
  assertEq('board 12 cols × 18 rows', g.cols * g.rows, 12 * 18);
  assertEq('initial 4 rows seeded',
           g.board.slice(0, 4).every(row => row.some(v => v > 0)), true);
  assertEq('bottom rows empty',
           g.board.slice(4).every(row => row.every(v => v === 0)), true);
  assertEq('1 ball at start', g.balls.length, 1);
  assertTrue('ball waiting for launch (vy === 0)', g.balls[0].vy === 0);
  assertEq('paddle col centered', g.paddle.col, 6);
}

// setPaddleCol：clamp 边界
{
  const g = new GameLogic();
  g.setPaddleCol(3);
  assertEq('paddle col=3', g.paddle.col, 3);
  g.setPaddleCol(-5);
  assertTrue('paddle col >= half-width (left clamp)', g.paddle.col >= 1.5);
  g.setPaddleCol(99);
  assertTrue('paddle col <= cols - half-width (right clamp)', g.paddle.col <= 12 - 1.5);
}

// 球发射：1.5s 倒计时
{
  const g = new GameLogic();
  assertTrue('initial ball glued (vy=0)', g.balls[0].vy === 0);
  g.step(800);
  assertTrue('still glued mid-countdown', g.balls[0].vy === 0);
  g.step(800);
  assertTrue('ball launched (vy != 0)', g.balls[0].vy !== 0);
  assertTrue('ball goes up', g.balls[0].vy < 0);
  const sp = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  const expected = SPEED_TABLE[g.speedLevel - 1];
  assertTrue('ball speed = speed table', Math.abs(sp - expected) < 0.01);
}

// paused 时 step 不推进
{
  const g = new GameLogic();
  g.setPaused(true);
  const before = g.ballRespawnTimer;
  g.step(2000);
  assertEq('paused: timer unchanged', g.ballRespawnTimer, before);
}

// 球运动 + 墙壁反射
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 5, vy: 0 };   // 向右走，预测 200ms 后到 7.0
  g.step(200);
  assertTrue('ball moved right', g.balls[0].x > 6.5);

  // 让球撞右墙
  g.balls[0] = { x: 11.5, y: 8, vx: 5, vy: 0 };
  g.step(200);
  assertTrue('ball bounced off right wall (vx flipped)', g.balls[0].vx < 0);
}

// 顶墙反射
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 0.5, vx: 0, vy: -5 };
  g.step(200);
  assertTrue('ball bounced off top wall (vy flipped)', g.balls[0].vy > 0);
}

// 球掉底：combo 归 1，触发 onDrop
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.combo = 5;
  g.balls[0] = { x: 6, y: 17.8, vx: 0, vy: 5 };
  let dropped = 0;
  g.onDrop(() => dropped++);
  g.step(200);  // 200ms 后球 y=18.8，越出
  assertEq('combo reset to 1', g.combo, 1);
  assertEq('onDrop fired', dropped, 1);
  assertEq('1 ball respawned', g.balls.length, 1);
  assertTrue('respawn timer set', g.ballRespawnTimer > 0);
}

// 板拍命中：球从板拍上方下来 → 反弹向上
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.paddle.col = 6;
  // 球正中央落在板拍中心：vy 向下，应反弹向上
  g.balls[0] = { x: 6, y: PADDLE_Y - 0.5, vx: 0, vy: 5 };
  let hits = 0;
  g.onPaddleHit(() => hits++);
  g.step(50);
  assertTrue('ball bounced off paddle (vy<0)', g.balls[0].vy < 0);
  assertEq('onPaddleHit fired', hits, 1);
}

// 板拍命中偏左 → vx 向左
{
  const g = new GameLogic();
  g.ballRespawnTimer = 0;
  g.paddle.col = 6;
  g.balls[0] = { x: 5.0, y: PADDLE_Y - 0.5, vx: 0, vy: 5 };  // 偏左
  g.step(50);
  assertTrue('left-of-center hit -> vx < 0', g.balls[0].vx < 0);
  assertTrue('vy < 0 (going up)', g.balls[0].vy < 0);
}
