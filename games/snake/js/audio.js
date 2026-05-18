// audio.js — 贪吃蛇音效
import { AudioEngine } from '../../../shared/audio-engine.js';

const BGM_THEMES = {
  cheery: {
    // 童趣 — 暖暖明亮 C 大调五声音阶
    melody: [
      261.63, 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63,
      261.63, 329.63, 261.63, 196.00, 220.00, 261.63, 329.63, 392.00,
    ],
    bass: [130.81, 130.81, 174.61, 174.61, 196.00, 196.00, 130.81, 130.81],
    beatMs: 700, melodyType: 'triangle', bassType: 'sine',
  },
  candy: {
    // 糖果 — 软糯 A 小调五声音阶
    melody: [
      440.00, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25,
      440.00, 523.25, 440.00, 392.00, 440.00, 523.25, 587.33, 659.25,
    ],
    bass: [220.00, 220.00, 261.63, 261.63, 293.66, 293.66, 220.00, 196.00],
    beatMs: 700, melodyType: 'triangle', bassType: 'sine',
  },
  forest: {
    // 森林 — 民谣感 D 多利亚
    melody: [
      293.66, 349.23, 392.00, 440.00, 493.88, 440.00, 392.00, 349.23,
      293.66, 349.23, 293.66, 261.63, 293.66, 349.23, 392.00, 440.00,
    ],
    bass: [146.83, 146.83, 196.00, 196.00, 174.61, 174.61, 146.83, 146.83],
    beatMs: 750, melodyType: 'triangle', bassType: 'sine',
  },
  ocean: {
    // 海洋 — 慵懒 G 米索利底亚
    melody: [
      392.00, 440.00, 493.88, 523.25, 587.33, 523.25, 493.88, 440.00,
      392.00, 440.00, 392.00, 349.23, 392.00, 440.00, 493.88, 523.25,
    ],
    bass: [196.00, 196.00, 261.63, 261.63, 220.00, 220.00, 196.00, 196.00],
    beatMs: 800, melodyType: 'sine', bassType: 'sine',
  },
  space: {
    // 太空 — 神秘 E 弗里几亚
    melody: [
      329.63, 349.23, 392.00, 440.00, 493.88, 440.00, 392.00, 349.23,
      329.63, 349.23, 329.63, 293.66, 329.63, 349.23, 392.00, 440.00,
    ],
    bass: [164.81, 164.81, 196.00, 196.00, 174.61, 174.61, 164.81, 164.81],
    beatMs: 850, melodyType: 'sawtooth', bassType: 'triangle',
  },
  night: {
    // 夜空 — 柔和 A 自然小调
    melody: [
      440.00, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88,
      440.00, 493.88, 440.00, 392.00, 440.00, 493.88, 523.25, 587.33,
    ],
    bass: [220.00, 220.00, 261.63, 261.63, 293.66, 293.66, 220.00, 196.00],
    beatMs: 900, melodyType: 'triangle', bassType: 'sine',
  },
};

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
    this.bgmTheme = 'cheery';
  }

  setBgmTheme(themeName) {
    if (!BGM_THEMES[themeName]) return;
    if (this.bgmTheme === themeName) return;
    this.bgmTheme = themeName;
    // 若正在放，重启以使用新主题
    if (this.bgmController) {
      this.stopBgm(200);
      if (this.bgmOn && this.ctx) {
        setTimeout(() => {
          if (this.bgmOn && this.ctx && !this.bgmController) this._startBgm();
        }, 250);
      }
    }
  }

  setBgmOn(on) {
    this.bgmOn = on;
    if (!on) {
      this.stopBgm(200);
    } else if (on && !this.bgmController && this.ctx) {
      this._startBgm();
    }
  }

  stopBgm(fadeMs = 200) {
    if (this.bgmController) {
      this.bgmController.stop(fadeMs);
      this.bgmController = null;
    }
  }

  /** 吃食物：上行小三度 C5 → E5 */
  playEat() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    this.scheduleNote(523.25, t0,         80, 0.35, 'triangle');
    this.scheduleNote(659.25, t0 + 0.08,  80, 0.35, 'triangle');
  }

  /** 转向：30ms 900Hz 极轻一下 */
  playTurn() {
    this.playTone({ freq: 900, type: 'sine', duration: 30, gain: 0.05, attack: 2 });
  }

  /** 死亡：下行 A4→F4→D4，方波 + 低通 */
  playDie() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [{ freq: 440, time: 0 }, { freq: 349.23, time: 0.2 }, { freq: 293.66, time: 0.4 }];
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = n.freq;
      const when = t0 + n.time;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.2, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(when);
      osc.stop(when + 0.3);
    }
  }

  /** 复活：警告低音（"完了"）+ 短促回血"叮"（"缓过来了"） */
  playRevive() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;

    // 第一段：低沉警告（A3 方波 + 低通滤波）
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 220;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.22);

    // 第二段：250ms 后一声"叮"，告诉玩家被救回来（中音 E5）
    this.scheduleNote(659.25, t0 + 0.25, 150, 0.25, 'triangle');
  }

  /** 穿墙：短促噪声扫频 */
  playWrap() {
    this.playNoiseSweep({ fromFreq: 2000, toFreq: 200, duration: 120, gain: 0.25, q: 2 });
  }

  /** 里程碑：上行三音 arpeggio，比 eat 更高更亮 */
  playMilestone() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    // C6 - E6 - G6，三音 60ms 间隔，triangle，比 eat 高一个八度
    this.scheduleNote(1046.50, t0,         140, 0.32, 'triangle');
    this.scheduleNote(1318.51, t0 + 0.06,  140, 0.32, 'triangle');
    this.scheduleNote(1567.98, t0 + 0.12,  180, 0.32, 'triangle');
  }

  /** 连击：快速上行三音 chime，区别于 eat */
  playCombo() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    // G5 - B5 - D6
    this.scheduleNote(783.99,  t0,         100, 0.3, 'triangle');
    this.scheduleNote(987.77,  t0 + 0.05,  100, 0.3, 'triangle');
    this.scheduleNote(1174.66, t0 + 0.10,  140, 0.3, 'triangle');
  }

  /** 破纪录：上行 4 音 */
  playHighScore() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < notes.length; i++) {
      this.scheduleNote(notes[i], t0 + i * 0.08, 200, 0.4, 'triangle');
    }
  }

  startBgm() {
    if (this.bgmOn && !this.bgmController) this._startBgm();
  }

  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const theme = BGM_THEMES[this.bgmTheme] || BGM_THEMES.cheery;
    const melody = theme.melody;
    const bass = theme.bass;
    const beatMs = theme.beatMs;
    const melodyType = theme.melodyType;
    const bassType = theme.bassType;

    const totalDuration = (melody.length * beatMs) / 1000;

    const bgmGain = ctx.createGain();
    bgmGain.gain.value = 0;
    bgmGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    bgmGain.connect(this.master);

    let stopFlag = false;

    const schedule = (loopStart) => {
      for (let i = 0; i < melody.length; i++) {
        const t = loopStart + (i * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = melodyType;
        osc.frequency.value = melody[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.45, t + 0.02);
        g.gain.linearRampToValueAtTime(0.3, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.4, beatMs / 1000 * 0.9));
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + Math.max(0.5, beatMs / 1000));
      }
      for (let i = 0; i < bass.length; i++) {
        const t = loopStart + (i * 2 * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = bassType;
        osc.frequency.value = bass[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.05);
        g.gain.linearRampToValueAtTime(0.18, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(1.0, beatMs / 1000 * 1.6));
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + Math.max(1.1, beatMs / 1000 * 1.7));
      }
    };

    let loopStart = ctx.currentTime + 0.1;
    schedule(loopStart);
    const interval = setInterval(() => {
      if (stopFlag) return;
      loopStart += totalDuration;
      schedule(loopStart);
    }, totalDuration * 1000 - 200);

    this.bgmController = {
      stop: (fadeMs = 200) => {
        stopFlag = true;
        clearInterval(interval);
        const tNow = ctx.currentTime;
        bgmGain.gain.cancelScheduledValues(tNow);
        bgmGain.gain.setValueAtTime(bgmGain.gain.value, tNow);
        bgmGain.gain.linearRampToValueAtTime(0, tNow + fadeMs / 1000);
      },
    };
  }
}
