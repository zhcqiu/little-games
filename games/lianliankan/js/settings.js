// settings.js — 设置面板 + lianliankan.settings + 最高分
import { GlobalSettings } from '../../../shared/global-settings.js';
import { DIFFICULTIES } from './board.js';

const KEY = 'lianliankan.settings';
const KEY_HIGH = 'lianliankan.highScore';

const DEFAULTS = {
  difficulty: 'novice',
  timed: false,
  relaxed: false,
};

const FX_INTENSITY = { strong: 1.0, mild: 0.4, off: 0 };

export class Settings {
  constructor(game, audio, effects, callbacks = {}) {
    this.game = game;
    this.audio = audio;
    this.effects = effects;
    this.state = { ...DEFAULTS };
    this.highScore = { beginner:{bestScore:0,fastestMs:0}, novice:{bestScore:0,fastestMs:0},
                       advanced:{bestScore:0,fastestMs:0}, master:{bestScore:0,fastestMs:0} };
    this._cb = callbacks;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...DEFAULTS, ...JSON.parse(raw) };
      const rawHi = localStorage.getItem(KEY_HIGH);
      if (rawHi) this.highScore = { ...this.highScore, ...JSON.parse(rawHi) };
      this._syncScalarHigh();  // 兜底：旧版本升级时只有嵌套 highScore 没有 .scalar
    } catch (e) {}
  }

  _syncScalarHigh() {
    try {
      let max = 0;
      for (const d of Object.keys(this.highScore)) {
        if (this.highScore[d].bestScore > max) max = this.highScore[d].bestScore;
      }
      localStorage.setItem('lianliankan.highScore.scalar', String(max));
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      localStorage.setItem(KEY_HIGH, JSON.stringify(this.highScore));
    } catch (e) {}
  }

  get(key) {
    // 全局字段走 GlobalSettings
    if (['theme','sfxOn','bgmOn','fxLevel'].includes(key)) return GlobalSettings.get(key);
    if (key === 'highScore') return this.highScore;
    return this.state[key];
  }

  set(key, value) {
    if (['theme','sfxOn','bgmOn','fxLevel'].includes(key)) {
      GlobalSettings.set(key, value);
    } else {
      this.state[key] = value;
      this.save();
    }
    this.apply();
  }

  apply() {
    this.audio.setSfxOn(GlobalSettings.get('sfxOn'));
    this.effects.setIntensity(FX_INTENSITY[GlobalSettings.get('fxLevel')] ?? 1.0);
    document.body.dataset.theme = GlobalSettings.get('theme');
    // 同步 PWA 状态栏
    const bg2 = getComputedStyle(document.body).getPropertyValue('--bg-2').trim();
    if (bg2) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg2);
    this._syncUi();
  }

  recordHighScore(difficulty, score, elapsedMs) {
    const cur = this.highScore[difficulty] || { bestScore: 0, fastestMs: 0 };
    let changed = false;
    if (score > cur.bestScore) { cur.bestScore = score; changed = true; }
    if (cur.fastestMs === 0 || elapsedMs < cur.fastestMs) {
      cur.fastestMs = elapsedMs; changed = true;
    }
    this.highScore[difficulty] = cur;
    if (changed) {
      this.save();
      this._syncScalarHigh();  // 标量给首页卡片用
    }
    return changed;
  }

  _syncUi() {
    for (const btn of document.querySelectorAll('#difficulty-seg button')) {
      btn.classList.toggle('active', btn.dataset.val === this.state.difficulty);
    }
    const timedRow = document.getElementById('timed-row');
    const showTimed = this.state.difficulty === 'advanced' || this.state.difficulty === 'master';
    if (timedRow) timedRow.style.display = showTimed ? '' : 'none';
    const timedBtn = document.getElementById('timed-toggle');
    if (timedBtn) {
      const isMaster = this.state.difficulty === 'master';
      const on = isMaster ? true : !!this.state.timed;
      timedBtn.classList.toggle('active', on);
      timedBtn.textContent = on ? '⏱' : '⏱️ 关';
      timedBtn.disabled = isMaster;
    }
    // relaxed toggle 只在连线 3 档（非 beginner）显示——翻牌档无路径概念
    const relaxedRow = document.getElementById('relaxed-row');
    if (relaxedRow) relaxedRow.style.display = this.state.difficulty === 'beginner' ? 'none' : '';
    const relaxedBtn = document.getElementById('relaxed-toggle');
    if (relaxedBtn) {
      const on = !!this.state.relaxed;
      relaxedBtn.classList.toggle('active', on);
      relaxedBtn.textContent = on ? '🆓 开' : '🆓 关';
    }
  }

  bindUi() {
    document.getElementById('difficulty-seg')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn?.dataset.val) return;
      const prev = this.state.difficulty;
      if (prev === btn.dataset.val) return;
      // 切难度 → 弹确认
      this._cb.onDifficultyChange?.(btn.dataset.val);
    });
    document.getElementById('timed-toggle')?.addEventListener('click', () => {
      this.set('timed', !this.state.timed);
      this._cb.onTimedChange?.(this.state.timed);
    });
    document.getElementById('relaxed-toggle')?.addEventListener('click', () => {
      this.set('relaxed', !this.state.relaxed);
      this._cb.onRelaxedChange?.(this.state.relaxed);
    });
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      this._cb.onRestart?.();
    });
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      document.getElementById('settings-panel').classList.remove('hidden');
      this._cb.onOpen?.();
      this._syncUi();
    });
    document.getElementById('settings-close')?.addEventListener('click', () => {
      this.close();
    });
    document.getElementById('help-btn')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.remove('hidden');
      this._cb.onHelpOpen?.();
    });
    document.getElementById('help-close')?.addEventListener('click', () => {
      document.getElementById('help-panel').classList.add('hidden');
      this._cb.onHelpClose?.();
    });
  }

  close() {
    document.getElementById('settings-panel').classList.add('hidden');
    this._cb.onClose?.();
  }
}
