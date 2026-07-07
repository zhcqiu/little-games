export const MIN_LANES = 3;
export const MAX_LANES = 5;
export const FRUITS = ['🍓', '🍌', '🍎', '🍊', '🍇', '🍉'];

const VEHICLES = [
  { kind: 'car', color: '#42a5f5', roof: '#bbdefb' },
  { kind: 'bus', color: '#ffca28', roof: '#fff8e1' },
  { kind: 'truck', color: '#66bb6a', roof: '#c8e6c9' },
  { kind: 'van', color: '#ef5350', roof: '#ffcdd2' },
];

const CHALLENGES = {
  gentle: { spawnMul: 0.72, speedMul: 0.78, fruitMul: 1.22 },
  normal: { spawnMul: 1.0, speedMul: 1.0, fruitMul: 1.0 },
  lively: { spawnMul: 1.24, speedMul: 1.14, fruitMul: 0.92 },
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function pick(arr) {
  return arr[randInt(arr.length)];
}

export class Game {
  constructor() {
    this.challenge = 'gentle';
    this.guidesOn = true;
    this.maxHits = 3;
    this.speedSetting = 2;
    this._listeners = {};
    this.reset();
  }

  reset() {
    this.score = 0;
    this.fruitCount = 0;
    this.distance = 0;
    this.damage = 0;
    this.gameTimeMs = 0;
    this.paused = false;
    this.gameOver = false;
    this.laneCount = MIN_LANES;
    this.playerLane = 1;
    this.playerOffset = 1;
    this.playerSpeed = this._targetSpeed();
    this.vehicles = [];
    this.fruits = [];
    this.scenery = [];
    this.vehicleSpawnMs = 900;
    this.fruitSpawnMs = 1300;
    this.scenerySpawnMs = 0;
    this.combo = 0;
    this.comboMs = 0;
    this.sunSmileMs = 1400;
    this.planeMs = 5000;
    this.repairMs = 0;
    this._emit('reset');
  }

  setPaused(paused) {
    this.paused = !!paused;
  }

  setChallenge(value) {
    if (CHALLENGES[value]) this.challenge = value;
  }

  setGuidesOn(on) {
    this.guidesOn = !!on;
  }

  setMaxHits(value) {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) this.maxHits = clamp(n, 2, 5);
  }

  setSpeed(value) {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) this.speedSetting = clamp(n, 1, 5);
  }

  moveLeft() {
    if (this.gameOver) return false;
    const next = clamp(this.playerLane - 1, 0, this.laneCount - 1);
    if (next === this.playerLane) return false;
    this.playerLane = next;
    this._emit('move', next);
    return true;
  }

  moveRight() {
    if (this.gameOver) return false;
    const next = clamp(this.playerLane + 1, 0, this.laneCount - 1);
    if (next === this.playerLane) return false;
    this.playerLane = next;
    this._emit('move', next);
    return true;
  }

  accelerate() {
    this.setSpeed(this.speedSetting + 1);
  }

  decelerate() {
    this.setSpeed(this.speedSetting - 1);
  }

  step(dt) {
    if (this.paused) return;
    dt = Math.min(Math.max(dt || 0, 0), 200);

    if (this.gameOver) {
      if (this.repairMs > 0) {
        this.repairMs -= dt;
        if (this.repairMs <= 0) this.reset();
      }
      return;
    }

    const seconds = dt / 1000;
    this.gameTimeMs += dt;
    this.distance += seconds * (6 + this.playerSpeed * 8);
    this.sunSmileMs = Math.max(0, this.sunSmileMs - dt);
    this.planeMs -= dt;
    if (this.planeMs <= -3800) this.planeMs = 9000 + Math.random() * 5000;

    const oldLaneCount = this.laneCount;
    this.laneCount = clamp(MIN_LANES + Math.floor(this.gameTimeMs / 45000), MIN_LANES, MAX_LANES);
    if (this.laneCount !== oldLaneCount) this.playerLane = clamp(this.playerLane, 0, this.laneCount - 1);

    this.playerOffset += (this.playerLane - this.playerOffset) * Math.min(1, seconds * 10);
    this.playerSpeed += (this._targetSpeed() - this.playerSpeed) * Math.min(1, seconds * 3);
    if (this.comboMs > 0) {
      this.comboMs -= dt;
      if (this.comboMs <= 0) this.combo = 0;
    }

    this._spawn(dt);
    this._moveObjects(seconds);
    this._checkCollections();
    this._checkCollisions();
  }

  getDangerLane() {
    if (!this.guidesOn) return null;
    let nearest = null;
    for (const v of this.vehicles) {
      if (v.hit || v.lane !== this.playerLane) continue;
      if (v.z > 0.16 && v.z < 0.44) {
        if (!nearest || v.z < nearest.z) nearest = v;
      }
    }
    return nearest ? nearest.lane : null;
  }

  serialize() {
    return {
      v: 1,
      score: this.score,
      fruitCount: this.fruitCount,
      distance: this.distance,
      damage: this.damage,
      gameTimeMs: this.gameTimeMs,
      laneCount: this.laneCount,
      playerLane: this.playerLane,
      speedSetting: this.speedSetting,
      challenge: this.challenge,
      guidesOn: this.guidesOn,
      maxHits: this.maxHits,
      vehicles: this.vehicles,
      fruits: this.fruits,
      scenery: this.scenery,
    };
  }

  restore(snap) {
    if (!snap || snap.v !== 1) return false;
    if (!Array.isArray(snap.vehicles) || !Array.isArray(snap.fruits)) return false;
    this.score = Math.max(0, snap.score | 0);
    this.fruitCount = Math.max(0, snap.fruitCount | 0);
    this.distance = Math.max(0, Number(snap.distance) || 0);
    this.damage = clamp(snap.damage | 0, 0, this.maxHits);
    this.gameTimeMs = Math.max(0, Number(snap.gameTimeMs) || 0);
    this.laneCount = clamp(snap.laneCount | 0, MIN_LANES, MAX_LANES);
    this.playerLane = clamp(snap.playerLane | 0, 0, this.laneCount - 1);
    this.playerOffset = this.playerLane;
    this.setSpeed(snap.speedSetting || this.speedSetting);
    this.setChallenge(snap.challenge || this.challenge);
    this.setGuidesOn(snap.guidesOn !== false);
    this.setMaxHits(snap.maxHits || this.maxHits);
    this.vehicles = snap.vehicles.filter((o) => Number.isFinite(o.z));
    this.fruits = snap.fruits.filter((o) => Number.isFinite(o.z));
    this.scenery = Array.isArray(snap.scenery) ? snap.scenery.filter((o) => Number.isFinite(o.z)) : [];
    this.paused = false;
    this.gameOver = false;
    return true;
  }

  on(name, cb) {
    this._listeners[name] = cb;
  }

  _emit(name, payload) {
    if (this._listeners[name]) this._listeners[name](payload);
  }

  _targetSpeed() {
    return 0.45 + this.speedSetting * 0.12;
  }

  _difficulty() {
    const c = CHALLENGES[this.challenge] || CHALLENGES.gentle;
    return {
      spawn: c.spawnMul * (1 + this.gameTimeMs / 95000),
      speed: c.speedMul * (1 + this.gameTimeMs / 120000),
      fruit: c.fruitMul,
    };
  }

  _spawn(dt) {
    const d = this._difficulty();
    this.vehicleSpawnMs -= dt * d.spawn;
    this.fruitSpawnMs -= dt * d.fruit;
    this.scenerySpawnMs -= dt;

    if (this.vehicleSpawnMs <= 0) {
      this._spawnVehicle();
      this.vehicleSpawnMs = clamp(1650 - this.gameTimeMs / 140, 620, 1650) + Math.random() * 520;
    }
    if (this.fruitSpawnMs <= 0) {
      this._spawnFruit();
      this.fruitSpawnMs = 1000 + Math.random() * 900;
    }
    if (this.scenerySpawnMs <= 0) {
      this.scenery.push({ side: 'left', z: 1.05, kind: Math.random() < 0.55 ? 'tree' : 'house' });
      this.scenery.push({ side: 'right', z: 1.05, kind: Math.random() < 0.55 ? 'tree' : 'house' });
      this.scenerySpawnMs = 360;
    }
  }

  _spawnVehicle() {
    const occupied = new Set(this.vehicles.filter((v) => v.z > 0.72).map((v) => v.lane));
    const candidates = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      if (!occupied.has(lane)) candidates.push(lane);
    }
    if (!candidates.length) return;
    const towardPlayer = Math.random() < 0.36 + Math.min(0.18, this.gameTimeMs / 240000);
    this.vehicles.push({
      id: Math.random().toString(36).slice(2),
      lane: pick(candidates),
      z: 1.04,
      speed: towardPlayer ? 0.34 + Math.random() * 0.16 : 0.18 + Math.random() * 0.12,
      direction: towardPlayer ? 'toward' : 'same',
      model: pick(VEHICLES),
      hit: false,
    });
  }

  _spawnFruit() {
    const blocked = new Set(this.vehicles.filter((v) => v.z > 0.65).map((v) => v.lane));
    const candidates = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      if (!blocked.has(lane)) candidates.push(lane);
    }
    if (!candidates.length) return;
    this.fruits.push({
      lane: pick(candidates),
      z: 1.02,
      emoji: pick(FRUITS),
      bob: Math.random() * Math.PI * 2,
    });
  }

  _moveObjects(seconds) {
    const d = this._difficulty();
    const base = 0.13 + this.playerSpeed * 0.12;
    for (const v of this.vehicles) v.z -= seconds * (base + v.speed * d.speed);
    for (const f of this.fruits) {
      f.z -= seconds * (base + 0.12);
      f.bob += seconds * 5;
    }
    for (const s of this.scenery) s.z -= seconds * (base + 0.18);
    this.vehicles = this.vehicles.filter((v) => v.z > -0.14);
    this.fruits = this.fruits.filter((f) => f.z > -0.12);
    this.scenery = this.scenery.filter((s) => s.z > -0.1);
  }

  _checkCollections() {
    const kept = [];
    for (const f of this.fruits) {
      if (f.lane === this.playerLane && f.z < 0.18) {
        this.fruitCount += 1;
        this.combo = this.comboMs > 0 ? this.combo + 1 : 1;
        this.comboMs = 3000;
        const bonus = this.combo >= 3 ? 2 : 1;
        this.score += 5 * bonus;
        this.sunSmileMs = 1800;
        this._emit('fruit', { fruit: f, combo: this.combo, bonus });
      } else {
        kept.push(f);
      }
    }
    this.fruits = kept;
  }

  _checkCollisions() {
    for (const v of this.vehicles) {
      if (v.hit || v.lane !== this.playerLane) continue;
      if (v.z < 0.16 && v.z > -0.06) {
        v.hit = true;
        this.damage += 1;
        this.combo = 0;
        this.comboMs = 0;
        this.speedSetting = Math.max(1, this.speedSetting - 1);
        this._emit('crash', { damage: this.damage, maxHits: this.maxHits, vehicle: v });
        if (this.damage >= this.maxHits) {
          this.gameOver = true;
          this.repairMs = 2600;
          this._emit('gameOver', { score: this.score, fruitCount: this.fruitCount });
        }
        break;
      }
    }
  }
}
