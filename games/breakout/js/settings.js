// settings.js — 设置面板 + localStorage
import { GlobalSettings, GLOBAL_FIELDS } from '../../../shared/global-settings.js';

const KEY = 'breakout.settings';
const KEY_HIGH = 'breakout.highScore';

// 仅游戏特有字段；theme/sfxOn/bgmOn/fxLevel 由 GlobalSettings 管。
const DEFAULTS = {
  speed: 2,
  endMode: 'endless',
  descentRate: 'slow',   // 砖块下移速度：'slow' / 'normal' / 'fast'（默认慢，照顾低龄玩家）
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };
const DESCENT_RATE_MUL = { slow: 0.6, normal: 1.0, fast: 1.5 };

export class Settings {
  constructor(game, audio, effects) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS, ...GlobalSettings.snapshot() };
    this.highScore = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      this.highScore = parseInt(localStorage.getItem(KEY_HIGH) || '0', 10) || 0;
    } catch (e) {}
    // 全局字段总是从 GlobalSettings 取（覆盖掉旧 KEY 里的残留值）
    for (const f of GLOBAL_FIELDS) this.state[f] = GlobalSettings.get(f);
  }

  save() {
    // 只把游戏特有字段写进本地 KEY，全局字段交给 GlobalSettings
    const local = {};
    for (const k of Object.keys(this.state)) {
      if (!GLOBAL_FIELDS.includes(k)) local[k] = this.state[k];
    }
    // 拆两个 try：settings 写失败（配额满）时高分仍能存
    try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (e) {}
    try { localStorage.setItem(KEY_HIGH, String(this.highScore)); } catch (e) {}
  }

  get(key) {
    return key === 'highScore' ? this.highScore : this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') {
      this.highScore = value;
    } else {
      this.state[key] = value;
      if (GLOBAL_FIELDS.includes(key)) GlobalSettings.set(key, value);
      this.apply();
    }
    this.save();
  }

  apply() {
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);
    this.audio.setSpeedLevel(this.state.speed);
    this.audio.setBgmTheme(this.state.theme);
    this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1.0);
    this.game.setSpeedLevel(this.state.speed);
    this.game.setEndMode(this.state.endMode);
    this.game.setDescentRateMul(DESCENT_RATE_MUL[this.state.descentRate] ?? 1.0);
    document.body.dataset.theme = this.state.theme;
    this._syncUi();
  }

  _syncUi() {
    document.querySelectorAll('#end-mode-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.endMode));
    document.querySelectorAll('#descent-rate-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.descentRate));
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.value = String(this.state.speed);
  }

  bindUi() {
    const wireSeg = (segId, key) => {
      document.querySelectorAll(`#${segId} button`).forEach((b) => {
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.set(key, b.dataset.val);
        });
      });
    };
    wireSeg('end-mode-seg', 'endMode');
    wireSeg('descent-rate-seg', 'descentRate');

    const slider = document.getElementById('speed-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.set('speed', parseInt(slider.value, 10));
      });
    }
  }
}
