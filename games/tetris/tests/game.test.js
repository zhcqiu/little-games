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
