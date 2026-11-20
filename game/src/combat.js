// combat.js — Combat in Tanjung Matahari: fists, pistol and shotgun.
// Weapons are real: the pistol and shotgun spend ammo, reload from a
// reserve, and hit what the crosshair is near. Shots are resolved by a
// simple ray on the ground plane — angle and distance against pedestrians,
// guards and police cars — with a tracer line the renderer draws for a
// moment and a muzzle flash light. Fists are a short lunge. Shooting in
// public raises the wanted level, and the crowd scatters.

import { WEAPONS } from './config.js';
import { angleDiff, clamp } from './rng.js';

/** A bullet tracer, drawn for a fraction of a second. */
export class Tracer {
  constructor(x1, y1, z1, x2, y2, z2) {
    this.x1 = x1;
    this.y1 = y1;
    this.z1 = z1;
    this.x2 = x2;
    this.y2 = y2;
    this.z2 = z2;
    this.life = 0.12;
  }
}

/** The combat system: weapons, ammo, shooting and hit resolution. */
export class Combat {
  constructor() {
    this.weaponIndex = 0;
    this.ammo = { pistol: 120, shotgun: 40 };
    this.reserve = { pistol: 240, shotgun: 80 };
    this.cooldown = 0;
    this.tracers = [];
    this.muzzle = 0;
    this.kills = 0;
    this.killsInMission = 0;
    this.shotsFired = 0;
    this.lastVictim = null;
  }

  /** The weapon currently in Raka's hands. */
  get weapon() {
    return WEAPONS[this.weaponIndex];
  }

  /** Switch weapon by index (0 fists, 1 pistol, 2 shotgun). */
  select(index) {
    this.weaponIndex = clamp(index, 0, WEAPONS.length - 1);
    this.cooldown = Math.max(this.cooldown, 0.2);
  }

  /** Cycle to the next weapon. */
  cycle() {
    this.select((this.weaponIndex + 1) % WEAPONS.length);
  }

  /** Ammo left in the current weapon (Infinity for fists). */
  ammoLeft() {
    const w = this.weapon;
    if (w.id === 'fists') return Infinity;
    return this.ammo[w.id];
  }

  /** Reload the current weapon from reserve. */
  reload() {
    const w = this.weapon;
    if (w.id === 'fists') return false;
    const need = w.ammo - this.ammo[w.id];
    if (need <= 0 || this.reserve[w.id] <= 0) return false;
    const take = Math.min(need, this.reserve[w.id]);
    this.ammo[w.id] += take;
    this.reserve[w.id] -= take;
    this.cooldown = Math.max(this.cooldown, 0.6);
    return true;
  }

  /** Can the current weapon fire right now? */
  canFire() {
    if (this.cooldown > 0) return false;
    const w = this.weapon;
    if (w.id === 'fists') return true;
    return this.ammo[w.id] > 0;
  }

  /**
   * Fire the current weapon from the player toward aimAngle.
   * Returns the list of victims hit (peds, guards or police cars).
   */
  fire(game, aimAngle) {
    if (!this.canFire()) {
      if (this.weapon.id !== 'fists' && this.ammo[this.weapon.id] <= 0) this.reload();
      return [];
    }
    const w = this.weapon;
    const p = game.player;
    this.cooldown = w.rate;
    this.muzzle = 0.09;
    this.shotsFired += 1;
    const victims = [];
    const pellets = w.pellets || 1;
    if (w.id === 'fists') {
      // A short punch: anything within arm's reach in front.
      const target = game.crowd.nearest(p.x + Math.sin(aimAngle) * 1.4, p.z + Math.cos(aimAngle) * 1.4, 1.6);
      if (target && target.hurt(w.damage)) {
        this.registerKill(game, target);
        victims.push(target);
      }
      game.audio.playSfx('punch');
      return victims;
    }
    this.ammo[w.id] -= 1;
    const ox = p.x;
    const oz = p.z;
    const oy = 1.5 + p.y;
    for (let i = 0; i < pellets; i += 1) {
      const spread = (game.rng.float() - 0.5) * 2 * w.spread;
      const a = aimAngle + spread;
      const range = w.range;
      const hx = ox + Math.sin(a) * range;
      const hz = oz + Math.cos(a) * range;
      this.tracers.push(new Tracer(ox, oy, oz, hx, oy, hz));
      // Hit test: pedestrians and guards near the shot line.
      let best = null;
      let bestD = range;
      for (const ped of game.crowd.list) {
        if (ped.state === 'down') continue;
        const dx = ped.x - ox;
        const dz = ped.z - oz;
        const along = dx * Math.sin(a) + dz * Math.cos(a);
        if (along < 0.5 || along > range) continue;
        const perp = Math.abs(dx * Math.cos(a) - dz * Math.sin(a));
        if (perp < 1.1 && along < bestD) {
          bestD = along;
          best = ped;
        }
      }
      if (best) {
        const hx2 = ox + Math.sin(a) * bestD;
        const hz2 = oz + Math.cos(a) * bestD;
        this.tracers[this.tracers.length - 1].x2 = hx2;
        this.tracers[this.tracers.length - 1].z2 = hz2;
        if (best.hurt(w.damage)) {
          this.registerKill(game, best);
          victims.push(best);
        }
      }
      // Police cars can be hit too: damage slows them, enough hits stop them.
      for (const unit of game.police.units) {
        const dx = unit.x - ox;
        const dz = unit.z - oz;
        const along = dx * Math.sin(a) + dz * Math.cos(a);
        if (along < 0.5 || along > range) continue;
        const perp = Math.abs(dx * Math.cos(a) - dz * Math.sin(a));
        if (perp < 2.2) {
          unit.speed *= 0.6;
          unit.stuck = 0.4;
        }
      }
    }
    game.audio.playSfx(w.id === 'shotgun' ? 'shotgun' : 'pistol');
    game.crowd.scareAll(p.x, p.z);
    if (game.police.wanted < 2) game.police.addHeat(2, p);
    else game.police.addHeat(0, p);
    return victims;
  }

  /** Record a kill for the mission counter, stats and achievements. */
  registerKill(game, ped) {
    this.kills += 1;
    this.killsInMission += 1;
    this.lastVictim = ped;
    game.stats.kills = this.kills;
    if (game.effects) game.effects.hitPuff(ped.x, 1.2, ped.z);
    game.achievements.check('kills', this.kills);
    if (ped.guard) game.achievements.check('guard', this.kills);
  }

  /** Step cooldowns, muzzle flash and tracer lifetimes. */
  step(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
  }

  /** Aim angle: where Raka is facing (camera-relative when driving). */
  aimAngle(player) {
    return player.angle;
  }
}

/** Enemy health bar helper: a guard's remaining health as 0..1. */
export function healthFrac(ped) {
  return Math.max(0, ped.health / (ped.guard ? 120 : 100));
}

/** An ammo pickup on the ground: pistol or shotgun rounds. */
export class AmmoPickup {
  constructor(x, z, kind) {
    this.x = x;
    this.z = z;
    this.kind = kind; // 'pistol' | 'shotgun'
    this.amount = kind === 'shotgun' ? 12 : 36;
    this.bob = 0;
    this.taken = false;
  }
}

/** Ammo pickups scattered around the city and the harbour. */
export const AMMO_SPOTS = [
  { x: 40, z: 150, kind: 'pistol' },
  { x: 252, z: 210, kind: 'shotgun' },
  { x: 150, z: 250, kind: 'shotgun' },
  { x: -180, z: 40, kind: 'pistol' },
  { x: 60, z: -40, kind: 'pistol' },
  { x: 200, z: 170, kind: 'shotgun' },
  { x: -40, z: -252, kind: 'pistol' },
  { x: 118, z: -8, kind: 'pistol' },
];

/** The ammo pickup system: spawn, draw data and collection. */
export class AmmoPickups {
  constructor() {
    this.list = AMMO_SPOTS.map((s) => new AmmoPickup(s.x, s.z, s.kind));
    this.respawnTimer = 0;
  }

  /** Collect pickups the player walks over; returns how many were taken. */
  step(dt, game) {
    let taken = 0;
    const p = game.player;
    for (const a of this.list) {
      if (a.taken) continue;
      a.bob += dt * 2;
      const dx = a.x - p.x;
      const dz = a.z - p.z;
      if (dx * dx + dz * dz < 2 * 2) {
        a.taken = true;
        taken += 1;
        game.combat.ammo[a.kind] += a.amount;
        game.combat.reserve[a.kind] += a.amount;
        game.audio.playSfx('pickup');
        game.dialogue.sayNow('Raka', `Amunisi ${a.kind}: +${a.amount}.`);
      }
    }
    // Taken pickups respawn after a while so the city never runs dry.
    this.respawnTimer += dt;
    if (this.respawnTimer > 90) {
      this.respawnTimer = 0;
      for (const a of this.list) a.taken = false;
    }
    return taken;
  }
}
