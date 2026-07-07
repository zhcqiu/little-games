import { AudioEngine } from '../../../shared/audio-engine.js';

export class Audio extends AudioEngine {
  constructor() {
    super();
    this.bgmOn = true;
    this.bgmController = null;
  }

  setBgmOn(on) {
    this.bgmOn = !!on;
    if (!this.bgmOn) this.stopBgm();
    else if (this.ctx && !this.bgmController) this.startBgm();
  }

  setBgmTheme() {}

  startBgm() {
    if (!this.bgmOn || !this.ctx || this.bgmController) return;
    let stopped = false;
    const notes = [392, 440, 523, 440, 392, 330, 392, 523];
    let i = 0;
    const tick = () => {
      if (stopped || !this.ctx || !this.bgmOn) return;
      const t = this.ctx.currentTime;
      this.scheduleNote(notes[i % notes.length], t, 180, 0.055, 'sine');
      i += 1;
      this.bgmController.timer = setTimeout(tick, 520);
    };
    this.bgmController = {
      timer: null,
      stop: () => {
        stopped = true;
        if (this.bgmController?.timer) clearTimeout(this.bgmController.timer);
      },
    };
    tick();
  }

  stopBgm() {
    if (!this.bgmController) return;
    this.bgmController.stop();
    this.bgmController = null;
  }

  playFruit() {
    this.playTone({ freq: 660, duration: 80, gain: 0.22 });
    setTimeout(() => this.playTone({ freq: 880, duration: 90, gain: 0.18 }), 70);
  }

  playMove() {
    this.playTone({ freq: 360, duration: 60, gain: 0.12 });
  }

  playCrash() {
    this.playThump({ fromFreq: 180, toFreq: 85, duration: 180, gain: 0.26 });
  }

  playRepair() {
    this.playTone({ freq: 392, duration: 110, gain: 0.16 });
    setTimeout(() => this.playTone({ freq: 523, duration: 160, gain: 0.16 }), 120);
  }

  playExtraLife() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [659, 784, 988, 1175].forEach((n, i) => this.scheduleNote(n, t + i * 0.07, 170, 0.18, 'triangle'));
  }

  playHighScore() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((n, i) => this.scheduleNote(n, t + i * 0.09, 180, 0.16));
  }
}
