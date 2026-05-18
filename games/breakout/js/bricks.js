// bricks.js — 砖块定义（纯数据）
// 4 种颜色对应 1/2/3/5 分，按权重 5/3/2/1 随机生成
// 多血量：1/2 分砖 = 1 击碎；3 分砖 = 2 击；5 分砖 = 3 击。颜色越深越硬越高分。
// CSS variable key 由 render 读 --brick-{value}

export const BRICK_DEFS = [
  { value: 1, weight: 5, cssVar: '--brick-1', hp: 1 },
  { value: 2, weight: 3, cssVar: '--brick-2', hp: 1 },
  { value: 3, weight: 2, cssVar: '--brick-3', hp: 2 },
  { value: 5, weight: 1, cssVar: '--brick-5', hp: 3 },
];

const TOTAL_WEIGHT = BRICK_DEFS.reduce((s, b) => s + b.weight, 0);

/** 按权重抽一种砖（返回 value，0 = 空格） */
export function randomBrickValue(rng = Math.random) {
  let r = rng() * TOTAL_WEIGHT;
  for (const b of BRICK_DEFS) {
    r -= b.weight;
    if (r < 0) return b.value;
  }
  return BRICK_DEFS[BRICK_DEFS.length - 1].value;
}

/** value → CSS variable key（render 用） */
export function brickCssVar(value) {
  const def = BRICK_DEFS.find((b) => b.value === value);
  return def ? def.cssVar : null;
}

/** value → 该色砖的初始 HP（render 用 maxHp-currentHp 算裂纹层数） */
export function brickMaxHp(value) {
  const def = BRICK_DEFS.find((b) => b.value === value);
  return def ? def.hp : 1;
}
