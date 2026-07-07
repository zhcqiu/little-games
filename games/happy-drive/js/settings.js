import { GlobalSettings, GLOBAL_FIELDS } from '../../../shared/global-settings.js';

const KEY = 'happyDrive.settings';
const KEY_HIGH = 'happyDrive.highScore';

const DEFAULTS = {
  speed: 2,
  challenge: 'gentle',
  maxHits: 3,
  guidesOn: true,
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };

export class Settings {
  constructor(game, audio, effects) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS, ...GlobalSettings.snapshot() };
    this.highScore = 0;
    this._onOpen = null;
    this._onClose = null;
    this._onReset = null;
    this._onHelpOpen = null;
    this._onHelpClose = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      this.highScore = parseInt(localStorage.getItem(KEY_HIGH) || '0', 10) || 0;
    } catch (e) {}
    for (const f of GLOBAL_FIELDS) this.state[f] = GlobalSettings.get(f);
  }

  save() {
    const local = {};
    for (const k of Object.keys(this.state)) {
      if (!GLOBAL_FIELDS.includes(k)) local[k] = this.state[k];
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(local));
      localStorage.setItem(KEY_HIGH, String(this.highScore));
    } catch (e) {}
  }

  get(key) {
    if (key === 'highScore') return this.highScore;
    return this.state[key];
  }

  set(key, value) {
    if (key === 'highScore') this.highScore = value;
    else {
      this.state[key] = value;
      if (GLOBAL_FIELDS.includes(key)) GlobalSettings.set(key, value);
      this.apply();
    }
    this.save();
  }

  apply() {
    this.game.setSpeed(this.state.speed);
    this.game.setChallenge(this.state.challenge);
    this.game.setMaxHits(this.state.maxHits);
    this.game.setGuidesOn(this.state.guidesOn);
    this.audio.setSfxOn(this.state.sfxOn);
    this.audio.setBgmOn(this.state.bgmOn);
    this.audio.setBgmTheme(this.state.theme);
    this.effects.setIntensity(FX_INTENSITY[this.state.fxLevel] ?? 1);
    document.body.dataset.theme = this.state.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      getComputedStyle(document.body).getPropertyValue('--bg-2').trim() || '#ff7043'
    );
    this._syncUi();
  }

  bindUi() {
    document.getElementById('speed-slider')?.addEventListener('input', (e) => {
      this.set('speed', parseInt(e.target.value, 10) || 2);
    });
    document.getElementById('challenge-seg')?.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.val) this.set('challenge', b.dataset.val);
    });
    document.getElementById('hits-seg')?.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.val) this.set('maxHits', parseInt(b.dataset.val, 10) || 3);
    });
    document.getElementById('guide-toggle')?.addEventListener('click', () => {
      this.set('guidesOn', !this.state.guidesOn);
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => this.open());
    document.getElementById('settings-close')?.addEventListener('click', () => this.close());
    document.getElementById('help-btn')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.remove('hidden');
      this._onHelpOpen?.();
    });
    document.getElementById('help-close')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.add('hidden');
      this._onHelpClose?.();
    });

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
      this._onReset?.();
    });
  }

  onOpen(cb) { this._onOpen = cb; }
  onClose(cb) { this._onClose = cb; }
  onReset(cb) { this._onReset = cb; }
  onHelpOpen(cb) { this._onHelpOpen = cb; }
  onHelpClose(cb) { this._onHelpClose = cb; }

  open() {
    document.getElementById('settings-panel').classList.remove('hidden');
    this._onOpen?.();
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this._onClose?.();
  }

  _syncUi() {
    const slider = document.getElementById('speed-slider');
    if (slider) slider.value = this.state.speed;
    this._setSeg('challenge-seg', this.state.challenge);
    this._setSeg('hits-seg', this.state.maxHits);
    const guide = document.getElementById('guide-toggle');
    if (guide) {
      guide.classList.toggle('active', this.state.guidesOn);
      guide.textContent = this.state.guidesOn ? '开' : '关';
    }
  }

  _setSeg(id, value) {
    const seg = document.getElementById(id);
    if (!seg) return;
    for (const b of seg.querySelectorAll('button')) {
      b.classList.toggle('active', b.dataset.val === String(value));
    }
  }
}
