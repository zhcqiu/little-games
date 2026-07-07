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
  gentle: { spawnMul: 1.28, speedMul: 0.54, fruitMul: 1.93 },
  normal: { spawnMul: 1.55, speedMul: 0.62, fruitMul: 1.68 },
  lively: { spawnMul: 1.82, speedMul: 0.7, fruitMul: 1.48 },
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
    this.targetOffset = 1;
    this.playerSpeed = this._targetSpeed();
    this.vehicles = [];
    this.fruits = [];
    this.scenery = [];
    this.vehicleSpawnMs = 450;
    this.fruitSpawnMs = 2600;
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
    const next = clamp(this.targetOffset - 0.5, 0, this.laneCount - 1);
    if (Math.abs(next - this.targetOffset) < 0.001) return false;
    this.targetOffset = next;
    this.playerLane = Math.round(next);
    this._emit('move', next);
    return true;
  }

  moveRight() {
    if (this.gameOver) return false;
    const next = clamp(this.targetOffset + 0.5, 0, this.laneCount - 1);
    if (Math.abs(next - this.targetOffset) < 0.001) return false;
    this.targetOffset = next;
    this.playerLane = Math.round(next);
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
    if (this.laneCount !== oldLaneCount) {
      this.playerLane = clamp(this.playerLane, 0, this.laneCount - 1);
      this.targetOffset = clamp(this.targetOffset, 0, this.laneCount - 1);
      this.playerOffset = clamp(this.playerOffset, 0, this.laneCount - 1);
    }

    this.playerOffset += (this.targetOffset - this.playerOffset) * Math.min(1, seconds * 7.5);
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
      if (v.hit || Math.abs(v.lane - this.playerOffset) > 0.62) continue;
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
      playerOffset: this.playerOffset,
      targetOffset: this.targetOffset,
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
    this.playerOffset = clamp(Number.isFinite(snap.playerOffset) ? snap.playerOffset : this.playerLane, 0, this.laneCount - 1);
    this.targetOffset = clamp(Number.isFinite(snap.targetOffset) ? snap.targetOffset : this.playerOffset, 0, this.laneCount - 1);
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
    return (0.45 + this.speedSetting * 0.12) * 0.8;
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
      this.vehicleSpawnMs = clamp(980 - this.gameTimeMs / 220, 420, 980) + Math.random() * 260;
    }
    if (this.fruitSpawnMs <= 0) {
      this._spawnFruit();
      this.fruitSpawnMs = 2600 + Math.random() * 1800;
    }
    if (this.scenerySpawnMs <= 0) {
      this._spawnSceneryPair();
      this.scenerySpawnMs = 170;
    }
  }

  _spawnSceneryPair() {
    const palettes = [
      { wall: '#ffe0b2', roof: '#ff7043', window: '#42a5f5' },
      { wall: '#c8e6c9', roof: '#43a047', window: '#80deea' },
      { wall: '#bbdefb', roof: '#5c6bc0', window: '#fff59d' },
      { wall: '#f8bbd0', roof: '#ec407a', window: '#b3e5fc' },
      { wall: '#d7ccc8', roof: '#8d6e63', window: '#ffecb3' },
    ];
    for (const side of ['left', 'right']) {
      const isTree = Math.random() < 0.14;
      if (isTree) {
        this.scenery.push({ side, z: 1.05, kind: 'tree' });
      } else {
        const palette = pick(palettes);
        this.scenery.push({
          side,
          z: 1.05,
          kind: 'building',
          wall: palette.wall,
          roof: palette.roof,
          window: palette.window,
          floors: 2 + randInt(4),
          widthMul: 0.85 + Math.random() * 0.45,
          heightMul: 0.85 + Math.random() * 0.55,
        });
      }
    }
  }

  _spawnVehicle() {
    const occupied = this.vehicles.filter((v) => v.z > 0.72).map((v) => Number.isFinite(v.targetLane) ? v.targetLane : v.lane);
    const pressure = this.vehicles.filter((v) => v.z > 0.22 && v.z < 0.82).map((v) => Number.isFinite(v.targetLane) ? v.targetLane : v.lane);
    if (pressure.length >= this.laneCount - 1) return;

    const towardPlayer = Math.random() < 0.36 + Math.min(0.18, this.gameTimeMs / 240000);
    const slots = this._trafficSlots(towardPlayer || Math.random() < 0.3);
    const candidates = [];
    for (const lane of slots) {
      const occupiedNear = occupied.some((pos) => Math.abs(pos - lane) < 0.38);
      const pressureNear = pressure.some((pos) => Math.abs(pos - lane) < 0.5);
      if (!occupiedNear && !pressureNear) candidates.push(lane);
    }
    if (!candidates.length) return;

    const halfLaneCandidates = candidates.filter((lane) => Math.abs(lane - Math.round(lane)) > 0.01);
    const lane = towardPlayer && halfLaneCandidates.length && Math.random() < 0.68
      ? pick(halfLaneCandidates)
      : pick(candidates);

    this.vehicles.push({
      id: Math.random().toString(36).slice(2),
      lane,
      targetLane: lane,
      laneChangeMs: 650 + Math.random() * 1300,
      z: 1.04,
      speed: towardPlayer ? 0.16 + Math.random() * 0.08 : 0.08 + Math.random() * 0.06,
      direction: towardPlayer ? 'toward' : 'same',
      model: pick(VEHICLES),
      hit: false,
    });
  }

  _trafficSlots(includeHalfLanes) {
    const slots = [];
    const steps = (this.laneCount - 1) * 2;
    for (let i = 0; i <= steps; i++) {
      if (!includeHalfLanes && i % 2 !== 0) continue;
      slots.push(i / 2);
    }
    return slots;
  }

  _spawnFruit() {
    if (this.vehicles.some((v) => v.direction === 'toward' && v.z > 0.18)) return;
    const blocked = this.vehicles.filter((v) => v.z > 0.15).map((v) => Number.isFinite(v.targetLane) ? v.targetLane : v.lane);
    const candidates = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      if (!blocked.some((pos) => Math.abs(pos - lane) < 0.55)) candidates.push(lane);
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
    const base = 0.08 + this.playerSpeed * 0.075;
    for (const v of this.vehicles) {
      this._updateVehicleLane(v, seconds);
      const nearExit = v.z < 0.16 ? (0.16 - v.z) * 2.4 : 0;
      v.z -= seconds * (base + v.speed * d.speed + nearExit);
    }
    for (const f of this.fruits) {
      f.z -= seconds * (base + 0.07);
      f.bob += seconds * 5;
    }
    for (const s of this.scenery) s.z -= seconds * (base + 0.1);
    this.vehicles = this.vehicles.filter((v) => v.z > -0.025);
    this.fruits = this.fruits.filter((f) => f.z > -0.12);
    this.scenery = this.scenery.filter((s) => s.z > -0.1);
  }

  _updateVehicleLane(v, seconds) {
    if (!Number.isFinite(v.targetLane)) v.targetLane = v.lane;
    if (!Number.isFinite(v.laneChangeMs)) v.laneChangeMs = 700 + Math.random() * 1400;

    v.laneChangeMs -= seconds * 1000;
    const canChange = v.direction === 'toward' && v.z > 0.18 && v.z < 0.86;
    if (canChange && v.laneChangeMs <= 0) {
      const baseLane = Math.round(v.targetLane * 2) / 2;
      const options = [baseLane - 0.5, baseLane + 0.5]
        .filter((lane) => lane >= 0 && lane <= this.laneCount - 1 && Math.abs(lane - v.targetLane) > 0.01);
      if (options.length && Math.random() < 0.62) v.targetLane = pick(options);
      v.laneChangeMs = 900 + Math.random() * 1700;
    }

    const rate = v.direction === 'toward' ? 1.45 : 0.8;
    v.lane += (v.targetLane - v.lane) * Math.min(1, seconds * rate);
    if (Math.abs(v.lane - v.targetLane) < 0.01) v.lane = v.targetLane;
  }

  _checkCollections() {
    const kept = [];
    for (const f of this.fruits) {
      if (Math.abs(f.lane - this.playerOffset) < 0.34 && f.z < 0.18) {
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
      if (v.hit) continue;
      const lateralOverlap = Math.abs(v.lane - this.playerOffset) < 0.3;
      const depthOverlap = v.z < 0.085 && v.z > -0.02;
      if (lateralOverlap && depthOverlap) {
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
