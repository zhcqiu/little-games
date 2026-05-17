import { Game, createBag } from '../js/game.js';

// Board 初始化
const g = new Game();
assertEq('棋盘 20 行', g.board.length, 20);
assertEq('每行 10 列', g.board[0].length, 10);
assertEq('棋盘全空', g.board.flat().every((c) => c === null), true);

// 7-bag 包含全 7 种
const bag = createBag();
assertEq('一袋 7 块', bag.length, 7);
const sorted = bag.slice().sort();
assertEq('一袋含 IJLOSTZ', sorted, ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

// Game 第一块就出生
assertTrue('有当前方块', g.current !== null);
assertTrue('有下一块', g.next !== null);
assertTrue('当前方块在棋盘顶上方', g.current.row <= 0);

// 碰撞检测
const g2 = new Game();
g2.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
assertEq('在空棋盘 (5,4) 不冲突', g2._collides(5, 4, 0, 'T'), false);
assertEq('越左边界冲突', g2._collides(5, -1, 0, 'T'), true);
assertEq('越右边界冲突 (T width=3)', g2._collides(5, 8, 0, 'T'), true);
assertEq('越下边界冲突', g2._collides(19, 4, 0, 'T'), true);

g2.board[6][5] = '#aaa';
// T 块 rotation 0 在 (5,4) 时占 (6,4)(6,5)(6,6)(7,5)
assertEq('堵在前方就冲突', g2._collides(5, 4, 0, 'T'), true);

// tryMoveTo
const g3 = new Game();
g3.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
const ok = g3.tryMoveTo(0, 5);
assertEq('成功移动到 (0,5)', ok && g3.current.col, 5);

g3.current = { type: 'O', rotation: 0, row: 0, col: 0, lowWaterMark: 0 };
g3.tryMoveTo(0, 20);
// O 块 shape 在 4×4 中占 col 1,2，所以最大有效 col = 10 - 3 = 7
assertEq('右越界夹到 col=7', g3.current.col, 7);

// tryMoveDown
const g4 = new Game();
g4.current = { type: 'I', rotation: 1, row: 0, col: 4, lowWaterMark: 0 };
const moved = g4.tryMoveDown();
assertEq('I 块下移一格', g4.current.row, 1);
assertEq('tryMoveDown 返回 true', moved, true);
assertEq('lowWaterMark 更新', g4.current.lowWaterMark, 1);

// 旋转无障碍
const g5 = new Game();
g5.current = { type: 'T', rotation: 0, row: 5, col: 4, lowWaterMark: 5 };
const r1 = g5.tryRotate(1);
assertEq('T 顺时针旋转成功', r1 && g5.current.rotation, 1);

// wall-kick：T 块贴左壁旋转，应被推回界内
const g6 = new Game();
g6.current = { type: 'T', rotation: 0, row: 5, col: -1, lowWaterMark: 5 };
const before = g6.current.col;
g6.tryRotate(1);
assertEq('wall-kick 把方块向右推', g6.current.col > before, true);

// 完全卡死
const g7 = new Game();
g7.current = { type: 'I', rotation: 0, row: 5, col: 3, lowWaterMark: 5 };
for (let r = 4; r <= 9; r++) for (let c = 2; c <= 8; c++) {
  if (r >= 0 && r < 20 && c >= 0 && c < 10) {
    if (!(r === 6 && c >= 3 && c <= 6)) g7.board[r][c] = '#aaa';
  }
}
const r2 = g7.tryRotate(1);
assertEq('卡死时 tryRotate 返回 false', r2, false);
assertEq('卡死时旋转态不变', g7.current.rotation, 0);

// lockPiece
const g8 = new Game();
g8.current = { type: 'O', rotation: 0, row: 18, col: 0, lowWaterMark: 18 };
const beforeNext = g8.next;
g8.lockPiece();
assertEq('O 块锁后 (18,1) 有色', g8.board[18][1], '#ffeb3b');
assertEq('O 块锁后 (19,1) 有色', g8.board[19][1], '#ffeb3b');
assertEq('锁后切换到 next', g8.current.type, beforeNext);

// 消行
const g9 = new Game();
for (let c = 0; c < 10; c++) g9.board[19][c] = '#aaa';
for (let c = 1; c < 10; c++) g9.board[18][c] = '#aaa';
const cleared = g9._findFullRows();
assertEq('第 19 行满', cleared, [19]);

g9._clearRows([19]);
assertEq('清行后第 19 行 col 0 = null', g9.board[19][0], null);
assertEq('清行后第 19 行 col 1 = 原 18 行 col 1', g9.board[19][1], '#aaa');
assertEq('score 增加', g9.score, 1);
