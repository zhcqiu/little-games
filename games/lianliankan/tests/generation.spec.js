import { Board, DIFFICULTIES } from '../js/board.js';

// 各档对数 + emoji 直方图全偶数 + 初始有解
for (const diff of ['beginner', 'novice', 'advanced', 'master']) {
  const b = new Board(diff);
  const innerCells = b.rows * b.cols;
  assertEq(`${diff} 对数 = innerCells/2`, b.countRemaining(), innerCells);

  const hist = {};
  for (let r = 1; r <= b.rows; r++) {
    for (let c = 1; c <= b.cols; c++) {
      const v = b.get(r, c);
      if (v) hist[v] = (hist[v] || 0) + 1;
    }
  }
  for (const [k, count] of Object.entries(hist)) {
    assertEq(`${diff} emoji ${k} 偶数`, count % 2, 0);
  }
  assertTrue(`${diff} 初始有解`, b.hasAnySolvable() !== null);
}

// 注入 seed 可复现
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
{
  const b1 = new Board('novice', seededRng(1234));
  const b2 = new Board('novice', seededRng(1234));
  assertEq('注入相同 seed 棋盘一致', Array.from(b1.data), Array.from(b2.data));
}
