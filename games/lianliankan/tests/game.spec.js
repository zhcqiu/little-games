import { Game } from '../js/game.js';
import { DIFFICULTIES } from '../js/board.js';

// ───── C1：状态机（连线模式）─────
{
  const g = new Game('novice', () => 0.5);
  assertEq('初始 score 0', g.score, 0);
  assertEq('初始 combo 0', g.combo, 0);
  assertEq('初始 selection null', g.selection, null);
  assertEq('初始 dead false', g.dead, false);
  assertEq('初始 won false', g.won, false);
}

// 选中一个非空 tile
{
  const g = new Game('novice', () => 0.5);
  // 找一个非空
  let target = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { target = {r, c}; break outer; }
    }
  }
  const ok = g.tap(target.r, target.c);
  assertEq('tap 非空格 selection = 自身', g.selection, target);
  assertEq('tap 非空格返回类型', ok.kind, 'select');
}

// 点同一格 → 取消
{
  const g = new Game('novice', () => 0.5);
  let target = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { target = {r, c}; break outer; }
    }
  }
  g.tap(target.r, target.c);
  const r2 = g.tap(target.r, target.c);
  assertEq('再点同一格 selection null', g.selection, null);
  assertEq('再点同一格返回 deselect', r2.kind, 'deselect');
}

// 点空格 → ignore
{
  const g = new Game('novice', () => 0.5);
  let empty = null;
  outer: for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) === 0) { empty = {r, c}; break outer; }
    }
  }
  // novice 满 36 格无空——跳过
  if (!empty) assertTrue('novice 满格，跳过 empty tap 测试', true);
  else {
    const r = g.tap(empty.r, empty.c);
    assertEq('点空格 ignore', r.kind, 'ignore');
  }
}

// 配对成功（造一个有解棋盘，多放 1 对避免消完直接 win）
{
  const g = new Game('novice', () => 0.5);
  // 改棋盘：清空 → 放 2 对（消第 1 对后剩第 2 对，仍是 match 不是 win）
  g.board.data.fill(0);
  g.board.set(1, 1, 7);
  g.board.set(1, 3, 7);
  g.board.set(4, 4, 9);
  g.board.set(4, 6, 9);
  const r1 = g.tap(1, 1);
  assertEq('first select', r1.kind, 'select');
  const r2 = g.tap(1, 3);
  assertEq('match!', r2.kind, 'match');
  assertTrue('match 返回 path', Array.isArray(r2.path));
  assertEq('match 后 board (1,1) 清空', g.board.get(1, 1), 0);
  assertEq('match 后 board (1,3) 清空', g.board.get(1, 3), 0);
  assertEq('match 后 score +10', g.score, 10);
  assertEq('match 后 combo = 1', g.combo, 1);
  assertEq('match 后 selection null', g.selection, null);
  assertEq('剩余对未消 won=false', g.won, false);
}

// 消完最后一对 → win
{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7);
  g.board.set(1, 3, 7);
  g.tap(1, 1);
  const r = g.tap(1, 3);
  assertEq('清空棋盘 → win', r.kind, 'win');
  assertEq('won=true', g.won, true);
}

// 配对失败（不同 emoji）
{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7);
  g.board.set(1, 3, 9);
  g.tap(1, 1);
  const r = g.tap(1, 3);
  assertEq('不同 emoji mismatch', r.kind, 'mismatch');
  assertEq('mismatch 后 selection = T2', g.selection, {r:1, c:3});
  assertEq('mismatch 后 score 不变', g.score, 0);
  assertEq('mismatch 后 combo 0', g.combo, 0);
}

// ───── C2：combo 时间窗口 ─────
{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);

  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  assertEq('combo=1', g.combo, 1);
  assertEq('score=10', g.score, 10);

  // 2 秒内再消 → combo+1
  g.elapsedMs = 2500;
  g.tap(2, 1); g.tap(2, 3);
  assertEq('combo=2', g.combo, 2);
  // 第 2 对得分 = 10 * (1 + 0.5*1) = 15
  assertEq('score=25', g.score, 25);
}

{
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);

  g.elapsedMs = 1000;
  g.tap(1, 1); g.tap(1, 3);
  // 4 秒后再消 → combo 重置
  g.elapsedMs = 5000;
  g.tap(2, 1); g.tap(2, 3);
  assertEq('combo 重置 1', g.combo, 1);
  assertEq('score=20（无 bonus）', g.score, 20);
}

// ───── C3：Memory 模式 ─────
{
  const g = new Game('beginner', () => 0.5);
  assertEq('beginner memory=true', g.memory, true);
  // 找两个相同 emoji 的格
  const find = (val) => {
    const found = [];
    for (let r = 1; r <= g.board.rows; r++) {
      for (let c = 1; c <= g.board.cols; c++) {
        if (g.board.get(r, c) === val) found.push({r, c});
      }
    }
    return found;
  };
  // 找第一个 emoji 值的两张
  let v = 0;
  for (let r = 1; r <= g.board.rows; r++) {
    for (let c = 1; c <= g.board.cols; c++) {
      if (g.board.get(r, c) !== 0) { v = g.board.get(r, c); break; }
    }
    if (v) break;
  }
  const pair = find(v);
  assertTrue('找到一对', pair.length >= 2);

  // tap 第 1 张 → flip
  const r1 = g.tap(pair[0].r, pair[0].c);
  assertEq('memory tap1 = flip', r1.kind, 'flip');
  assertEq('翻开状态', g.board.isFlipped(pair[0].r, pair[0].c), true);
  assertEq('flippedFirst 指向 T1', g.flippedFirst, pair[0]);

  // tap 第 2 张 (相同) → match
  const r2 = g.tap(pair[1].r, pair[1].c);
  assertEq('memory tap2 = match', r2.kind, 'match');
  assertEq('match 后 board 清', g.board.get(pair[0].r, pair[0].c), 0);
}

// memory 翻不同 → 返回 mismatch（需 caller 延迟回 flip）
{
  const g = new Game('beginner', () => 0.5);
  g.board.data.fill(0);
  if (g.board.flipped) g.board.flipped.fill(0);
  g.board.set(1, 1, 5);
  g.board.set(2, 2, 7);
  g.tap(1, 1);
  const r = g.tap(2, 2);
  assertEq('memory 不同 emoji = mismatch', r.kind, 'mismatch');
  assertEq('两张都翻开', g.board.isFlipped(1, 1) && g.board.isFlipped(2, 2), true);
  // caller 调 resolveMemoryMismatch() 把它们翻回
  g.resolveMemoryMismatch();
  assertEq('翻回 1,1', g.board.isFlipped(1, 1), false);
  assertEq('翻回 2,2', g.board.isFlipped(2, 2), false);
  assertEq('flippedFirst null', g.flippedFirst, null);
}

// ───── C4：serialize / restore / reset ─────
{
  const g = new Game('novice', () => 0.5);
  g.score = 50; g.combo = 3; g.elapsedMs = 12345; g.lastMatchAtMs = 12000;
  g.board.set(1, 1, 0);  // 改一下
  const snap = g.serialize();
  assertEq('snap version', snap.version, 1);
  assertEq('snap difficulty', snap.difficulty, 'novice');
  assertEq('snap rows', snap.rows, 6);
  assertEq('snap cols', snap.cols, 6);
  assertEq('snap score', snap.score, 50);
  assertEq('snap combo', snap.combo, 3);
  assertEq('snap elapsedMs', snap.elapsedMs, 12345);
  assertEq('snap boardData length', snap.boardData.length, 8 * 8);

  const g2 = new Game('novice', () => 0.5);
  const ok = g2.restore(snap);
  assertEq('restore ok', ok, true);
  assertEq('restore score', g2.score, 50);
  assertEq('restore combo', g2.combo, 3);
  assertEq('restore elapsedMs', g2.elapsedMs, 12345);
  assertEq('restore boardData', Array.from(g2.board.data), snap.boardData);
}

// restore 失败：version 不符
{
  const g = new Game('novice', () => 0.5);
  assertEq('restore null', g.restore(null), false);
  assertEq('restore version 99', g.restore({ version: 99 }), false);
}

// restore 失败：尺寸不符
{
  const g = new Game('novice', () => 0.5);
  const snap = g.serialize();
  snap.rows = 4;  // novice 应 6
  assertEq('restore rows 不符', g.restore(snap), false);
}

// restore 失败：boardData 长度不符
{
  const g = new Game('novice', () => 0.5);
  const snap = g.serialize();
  snap.boardData = snap.boardData.slice(0, -1);  // 短一格
  assertEq('restore boardData 长度不符', g.restore(snap), false);
}

// reset 清状态
{
  const g = new Game('novice', () => 0.5);
  g.score = 50; g.combo = 3; g.elapsedMs = 12345; g.selection = { r: 1, c: 1 };
  g.reset();
  assertEq('reset score 0', g.score, 0);
  assertEq('reset combo 0', g.combo, 0);
  assertEq('reset elapsedMs 0', g.elapsedMs, 0);
  assertEq('reset selection null', g.selection, null);
  assertEq('reset countRemaining = pairs*2', g.board.countRemaining(), DIFFICULTIES.novice.pairs * 2);
}

// ───── 配对消完后无解 → 自动 reshuffle 触发 onShuffle ─────
{
  // 造一个棋盘：剩 4 张（2 对），但消完 1 对后剩 1 对无解？
  // 简化：消最后 1 对前手动让 hasAnySolvable 返 null 不容易。
  // 间接测：消完后剩 1 对 → 自动 win 而非 shuffle（这条已有 win 测试覆盖）。
  // 改用：消完后剩 ≥ 2 对但全无解的情况，shuffle 应触发。
  // 构造 5×5 棋盘，放 3 对：1 对在 (1,1)-(1,3) 同 emoji=5（可连消除），
  // 然后剩 2 对 (5,5)=7/(5,1)=7 和 (3,3)=9/(3,1)=9 周围被堵——但 5×5
  // 太小且哨兵让"堵"很难做。改用直接检查 board.reshuffle 在 game 流程外。
  const g = new Game('novice', () => 0.5);
  g.board.data.fill(0);
  // 放 2 对：消第 1 对后剩第 2 对，hasAnySolvable=true → 不 shuffle
  g.board.set(1, 1, 7); g.board.set(1, 3, 7);
  g.board.set(2, 1, 9); g.board.set(2, 3, 9);
  let shuffled = false;
  g.onShuffle(() => { shuffled = true; });
  g.tap(1, 1); g.tap(1, 3);
  assertEq('剩 1 对可消 不 shuffle', shuffled, false);
}

// ───── C5：timed 超时触发 onLose ─────
{
  const g = new Game('master', () => 0.5);
  let loseReason = null;
  g.onLose((reason) => { loseReason = reason; });
  // master 限时 300_000 ms。step 一次 super-long dt 让 elapsed 超时
  g.step(300_001);
  assertEq('master 超时 dead=true', g.dead, true);
  assertEq('onLose 收到 timeout', loseReason, 'timeout');
}

// ───── C6：serialize/restore 保留 timed 偏好 ─────
{
  const g = new Game('advanced', () => 0.5);
  g.timed = true;  // 用户手动开了计时
  const snap = g.serialize();
  assertEq('snap.timed = true', snap.timed, true);
  const g2 = new Game('advanced', () => 0.5);
  g2.timed = false;  // 起始 false
  g2.restore(snap);
  assertEq('restore 恢复 timed=true', g2.timed, true);
}
