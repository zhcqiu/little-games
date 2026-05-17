import { Game, BOARD_WIDTH, BOARD_HEIGHT } from '../js/game.js';

// 板尺寸
assertEq('BOARD_WIDTH = 12', BOARD_WIDTH, 12);
assertEq('BOARD_HEIGHT = 16', BOARD_HEIGHT, 16);

// 初始 Game
const g = new Game();
assertEq('初始蛇长 4', g.snake.length, 4);
assertEq('初始蛇头 (8, 7)', g.snake[0], { row: 8, col: 7 });
assertEq('初始蛇身[1] (8, 6)', g.snake[1], { row: 8, col: 6 });
assertEq('初始蛇身[2] (8, 5)', g.snake[2], { row: 8, col: 5 });
assertEq('初始蛇尾 (8, 4)', g.snake[3], { row: 8, col: 4 });
assertEq('初始方向 right', g.currentDirection, 'right');
assertEq('初始 nextDirection null', g.nextDirection, null);
assertEq('初始分数 0', g.score, 0);
assertEq('初始 dead false', g.dead, false);
assertEq('初始 paused false', g.paused, false);

// 食物在合法位置
assertTrue('食物不在蛇身上', !g.snake.some((s) => s.row === g.food.row && s.col === g.food.col));
assertTrue('食物有效行', g.food.row >= 0 && g.food.row < BOARD_HEIGHT);
assertTrue('食物有效列', g.food.col >= 0 && g.food.col < BOARD_WIDTH);

// queueDirection
const g2 = new Game();
assertEq('初始 right', g2.currentDirection, 'right');
g2.queueDirection('up');
assertEq('up 入队', g2.nextDirection, 'up');
g2.queueDirection('left');
assertEq('left 入队（同 tick 多次取最后）', g2.nextDirection, 'left');

// 180° 反向拒绝
const g3 = new Game();          // currentDirection = right
g3.queueDirection('left');      // 反向
assertEq('反向 left 被拒绝', g3.nextDirection, null);
g3.queueDirection('down');
assertEq('非反向 down 接受', g3.nextDirection, 'down');

// 反向也要考虑已经入队的方向（蛇可能正要转 up，反 up 是 down，要拒绝）
const g4 = new Game();
g4.queueDirection('up');       // current=right, next=up
g4.queueDirection('down');     // down 是 up 的反向 → 拒绝
assertEq('next=up 时反向 down 被拒绝', g4.nextDirection, 'up');

// 推进 1 tick
const g5 = new Game();
const food5 = g5.food;
// 把食物从蛇头前面挪开，避免吃到
if (food5.row === 8 && food5.col === 8) {
  g5.food = { row: 0, col: 0 };
}
const tailBefore = g5.snake[g5.snake.length - 1];
g5._advance();
assertEq('蛇头从 (8,7) → (8,8)', g5.snake[0], { row: 8, col: 8 });
assertEq('蛇身长度不变', g5.snake.length, 4);
assertTrue('尾被弹出', g5.snake[g5.snake.length - 1].col !== tailBefore.col || g5.snake[g5.snake.length - 1].row !== tailBefore.row);

// 应用 nextDirection
const g6 = new Game();
g6.food = { row: 0, col: 0 };  // 避吃
g6.queueDirection('down');
g6._advance();
assertEq('应用 down → 蛇头 (9, 7)', g6.snake[0], { row: 9, col: 7 });
assertEq('current=down', g6.currentDirection, 'down');
assertEq('next 清空', g6.nextDirection, null);

// 标准模式撞墙
const g7 = new Game();
g7.food = { row: 0, col: 0 };
g7.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
g7.currentDirection = 'right';
g7._advance();
assertEq('撞右墙 dead', g7.dead, true);

// 标准模式撞自己
const g8 = new Game();
g8.food = { row: 0, col: 0 };
// 蛇绕一圈：头 (5,5)，依次 (5,6)(6,6)(6,5)，方向 left → 下一步 (5,4)，安全
// 让头朝 (5,5) 想去 (5,5)... 简化：手动构造能自撞的状态
g8.snake = [{ row: 5, col: 5 }, { row: 4, col: 5 }, { row: 4, col: 6 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g8.currentDirection = 'up';
g8._advance();   // 头 (5,5) → (4,5)，命中身体
assertEq('撞自己 dead', g8.dead, true);

// 移动到尾巴位置不算撞（尾巴即将弹出）
const g9 = new Game();
g9.food = { row: 0, col: 0 };
// 蛇 head=(5,5) 朝 down，下一步 (6,5)。把 (6,5) 设为尾。
g9.snake = [{ row: 5, col: 5 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g9.currentDirection = 'down';  // 朝 (6,5)，那是尾
g9._advance();
assertEq('入尾位不死', g9.dead, false);
assertEq('新头在尾位 (6,5)', g9.snake[0], { row: 6, col: 5 });
