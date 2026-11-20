// peds.js — Pedestrians of Tanjung Matahari.
// 60+ people walk the sidewalks, cross at corners, gather at the market and
// the beach, and scatter when a gun fires or a car screeches past. Guards in
// dark uniforms stand at mission spots. Each pedestrian has a name, an
// outfit, a walk speed and a destination they keep changing, so the crowd
// never stands still. Peds are simple state machines: walk, idle, flee,
// down (when shot), with a walk-phase for the leg swing the renderer draws.

import { Rng } from './rng.js';
import { PED_NAMES, PED_SHIRTS, PED_SKINS } from './config.js';
import { ROAD_LINES, randomRoadPoint, isSea } from './world.js';

export const PED_COUNT = 64;

/** One pedestrian. */
export class Ped {
  constructor(rng, id, x, z) {
    this.id = id;
    this.name = rng.pick(PED_NAMES);
    this.shirt = rng.pick(PED_SHIRTS);
    this.skin = rng.pick(PED_SKINS);
    this.pants = rng.pick(['#2a2a3a', '#3a2a2a', '#4a4a4a', '#2a3a4a']);
    this.x = x;
    this.z = z;
    this.angle = rng.angle();
    this.speed = rng.range(0.8, 1.6);
    this.walkPhase = rng.float() * Math.PI * 2;
    this.state = 'walk'; // 'walk' | 'idle' | 'flee' | 'down'
    this.stateTimer = rng.range(2, 12);
    this.tx = x;
    this.tz = z;
    this.guard = false;
    this.health = 100;
    this.pickTarget(rng);
  }

  /** Choose a new sidewalk destination near the current spot. */
  pickTarget(rng) {
    const p = randomRoadPoint(rng);
    // Sidewalk offset: a few metres off the road line.
    const off = rng.chance(0.5) ? 10 : -10;
    if (Math.abs(p.x - Math.round(p.x / 64) * 64) < 1) {
      this.tx = p.x + off;
      this.tz = p.z;
    } else {
      this.tx = p.x;
      this.tz = p.z + off;
    }
    if (isSea(this.tx, this.tz)) this.tz = 250;
  }

  /** Step the pedestrian: walk toward the target, idle, or flee danger. */
  step(dt, rng, danger) {
    if (this.state === 'down') return;
    this.stateTimer -= dt;
    if (this.state === 'flee') {
      // Run away from the danger point.
      const dx = this.x - danger.x;
      const dz = this.z - danger.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      this.angle = Math.atan2(dx / d, dz / d);
      this.x += Math.sin(this.angle) * 4.2 * dt;
      this.z += Math.cos(this.angle) * 4.2 * dt;
      this.walkPhase += dt * 11;
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.pickTarget(rng);
      }
      return;
    }
    if (this.state === 'idle') {
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.stateTimer = rng.range(4, 14);
        this.pickTarget(rng);
      }
      return;
    }
    if (this.state === 'sit' || this.state === 'vend' || this.state === 'phone') {
      // Stationary states: the timer runs out, then they walk again.
      // Vendors stay put much longer; sitters watch the world go by.
      if (this.stateTimer <= 0) {
        this.state = 'walk';
        this.stateTimer = rng.range(6, 16);
        this.pickTarget(rng);
      }
      return;
    }
    // Walk toward the target.
    const dx = this.tx - this.x;
    const dz = this.tz - this.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1.5 || this.stateTimer <= 0) {
      if (rng.chance(0.3)) {
        this.state = 'idle';
        this.stateTimer = rng.range(2, 8);
      } else {
        this.pickTarget(rng);
        this.stateTimer = rng.range(6, 16);
      }
      return;
    }
    const want = Math.atan2(dx / d, dz / d);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    this.x += Math.sin(this.angle) * this.speed * dt;
    this.z += Math.cos(this.angle) * this.speed * dt;
    this.walkPhase += dt * this.speed * 5;
  }

  /** Scare this pedestrian: they flee from (x, z). */
  scare(x, z) {
    if (this.state === 'down') return;
    const dx = this.x - x;
    const dz = this.z - z;
    if (dx * dx + dz * dz < 30 * 30) {
      this.state = 'flee';
      this.stateTimer = 3.5;
    }
  }

  /** Hurt the pedestrian; returns true when they go down. */
  hurt(damage) {
    if (this.state === 'down') return false;
    this.health -= damage;
    if (this.health <= 0) {
      this.state = 'down';
      return true;
    }
    return false;
  }

  /** Sit down (benches, beach, market steps). */
  sit() {
    if (this.state === 'down') return;
    this.state = 'sit';
    this.stateTimer = 10;
  }

  /** Stand at a stall as a vendor, calling out their goods. */
  vend(stallName) {
    this.state = 'vend';
    this.stateTimer = 30;
    this.stallName = stallName;
  }

  /** Check the phone while standing still. */
  checkPhone() {
    if (this.state === 'down') return;
    this.state = 'phone';
    this.stateTimer = 6;
  }
}

/** The crowd: spawns, steps and counts. */
export class Crowd {
  constructor(seed) {
    this.rng = new Rng(seed + 202);
    this.list = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      // Cluster the crowd: market, beach, old square and scattered streets.
      let x;
      let z;
      const roll = this.rng.float();
      if (roll < 0.3) {
        x = 40 + this.rng.range(-70, 70);
        z = 150 + this.rng.range(-60, 60);
      } else if (roll < 0.55) {
        x = -120 + this.rng.range(-90, 90);
        z = 230 + this.rng.range(-30, 30);
      } else if (roll < 0.7) {
        x = 60 + this.rng.range(-60, 60);
        z = -40 + this.rng.range(-50, 50);
      } else {
        const p = randomRoadPoint(this.rng);
        x = p.x;
        z = p.z;
      }
      this.list.push(new Ped(this.rng, i, x, z));
    }
    // A few guards stand at the harbour and the market.
    this.spawnGuards(4);
    // Vendors at the market stalls, sitters on the beach, phone users in town.
    this.assignRoles();
  }

  /** Give some pedestrians stationary roles so the city feels lived-in. */
  assignRoles() {
    const rng = this.rng;
    const vendors = this.list.filter((p) => !p.guard).slice(0, 8);
    const stallNames = ['Soto Mak Ijah', 'Satay Bang Dul', 'Es Teh Manis', 'Gorengan Mbak Sari'];
    vendors.forEach((p, i) => {
      p.x = 16 + i * 12;
      p.z = 140 + (i % 2) * 22;
      p.vend(stallNames[i % stallNames.length]);
    });
    const sitters = this.list.filter((p) => !p.guard && p.state === 'walk').slice(8, 14);
    sitters.forEach((p, i) => {
      p.x = -140 + i * 14;
      p.z = 252;
      p.sit();
    });
    const phoners = this.list.filter((p) => !p.guard && p.state === 'walk').slice(14, 20);
    phoners.forEach((p) => p.checkPhone());
    this.formGroups();
  }

  /** Spawn armed guards at fixed posts; they are mission targets. */
  spawnGuards(count) {
    const posts = [
      [252, 210], [150, 250], [96, 196], [210, 180], [60, -110],
    ];
    for (let i = 0; i < count; i += 1) {
      const [x, z] = posts[i % posts.length];
      const g = new Ped(this.rng, 1000 + i, x + this.rng.range(-6, 6), z + this.rng.range(-6, 6));
      g.guard = true;
      g.shirt = '#1a1a22';
      g.pants = '#1a1a22';
      g.speed = 0.9;
      g.health = 120;
      this.list.push(g);
    }
  }

  /** Step every pedestrian. */
  step(dt, danger) {
    for (const p of this.list) p.step(dt, this.rng, danger);
  }

  /** Scare everyone near (x, z). */
  scareAll(x, z) {
    for (const p of this.list) p.scare(x, z);
  }

  /** Count pedestrians near a point (used for shot density and the HUD). */
  countNear(x, z, radius) {
    let n = 0;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < radius * radius) n += 1;
    }
    return n;
  }

  /** The nearest standing pedestrian to (x, z) within maxDist. */
  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const d = Math.sqrt((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z));
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Guards still standing (mission targets). */
  guardsLeft() {
    return this.list.filter((p) => p.guard && p.state !== 'down').length;
  }

  /** Bring downed pedestrians back over time so the city never empties. */
  revive(dt) {
    this.reviveTimer = (this.reviveTimer || 0) + dt;
    if (this.reviveTimer < 20) return;
    this.reviveTimer = 0;
    for (const p of this.list) {
      if (p.state === 'down' && !p.guard) {
        p.state = 'walk';
        p.health = 100;
        const pt = randomRoadPoint(this.rng);
        p.x = pt.x;
        p.z = pt.z;
        p.pickTarget(this.rng);
        break;
      }
    }
  }

  /** Groups of friends: pick pairs that walk to the same destination. */
  formGroups() {
    const walkers = this.list.filter((p) => p.state === 'walk' && !p.guard);
    for (let i = 0; i + 1 < walkers.length; i += 2) {
      if (this.rng.chance(0.4)) {
        const a = walkers[i];
        const b = walkers[i + 1];
        b.tx = a.tx;
        b.tz = a.tz;
        b.group = a.id;
        a.group = b.id;
      }
    }
  }

  /** Count pedestrians in each state, for the HUD and tests. */
  stateCounts() {
    const counts = { walk: 0, idle: 0, flee: 0, down: 0, sit: 0, vend: 0, phone: 0 };
    for (const p of this.list) {
      if (counts[p.state] !== undefined) counts[p.state] += 1;
      else counts[p.state] = 1;
    }
    return counts;
  }
}
