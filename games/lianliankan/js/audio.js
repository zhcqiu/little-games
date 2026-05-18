// audio.js — 连连看音效（extends AudioEngine）
import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = false;  // 连连看 v1 暂不做 BGM
  }
  setBgmOn(on) { this.bgmOn = on; }
  startBgm() {}
  stopBgm() {}

  playSelect() {
    this.playTone({ freq: 880, type: 'sine', duration: 70, gain: 0.18 });
  }
  playMatch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.scheduleNote(659, t,         100, 0.3, 'sine');
    this.scheduleNote(784, t + 0.05,  100, 0.3, 'sine');
    this.scheduleNote(988, t + 0.10,  140, 0.3, 'sine');
  }
  playMiss() {
    this.playThump({ fromFreq: 220, toFreq: 90, duration: 160, gain: 0.4 });
  }
  playCombo() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.scheduleNote(523, t,        80, 0.35, 'triangle');
    this.scheduleNote(659, t + 0.06, 80, 0.35, 'triangle');
    this.scheduleNote(784, t + 0.12, 80, 0.35, 'triangle');
    this.scheduleNote(1046, t + 0.18, 160, 0.4, 'triangle');
  }
  playHint() {
    this.playTone({ freq: 1320, type: 'sine', duration: 120, gain: 0.25 });
  }
  playShuffle() {
    this.playNoiseSweep({ fromFreq: 1500, toFreq: 300, duration: 350, gain: 0.3 });
  }
  playWin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melody = [523, 659, 784, 1046, 1318];
    melody.forEach((f, i) => this.scheduleNote(f, t + i * 0.10, 200, 0.4, 'square'));
  }
}
