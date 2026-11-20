// effects.js — Particles, skid marks and screen shake for Tanjung Matahari.
// The city feels alive when actions leave a trace: tyre smoke on a
// handbrake turn, dust behind a sprint, sparks from a bullet impact, golden
// sparkles on a keris pickup, exhaust puffs and the blue nitro flame. All
// effects are tiny boxes in the same WebGL buffer as everything else, so
// they cost almost nothing and need no texture. Skid marks are flat dark
// quads that fade slowly; the camera shake is a small decaying offset the
// renderer adds to the eye position.

import { Rng } from './rng.js';

/** One particle: a small coloured box with velocity, life and gravity. */
export class Particle {
  constructor(x, y, z, vx, vy, vz, life, size, colour) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.colour = colour;
    this.gravity = 0;
  }

  /** Fade factor 0..1 over the particle's life. */
  fade() {
    return Math.max(0, this.life / this.maxLife);
  }
}

/** One skid mark: a flat dark quad on the road that fades over a minute. */
export class SkidMark {
  constructor(x, z, angle, length) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.length = length;
    this.life = 60;
  }
}

/** Floating world text: a pickup label the HUD shows near the player. */
export class FloatText {
  constructor(text, x, z, colour) {
    this.text = text;
    this.x = x;
    this.z = z;
    this.colour = colour;
    this.life = 2.2;
  }
}

/** The effects system: spawn, step and draw. */
export class Effects {
  constructor(seed) {
    this.rng = new Rng(seed + 505);
    this.particles = [];
    this.skids = [];
    this.floats = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.maxParticles = 420;
  }

  /** Add one particle, dropping the oldest when the pool is full. */
  add(p) {
    if (this.particles.length >= this.maxParticles) this.particles.shift();
    this.particles.push(p);
  }

  /** A burst of dust at (x, z) on the ground. */
  dust(x, z, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.angle();
      const s = this.rng.range(0.5, 2.2);
      this.add(new Particle(
        x + this.rng.range(-0.5, 0.5), 0.3, z + this.rng.range(-0.5, 0.5),
        Math.sin(a) * s, this.rng.range(0.4, 1.4), Math.cos(a) * s,
        this.rng.range(0.4, 0.9), this.rng.range(0.2, 0.45), '#b8a888',
      ));
    }
  }

  /** Tyre smoke: grey-white puffs that rise and drift. */
  tyreSmoke(x, z) {
    for (let i = 0; i < 2; i += 1) {
      const p = new Particle(
        x + this.rng.range(-0.6, 0.6), 0.4, z + this.rng.range(-0.6, 0.6),
        this.rng.range(-0.4, 0.4), this.rng.range(0.8, 1.6), this.rng.range(-0.4, 0.4),
        this.rng.range(0.6, 1.2), this.rng.range(0.4, 0.8), '#c8c8c8',
      );
      p.gravity = -0.4;
      this.add(p);
    }
  }

  /** Exhaust puff from a car. */
  exhaust(x, z, angle) {
    const bx = x - Math.sin(angle) * 2.2;
    const bz = z - Math.cos(angle) * 2.2;
    const p = new Particle(
      bx, 0.5, bz,
      -Math.sin(angle) * 1.5 + this.rng.range(-0.3, 0.3), 0.7, -Math.cos(angle) * 1.5 + this.rng.range(-0.3, 0.3),
      0.7, 0.35, '#8a8a8a',
    );
    p.gravity = -0.3;
    this.add(p);
  }

  /** Sparks from a bullet impact or a crash. */
  sparks(x, y, z, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.angle();
      const s = this.rng.range(2, 7);
      const p = new Particle(
        x, y, z,
        Math.sin(a) * s, this.rng.range(1, 5), Math.cos(a) * s,
        this.rng.range(0.2, 0.5), this.rng.range(0.08, 0.16), '#ffd94a',
      );
      p.gravity = 9;
      this.add(p);
    }
  }

  /** Golden sparkles for a keris pickup. */
  kerisSparkle(x, z) {
    for (let i = 0; i < 16; i += 1) {
      const a = this.rng.angle();
      const r = this.rng.range(0.3, 1.4);
      const p = new Particle(
        x + Math.sin(a) * r, 1.1 + this.rng.range(-0.4, 0.8), z + Math.cos(a) * r,
        Math.sin(a) * 0.8, this.rng.range(1.2, 2.6), Math.cos(a) * 0.8,
        this.rng.range(0.7, 1.4), this.rng.range(0.12, 0.24), '#ffe93c',
      );
      p.gravity = -1.2;
      this.add(p);
    }
  }

  /** Blue nitro flame puffs behind the car. */
  nitroFlame(x, z, angle) {
    for (let i = 0; i < 3; i += 1) {
      const bx = x - Math.sin(angle) * (2.4 + i * 0.5);
      const bz = z - Math.cos(angle) * (2.4 + i * 0.5);
      this.add(new Particle(
        bx + this.rng.range(-0.2, 0.2), 0.5, bz + this.rng.range(-0.2, 0.2),
        -Math.sin(angle) * 3, this.rng.range(0.2, 0.8), -Math.cos(angle) * 3,
        0.3, this.rng.range(0.3, 0.55), i === 0 ? '#3aa8ff' : '#9ad8ff',
      ));
    }
  }

  /** Muzzle smoke after a shot. */
  muzzleSmoke(x, y, z, angle) {
    const p = new Particle(
      x + Math.sin(angle) * 1.2, y, z + Math.cos(angle) * 1.2,
      Math.sin(angle) * 0.6, 0.9, Math.cos(angle) * 0.6,
      0.8, 0.3, '#b8b8b8',
    );
    p.gravity = -0.5;
    this.add(p);
  }

  /** Blood-free impact puff (a hit lands, no gore in this game). */
  hitPuff(x, y, z) {
    for (let i = 0; i < 5; i += 1) {
      this.add(new Particle(
        x + this.rng.range(-0.3, 0.3), y + this.rng.range(-0.2, 0.4), z + this.rng.range(-0.3, 0.3),
        this.rng.range(-1, 1), this.rng.range(0.5, 2), this.rng.range(-1, 1),
        0.5, 0.2, '#e8e8e8',
      ));
    }
  }

  /** Add a skid mark under a sliding car. */
  addSkid(x, z, angle) {
    const last = this.skids[this.skids.length - 1];
    if (last && Math.abs(last.x - x) < 1 && Math.abs(last.z - z) < 1) return;
    this.skids.push(new SkidMark(x, z, angle, 2.2));
    if (this.skids.length > 120) this.skids.shift();
  }

  /** Floating text at a world position. */
  float(text, x, z, colour) {
    this.floats.push(new FloatText(text, x, z, colour || '#ffd94a'));
    if (this.floats.length > 8) this.floats.shift();
  }

  /** Kick the camera shake (crashes, explosions, busts). */
  kick(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Step particles, skids, floats and shake. */
  step(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.1) {
        p.y = 0.1;
        p.vy = 0;
      }
    }
    for (let i = this.skids.length - 1; i >= 0; i -= 1) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i -= 1) {
      this.floats[i].life -= dt;
      if (this.floats[i].life <= 0) this.floats.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.shakeX = (this.rng.float() - 0.5) * this.shake * 0.5;
    this.shakeY = (this.rng.float() - 0.5) * this.shake * 0.35;
  }

  /** Rain splashes where drops hit the ground (called from the weather). */
  rainSplash(x, z) {
    for (let i = 0; i < 3; i += 1) {
      const p = new Particle(
        x + this.rng.range(-0.4, 0.4), 0.15, z + this.rng.range(-0.4, 0.4),
        0, 1.5, 0, 0.3, 0.35, '#b0c8e8',
      );
      p.gravity = -6;
      this.add(p);
    }
  }

  /** A burst of golden confetti for mission completion. */
  confetti(x, z) {
    const colours = ['#e8b73c', '#f0542c', '#4aa8f0', '#ffe93c'];
    for (let i = 0; i < 40; i += 1) {
      const a = this.rng.angle();
      const sp = this.rng.range(2, 6);
      const p = new Particle(
        x, 2, z,
        Math.sin(a) * sp, this.rng.range(3, 7), Math.cos(a) * sp,
        1.4, 0.3, this.rng.pick(colours),
      );
      p.gravity = -5;
      this.add(p);
    }
  }

  /** Skid marks fade slowly; this is how many are alive. */
  skidCount() {
    return this.skids.length;
  }

  /** Current particle count (for tests and the HUD). */
  count() {
    return this.particles.length;
  }
}
