// shared/global-settings.js — 跨游戏共享设置（theme / sfxOn / bgmOn / fxLevel）
//
// 单一 localStorage key：'lg.settings'
// 每个游戏的 Settings 在初始化时通过本模块读写这 4 个字段。
// 游戏特有字段（speed / endMode / 各种独有项）仍存在各自的 '<game>.settings' 里。
//
// 首次使用本模块时（lg.settings 不存在）会从 3 个游戏的旧 settings 里迁移：
// 按 breakout → tetris → snake 顺序扫描，第一个非 undefined 的值胜出。
// 旧 key 的本地字段不主动清理——下次任一游戏 save() 时会自然把 4 个共享字段移除。

const STORAGE_KEY = 'lg.settings';

const GAME_KEYS = ['breakout.settings', 'tetris.settings', 'snake.settings'];

export const GLOBAL_FIELDS = ['theme', 'sfxOn', 'bgmOn', 'fxLevel'];

const DEFAULTS = {
  theme: 'cheery',
  sfxOn: true,
  bgmOn: true,
  fxLevel: 'strong',
};

let _state = null;

function _read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  return null;
}

function _write(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function _migrate() {
  const collected = {};
  for (const k of GAME_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      for (const f of GLOBAL_FIELDS) {
        if (collected[f] === undefined && obj[f] !== undefined) {
          collected[f] = obj[f];
        }
      }
    } catch (e) {}
  }
  return { ...DEFAULTS, ...collected };
}

export const GlobalSettings = {
  /** 懒加载：第一次调用任意 API 时读 localStorage / 跑迁移。 */
  _ensure() {
    if (_state) return;
    const existing = _read();
    if (existing) {
      _state = existing;
    } else {
      _state = _migrate();
      _write(_state);
    }
  },

  get(key) {
    this._ensure();
    return _state[key];
  },

  set(key, value) {
    this._ensure();
    if (_state[key] === value) return;
    _state[key] = value;
    _write(_state);
  },

  /** 一次性返回整份快照（不可变副本）。 */
  snapshot() {
    this._ensure();
    return { ..._state };
  },
};
