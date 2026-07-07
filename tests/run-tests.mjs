// 仓库级 Node 测试入口 — CI 用
// 跑各游戏的纯函数测试断言。浏览器侧另有 tests.html 包同样断言。
import { PIECE_TYPES, getCells, getPieceWidth, PIECES } from '../games/tetris/js/pieces.js';
import { Game, createBag } from '../games/tetris/js/game.js';
import { GameLogic as BreakoutGame, COLS as BR_COLS, ROWS as BR_ROWS } from '../games/breakout/js/game.js';
import { reflectFromBrick, paddleReflectionAngle, sweepAgainstBrick } from '../games/breakout/js/physics.js';
import { randomBrickValue } from '../games/breakout/js/bricks.js';
import { Board, DIFFICULTIES, EMOJI_POOL } from '../games/lianliankan/js/board.js';
import { Game as LianGame } from '../games/lianliankan/js/game.js';
import { Game as DriveGame, MIN_LANES, MAX_LANES } from '../games/happy-drive/js/game.js';
import { Renderer as DriveRenderer } from '../games/happy-drive/js/render.js';
import { Effects as DriveEffects } from '../games/happy-drive/js/effects.js';

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

// snake gameTimeMs 增长 / 暂停不增
const sg20 = new SnakeGame();
sg20.food = { row: 0, col: 0 };
const t20 = sg20.gameTimeMs;
sg20.step(100);
eq('snake step 100ms gameTimeMs +100', sg20.gameTimeMs, t20 + 100);
sg20.setPaused(true);
sg20.step(100);
eq('snake paused gameTimeMs 不增', sg20.gameTimeMs, t20 + 100);

// snake reset 清 gameTimeMs
const sg21 = new SnakeGame();
sg21.gameTimeMs = 12345;
sg21.reset();
eq('snake reset gameTimeMs', sg21.gameTimeMs, 0);

// snake serialize/restore gameTimeMs
const sg22 = new SnakeGame();
sg22.gameTimeMs = 7777;
const gtSnap = sg22.serialize();
const sg23 = new SnakeGame();
sg23.restore(gtSnap);
eq('snake restore gameTimeMs', sg23.gameTimeMs, 7777);

// snake combo 5s 使用 gameTimeMs 而非 wall clock
const sg24 = new SnakeGame();
sg24.food = { row: 8, col: 8 };
sg24._advance();
eq('snake combo 1 (gt)', sg24.comboCount, 1);
sg24.gameTimeMs = sg24.comboLastEatMs + 6000;
sg24.food = { row: 9, col: 8 };
sg24.currentDirection = 'down';
sg24._advance();
eq('snake combo reset 1 (gt > 5s)', sg24.comboCount, 1);

// snake 无敌期穿身体不留重叠
const sg25 = new SnakeGame();
sg25.setEndMode('revive');
sg25.food = { row: 0, col: 0 };
sg25.snake = [
  { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 6, col: 6 },
  { row: 6, col: 5 }, { row: 7, col: 5 }, { row: 7, col: 6 },
];
sg25.reviveInvincibleMs = 1000;
sg25.currentDirection = 'down';
sg25._advance();
{
  const seen = new Set();
  let dup = false;
  for (const s of sg25.snake) {
    const key = `${s.row},${s.col}`;
    if (seen.has(key)) { dup = true; break; }
    seen.add(key);
  }
  eq('snake invincible no overlap', dup, false);
}

// snake 全板触发 win
const sg26 = new SnakeGame();
let sgWonEvents = 0;
sg26.onWin(() => sgWonEvents++);
const sgAll = [];
for (let r = 0; r < SH; r++) {
  for (let c = 0; c < SW; c++) sgAll.push({ row: r, col: c });
}
sg26.snake = sgAll.filter(s => !(s.row === 0 && s.col === 1));
const sgHeadIdx = sg26.snake.findIndex(s => s.row === 0 && s.col === 0);
const sgHead = sg26.snake.splice(sgHeadIdx, 1)[0];
sg26.snake.unshift(sgHead);
sg26.food = { row: 0, col: 1 };
sg26.currentDirection = 'right';
sg26._advance();
eq('snake full-board win fired', sgWonEvents, 1);
eq('snake full-board win dead', sg26.dead, true);

// snake restore 旧版本 snap（无 gameTimeMs）→ combo 重置
const sg27 = new SnakeGame();
const sg27OldSnap = {
  v: 1,
  snake: [{ row: 8, col: 7 }, { row: 8, col: 6 }],
  currentDirection: 'right',
  nextDirection: null,
  food: { row: 0, col: 0 },
  foodEmoji: '🍎',
  score: 3,
  reviveInvincibleMs: 0,
  comboCount: 5,
  comboLastEatMs: 99999,
};
sg27.restore(sg27OldSnap);
eq('snake old-snap combo reset', sg27.comboCount, 0);
eq('snake old-snap comboLastEatMs reset', sg27.comboLastEatMs, -10000);
eq('snake old-snap gameTimeMs zero', sg27.gameTimeMs, 0);

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
  // 球从砖下方（y=6.5，外于扩展 AABB 6.3）干净接近砖底沿
  const ball = { x: 4.5, y: 6.5 };
  const next = { x: 4.5, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  truthy('breakout sweep top hit', hit !== null && hit.side === 'bottom');
}
{
  const noHit = sweepAgainstBrick({ x: 1, y: 1 }, { x: 1.2, y: 1.2 }, 4, 5, 0.3);
  eq('breakout sweep no hit', noHit, null);
}
// 幽灵命中守卫（regression: Codex C-1）：球已在扩展 AABB 内不算新命中
{
  const ball = { x: 4.3, y: 5.5 };
  const next = { x: 4.6, y: 5.5 };
  const hit = sweepAgainstBrick(ball, next, 4, 5, 0.3);
  eq('breakout phantom adjacent rejected', hit, null);
}
// reflectFromBrick 四方向（之前只测了 top；补 left/right/bottom）
{
  eq('reflectFromBrick bottom flips vy', reflectFromBrick({vx:1,vy:2},'bottom').vy, -2);
  eq('reflectFromBrick left flips vx',   reflectFromBrick({vx:3,vy:1},'left').vx,  -3);
  eq('reflectFromBrick right flips vx',  reflectFromBrick({vx:-3,vy:1},'right').vx, 3);
}
// paddleReflectionAngle 最左端（之前只测了 0 和 +1）
{
  const left = paddleReflectionAngle({vx:0,vy:5}, -1);
  truthy('paddle left end vx<0', left.vx < 0);
  truthy('paddle left end vy<0', left.vy < 0);
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
  g.balls[0] = { x: 6.5, y: 6.4, vx: 0, vy: -5 };
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

// 慢球应同时减缓砖块下移（regression: 用户反馈低球速被压顶）
{
  // 不接慢球：5000ms 内扣 5000ms
  const g1 = new BreakoutGame();
  g1.ballRespawnTimer = 0;
  g1.brickDescentTimer = 7000;
  g1.step(5000);
  truthy('normal descent: ~2000 left after 5s', Math.abs(g1.brickDescentTimer - 2000) < 50);
  // 接慢球：5000ms 内只扣 3500ms（× 0.7）
  const g2 = new BreakoutGame();
  g2.ballRespawnTimer = 0;
  g2.brickDescentTimer = 7000;
  g2._applyPowerup('slow');
  g2.step(5000);
  truthy('slow descent: ~3500 left after 5s', Math.abs(g2.brickDescentTimer - 3500) < 50);
}

// 红/黄砖初始保底（regression: 用户反馈"低比重导致部分场景没有红黄"）
{
  let withRed = 0, withYellow = 0;
  for (let i = 0; i < 50; i++) {
    const g = new BreakoutGame();
    let r = 0, y = 0;
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c < 12; c++) {
        if (g.board[row][c] === 5) r++;
        if (g.board[row][c] === 3) y++;
      }
    }
    if (r >= 1) withRed++;
    if (y >= 2) withYellow++;
  }
  eq('initial: all 50 sessions have ≥1 red', withRed, 50);
  eq('initial: all 50 sessions have ≥2 yellow', withYellow, 50);
}

// 稀疏行：初始 4 行各 7-9 砖（不再满 12）
{
  const g = new BreakoutGame();
  for (let r = 0; r < 4; r++) {
    const count = g.board[r].filter((v) => v > 0).length;
    truthy(`row ${r} sparse (7-9 bricks)`, count >= 7 && count <= 9);
  }
  // row 4+ 应空
  for (let r = 4; r < g.rows; r++) {
    truthy(`row ${r} empty`, g.board[r].every((v) => v === 0));
  }
}

// Combo 衰减：4s 不击中砖 → combo→1
{
  const g = new BreakoutGame();
  g.combo = 5;
  g.comboDecayTimer = 4000;
  g.ballRespawnTimer = 0;
  g.step(2000);
  eq('combo not decayed yet at 2s', g.combo, 5);
  g.step(2100);
  eq('combo decayed at 4s', g.combo, 1);
}

// 球速升级：每 300 分 +5%，上限 1.4×（每次手动设置 brickHp=1 以单击 kill）
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;
  g.combo = 10;
  g.board[5][6] = 5; g.brickHp[5][6] = 1;
  g._onBrickHit(6, 5);
  eq('score 50 → bonus 1.0', g.sessionSpeedBonus, 1.0);
  g.score = 300;
  g.board[5][6] = 1; g.brickHp[5][6] = 1;
  g._onBrickHit(6, 5);
  truthy('score 310 → bonus 1.05', Math.abs(g.sessionSpeedBonus - 1.05) < 0.001);
  g.score = 8000;
  g.board[5][6] = 1; g.brickHp[5][6] = 1;
  g._onBrickHit(6, 5);
  eq('score 8000+ → bonus capped at 1.4', g.sessionSpeedBonus, 1.4);
}

// 多血砖：黄 (value=3) 需 2 击 / 红 (value=5) 需 3 击
{
  const g = new BreakoutGame();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;

  // 黄砖：3 分，2 HP
  g.board[5][6] = 3; g.brickHp[5][6] = 2;
  g._onBrickHit(6, 5);
  eq('yellow brick first hit: still alive', g.board[5][6], 3);
  eq('yellow brick HP→1', g.brickHp[5][6], 1);
  eq('yellow brick: no score yet', g.score, 0);
  g._onBrickHit(6, 5);
  eq('yellow brick second hit: cleared', g.board[5][6], 0);
  eq('yellow brick: score +3', g.score, 3);

  // 红砖：5 分，3 HP
  g.score = 0; g.combo = 1;
  g.board[5][6] = 5; g.brickHp[5][6] = 3;
  g._onBrickHit(6, 5);
  g._onBrickHit(6, 5);
  eq('red brick 2 hits: still alive', g.board[5][6], 5);
  eq('red brick HP→1', g.brickHp[5][6], 1);
  g._onBrickHit(6, 5);
  eq('red brick 3 hits: cleared', g.board[5][6], 0);
  eq('red brick: score +5', g.score, 5);

  // 已清空格不应再触发计分（双击防护）
  g.score = 100;
  g._onBrickHit(6, 5);
  eq('cleared cell: no score change', g.score, 100);
}

// 自适应道具：连续 22 砖击碎未掉道具时强制掉（每次都重置 board / brickHp）
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  // 强制 rng 让正常路径永不触发 (>= 0.08)
  g._rng = () => 0.5;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) g.board[r][c] = 0;

  for (let i = 0; i < 21; i++) {
    g.board[0][0] = 1; g.brickHp[0][0] = 1;
    g._onBrickHit(0, 0);
  }
  truthy('21 bricks: no powerup yet', g.fallingItem === null);
  truthy('counter at 21', g.bricksSinceLastPowerup === 21);
  // 22 次击碎：强制掉
  g.board[0][0] = 1; g.brickHp[0][0] = 1;
  g._onBrickHit(0, 0);
  truthy('22 bricks: powerup forced', g.fallingItem !== null);
  truthy('counter reset to 0', g.bricksSinceLastPowerup === 0);
}

// descentRateMul：settings 可手调的"下移速度"独立倍率
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.setDescentRateMul(0.5);
  g.brickDescentTimer = 10000;
  g.step(4000);
  // 4000 × 0.5 = 2000 扣除 → timer = 8000
  truthy('descentRateMul 0.5: timer ~= 8000 after 4s',
    Math.abs(g.brickDescentTimer - 8000) < 50);
  // 同时叠加慢球：mul 实际 = 0.5 × 0.7 = 0.35
  g._applyPowerup('slow');
  const before = g.brickDescentTimer;
  g.step(2000);
  // 2000 × 0.35 = 700 扣除
  truthy('descentRateMul 0.5 + slow: timer drop ~700',
    Math.abs(before - g.brickDescentTimer - 700) < 50);
  // setDescentRateMul 拒绝非法值
  g.setDescentRateMul(-1);
  truthy('setDescentRateMul rejects negative', g.descentRateMul === 0.5);
  g.setDescentRateMul('abc');
  truthy('setDescentRateMul rejects NaN', g.descentRateMul === 0.5);
}

// 道具效果（coverage gap）：multi / wider 应用后状态正确
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 3, vy: -5 };
  g._applyPowerup('multi');
  eq('multi: balls doubled', g.balls.length, 2);
  truthy('multi: clone vx opposite', g.balls[1].vx === -g.balls[0].vx);
}
{
  const g = new BreakoutGame();
  g._applyPowerup('wider');
  eq('wider: widthMul = 1.6', g.paddle.widthMul, 1.6);
  truthy('wider: timer > 0', g.paddle.widthRemainMs > 0);
}

// 慢球状态下的 serialize/restore 往返（coverage gap）
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 0, vy: -10 };
  g._applyPowerup('slow');
  const snap = g.serialize();
  const g2 = new BreakoutGame();
  g2.restore(snap);
  truthy('slow restore: _slowWasActive flag set', g2._slowWasActive === true);
  eq('slow restore: slowRemainMs preserved', g2.slowRemainMs, g.slowRemainMs);
  truthy('slow restore: ball speed preserved',
    Math.abs(Math.hypot(g2.balls[0].vx, g2.balls[0].vy) - 7) < 0.01);
}

// restore() 维度校验（regression: Codex I-2）：
{
  const g = new BreakoutGame();
  // 缺 v
  truthy('restore null returns false',      g.restore(null) === false);
  truthy('restore wrong version returns false', g.restore({ v: 99 }) === false);
  // board 行数错（10 行而非 18）
  const badBoard = {
    v: 1,
    score: 0, combo: 1, endMode: 'endless', speedLevel: 2,
    board: Array.from({ length: 10 }, () => Array(12).fill(0)),
    paddle: { col: 6, widthMul: 1, widthRemainMs: 0 },
    balls: [{ x: 6, y: 10, vx: 0, vy: 0 }],
    fallingItem: null, brickDescentTimer: 1000, ballRespawnTimer: 0,
    slowRemainMs: 0, gameOver: false,
  };
  truthy('restore wrong row count returns false', g.restore(badBoard) === false);
  // board 列数错
  const badCols = { ...badBoard, board: Array.from({ length: 18 }, () => Array(8).fill(0)) };
  truthy('restore wrong col count returns false', g.restore(badCols) === false);
  // balls 空
  const noBalls = { ...badBoard, board: Array.from({ length: 18 }, () => Array(12).fill(0)), balls: [] };
  truthy('restore empty balls returns false', g.restore(noBalls) === false);
}

// reset() 应清掉 paused（regression: Codex C-2）：
// game-over 期间打开 help/settings 再关闭会留下 paused=true，replay 后必须解锁
{
  const g = new BreakoutGame();
  g.setPaused(true);
  g.gameOver = true;
  g.reset();
  eq('reset clears paused', g.paused, false);
  eq('reset clears gameOver', g.gameOver, false);
  eq('reset clears score', g.score, 0);
  eq('reset clears combo', g.combo, 1);
}

// 慢球叠加不应永久降速（regression: 见 code-review #1）
{
  const g = new BreakoutGame();
  g.ballRespawnTimer = 0;
  g.balls[0] = { x: 6, y: 8, vx: 0, vy: -10 };
  const sp0 = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  // 第一次接 🐌
  g._applyPowerup('slow');
  const sp1 = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  truthy('slow #1: ball ~0.7×', Math.abs(sp1 / sp0 - 0.7) < 0.01);
  // 在仍激活时再接 🐌（应仅延长计时，不再二次降速）
  g._applyPowerup('slow');
  const sp2 = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  truthy('slow #2 stack: ball still ~0.7×', Math.abs(sp2 / sp0 - 0.7) < 0.01);
  // 让计时器走完
  while (g.slowRemainMs > 0) g.step(500);
  const sp3 = Math.hypot(g.balls[0].vx, g.balls[0].vy);
  truthy('slow expire: ball back to 1×', Math.abs(sp3 / sp0 - 1.0) < 0.01);
}

// ───── lianliankan ─────
eq('lian DIFFICULTIES 4 档', Object.keys(DIFFICULTIES).sort(), ['advanced','beginner','master','novice']);
truthy('lian EMOJI_POOL ≥ 30', EMOJI_POOL.length >= 30);

// Board 生成
{
  const b = new Board('novice');
  eq('lian novice cells = pairs*2', b.countRemaining(), DIFFICULTIES.novice.pairs * 2);
  // 直方图全偶数
  const hist = {};
  for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) {
    const v = b.get(r, c); if (v) hist[v] = (hist[v] || 0) + 1;
  }
  let allEven = true;
  for (const k of Object.keys(hist)) if (hist[k] % 2 !== 0) { allEven = false; break; }
  truthy('lian novice 直方图全偶', allEven);
  truthy('lian novice 初始有解', b.hasAnySolvable() !== null);
}

// findPath 同行
{
  const b = Object.create(Board.prototype);
  b.rows = 2; b.cols = 4;
  b.data = new Int8Array(4 * 6);
  b.memory = false; b.flipped = null;
  b.set(1, 1, 5); b.set(1, 4, 5);
  const p = b.findPath({r:1,c:1}, {r:1,c:4});
  truthy('lian findPath 同行', p !== null);
}

// Game 状态机
{
  const g = new LianGame('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  // 加一对干扰牌避免消除后立即触发 win
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);
  g.tap(1, 1);
  const r = g.tap(1, 3);
  eq('lian match', r.kind, 'match');
  eq('lian score 10', g.score, 10);
  eq('lian combo 1', g.combo, 1);
}

// combo 时间窗口
{
  const g = new LianGame('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);
  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  g.elapsedMs = 2500;
  g.tap(2, 1); g.tap(2, 3);
  eq('lian combo 2', g.combo, 2);
  eq('lian score 25', g.score, 25);
}

// serialize / restore
{
  const g = new LianGame('novice', () => 0.5);
  g.score = 50;
  const snap = g.serialize();
  eq('lian snap version', snap.version, 1);
  const g2 = new LianGame('novice', () => 0.5);
  eq('lian restore ok', g2.restore(snap), true);
  eq('lian restore score', g2.score, 50);
  eq('lian restore reject null', g2.restore(null), false);
  eq('lian restore reject wrong version', g2.restore({version:99}), false);
}

// Memory 模式
{
  const g = new LianGame('beginner', () => 0.5);
  truthy('lian beginner memory', g.memory === true);
  truthy('lian beginner has flipped', g.board.flipped !== null);
}

// ───── happy drive ─────
{
  const g = new DriveGame();
  eq('drive min lanes', MIN_LANES, 3);
  eq('drive max lanes', MAX_LANES, 8);
  eq('drive initial lanes', g.laneCount, 3);
  eq('drive initial score', g.score, 0);
  eq('drive initial damage', g.damage, 0);
  eq('drive initial lane', g.playerLane, 1);
  truthy('drive default speed reduced 20%', Math.abs(g.playerSpeed - 0.552) < 0.001);
  truthy('drive fruit spawn rate reduced from pile-up tuning', Math.abs(g._difficulty().fruit - 1.75) < 0.001);
}
{
  const g = new DriveGame();
  g.gameTimeMs = 120000;
  truthy('drive speed difficulty rises more gently', g._difficulty().speed < 0.8);
  g.step(16);
  truthy('drive lane growth is gradual', g.laneCount <= 4);
  const nextVehicleMs = g._nextVehicleSpawnMs();
  truthy('drive vehicle cadence stays bounded late', nextVehicleMs >= 720 && nextVehicleMs <= 1560);
  g.gameTimeMs = 350000;
  g.step(16);
  eq('drive lane cap reaches eight', g.laneCount, 8);
}
{
  const g = new DriveGame();
  g.moveLeft();
  eq('drive half-left target', g.targetOffset, 0.5);
  g.step(200);
  truthy('drive half-left offset between lanes', g.playerOffset > 0 && g.playerOffset < 1);
  g.moveLeft();
  eq('drive full-left target', g.targetOffset, 0);
  eq('drive left edge clamp', g.moveLeft(), false);
  g.moveRight();
  eq('drive half-right target', g.targetOffset, 0.5);
  g.moveRight();
  g.moveRight();
  g.moveRight();
  eq('drive full-right target', g.targetOffset, 2);
  eq('drive right edge clamp', g.moveRight(), false);
}
{
  const g = new DriveGame();
  g.fruits = [{ lane: g.playerLane, z: 0.12, emoji: '🍓', bob: 0 }];
  g.step(16);
  eq('drive fruit outside shared hit depth not collected', g.fruitCount, 0);
}
{
  const g = new DriveGame();
  g.fruits = [{ lane: g.playerLane, z: 0.04, emoji: '🍓', bob: 0 }];
  g.step(16);
  eq('drive fruit collected with shared hitbox', g.fruitCount, 1);
  eq('drive fruit score +5', g.score, 5);
}
{
  const g = new DriveGame();
  let extraLifeEvents = 0;
  g.on('extraLife', () => extraLifeEvents++);
  for (let i = 0; i < 8; i++) {
    g.fruits = [{ lane: g.playerLane, z: 0.04, emoji: '🍓', bob: 0 }];
    g.step(16);
  }
  eq('drive fruit grants extra hit at 8', g.maxHits, 4);
  eq('drive fruit extra life event once', extraLifeEvents, 1);
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: g.playerLane, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  g.step(16);
  eq('drive crash damage +1', g.damage, 1);
  eq('drive crash not over yet', g.gameOver, false);
}
{
  const g = new DriveGame();
  g.setMaxHits(2);
  g.vehicles = [
    { lane: g.playerLane, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
    { lane: g.playerLane, z: 0.05, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
  ];
  g.step(16);
  g.vehicles[1].hit = false;
  g.step(16);
  eq('drive max hits game over', g.gameOver, true);
}
{
  const g = new DriveGame();
  g.setChallenge('lively');
  g.setGuidesOn(false);
  g.setSpeed(5);
  g.score = 12;
  g.fruits = [{ lane: 0, z: 0.5, emoji: '🍌', bob: 1 }];
  const snap = g.serialize();
  const g2 = new DriveGame();
  eq('drive restore ok', g2.restore(snap), true);
  eq('drive restore score', g2.score, 12);
  eq('drive restore challenge', g2.challenge, 'lively');
  eq('drive restore guides', g2.guidesOn, false);
  eq('drive restore invalid', g2.restore({}), false);
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: 0, z: 0.72, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  eq('drive fruit can spawn away from oncoming traffic', g._spawnFruit(), true);
  eq('drive fruit appears in safe lane', g.fruits.length, 1);
  truthy('drive fruit avoids blocked traffic lane', Math.abs(g.fruits[0].lane - 0) >= 0.52);
}
{
  const g = new DriveGame();
  g.vehicles = [
    { lane: 0, targetLane: 0, z: 0.72, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
    { lane: 1, targetLane: 1, z: 0.72, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
    { lane: 2, targetLane: 2, z: 0.72, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
  ];
  eq('drive fruit blocked returns false', g._spawnFruit(), false);
  g.fruitSpawnMs = 0;
  g._spawn(16);
  truthy('drive fruit retries soon when blocked', g.fruitSpawnMs <= 520);
}
{
  const g = new DriveGame();
  const next = g._nextFruitSpawnMs();
  truthy('drive fruit cadence is calmer', next >= 1350 && next <= 2250);
}
{
  const g = new DriveGame();
  g.fruits = [
    { lane: 0, z: 0.6, emoji: '🍓', bob: 0 },
    { lane: 2, z: 0.2, emoji: '🍌', bob: 0 },
  ];
  eq('drive fruit cap prevents piles', g._spawnFruit(), false);
}
{
  const g = new DriveGame();
  g.playerOffset = 0.5;
  g.targetOffset = 0.5;
  g.vehicles = [
    { lane: 0, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
    { lane: 1, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
  ];
  g.step(16);
  eq('drive gap between two cars avoids collision', g.damage, 0);
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: g.playerLane, z: 0.12, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  g.step(16);
  eq('drive near visual gap avoids collision', g.damage, 0);
}
{
  const g = new DriveGame();
  g.playerOffset = 0.31;
  g.targetOffset = 0.31;
  g.fruits = [{ lane: 0, z: 0.04, emoji: '🍌', bob: 0 }];
  g.vehicles = [{ lane: 0, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  g.step(16);
  eq('drive fruit uses same lateral hitbox as car', g.fruitCount, 0);
  eq('drive car uses same lateral hitbox as fruit', g.damage, 0);
}
{
  const g = new DriveGame();
  g.playerOffset = 0.5;
  g.targetOffset = 0.5;
  g.vehicles = [{ lane: 0.5, targetLane: 0.5, z: 0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  g.step(16);
  eq('drive half-lane vehicle can hit middle player', g.damage, 1);
}
{
  const oldRandom = Math.random;
  Math.random = () => 0;
  try {
    const g = new DriveGame();
    g.vehicles = [{ lane: 1, targetLane: 1, laneChangeMs: 0, z: 0.5, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
    g._moveObjects(0.2);
    eq('drive oncoming vehicle can target half lane', g.vehicles[0].targetLane, 0.5);
    truthy('drive oncoming vehicle starts lane change', g.vehicles[0].lane < 1 && g.vehicles[0].lane > 0.5);
  } finally {
    Math.random = oldRandom;
  }
}
{
  const oldRandom = Math.random;
  const seq = [0, 0, 0, 0, 0, 0];
  Math.random = () => seq.shift() ?? 0;
  try {
    const g = new DriveGame();
    eq('drive oncoming traffic spawn succeeds', g._spawnVehicle(), true);
    eq('drive oncoming traffic can spawn in half lane', g.vehicles[0].lane, 0.5);
    eq('drive half-lane spawn target matches lane', g.vehicles[0].targetLane, 0.5);
  } finally {
    Math.random = oldRandom;
  }
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: 0, targetLane: 0, z: 0.92, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  eq('drive adjacent half lane blocked near spawn', g._trafficSlotOpen(0.5, 0.66, 1.08), false);
}
{
  const oldRandom = Math.random;
  Math.random = () => 0;
  try {
    const g = new DriveGame();
    g.vehicles = [
      { lane: 1, targetLane: 1, laneChangeMs: 0, z: 0.5, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
      { lane: 0.5, targetLane: 0.5, laneChangeMs: 999, z: 0.5, speed: 0.2, direction: 'toward', model: { color: '#111', roof: '#fff' }, hit: false },
    ];
    g._moveObjects(0.2);
    eq('drive lane change avoids occupied adjacent lane', g.vehicles[0].targetLane, 1.5);
  } finally {
    Math.random = oldRandom;
  }
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: g.playerLane, z: -0.04, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  g.step(16);
  eq('drive passed vehicle clears bottom', g.vehicles.length, 0);
}
{
  const g = new DriveGame();
  g.vehicles = [{ lane: g.playerLane, z: 0.08, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false }];
  const before = g.vehicles[0].z;
  g._moveObjects(0.1);
  const delta = before - g.vehicles[0].z;
  truthy('drive rear vehicle does not accelerate away', delta < 0.04);
}
{
  const g = new DriveGame();
  g.vehicles = [
    { lane: 0, z: 0.5, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
    { lane: 1, z: 0.5, speed: 0.2, direction: 'toward', model: { color: '#000', roof: '#fff' }, hit: false },
  ];
  eq('drive pressure zone leaves one lane open', g._spawnVehicle(), false);
  eq('drive pressure zone leaves one lane open count', g.vehicles.length, 2);
}
{
  const e = new DriveEffects();
  e.crash(100, 120, 2);
  truthy('drive crash flash is strong', e.flashMs >= 400 && e.impactMs >= 800);
  truthy('drive crash shake is strong', e.shakeAmp >= 20 && e.shakeMs >= 500);
}
{
  const r = Object.create(DriveRenderer.prototype);
  r.w = 600; r.h = 800; r.dpr = 1;
  const player = r.playerPoint({ playerOffset: 1, laneCount: 3 });
  truthy('drive player stays in lower screen', player.y > r.h * 0.72);
  truthy('drive left lane shows left side', r._sideLean(r.w * 0.25, { width: r.w }) > 0);
  truthy('drive right lane shows right side', r._sideLean(r.w * 0.75, { width: r.w }) < 0);
  truthy('drive side perspective is stronger', Math.abs(r._sideLean(r.w * 0.25, { width: r.w })) > 0.45);
  const farDelta = r._roadAt(0.8).y - r._roadAt(0.9).y;
  const nearDelta = r._roadAt(0.1).y - r._roadAt(0.2).y;
  truthy('drive perspective near screen speed > far', nearDelta > farDelta * 6);
  const eightLaneX = r.projectLane(7, 8, 0.02);
  truthy('drive renderer supports eight lanes', eightLaneX < r._roadAt(0.02).right);
  const farMarker = r._roadAt(0.85);
  const nearMarker = r._roadAt(0.12);
  truthy('drive lane markers respect perspective', nearMarker.k > farMarker.k * 8);
  const markerPhaseA = r._laneMarkerPhase({ distance: 10 }, 0.2);
  const markerPhaseB = r._laneMarkerPhase({ distance: 12 }, 0.2);
  truthy('drive lane markers sync gently to world distance', markerPhaseB < markerPhaseA);
  truthy('drive lane markers include player rear', r._laneMarkerStartZ({ distance: 10 }, 0.2) <= 0.02);
  const leftSpeedLine = r._speedLineSegment({ playerOffset: 1, laneCount: 3 }, -1, 0, 0.4, 0.55);
  const rightSpeedLine = r._speedLineSegment({ playerOffset: 1, laneCount: 3 }, 1, 0, 0.4, 0.55);
  const playerPointForLines = r.playerPoint({ playerOffset: 1, laneCount: 3 });
  truthy('drive left speed line starts behind car', Math.abs(leftSpeedLine.start.x - playerPointForLines.x) < 45 && leftSpeedLine.start.y > playerPointForLines.y);
  truthy('drive right speed line starts behind car', Math.abs(rightSpeedLine.start.x - playerPointForLines.x) < 45 && rightSpeedLine.start.y > playerPointForLines.y);
  truthy('drive left speed line follows road perspective', leftSpeedLine.end.x < leftSpeedLine.start.x && leftSpeedLine.end.y > leftSpeedLine.start.y);
  truthy('drive right speed line follows road perspective', rightSpeedLine.end.x > rightSpeedLine.start.x && rightSpeedLine.end.y > rightSpeedLine.start.y);
}
// ───── result ─────
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
