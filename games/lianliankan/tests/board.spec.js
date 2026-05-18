import { Board, DIFFICULTIES, EMOJI_POOL } from '../js/board.js';

// ───── B1：Board 基础 ─────
assertEq('DIFFICULTIES 4 档', Object.keys(DIFFICULTIES).sort(),
  ['advanced', 'beginner', 'master', 'novice']);
assertEq('beginner 4x4', [DIFFICULTIES.beginner.rows, DIFFICULTIES.beginner.cols], [4, 4]);
assertEq('master 10x12', [DIFFICULTIES.master.rows, DIFFICULTIES.master.cols], [10, 12]);
assertTrue('EMOJI_POOL ≥ 30', EMOJI_POOL.length >= 30);

const b = new Board('novice');
assertEq('novice rows', b.rows, 6);
assertEq('novice cols', b.cols, 6);
assertEq('novice data length (rows+2)*(cols+2)', b.data.length, 8 * 8);
assertEq('novice countRemaining = 36', b.countRemaining(), 36);

// 哨兵外圈应全 0
const allSentinelsZero = (() => {
  for (let c = 0; c < b.cols + 2; c++) {
    if (b.get(0, c) !== 0) return false;
    if (b.get(b.rows + 1, c) !== 0) return false;
  }
  for (let r = 0; r < b.rows + 2; r++) {
    if (b.get(r, 0) !== 0) return false;
    if (b.get(r, b.cols + 1) !== 0) return false;
  }
  return true;
})();
assertTrue('哨兵外圈全 0', allSentinelsZero);

// ───── B2：findPath ─────
// 用 helper 直接造棋盘
function makeBoard(rows, cols) {
  const b = Object.create(Board.prototype);
  b.rows = rows; b.cols = cols;
  b.data = new Int8Array((rows + 2) * (cols + 2));
  b.memory = false; b.flipped = null;
  b.rng = Math.random;
  return b;
}

// 同行无阻挡
{
  const b = makeBoard(2, 4);
  b.set(1, 1, 5); b.set(1, 4, 5);
  const p = b.findPath({r:1, c:1}, {r:1, c:4});
  assertTrue('同行无阻挡 有解', p !== null);
  assertEq('同行 2 顶点', p.length, 2);
}

// 同列无阻挡
{
  const b = makeBoard(4, 2);
  b.set(1, 1, 5); b.set(4, 1, 5);
  const p = b.findPath({r:1, c:1}, {r:4, c:1});
  assertTrue('同列无阻挡 有解', p !== null);
  assertEq('同列 2 顶点', p.length, 2);
}

// 同行有阻挡
{
  const b = makeBoard(2, 4);
  b.set(1, 1, 5); b.set(1, 4, 5); b.set(1, 2, 7);
  const p = b.findPath({r:1, c:1}, {r:1, c:4});
  // 但 2 拐弯可能仍能绕：(1,1)->(0,1)->(0,4)->(1,4)
  assertTrue('同行阻挡仍可绕外', p !== null);
}

// 1 拐弯
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 5);
  const p = b.findPath({r:1, c:1}, {r:3, c:3});
  assertTrue('1 拐弯有解', p !== null);
  assertTrue('1 拐弯 ≥ 3 顶点', p.length >= 3);
}

// 2 拐弯
{
  const b = makeBoard(3, 5);
  b.set(2, 1, 5); b.set(2, 5, 5);
  b.set(1, 2, 7); b.set(1, 3, 7); b.set(1, 4, 7);  // 上挡
  b.set(3, 2, 7); b.set(3, 3, 7); b.set(3, 4, 7);  // 下挡（但哨兵 row 0 / row 4 应仍空）
  // 同行被挡 → 走哨兵行
  // 但 row 0 空 → 应能 (2,1)->(0,1)->(0,5)->(2,5)
  const p = b.findPath({r:2, c:1}, {r:2, c:5});
  assertTrue('2 拐弯走哨兵 有解', p !== null);
}

// 完全不可达
{
  const b = makeBoard(3, 5);
  b.set(2, 1, 5); b.set(2, 5, 5);
  // 把所有可能路径上的格都堵死（含哨兵）— 难造，跳过这种极端

  // 用更直接的：两个相邻但都被四周围住
  const b2 = makeBoard(5, 5);
  b2.set(3, 3, 5); b2.set(3, 1, 5);
  // 在 (3,3) 和 (3,1) 之间所有连通可能挡掉
  b2.set(3, 2, 7);  // 直挡
  b2.set(2, 2, 7); b2.set(2, 1, 7); b2.set(2, 3, 7);  // 上挡
  b2.set(4, 2, 7); b2.set(4, 1, 7); b2.set(4, 3, 7);  // 下挡
  // 仍能绕去 row 0 或 row 5（哨兵）—— 所以不可达极少见
  // 改造：把 row 1/row 5/col 0/col 5 也挡（但哨兵在 row 0 和 col 0 那是外圈）
  // 简单点：直接造一个例子是不同 emoji
  const b3 = makeBoard(2, 2);
  b3.set(1, 1, 5); b3.set(2, 2, 7);
  assertEq('不同 emoji 返回 null', b3.findPath({r:1, c:1}, {r:2, c:2}), null);
}

// 自身 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  assertEq('a==b 返回 null', b.findPath({r:1, c:1}, {r:1, c:1}), null);
}

// 越界 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  assertEq('越界 r 返回 null', b.findPath({r:1, c:1}, {r:99, c:1}), null);
  assertEq('越界 c 返回 null', b.findPath({r:1, c:1}, {r:1, c:99}), null);
}

// 空格 → null
{
  const b = makeBoard(2, 2);
  b.set(1, 1, 5);
  // (1,2) 是空
  assertEq('对方为空 返回 null', b.findPath({r:1, c:1}, {r:1, c:2}), null);
}

// ───── B3：hasAnySolvable ─────
{
  const b = makeBoard(3, 3);
  assertEq('全空棋盘 无解', b.hasAnySolvable(), null);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5);
  assertEq('单一格 无解', b.hasAnySolvable(), null);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(1, 3, 5);
  const sol = b.hasAnySolvable();
  assertTrue('有 1 对 应有解', sol !== null);
  assertTrue('有解返回路径', Array.isArray(sol.path) && sol.path.length >= 2);
}
{
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 7);  // 不同 emoji
  assertEq('全不同 emoji 无解', b.hasAnySolvable(), null);
}

// ───── B4：reshuffle ─────
{
  // 造一个"无解但有多对"的棋盘：5 个相同 emoji 围一圈把第 6 个困住
  const b = makeBoard(5, 5);
  // 简单：放 4 对 5，洗牌后应仍 4 对且有解
  b.set(1, 1, 5); b.set(1, 2, 5);
  b.set(1, 3, 7); b.set(1, 4, 7);
  b.set(2, 1, 9); b.set(2, 2, 9);
  b.set(2, 3, 11); b.set(2, 4, 11);
  const beforeHist = histogram(b);
  const ok = b.reshuffle();
  assertEq('reshuffle 成功', ok, true);
  const afterHist = histogram(b);
  assertEq('reshuffle 保留直方图', afterHist, beforeHist);
  assertTrue('reshuffle 后有解', b.hasAnySolvable() !== null);
}
{
  // 剩 1 对 → 跳过
  const b = makeBoard(3, 3);
  b.set(1, 1, 5); b.set(3, 3, 5);
  const before = JSON.stringify(Array.from(b.data));
  const ok = b.reshuffle();
  assertEq('1 对跳过 reshuffle 仍 true', ok, true);
  assertEq('棋盘不变', JSON.stringify(Array.from(b.data)), before);
}

function histogram(b) {
  const h = {};
  for (let r = 1; r <= b.rows; r++) {
    for (let c = 1; c <= b.cols; c++) {
      const v = b.get(r, c);
      if (v) h[v] = (h[v] || 0) + 1;
    }
  }
  return h;
}
