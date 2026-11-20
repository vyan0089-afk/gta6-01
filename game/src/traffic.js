// traffic.js — Traffic and parked cars for Tanjung Matahari.
// 32 traffic cars drive the road grid in lanes, stopping at red lights and
// slowing for the car ahead; 20 parked cars wait along kerbs to be stolen.
// Every car is a model from config.js with its own colour, speed and driver
// patience. Cars never leave the road grid, and they wrap around the city
// edges so the streets always feel alive.

import { Rng, clamp } from './rng.js';
import { CAR_MODELS, WORLD } from './config.js';
import { ROAD_LINES, isOnRoad, randomRoadPoint } from './world.js';

export const TRAFFIC_COUNT = 32;
export const PARKED_COUNT = 20;

/** Weighted pick of a car model. */
export function pickModel(rng) {
  let total = 0;
  for (const m of CAR_MODELS) total += m.weight;
  let roll = rng.float() * total;
  for (const m of CAR_MODELS) {
    roll -= m.weight;
    if (roll <= 0) return m;
  }
  return CAR_MODELS[0];
}

/** A moving traffic car. */
export class TrafficCar {
  constructor(rng, id) {
    this.id = id;
    this.model = pickModel(rng);
    this.colour = rng.pick(this.model.colour);
    this.horizontal = rng.chance(0.5);
    this.line = rng.pick(ROAD_LINES);
    this.along = rng.range(-280, 280);
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.lane = rng.chance(0.5) ? 3.5 : -3.5;
    this.speed = 0;
    this.cruise = this.model.top * rng.range(0.45, 0.7);
    this.accel = this.model.accel * 0.5;
    this.wait = 0;
    this.stolen = false;
    this.x = 0;
    this.z = 0;
    this.angle = 0;
    this.updatePosition();
  }

  updatePosition() {
    if (this.horizontal) {
      this.x = this.along;
      this.z = this.line + this.lane;
      this.angle = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      this.x = this.line + this.lane;
      this.z = this.along;
      this.angle = this.dir > 0 ? 0 : Math.PI;
    }
  }

  /** Step the car forward; lights and the car ahead can stop it. */
  step(dt, world, cars) {
    if (this.stolen) return;
    let target = this.cruise;
    if (this.wait > 0) {
      this.wait -= dt;
      target = 0;
    }
    // Red light ahead: stop at the intersection line.
    const ahead = this.along + this.dir * 14;
    for (const light of world.lights) {
      const onMyRoad = this.horizontal
        ? Math.abs(light.z - this.line) < 4 && Math.abs(light.x - ahead) < 8
        : Math.abs(light.x - this.line) < 4 && Math.abs(light.z - ahead) < 8;
      if (!onMyRoad) continue;
      const greenForMe = this.horizontal ? light.phase === 2 : light.phase === 0;
      if (!greenForMe) target = 0;
    }
    // Car ahead in the same lane: keep a gap.
    for (const other of cars) {
      if (other === this || other.stolen) continue;
      if (other.horizontal !== this.horizontal || other.line !== this.line || other.dir !== this.dir) continue;
      const gap = (other.along - this.along) * this.dir;
      if (gap > 0 && gap < 12) {
        target = Math.min(target, Math.max(0, other.speed * 0.9));
        if (gap < 7) target = 0;
      }
    }
    if (target > this.speed) this.speed = Math.min(target, this.speed + this.accel * dt);
    else this.speed = Math.max(target, this.speed - this.accel * 2.2 * dt);
    this.along += this.dir * this.speed * dt;
    if (this.along > 300) this.along = -300;
    if (this.along < -300) this.along = 300;
    this.updatePosition();
  }
}

/** A parked car waiting to be stolen. */
export class ParkedCar {
  constructor(rng, id) {
    this.id = id;
    this.model = pickModel(rng);
    this.colour = rng.pick(this.model.colour);
    this.horizontal = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-270, 270);
    const side = rng.chance(0.5) ? 9.5 : -9.5;
    if (this.horizontal) {
      this.x = along;
      this.z = line + side;
      this.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      this.x = line + side;
      this.z = along;
      this.angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    this.speed = 0;
    this.stolen = false;
    this.locked = rng.chance(0.25);
    this.name = this.model.name;
  }
}

/** The whole traffic system: moving cars, parked cars and spawning. */
export class Traffic {
  constructor(seed) {
    this.rng = new Rng(seed + 101);
    this.cars = [];
    this.parked = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) this.cars.push(new TrafficCar(this.rng, i));
    for (let i = 0; i < PARKED_COUNT; i += 1) this.parked.push(new ParkedCar(this.rng, i));
  }

  /** Step every moving car. */
  step(dt, world) {
    for (const car of this.cars) car.step(dt, world, this.cars);
  }

  /** The nearest drivable car (parked or traffic) to (x, z) within maxDist. */
  nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    const consider = (c) => {
      if (c.stolen) return;
      const d = Math.sqrt((c.x - x) * (c.x - x) + (c.z - z) * (c.z - z));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    };
    for (const c of this.parked) consider(c);
    for (const c of this.cars) consider(c);
    return best;
  }

  /** How many cars are currently on the road grid near (x, z). */
  countNear(x, z, radius) {
    let n = 0;
    for (const c of this.cars) {
      const dx = c.x - x;
      const dz = c.z - z;
      if (dx * dx + dz * dz < radius * radius) n += 1;
    }
    return n;
  }

  /** Turn a traffic car into the player's stolen car (it stops driving itself). */
  steal(car) {
    car.stolen = true;
    car.speed = 0;
    return car;
  }

  /** Return a stolen car to traffic (used when the player abandons it). */
  release(car) {
    car.stolen = false;
    car.horizontal = Math.abs(Math.sin(car.angle)) > 0.5;
    car.line = car.horizontal ? Math.round(car.z / 64) * 64 : Math.round(car.x / 64) * 64;
    car.along = car.horizontal ? car.x : car.z;
    car.dir = car.horizontal ? (Math.cos(car.angle) > 0 ? 1 : -1) : (Math.sin(car.angle) > 0 ? -1 : 1);
    car.lane = 3.5;
    car.cruise = car.model.top * 0.5;
    car.updatePosition();
  }

  /** A random parked car near a point, for missions that need a target car. */
  randomParkedNear(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const c of this.parked) {
      if (c.stolen) continue;
      const d = Math.sqrt((c.x - x) * (c.x - x) + (c.z - z) * (c.z - z));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Honk: nearby traffic cars honk back (a sound cue + a scare). */
  honkNear(x, z, game) {
    let honked = 0;
    for (const c of this.cars) {
      const dx = c.x - x;
      const dz = c.z - z;
      if (dx * dx + dz * dz < 25 * 25) {
        honked += 1;
        if (game && game.audio) game.audio.playSfx('horn');
      }
    }
    return honked;
  }

  /**
   * Near-miss detection: the player screams past a traffic car at speed.
   * Returns the number of near misses this frame; the caller pays respect
   * and a little wanted heat for reckless driving.
   */
  nearMisses(player) {
    if (!player.car || Math.abs(player.carSpeed) < 14) return 0;
    let n = 0;
    for (const c of this.cars) {
      if (c.stolen) continue;
      const dx = c.x - player.x;
      const dz = c.z - player.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 3.2 * 3.2 && d2 > 1.2 * 1.2) {
        if (!c._nearMissed) {
          c._nearMissed = true;
          n += 1;
        }
      } else if (d2 > 8 * 8) {
        c._nearMissed = false;
      }
    }
    return n;
  }

  /** Fender-bender check: the player's car clips a traffic car. */
  collisions(player, game) {
    if (!player.car) return 0;
    let n = 0;
    for (const c of this.cars) {
      if (c.stolen) continue;
      const dx = c.x - player.x;
      const dz = c.z - player.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 2.6 * 2.6) {
        if (!c._bumped || game.time - c._bumped > 1.5) {
          c._bumped = game.time;
          n += 1;
          player.carSpeed *= 0.6;
          if (game.effects) {
            game.effects.sparks(player.x, 1, player.z, 6);
            game.effects.kick(0.35);
          }
          if (game.audio) game.audio.playSfx('crash');
          c.speed = 0;
        }
      }
    }
    return n;
  }
}

/** Taxi behaviour: a taxi stops for a waving pedestrian, then drives on. */
export class TaxiLogic {
  constructor() {
    this.pickupCooldown = 0;
  }

  /** Step taxis: occasionally stop at a kerb to pick someone up. */
  step(dt, traffic, crowd) {
    this.pickupCooldown -= dt;
    if (this.pickupCooldown > 0) return;
    for (const car of traffic.cars) {
      if (car.model.kind !== 'taxi') continue;
      if (car.speed < 1) continue;
      const near = crowd.nearest(car.x, car.z, 6);
      if (near && near.state === 'walk') {
        // The taxi pulls over for a moment; the pedestrian gets in and the
        // taxi carries on with one fewer walker on the street.
        car.speed = 0;
        car.wait = 2;
        near.state = 'idle';
        near.stateTimer = 2;
        this.pickupCooldown = 8;
        break;
      }
    }
  }
}

/** Keep a car inside the world: clamp position, kill speed at the edge. */
export function clampCarToWorld(car) {
  const m = WORLD.half - 8;
  car.x = clamp(car.x, -m, m);
  car.z = clamp(car.z, -m, WORLD.beachZ - 4);
}
