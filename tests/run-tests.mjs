// 仓库级 Node 测试入口 — CI 用
// 跑各游戏的纯函数测试断言。浏览器侧另有 tests.html 包同样断言。
import { PIECE_TYPES, getCells, getPieceWidth, PIECES } from '../games/tetris/js/pieces.js';
import { Game, createBag } from '../games/tetris/js/game.js';
import { GameLogic as BreakoutGame, COLS as BR_COLS, ROWS as BR_ROWS } from '../games/breakout/js/game.js';
import { reflectFromBrick, paddleReflectionAngle, sweepAgainstBrick } from '../games/breakout/js/physics.js';
import { randomBrickValue } from '../games/breakout/js/bricks.js';

let passed = 0;
let failed = 0;
const eq = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`FAIL: ${label}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`); }
};
const truthy = (label, cond) => {
  if (cond) passed++;
  else { failed++; console.error(`FAIL: ${label}`); }
};

// ───── pieces ─────
eq('PIECE_TYPES length', PIECE_TYPES.length, 7);
for (const t of PIECE_TYPES) {
  eq(`${t} has 4 rotations`, PIECES[t].shapes.length, 4);
  truthy(`${t} has color`, typeof PIECES[t].color === 'string');
}
eq('O 4 cells', getCells('O', 0).length, 4);
eq('O rotation consistency', getCells('O', 0), getCells('O', 2));
eq('I horizontal width', getPieceWidth('I', 0), 4);
eq('I vertical width', getPieceWidth('I', 1), 3);

// ───── game basics ─────
const g = new Game();
eq('20 rows', g.board.length, 20);
eq('10 cols per row', g.board[0].length, 10);
eq('board empty', g.board.flat().every((c) => c === null), true);

// 7-bag
const bag = createBag();
eq('bag size 7', bag.length, 7);
eq('bag contains IJLOSTZ', bag.slice().sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
truthy('has current', g.current !== null);
truthy('has next', g.next !== null);

// 碰撞 + tryMoveTo + tryMoveDown
const g2 = new Game();
g2.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
eq('empty (5,4) no collide', g2._collides(5, 4, 0, 'T'), false);
eq('left edge collide', g2._collides(5, -1, 0, 'T'), true);
eq('right edge collide', g2._collides(5, 8, 0, 'T'), true);
eq('bottom collide', g2._collides(19, 4, 0, 'T'), true);
g2.board[6][5] = '#aaa';
eq('block ahead collide', g2._collides(5, 4, 0, 'T'), true);

const g3 = new Game();
g3.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
g3.tryMoveTo(0, 20);
eq('clamp right', g3.current.col, 7);

const g4 = new Game();
g4.current = { type: 'I', rotation: 1, row: 0, col: 4, lowWaterMark: 0 };
const moved = g4.tryMoveDown();
eq('I down', g4.current.row, 1);
eq('tryMoveDown true', moved, true);

// 旋转 + wall-kick
const g5 = new Game();
g5.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
truthy('T CW rotates', g5.tryRotate(1));
eq('T rotation = 1', g5.current.rotation, 1);

const g6 = new Game();
g6.current = { type: 'T', rotation: 0, row: 5, col: -1, lowWaterMark: 5 };
const before = g6.current.col;
g6.tryRotate(1);
truthy('wall-kick shift right', g6.current.col > before);

// lock + 消行
const g7 = new Game();
g7.current = { type: 'O', rotation: 0, row: 18, col: 0, lowWaterMark: 18 };
const beforeNext = g7.next;
g7.lockPiece();
eq('locked O at (18,1)', g7.board[18][1], '#ffeb3b');
eq('locked O at (19,1)', g7.board[19][1], '#ffeb3b');
eq('current advanced to next', g7.current.type, beforeNext);

// 多行消除（v1.2 bug 修复回归测试）
const g8 = new Game();
for (let c = 0; c < 10; c++) { g8.board[18][c] = '#aaa'; g8.board[19][c] = '#bbb'; }
g8._clearRows([18, 19]);
eq('row 19 cleared (was bbb)', g8.board[19], Array(10).fill(null));
eq('row 18 cleared (was aaa)', g8.board[18], Array(10).fill(null));
eq('score +2 from double clear', g8.score, 2);

const g9 = new Game();
for (let r = 16; r <= 19; r++) for (let c = 0; c < 10; c++) g9.board[r][c] = '#aaa';
g9._clearRows([16, 17, 18, 19]);
eq('tetris clear empties 4 rows', g9.board.slice(16, 20).every(row => row.every(c => c === null)), true);
eq('score +4', g9.score, 4);

// 上拉容忍
const g10 = new Game();
g10.setUpwardTolerance(0);
g10.current = { type: 'O', rotation: 0, row: 10, col: 0, lowWaterMark: 10 };
g10.tryMoveTo(5, 0);
eq('tol=0 cannot pull up', g10.current.row, 10);
g10.setUpwardTolerance(2);
g10.tryMoveTo(8, 0);
eq('tol=2 pull up to 8', g10.current.row, 8);

// 无尽模式：清下半区 + 上半区下移
const g11 = new Game();
g11.setEndMode('endless');
for (let r = 0; r < 20; r++) for (let c = 0; c < 10; c++) g11.board[r][c] = '#aaa';
for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) g11.board[r][c] = null;
let endlessCalled = [];
g11.onGameOver((mode) => endlessCalled.push(mode));
g11._handleGameOver();
eq('endless-reset called', endlessCalled[0], 'endless-reset');
// 上半区原来的 row 5 ('#aaa') 被下移到 row 15
eq('old row 5 now at row 15', g11.board[15][5], '#aaa');
// 新 row 5 是新插入的空行
eq('new row 5 is empty', g11.board[5][5], null);
// 新 row 0..2 也是空（顶上 10 行全空，给新方块空间）
eq('new row 0 col 5 empty', g11.board[0][5], null);

// 硬落下
const g12 = new Game();
g12.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
g12.hardDrop();
truthy('hard drop locked the piece', g12.board[19][1] !== null);

// 序列化 + 反序列化
const g13 = new Game();
g13.current = { type: 'T', rotation: 1, row: 5, col: 4, lowWaterMark: 5 };
g13.score = 7;
const snap = g13.serialize();
const g14 = new Game();
g14.restore(snap);
eq('restore score', g14.score, 7);
eq('restore current type', g14.current.type, 'T');
eq('restore current rotation', g14.current.rotation, 1);

// ───── snake ─────
const { Game: SnakeGame, BOARD_WIDTH: SW, BOARD_HEIGHT: SH } =
  await import('../games/snake/js/game.js');

eq('snake board 12 wide', SW, 12);
eq('snake board 16 tall', SH, 16);

const sg = new SnakeGame();
eq('snake init len 4', sg.snake.length, 4);
eq('snake head (8,7)', sg.snake[0], { row: 8, col: 7 });
eq('snake init dir right', sg.currentDirection, 'right');

// 180° 反向拒绝
const sg2 = new SnakeGame();
sg2.queueDirection('left');
eq('snake reject 180°', sg2.nextDirection, null);
sg2.queueDirection('up');
eq('snake accept perpendicular', sg2.nextDirection, 'up');

// advance + 撞墙（标准）
const sg3 = new SnakeGame();
sg3.food = { row: 0, col: 0 };
sg3.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
sg3._advance();
eq('snake wall hits dead', sg3.dead, true);

// wrap
const sg4 = new SnakeGame();
sg4.setEndMode('wrap');
sg4.food = { row: 0, col: 0 };
sg4.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }];
sg4._advance();
eq('snake wrap to col 0', sg4.snake[0], { row: 8, col: 0 });
eq('snake wrap not dead', sg4.dead, false);

// revive
const sg5 = new SnakeGame();
sg5.setEndMode('revive');
sg5.food = { row: 0, col: 0 };
sg5.snake = [
  { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 8, col: 8 },
  { row: 8, col: 7 }, { row: 8, col: 6 }, { row: 8, col: 5 }, { row: 8, col: 4 },
];
sg5.score = 5;
sg5._advance();
eq('snake revive not dead', sg5.dead, false);
eq('snake revive trim to 4', sg5.snake.length, 4);
eq('snake revive score kept', sg5.score, 5);
truthy('snake revive invincible', sg5.reviveInvincibleMs > 0);

// 吃食物
const sg6 = new SnakeGame();
sg6.food = { row: 8, col: 8 };
sg6._advance();
eq('snake ate +1', sg6.score, 1);
eq('snake grew', sg6.snake.length, 5);

// 序列化
const sg7 = new SnakeGame();
sg7.score = 11;
sg7.currentDirection = 'down';
sg7.foodEmoji = '🍓';
const snakeSnap = sg7.serialize();
const sg8 = new SnakeGame();
const ok = sg8.restore(snakeSnap);
truthy('snake restore ok', ok);
eq('snake restore score', sg8.score, 11);
eq('snake restore dir', sg8.currentDirection, 'down');
eq('snake restore emoji', sg8.foodEmoji, '🍓');
eq('snake restore invalid', sg8.restore({}), false);

// snake heads
const sg9 = new SnakeGame();
truthy('snake init head exists', typeof sg9.headEmoji === 'string' && sg9.headEmoji.length > 0);
eq('snake init theme cheery', sg9.theme, 'cheery');

sg9.setTheme('night');
const NIGHT_POOL = ['🦇', '🦉', '👻', '🐺'];
truthy('snake night head from pool', NIGHT_POOL.includes(sg9.headEmoji));

// 序列化保留
sg9.setTheme('forest');
sg9.reset();
const oldH = sg9.headEmoji;
const headSnap = sg9.serialize();
const sg10 = new SnakeGame();
sg10.restore(headSnap);
eq('snake restore preserves head', sg10.headEmoji, oldH);
eq('snake restore preserves theme', sg10.theme, 'forest');

// snake combo
const sg11 = new SnakeGame();
sg11.food = { row: 8, col: 8 };
sg11._advance();
eq('snake combo 1', sg11.comboCount, 1);
sg11.food = { row: 8, col: 9 };
sg11._advance();
sg11.food = { row: 8, col: 10 };
sg11._advance();
eq('snake combo 3', sg11.comboCount, 3);
eq('snake combo +1 bonus', sg11.score, 4);

const sg12 = new SnakeGame();
sg12.comboCount = 7;
sg12.reset();
eq('snake reset combo', sg12.comboCount, 0);

const sg13 = new SnakeGame();
sg13.comboCount = 4;
sg13.comboLastEatMs = 999;
const snap2 = sg13.serialize();
const sg14 = new SnakeGame();
sg14.restore(snap2);
eq('snake restore combo', sg14.comboCount, 4);
eq('snake restore comboLastEatMs', sg14.comboLastEatMs, 999);

// snake unlock heads
const sg15 = new SnakeGame();
sg15.setTotalFood(150);
const t2pool = ['🐲', '🐯', '🦁', '🐹', '🐵'];
let allInT2 = true;
for (let i = 0; i < 30; i++) {
  sg15.reset();
  if (!t2pool.includes(sg15.headEmoji)) { allInT2 = false; break; }
}
truthy('snake t2 unlock', allInT2);

// snake food edge margin
const sg16 = new SnakeGame();
sg16.setFoodEdgeMargin(3);
sg16.snake = [{ row: 8, col: 7 }];
let allInner = true;
for (let i = 0; i < 50; i++) {
  const f = sg16._spawnFood();
  if (!f || f.row < 3 || f.row >= 13 || f.col < 3 || f.col >= 9) { allInner = false; break; }
}
truthy('snake margin=3 inner only', allInner);

const sg17 = new SnakeGame();
sg17.setFoodEdgeMargin(-1);
eq('snake clamp neg', sg17.foodEdgeMargin, 0);
sg17.setFoodEdgeMargin(99);
eq('snake clamp huge', sg17.foodEdgeMargin, 3);

const sg18 = new SnakeGame();
sg18.foodEdgeMargin = 2;
const fmSnapNode = sg18.serialize();
const sg19 = new SnakeGame();
sg19.restore(fmSnapNode);
eq('snake restore foodEdgeMargin', sg19.foodEdgeMargin, 2);

// ───── breakout ─────
// physics
{
  const r = reflectFromBrick({ vx: 0.3, vy: -0.5 }, 'top');
  eq('breakout reflect top vx', r.vx, 0.3);
  eq('breakout reflect top vy', r.vy, 0.5);
}
{
  const r = paddleReflectionAngle({ vx: 0, vy: 5 }, 0);
  truthy('breakout paddle center vx≈0', Math.abs(r.vx) < 0.01);
  truthy('breakout paddle center vy<0', r.vy < 0);
}
{
  const right = paddleReflectionAngle({ vx: 0, vy: 5 }, 1);
  truthy('breakout paddle right vx>0', right.vx > 0);
}
{
  const ball = { x: 4.5, y: 6 };
  const next = { x: 4.5, y: 5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  truthy('breakout sweep top hit', hit !== null && hit.side === 'bottom');
}
{
  const noHit = sweepAgainstBrick({ x: 1, y: 1 }, { x: 1.2, y: 1.2 }, 4, 5, 0.3);
  eq('breakout sweep no hit', noHit, null);
}

// bricks
{
  let sum = 0;
  for (let i = 0; i < 100; i++) sum += randomBrickValue();
  truthy('breakout bricks return value > 0', sum > 0);
}

// game initial
{
  const g = new BreakoutGame();
  eq('breakout score=0',     g.score, 0);
  eq('breakout combo=1',     g.combo, 1);
  eq('breakout cols',        g.cols, BR_COLS);
  eq('breakout rows',        g.rows, BR_ROWS);
  eq('breakout 1 ball',      g.balls.length, 1);
  truthy('breakout ball glued', g.balls[0].vy === 0);
}

// 球发射
{
  const g = new BreakoutGame();
  g.step(1600);
  truthy('breakout ball launched', g.balls[0].vy !== 0 && g.balls[0].vy < 0);
}

// 砖块命中 + 计分
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.combo = 3;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.board[5][6] = 2;
  g.balls[0] = { x: 6.5, y: 6.2, vx: 0, vy: -5 };
  g.step(50);
  eq('breakout brick cleared', g.board[5][6], 0);
  eq('breakout score = value × combo', g.score, 6);
  eq('breakout combo +1', g.combo, 4);
}

// 掉球归 combo
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.combo = 7;
  g.balls[0] = { x: 6, y: 17.8, vx: 0, vy: 5 };
  g.step(200);
  eq('breakout drop reset combo', g.combo, 1);
  eq('breakout respawned 1 ball', g.balls.length, 1);
}

// 无尽压顶
{
  const g = new BreakoutGame();
  g.endMode = 'endless';
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  for (let c = 0; c < g.cols; c++) g.board[5][c] = 3;
  g.brickDescentTimer = 1;
  let topOut = 0;
  g.onTopOut(() => topOut++);
  g.step(100);
  eq('breakout endless topOut',  topOut, 1);
  // 清前 9 行（含 row 5 标记）+ 下半区上移：原 row 5 标记被清掉
  eq('breakout row 5 marker cleared', g.board[14][3], 0);
  eq('breakout row 17 cleared',  g.board[17][3], 0);
}

// 标准压顶
{
  const g = new BreakoutGame();
  g.endMode = 'standard';
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 1;
  g.brickDescentTimer = 1;
  let mode = null;
  g.onGameOver((m) => { mode = m; });
  g.step(100);
  eq('breakout standard game over', mode, 'standard');
  eq('breakout gameOver flag',      g.gameOver, true);
}

// 序列化
{
  const g = new BreakoutGame();
  g.score = 999;
  g.combo = 4;
  const snap = g.serialize();
  const g2 = new BreakoutGame();
  g2.restore(snap);
  eq('breakout restore score', g2.score, 999);
  eq('breakout restore combo', g2.combo, 4);
}

// ───── result ─────
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
