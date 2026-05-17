// audio.js — Web Audio API 合成
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
    this.bgmOn = true;
    this.bgmController = null;
  }

  /** 由首次用户手势触发 */
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1.0;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext 创建失败：', e);
    }
  }

  setSfxOn(on) { this.sfxOn = on; }
  setBgmOn(on) {
    this.bgmOn = on;
    if (!on) {
      this.stopBgm(200);
    } else if (on && !this.bgmController && this.ctx) {
      this._startBgm();
    }
  }

  /** 停止 BGM 并 fade out，自动 null 控制器 */
  stopBgm(fadeMs = 200) {
    if (this.bgmController) {
      this.bgmController.stop(fadeMs);
      this.bgmController = null;
    }
  }

  /** 创建一个简单的 oscillator + envelope */
  _playTone({ freq, type = 'sine', duration, gain = 0.3, attack = 5 }) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack / 1000);
    g.gain.linearRampToValueAtTime(gain * 0.7, t0 + (attack + 20) / 1000);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration / 1000 + 0.05);
  }

  playLock() {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    // 主体：sine 200Hz → 80Hz 快速下扫，模拟落地"咚"
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.06);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.55, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.2);

    // 顶部叠加噪声 click 增加触感
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.04), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1500;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
    src.connect(hpf);
    hpf.connect(ng);
    ng.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.05);
  }

  playMove() {
    this._playTone({ freq: 600, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
  }

  playRotate() {
    this._playTone({ freq: 800, type: 'sine', duration: 30, gain: 0.1, attack: 2 });
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
      this._scheduleChordNote(freq, t0, duration);
      this._scheduleChordNote(freq * 2, t0, duration, 0.1, 'triangle');
    }

    if (lines >= 4) {
      // 四消额外：上行琶音 + 一记低音 boom
      const arp = [1046.50, 1318.51, 1567.98, 2093.00];
      for (let i = 0; i < arp.length; i++) {
        this._scheduleChordNote(arp[i], t0 + 0.4 + i * 0.08, 100, 0.45);
      }
      // 低音 boom
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

  _scheduleChordNote(freq, when, duration, gain = 0.38, type = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.linearRampToValueAtTime(gain * 0.7, when + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + duration / 1000 + 0.05);
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
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t0);
    filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.4);
    filter.Q.value = 2;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);

    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    source.start(t0);
    source.stop(t0 + 0.4);
  }

  _startBgm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    // C 大调五声音阶
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
