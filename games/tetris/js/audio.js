// games/tetris/js/audio.js — Tetris 专属音效
// 通用合成原语在 /shared/audio-engine.js
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
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

  playLock() {
    this.playThump({ fromFreq: 200, toFreq: 80, duration: 180, gain: 0.55 });
  }

  playMove() {
    this.playTone({ freq: 600, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
  }

  playRotate() {
    this.playTone({ freq: 800, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
  }

  playClear(lines) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const tones = [
      [523.25],
      [523.25, 659.25],
      [523.25, 659.25, 783.99],
      [523.25, 659.25, 783.99, 1046.50],
    ][Math.min(lines, 4) - 1] || [523.25];

    const duration = [250, 350, 450, 600][Math.min(lines, 4) - 1] || 250;

    for (const freq of tones) {
      this.scheduleNote(freq, t0, duration);
      this.scheduleNote(freq * 2, t0, duration, 0.1, 'triangle');
    }

    if (lines >= 4) {
      // 四消额外：上行琶音 + 一记低音 boom
      const arp = [1046.50, 1318.51, 1567.98, 2093.00];
      for (let i = 0; i < arp.length; i++) {
        this.scheduleNote(arp[i], t0 + 0.4 + i * 0.08, 100, 0.45);
      }
      const boom = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(80, t0);
      boom.frequency.exponentialRampToValueAtTime(40, t0 + 0.6);
      bg.gain.setValueAtTime(0, t0);
      bg.gain.linearRampToValueAtTime(0.6, t0 + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
      boom.connect(bg);
      bg.connect(this.master);
      boom.start(t0);
      boom.stop(t0 + 0.8);
    }
  }

  playGameOver() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [
      { freq: 440, time: 0 },
      { freq: 349.23, time: 0.25 },
      { freq: 293.66, time: 0.5 },
    ];
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

  playEndlessReset() {
    this.playNoiseSweep({ fromFreq: 2000, toFreq: 200, duration: 400, gain: 0.3, q: 2 });
  }

  /** 破纪录的"叮咚！" 上行 4 音 */
  playHighScore() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < notes.length; i++) {
      this.scheduleNote(notes[i], t0 + i * 0.08, 200, 0.4, 'triangle');
    }
  }

  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const melody = [
      261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00,
      261.63, 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63,
    ];
    const bass = [
      130.81, 130.81, 196.00, 196.00,
      174.61, 174.61, 196.00, 196.00,
    ];

    const beatMs = 500;
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
        osc.type = 'triangle';
        osc.frequency.value = melody[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.02);
        g.gain.linearRampToValueAtTime(0.3, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 0.5);
      }
      for (let i = 0; i < bass.length; i++) {
        const t = loopStart + (i * 2 * beatMs) / 1000;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = bass[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.05);
        g.gain.linearRampToValueAtTime(0.2, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 1);
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

  startBgm() {
    if (this.bgmOn && !this.bgmController) this._startBgm();
  }
}
