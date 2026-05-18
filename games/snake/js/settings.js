// settings.js — 设置面板 + localStorage
const KEY = 'snake.settings';
const KEY_HIGH = 'snake.highScore';

const DEFAULTS = {
  speed: 1,
  endMode: 'standard',
  sfxOn: true,
  bgmOn: true,
  theme: 'cheery',
  fxLevel: 'strong',
  totalFood: 0,    // 累计吃食物数（解锁额外蛇头用）
  foodEdgeMargin: 1,
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
      const h = localStorage.getItem(KEY_HIGH);
      if (h) this.highScore = parseInt(h, 10) || 0;
    } catch (e) { /* 默认值兜底 */ }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) {}
  }

  get(key) {
    if (key === 'highScore') return this.highScore;
    return this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') {
      this.highScore = value;
    } else {
      this.state[key] = value;
      this.apply();
    }
    this.save();
  }

  apply() {
    this.game.setSpeed(this.state.speed);
    this.game.setEndMode(this.state.endMode);
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);
    if (this.effects) this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1.0);
    this.game.setTheme(this.state.theme);
    this.audio.setBgmTheme(this.state.theme);
    this.game.setTotalFood(this.state.totalFood);
    this.game.setFoodEdgeMargin(this.state.foodEdgeMargin);
    document.body.dataset.theme = this.state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      getComputedStyle(document.body).getPropertyValue('--bg-2').trim() || '#ff7043'
    );
    this._syncUi();
  }

  _syncUi() {
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) speedSlider.value = this.state.speed;

    const setSeg = (id, val) => {
      const seg = document.getElementById(id);
      if (!seg) return;
      for (const btn of seg.querySelectorAll('button')) {
        btn.classList.toggle('active', btn.dataset.val === String(val));
      }
    };
    setSeg('theme-seg',    this.state.theme);
    setSeg('end-mode-seg', this.state.endMode);
    setSeg('fx-seg',       this.state.fxLevel);
    setSeg('food-edge-seg', this.state.foodEdgeMargin);

    const sfxBtn = document.getElementById('sfx-toggle');
    if (sfxBtn) {
      sfxBtn.classList.toggle('active', this.state.sfxOn);
      sfxBtn.textContent = this.state.sfxOn ? '🔊' : '🔇';
    }
    const bgmBtn = document.getElementById('bgm-toggle');
    if (bgmBtn) {
      bgmBtn.classList.toggle('active', this.state.bgmOn);
      bgmBtn.textContent = this.state.bgmOn ? '🎵' : '🔕';
    }
  }

  bindUi() {
    // 主题
    const themeSeg = document.getElementById('theme-seg');
    themeSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('theme', btn.dataset.val);
    });

    // 速度
    document.getElementById('speed-slider')?.addEventListener('input', (e) => {
      this.set('speed', parseInt(e.target.value, 10) || 1);
    });

    // 结束模式
    document.getElementById('end-mode-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('endMode', btn.dataset.val);
    });

    // 食物范围
    document.getElementById('food-edge-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val !== undefined) this.set('foodEdgeMargin', parseInt(btn.dataset.val, 10) || 0);
    });

    // 音效 / BGM
    document.getElementById('sfx-toggle')?.addEventListener('click', () => {
      this.set('sfxOn', !this.state.sfxOn);
    });
    document.getElementById('bgm-toggle')?.addEventListener('click', () => {
      this.set('bgmOn', !this.state.bgmOn);
    });

    // 动效强度
    document.getElementById('fx-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.val) this.set('fxLevel', btn.dataset.val);
    });

    // 打开 / 关闭
    document.getElementById('settings-btn')?.addEventListener('click', () => this.open());
    document.getElementById('settings-close')?.addEventListener('click', () => this.close());

    // 帮助按钮
    document.getElementById('help-btn')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.remove('hidden');
      this.game.setPaused(true);
      this.audio.stopBgm(100);
    });
    document.getElementById('help-close')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.add('hidden');
      this.game.setPaused(false);
      if (this.state.bgmOn && this.audio.ctx) this.audio.startBgm();
    });

    // 重启
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.remove('hidden');
    });
    document.getElementById('restart-cancel')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
    });
    document.getElementById('restart-ok')?.addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
      this.close();
      this.game.reset();
      if (this._onReset) this._onReset();
    });
  }

  onReset(cb) { this._onReset = cb; }

  open() {
    document.getElementById('settings-panel').classList.remove('hidden');
    this.game.setPaused(true);
    this.audio.stopBgm(100);
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this.game.setPaused(false);
    if (this.state.bgmOn && this.audio.ctx) this.audio.startBgm();
  }
}
