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
