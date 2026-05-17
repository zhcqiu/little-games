// shared/audio-engine.js — Web Audio API 基础类
// 提供 AudioContext 懒初始化、master gain、几个常用合成原语
// 各游戏继承 / 组合本类，加自己游戏特定的音效

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxOn = true;
  }

  /** 由首次用户手势调用，iOS Safari 要求 */
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

  /**
   * 单 oscillator + envelope。
   * opts: { freq, type='sine', duration, gain=0.3, attack=5 }
   * duration / attack 单位是毫秒
   */
  playTone({ freq, type = 'sine', duration, gain = 0.3, attack = 5 }) {
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

  /** 按指定时刻调度一个和弦音符（用于多音和弦 / 琶音） */
  scheduleNote(freq, when, duration, gain = 0.38, type = 'sine') {
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

  /** 频率快速下扫 + 短暂噪声 click，常用于"落地""撞击" */
  playThump({ fromFreq = 200, toFreq = 80, duration = 180, gain = 0.55, clickFreq = 1500, clickDuration = 40 } = {}) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration * 0.3 / 1000);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration / 1000);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration / 1000 + 0.05);

    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * clickDuration / 1000), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = clickFreq;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + clickDuration / 1000);
    src.connect(hpf);
    hpf.connect(ng);
    ng.connect(this.master);
    src.start(t0);
    src.stop(t0 + clickDuration / 1000 + 0.01);
  }

  /** 带通滤波器扫频的噪声 - "哗啦" / "嗖" */
  playNoiseSweep({ fromFreq = 2000, toFreq = 200, duration = 400, gain = 0.3, q = 2 } = {}) {
    if (!this.sfxOn || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration / 1000);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration / 1000);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration / 1000);

    source.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    source.start(t0);
    source.stop(t0 + duration / 1000 + 0.02);
  }
}
