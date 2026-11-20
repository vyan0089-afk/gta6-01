// police.js — The wanted system of Tanjung Matahari.
// Stealing a car, shooting, or speeding past a patrol raises the heat from
// 1 to 5 stars. Named units respond: patrol cars chase and ram, the Elang
// helicopter circles from 4 stars, and at 5 stars roadblocks appear ahead.
// Lay low out of sight and the heat cools; get caught slow and on foot near
// a unit and the bust timer runs. Police cars are real cars in the world:
// they drive the roads, they crash into traffic, and they can be outrun.

import { Rng, clamp } from './rng.js';
import { POLICE_UNITS } from './config.js';
import { WORLD } from './config.js';

export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 26;

/** One police car chasing the player. */
export class PoliceCar {
  constructor(x, z, angle) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.speed = 0;
    this.top = 34;
    this.stuck = 0;
    this.ramCooldown = 0;
    this.sirenPhase = 0;
  }

  /** Chase the player: steer toward them, ram when close. */
  step(dt, player, rng) {
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const want = Math.atan2(dx / d, dz / d);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    const target = d > 6 ? this.top : this.top * 0.4;
    this.speed += (target - this.speed) * Math.min(1, 1.6 * dt);
    const prevX = this.x;
    const prevZ = this.z;
    this.x += Math.sin(this.angle) * this.speed * dt;
    this.z += Math.cos(this.angle) * this.speed * dt;
    const moved = Math.sqrt((this.x - prevX) * (this.x - prevX) + (this.z - prevZ) * (this.z - prevZ));
    if (this.speed > 5 && moved < 0.01) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 1.2) {
      // Back out of whatever corner we are in and try again.
      this.angle += Math.PI * 0.7;
      this.speed = -6;
      this.stuck = 0;
    }
    this.x = clamp(this.x, -WORLD.half + 8, WORLD.half - 8);
    this.z = clamp(this.z, -WORLD.half + 8, WORLD.beachZ - 4);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.sirenPhase += dt * 6;
    return d;
  }
}

/** The police helicopter that circles at 4+ stars. */
export class Helicopter {
  constructor() {
    this.angle = 0;
    this.radius = 26;
    this.height = 34;
    this.x = 0;
    this.y = 34;
    this.z = 0;
    this.rotor = 0;
    this.searchlight = false;
  }

  step(dt, player, night) {
    this.angle += dt * 0.32;
    this.x = player.x + Math.cos(this.angle) * this.radius;
    this.z = player.z + Math.sin(this.angle) * this.radius;
    this.y = this.height + Math.sin(this.angle * 2.3) * 2;
    this.rotor += dt * 22;
    this.searchlight = night;
  }
}

/** A roadblock: police cars parked across the road ahead of the player. */
export class Roadblock {
  constructor(x, z, angle) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.cars = 2;
  }
}

/** A spike strip on the road: driving over it shreds the tyres. */
export class SpikeStrip {
  constructor(x, z, angle) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.used = false;
  }

  /** True when the player's car is on the strip. */
  hitBy(player) {
    if (this.used || !player.car) return false;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    return dx * dx + dz * dz < 3 * 3;
  }
}

/** The whole wanted system. */
export class Police {
  constructor() {
    this.wanted = 0;
    this.units = [];
    this.heli = null;
    this.roadblocks = [];
    this.spikes = [];
    this.bustTimer = 0;
    this.busted = false;
    this.heatTimer = 0;
    this.lastSeen = 0;
    this.rng = new Rng(777);
  }

  /** The named unit responding at the current wanted level. */
  unitName() {
    if (this.wanted <= 0) return 'Tidak ada';
    const unit = POLICE_UNITS[Math.min(this.wanted, POLICE_UNITS.length) - 1];
    return unit.name;
  }

  /** How many police cars should be chasing at this level. */
  wantedCarCount() {
    if (this.wanted <= 0) return 0;
    return POLICE_UNITS[Math.min(this.wanted, POLICE_UNITS.length) - 1].cars;
  }

  /** Raise the wanted level, spawning units to match. */
  raise(level, player) {
    const before = this.wanted;
    this.wanted = clamp(Math.max(this.wanted, level), 0, MAX_WANTED);
    this.heatTimer = 0;
    if (this.wanted > before) this.syncUnits(player);
    return this.wanted;
  }

  /** Add one star of heat (a crime just happened). */
  addHeat(amount, player) {
    if (this.wanted >= MAX_WANTED) return this.wanted;
    this.wanted = clamp(this.wanted + amount, 0, MAX_WANTED);
    this.heatTimer = 0;
    this.syncUnits(player);
    return this.wanted;
  }

  /** Make sure the number of chasing units matches the wanted level. */
  syncUnits(player) {
    const want = this.wantedCarCount();
    while (this.units.length < want) {
      const a = this.rng.angle();
      const d = 40 + this.rng.range(0, 30);
      this.units.push(new PoliceCar(player.x + Math.sin(a) * d, player.z + Math.cos(a) * d, this.rng.angle()));
    }
    while (this.units.length > want) this.units.pop();
    if (this.wanted >= 4 && !this.heli) this.heli = new Helicopter();
    if (this.wanted < 4) this.heli = null;
    if (this.wanted >= 5 && this.roadblocks.length === 0) {
      this.roadblocks.push(new Roadblock(player.x + 60, player.z, 0));
      this.roadblocks.push(new Roadblock(player.x - 60, player.z, Math.PI / 2));
      this.spikes.push(new SpikeStrip(player.x + 40, player.z, 0));
      this.spikes.push(new SpikeStrip(player.x - 40, player.z, Math.PI / 2));
    }
    if (this.wanted < 5) {
      this.roadblocks = [];
      this.spikes = [];
    }
  }

  /** Step the chase, the helicopter, the bust timer and the cooldown. */
  step(dt, player, night) {
    // Chase cars.
    for (const unit of this.units) {
      const d = unit.step(dt, player, this.rng);
      // Ram: bump the player's car and slow it.
      if (d < 3.4 && unit.ramCooldown <= 0) {
        unit.ramCooldown = 1.4;
        if (player.car) {
          player.carSpeed *= 0.55;
          player.hurt(4);
        } else {
          player.hurt(8);
        }
      }
    }
    if (this.heli) this.heli.step(dt, player, night);
    // Spike strips: shred the tyres of a car that drives over them.
    for (const strip of this.spikes) {
      if (strip.hitBy(player)) {
        strip.used = true;
        player.carSpeed *= 0.35;
        player.hurt(2);
      }
    }
    // Bust timer: on foot, slow, and a unit is close.
    if (this.wanted > 0 && !player.car && player.speed < 1.5) {
      let nearest = Infinity;
      for (const unit of this.units) {
        const dx = unit.x - player.x;
        const dz = unit.z - player.z;
        nearest = Math.min(nearest, Math.sqrt(dx * dx + dz * dz));
      }
      if (nearest < 7) {
        this.bustTimer += dt;
        if (this.bustTimer > 3) this.busted = true;
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // Cooldown: stay out of sight and the heat fades one star at a time.
    if (this.wanted > 0) {
      this.heatTimer += dt;
      const nearest = this.nearestUnitDistance(player);
      if (nearest > 90) {
        if (this.heatTimer > WANTED_DECAY_SECONDS) {
          this.wanted -= 1;
          this.heatTimer = 0;
          this.syncUnits(player);
        }
      } else {
        this.heatTimer = Math.min(this.heatTimer, WANTED_DECAY_SECONDS * 0.5);
      }
    }
  }

  /** Distance to the nearest police unit, or Infinity when none. */
  nearestUnitDistance(player) {
    let best = Infinity;
    for (const unit of this.units) {
      const dx = unit.x - player.x;
      const dz = unit.z - player.z;
      best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
    }
    return best;
  }

  /** Distances to every unit, for the HUD's police readout. */
  unitDistances(player) {
    return this.units.map((u) => Math.round(Math.sqrt((u.x - player.x) * (u.x - player.x) + (u.z - player.z) * (u.z - player.z))));
  }

  /** Clear all heat (mission reward, or a fresh start). */
  clear() {
    this.wanted = 0;
    this.units = [];
    this.heli = null;
    this.roadblocks = [];
    this.spikes = [];
    this.bustTimer = 0;
    this.busted = false;
    this.heatTimer = 0;
  }

  /** After being busted: lose some money, keep the story. */
  applyBust(player) {
    this.busted = false;
    this.clear();
    player.money = Math.max(0, player.money - 50000);
    player.health = 60;
    if (player.car) player.exitCar();
  }
}
