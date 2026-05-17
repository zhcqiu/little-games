// settings.js — 设置面板 + localStorage 持久化
const KEY = 'tetris.settings';
const KEY_HIGH = 'tetris.highScore';

const DEFAULTS = {
  speed: 1,
  upwardTolerance: 1,
  endMode: 'standard',
  sfxOn: true,
  bgmOn: true,
};

export class Settings {
  constructor(game, audio) {
    this.game = game;
    this.audio = audio;
    this.state = { ...DEFAULTS };
    this.highScore = 0;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      const h = localStorage.getItem(KEY_HIGH);
      if (h) this.highScore = parseInt(h, 10) || 0;
    } catch (e) {
      // localStorage 不可用，用默认值
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) { /* ignore */ }
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

  /** 把 state 推到 game / audio */
  apply() {
    this.game.setSpeed(this.state.speed);
    this.game.setUpwardTolerance(this.state.upwardTolerance);
    this.game.setEndMode(this.state.endMode);
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);

    this._syncUi();
  }

  _syncUi() {
    document.getElementById('speed-slider').value = this.state.speed;

    const upwardSeg = document.getElementById('upward-seg');
    for (const btn of upwardSeg.querySelectorAll('button')) {
      btn.classList.toggle('active', String(this.state.upwardTolerance) === btn.dataset.val);
    }

    const endSeg = document.getElementById('end-mode-seg');
    for (const btn of endSeg.querySelectorAll('button')) {
      btn.classList.toggle('active', this.state.endMode === btn.dataset.val);
    }

    document.getElementById('sfx-toggle').classList.toggle('active', this.state.sfxOn);
    document.getElementById('sfx-toggle').textContent = this.state.sfxOn ? '开' : '关';
    document.getElementById('bgm-toggle').classList.toggle('active', this.state.bgmOn);
    document.getElementById('bgm-toggle').textContent = this.state.bgmOn ? '开' : '关';
  }

  bindUi() {
    document.getElementById('settings-btn').addEventListener('click', () => this.open());
    document.getElementById('settings-close').addEventListener('click', () => this.close());

    document.getElementById('speed-slider').addEventListener('input', (e) => {
      this.set('speed', parseInt(e.target.value, 10));
    });

    document.getElementById('upward-seg').addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        this.set('upwardTolerance', parseInt(e.target.dataset.val, 10));
      }
    });

    document.getElementById('end-mode-seg').addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        this.set('endMode', e.target.dataset.val);
      }
    });

    document.getElementById('sfx-toggle').addEventListener('click', () => {
      this.set('sfxOn', !this.state.sfxOn);
    });

    document.getElementById('bgm-toggle').addEventListener('click', () => {
      this.set('bgmOn', !this.state.bgmOn);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.remove('hidden');
    });

    document.getElementById('restart-cancel').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
    });

    document.getElementById('restart-ok').addEventListener('click', () => {
      document.getElementById('restart-confirm').classList.add('hidden');
      document.getElementById('settings-panel').classList.add('hidden');
      this.game.reset();
      this.game.setPaused(false);
    });
  }

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
