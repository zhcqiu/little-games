import { PIECE_TYPES, getCells, getPieceWidth, PIECES } from '../js/pieces.js';

// 7 种方块
assertEq('PIECE_TYPES 7 种', PIECE_TYPES.length, 7);

// 每种都有 4 个旋转态
for (const t of PIECE_TYPES) {
  assertEq(`${t} 有 4 旋转态`, PIECES[t].shapes.length, 4);
  assertTrue(`${t} 有颜色`, typeof PIECES[t].color === 'string');
}

// O 块旋转后形状不变
assertEq('O 块旋转 0 占 4 格', getCells('O', 0).length, 4);
assertEq('O 块旋转 1 占 4 格', getCells('O', 1).length, 4);
assertEq('O 块 4 旋转态一致', getCells('O', 0), getCells('O', 2));

// I 块横/纵宽度
assertEq('I 块横置宽 4', getPieceWidth('I', 0), 4);
assertEq('I 块纵置宽 3', getPieceWidth('I', 1), 3);

// T 块旋转态 0 是「凸」朝下的 T
const t0 = getCells('T', 0);
assertEq('T 块旋转 0 占 4 格', t0.length, 4);
const t0sorted = t0.slice().sort((a, b) => a.row - b.row || a.col - b.col);
assertEq('T 块旋转 0 占位正确', t0sorted, [
  { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }
]);
