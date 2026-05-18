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

// 吃食物：长度 +1，分数 +1
const g10 = new Game();
g10.food = { row: 8, col: 8 };
const lenBefore = g10.snake.length;
g10._advance();
assertEq('吃后长 +1', g10.snake.length, lenBefore + 1);
assertEq('分数 +1', g10.score, 1);
assertTrue('新食物不在蛇身', !g10.snake.some((s) => s.row === g10.food.row && s.col === g10.food.col));

// 穿墙模式：右出左入
const g11 = new Game();
g11.setEndMode('wrap');
g11.food = { row: 0, col: 0 };
g11.snake = [{ row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }];
g11.currentDirection = 'right';
g11._advance();
assertEq('穿墙后 dead=false', g11.dead, false);
assertEq('穿墙后头在左边 (8,0)', g11.snake[0], { row: 8, col: 0 });

// 上出下入
const g12 = new Game();
g12.setEndMode('wrap');
g12.food = { row: 4, col: 4 };
g12.snake = [{ row: 0, col: 7 }, { row: 1, col: 7 }, { row: 2, col: 7 }];
g12.currentDirection = 'up';
g12._advance();
assertEq('上穿墙头在 (15,7)', g12.snake[0], { row: 15, col: 7 });

// 穿墙模式撞自己仍死
const g13 = new Game();
g13.setEndMode('wrap');
g13.food = { row: 0, col: 0 };
g13.snake = [{ row: 5, col: 5 }, { row: 4, col: 5 }, { row: 4, col: 6 }, { row: 5, col: 6 }, { row: 6, col: 6 }, { row: 6, col: 5 }];
g13.currentDirection = 'up';
g13._advance();
assertEq('wrap 模式撞自己 dead', g13.dead, true);

// 复活模式撞墙
const g14 = new Game();
g14.setEndMode('revive');
g14.food = { row: 0, col: 0 };
g14.snake = [
  { row: 8, col: 11 }, { row: 8, col: 10 }, { row: 8, col: 9 }, { row: 8, col: 8 },
  { row: 8, col: 7 }, { row: 8, col: 6 }, { row: 8, col: 5 }, { row: 8, col: 4 },
];
g14.score = 10;
g14.currentDirection = 'right';
g14._advance();
assertEq('revive 撞墙 dead=false', g14.dead, false);
assertEq('蛇头不动 (8,11)', g14.snake[0], { row: 8, col: 11 });
assertEq('蛇身砍到 max(2, floor(8/2))=4', g14.snake.length, 4);
assertEq('分数不变', g14.score, 10);
assertTrue('无敌期开启', g14.reviveInvincibleMs > 0);

// 长度小不会砍到 0
const g15 = new Game();
g15.setEndMode('revive');
g15.food = { row: 0, col: 0 };
g15.snake = [{ row: 0, col: 0 }, { row: 0, col: 1 }];   // 长 2
g15.currentDirection = 'up';
g15._advance();
assertEq('len=2 砍后保留 max(2, 1)=2', g15.snake.length, 2);

// 复活后无敌期内再撞不死
const g16 = new Game();
g16.setEndMode('revive');
g16.food = { row: 0, col: 0 };
g16.snake = [{ row: 0, col: 11 }, { row: 0, col: 10 }, { row: 0, col: 9 }, { row: 0, col: 8 }];
g16.currentDirection = 'right';
g16._advance();   // 触发复活
assertTrue('无敌期开启', g16.reviveInvincibleMs > 0);
const lenAfterRevive = g16.snake.length;
g16._advance();   // 无敌期内继续 right，又出墙
assertEq('无敌期内 dead=false', g16.dead, false);
// 无敌期内出墙按 wrap 处理
assertEq('无敌期+撞右墙：头 wrap 到 (0,0)', g16.snake[0], { row: 0, col: 0 });

// 无敌期超时
const g17 = new Game();
g17.setEndMode('revive');
g17.reviveInvincibleMs = 1000;
g17._tickInvincibility(500);
assertEq('500ms 后剩 500', g17.reviveInvincibleMs, 500);
g17._tickInvincibility(600);
assertEq('再 600ms 后归 0', g17.reviveInvincibleMs, 0);

// step 累加 dt 推进 tick
const g18 = new Game();
g18.food = { row: 0, col: 0 };
g18.setSpeed(1);   // tickInterval = 400
const before18 = g18.snake[0].col;
g18.step(200);
assertEq('200ms 不到一 tick，头不动', g18.snake[0].col, before18);
g18.step(300);     // 累计 500ms，跨过 400
assertEq('500ms 推进 1 tick', g18.snake[0].col, before18 + 1);

// paused 不推进
const g19 = new Game();
g19.food = { row: 0, col: 0 };
g19.setSpeed(5);   // 110ms
const col19 = g19.snake[0].col;
g19.setPaused(true);
g19.step(500);
assertEq('paused 不推进', g19.snake[0].col, col19);

// dead 不推进
const g20 = new Game();
g20.dead = true;
const col20 = g20.snake[0].col;
g20.step(500);
assertEq('dead 不推进', g20.snake[0].col, col20);

// 无敌期递减
const g21 = new Game();
g21.reviveInvincibleMs = 1000;
g21.food = { row: 0, col: 0 };
g21.step(500);
assertEq('step 500ms 无敌 -= 500', g21.reviveInvincibleMs, 500);

// 序列化 + 反序列化
const g22 = new Game();
g22.score = 7;
g22.snake = [{ row: 1, col: 1 }, { row: 1, col: 0 }];
g22.currentDirection = 'down';
g22.foodEmoji = '🍓';
g22.food = { row: 5, col: 5 };
const snap = g22.serialize();
const g23 = new Game();
const restored = g23.restore(snap);
assertEq('restore 返回 true', restored, true);
assertEq('恢复 score', g23.score, 7);
assertEq('恢复 snake', g23.snake, [{ row: 1, col: 1 }, { row: 1, col: 0 }]);
assertEq('恢复方向', g23.currentDirection, 'down');
assertEq('恢复食物', g23.food, { row: 5, col: 5 });
assertEq('恢复 emoji', g23.foodEmoji, '🍓');

// 异常 restore
const g24 = new Game();
assertEq('restore 空对象失败', g24.restore({}), false);
assertEq('restore null 失败', g24.restore(null), false);
assertEq('restore 错版本失败', g24.restore({ v: 999 }), false);

// reset
const g25 = new Game();
g25.score = 99;
g25.dead = true;
g25.snake = [{ row: 0, col: 0 }];
g25.reset();
assertEq('reset score=0', g25.score, 0);
assertEq('reset 蛇长 4', g25.snake.length, 4);
assertEq('reset 头 (8,7)', g25.snake[0], { row: 8, col: 7 });
assertEq('reset dead=false', g25.dead, false);

// 蛇头池
const g26 = new Game();
assertTrue('初始 headEmoji 存在', typeof g26.headEmoji === 'string' && g26.headEmoji.length > 0);
const cheeryPool = ['🐲', '🐯', '🦁', '🐹'];
assertTrue('初始 head 来自 cheery 池', cheeryPool.includes(g26.headEmoji));
assertEq('初始 theme cheery', g26.theme, 'cheery');

// setTheme 在初始状态会换头
const g27 = new Game();
g27.setTheme('night');
const NIGHT = ['🦇', '🦉', '👻', '🐺'];
assertTrue('setTheme 后 head 来自 night 池', NIGHT.includes(g27.headEmoji));
assertEq('theme=night', g27.theme, 'night');

// 中途切主题不换头
const g28 = new Game();
const head28 = g28.headEmoji;
g28.snake.unshift({ row: 8, col: 8 });   // 模拟"走了一步"
g28.snake.pop();
g28.setTheme('night');
assertEq('中途切主题不换头', g28.headEmoji, head28);
assertEq('theme 仍更新', g28.theme, 'night');

// reset 在新主题下重新抽
const g29 = new Game();
g29.setTheme('forest');
g29.snake.unshift({ row: 8, col: 8 });
g29.snake.pop();
g29.reset();
const FOREST = ['🐸', '🐻', '🦊', '🐗'];
assertTrue('reset 后 head 来自 forest 池', FOREST.includes(g29.headEmoji));

// 序列化保留头
const g30 = new Game();
g30.setTheme('space');
g30.reset();
const oldHead = g30.headEmoji;
const snapHead = g30.serialize();
const g31 = new Game();
assertEq('restore ok', g31.restore(snapHead), true);
assertEq('restore 恢复 head', g31.headEmoji, oldHead);
assertEq('restore 恢复 theme', g31.theme, 'space');

// 连吃 combo
const g32 = new Game();
g32.food = { row: 8, col: 8 };  // 第 1 食
let comboHits = [];
g32.onCombo((n) => comboHits.push(n));
g32._advance();  // eat 1
assertEq('combo 1', g32.comboCount, 1);
g32.food = { row: 8, col: 9 };
g32._advance();  // eat 2
assertEq('combo 2', g32.comboCount, 2);
g32.food = { row: 8, col: 10 };
g32._advance();  // eat 3 — combo fires
assertEq('combo 3', g32.comboCount, 3);
assertEq('combo bonus +1', g32.score, 3 + 1);  // 3 eats × 1 + 1 bonus
assertEq('combo cb fired with 3', comboHits, [3]);

// 5s 后 combo 重置（使用游戏内时间）
const g33 = new Game();
g33.food = { row: 8, col: 8 };
g33._advance();
assertEq('combo 1', g33.comboCount, 1);
// 模拟 6 秒游戏时间过去
g33.gameTimeMs = g33.comboLastEatMs + 6000;
g33.food = { row: 9, col: 8 };
g33.currentDirection = 'down';
g33._advance();
assertEq('combo 重置为 1（game time > 5s）', g33.comboCount, 1);

// reset 清 combo
const g34 = new Game();
g34.comboCount = 5;
g34.comboLastEatMs = performance.now();
g34.reset();
assertEq('reset combo=0', g34.comboCount, 0);

// 序列化保留 combo
const g35 = new Game();
g35.comboCount = 4;
g35.comboLastEatMs = 12345;
const comboSnap = g35.serialize();
const g36 = new Game();
g36.restore(comboSnap);
assertEq('restore combo', g36.comboCount, 4);
assertEq('restore comboLastEatMs', g36.comboLastEatMs, 12345);

// 解锁层
const g37 = new Game();
g37.setTotalFood(50);
// 50 < 100, 应只在 base 池
const base = ['🐲', '🐯', '🦁', '🐹'];
g37.reset();
assertTrue('50 食物时 head 仍在 base 池', base.includes(g37.headEmoji));

// 100+：base ∪ tier2
const g38 = new Game();
g38.setTotalFood(150);
const cheeryT2 = ['🐲', '🐯', '🦁', '🐹', '🐵'];
// 抽 30 次，至少能验证 head 来自 base+tier2 池
let allFromT2Pool = true;
for (let i = 0; i < 30; i++) {
  g38.reset();
  if (!cheeryT2.includes(g38.headEmoji)) { allFromT2Pool = false; break; }
}
assertTrue('150 食物时 head 来自 base+tier2 池', allFromT2Pool);

// 500+：base ∪ tier2 ∪ tier3
const g39 = new Game();
g39.setTotalFood(600);
const cheeryT3 = ['🐲', '🐯', '🦁', '🐹', '🐵', '🐴'];
let allFromT3Pool = true;
for (let i = 0; i < 30; i++) {
  g39.reset();
  if (!cheeryT3.includes(g39.headEmoji)) { allFromT3Pool = false; break; }
}
assertTrue('600 食物时 head 来自 base+tier2+tier3 池', allFromT3Pool);

// 食物边缘限制
const g40 = new Game();
g40.setFoodEdgeMargin(3);
g40.snake = [{ row: 8, col: 7 }];   // 蛇只占一格，内部区域几乎全空
// 抽 100 次食物，全部应在 row[3..12]、col[3..8] 范围内
let allInner = true;
for (let i = 0; i < 100; i++) {
  const f = g40._spawnFood();
  if (!f || f.row < 3 || f.row >= 13 || f.col < 3 || f.col >= 9) { allInner = false; break; }
}
assertEq('margin=3 食物全在内部', allInner, true);

// margin=0 时食物可以出现在边缘
const g41 = new Game();
g41.setFoodEdgeMargin(0);
g41.snake = [{ row: 8, col: 7 }];
// 抽 200 次，应至少有一次在边缘
let anyEdge = false;
for (let i = 0; i < 200; i++) {
  const f = g41._spawnFood();
  if (f && (f.row === 0 || f.row === 15 || f.col === 0 || f.col === 11)) { anyEdge = true; break; }
}
assertEq('margin=0 食物可以在边缘', anyEdge, true);

// fallback：margin 太大但内部都被占 → 用全板（蛇 192 节是极端，用一个较小但中心被占的场景）
const g42 = new Game();
g42.setFoodEdgeMargin(3);
// 把内部 6×10 区域全填满（row 3-12, col 3-8）
const occ = [];
for (let r = 3; r < 13; r++) {
  for (let c = 3; c < 9; c++) {
    occ.push({ row: r, col: c });
  }
}
g42.snake = occ;
const fallback = g42._spawnFood();
// 因为没有有效内部空格 → 应当回退到全板，落在边缘区
assertTrue('fallback 抽到食物', fallback !== null);
const isEdge = fallback.row < 3 || fallback.row >= 13 || fallback.col < 3 || fallback.col >= 9;
assertEq('fallback 食物在边缘区', isEdge, true);

// setFoodEdgeMargin 边界 clamp
const g43 = new Game();
g43.setFoodEdgeMargin(-1);
assertEq('clamp -1 → 0', g43.foodEdgeMargin, 0);
g43.setFoodEdgeMargin(99);
assertEq('clamp 99 → 3', g43.foodEdgeMargin, 3);

// 序列化保留
const g44 = new Game();
g44.foodEdgeMargin = 2;
const fmSnap = g44.serialize();
const g45 = new Game();
g45.restore(fmSnap);
assertEq('restore foodEdgeMargin', g45.foodEdgeMargin, 2);

// 无敌期穿身体不留重叠
const g46 = new Game();
g46.setEndMode('revive');
g46.food = { row: 0, col: 0 };
g46.snake = [
  { row: 5, col: 5 }, { row: 5, col: 6 }, { row: 6, col: 6 },
  { row: 6, col: 5 }, { row: 7, col: 5 }, { row: 7, col: 6 },
];
g46.reviveInvincibleMs = 1000;
g46.currentDirection = 'down';   // head (5,5) → (6,5)，是身体段
g46._advance();
// 检查蛇身没有重复格
const seen = new Set();
let hasDup = false;
for (const s of g46.snake) {
  const key = `${s.row},${s.col}`;
  if (seen.has(key)) { hasDup = true; break; }
  seen.add(key);
}
assertEq('无敌期穿身体后无重复格', hasDup, false);

// gameTimeMs 增长
const g47 = new Game();
g47.food = { row: 0, col: 0 };
const t0 = g47.gameTimeMs;
g47.step(100);
assertEq('step 100ms gameTimeMs +100', g47.gameTimeMs, t0 + 100);
g47.setPaused(true);
g47.step(100);
assertEq('paused 时 gameTimeMs 不增', g47.gameTimeMs, t0 + 100);

// 全板触发 win
const g48 = new Game();
let wonEvents = 0;
g48.onWin(() => wonEvents++);
// 构造："就差一格"状态：蛇 191 节，最后一个空格就是食物
const allCells = [];
for (let r = 0; r < 16; r++) {
  for (let c = 0; c < 12; c++) {
    allCells.push({ row: r, col: c });
  }
}
// 蛇占满除了 (0, 1) 之外，蛇头在 (0, 0)，朝右去吃 (0, 1) 上的食物
g48.snake = allCells.filter(s => !(s.row === 0 && s.col === 1));
// 把头放第一位
const headIdx = g48.snake.findIndex(s => s.row === 0 && s.col === 0);
const head = g48.snake.splice(headIdx, 1)[0];
g48.snake.unshift(head);
g48.food = { row: 0, col: 1 };
g48.currentDirection = 'right';
g48._advance();
assertEq('全板触发 win', wonEvents, 1);
assertEq('全板后 dead', g48.dead, true);

// reset 清 gameTimeMs
const g49 = new Game();
g49.gameTimeMs = 12345;
g49.reset();
assertEq('reset 清 gameTimeMs', g49.gameTimeMs, 0);

// serialize/restore gameTimeMs
const g50 = new Game();
g50.gameTimeMs = 7777;
const snap50 = g50.serialize();
const g51 = new Game();
g51.restore(snap50);
assertEq('restore gameTimeMs', g51.gameTimeMs, 7777);

// 旧版本快照（无 gameTimeMs）restore 时 combo 应重置
const g52 = new Game();
g52.comboCount = 5;
g52.comboLastEatMs = 99999;
g52.gameTimeMs = 12345;
const oldSnap = {
  v: 1,
  snake: [{ row: 8, col: 7 }, { row: 8, col: 6 }],
  currentDirection: 'right',
  nextDirection: null,
  food: { row: 0, col: 0 },
  foodEmoji: '🍎',
  score: 3,
  reviveInvincibleMs: 0,
  theme: 'cheery',
  headEmoji: '🐲',
  comboCount: 5,
  comboLastEatMs: 99999,
  // 注意：故意不包含 gameTimeMs（模拟旧版本快照）
  foodEdgeMargin: 1,
};
const g53 = new Game();
g53.restore(oldSnap);
assertEq('旧 snap restore：gameTimeMs=0', g53.gameTimeMs, 0);
assertEq('旧 snap restore：comboCount=0', g53.comboCount, 0);
assertEq('旧 snap restore：comboLastEatMs=-10000', g53.comboLastEatMs, -10000);

// 新版本快照（含 gameTimeMs）restore 时 combo 状态保留
const g54 = new Game();
g54.gameTimeMs = 5000;
g54.comboCount = 3;
g54.comboLastEatMs = 4000;
const newSnap = g54.serialize();
const g55 = new Game();
g55.restore(newSnap);
assertEq('新 snap restore：gameTimeMs', g55.gameTimeMs, 5000);
assertEq('新 snap restore：comboCount', g55.comboCount, 3);
assertEq('新 snap restore：comboLastEatMs', g55.comboLastEatMs, 4000);
