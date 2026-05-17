// 仓库级 Node 测试入口 — CI 用
// 跑各游戏的纯函数测试断言。浏览器侧另有 tests.html 包同样断言。
import { PIECE_TYPES, getCells, getPieceWidth, PIECES } from '../games/tetris/js/pieces.js';
import { Game, createBag } from '../games/tetris/js/game.js';

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

// ───── result ─────
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
