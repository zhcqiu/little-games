// game.test.js — GameLogic 纯函数测试
import { GameLogic } from '../js/game.js';

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
