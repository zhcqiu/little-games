// settings.js — 设置面板 + localStorage
const KEY = 'breakout.settings';
const KEY_HIGH = 'breakout.highScore';

const DEFAULTS = {
  theme: 'cheery',
  speed: 2,
  endMode: 'endless',
  sfxOn: true,
  bgmOn: true,
  fxLevel: 'strong',
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };

export class Settings {
  constructor(game, audio, effects) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS };
    this.highScore = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      this.highScore = parseInt(localStorage.getItem(KEY_HIGH) || '0', 10) || 0;
    } catch (e) {}
  }

  save() {
    // 拆两个 try：settings 写失败（配额满）时高分仍能存
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {}
    try { localStorage.setItem(KEY_HIGH, String(this.highScore)); } catch (e) {}
  }

  get(key) {
    return key === 'highScore' ? this.highScore : this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') this.highScore = value;
    else { this.state[key] = value; this.apply(); }
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
    document.body.dataset.theme = this.state.theme;
    this._syncUi();
  }

  _syncUi() {
    document.querySelectorAll('#theme-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.theme));
    document.querySelectorAll('#end-mode-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.endMode));
    document.querySelectorAll('#fx-seg button').forEach((b) =>
      b.classList.toggle('active', b.dataset.val === this.state.fxLevel));
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.value = String(this.state.speed);
    const sfx = document.getElementById('sfx-toggle');
    if (sfx) { sfx.classList.toggle('active', this.state.sfxOn); sfx.textContent = this.state.sfxOn ? '🔊' : '🔇'; }
    const bgm = document.getElementById('bgm-toggle');
    if (bgm) { bgm.classList.toggle('active', this.state.bgmOn); bgm.textContent = this.state.bgmOn ? '🎵' : '🔕'; }
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
    wireSeg('theme-seg', 'theme');
    wireSeg('end-mode-seg', 'endMode');
    wireSeg('fx-seg', 'fxLevel');

    const slider = document.getElementById('speed-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.set('speed', parseInt(slider.value, 10));
      });
    }

    const sfx = document.getElementById('sfx-toggle');
    if (sfx) sfx.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.set('sfxOn', !this.state.sfxOn);
    });
    const bgm = document.getElementById('bgm-toggle');
    if (bgm) bgm.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.set('bgmOn', !this.state.bgmOn);
    });
  }
}
