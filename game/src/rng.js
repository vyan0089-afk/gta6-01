// rng.js — Seeded random numbers for Tanjung Matahari.
// Every random choice in the world comes from one mulberry32 stream, so the
// same seed always builds the same city, the same traffic and the same crowds.
// Nothing in the game calls Math.random: determinism is a feature, not a hope.
// mulberry32 is a tiny public-domain style hash PRNG; the implementation here
// is written fresh for this game from the algorithm's well-known description.

/** Make a mulberry32 generator from an integer seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small helper object wrapping one stream with the draws the game needs. */
export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }

  /** Uniform float in [0, 1). */
  float() {
    return this.next();
  }

  /** Uniform float in [min, max). */
  range(min, max) {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }

  /** Pick one element of an array. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Pick one element, removing it from the array. */
  take(list) {
    if (list.length === 0) return undefined;
    return list.splice(Math.floor(this.next() * list.length), 1)[0];
  }

  /** A new independent stream derived from this one. */
  fork() {
    return new Rng(Math.floor(this.next() * 2147483647) + 1);
  }

  /** Shuffle a copy of an array and return it. */
  shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Gaussian-ish value in [-1, 1] from three uniform draws. */
  bell() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }

  /** A random angle in radians. */
  angle() {
    return this.next() * Math.PI * 2;
  }
}

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep easing in [0, 1]. */
export function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Shortest signed angular difference from a to b, in radians. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move angle a toward b by at most step radians. */
export function angleToward(a, b, step) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

/** Distance between two points on the ground plane. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Format an integer with thousands separators (Indonesian style dots). */
export function fmtMoney(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Format seconds as mm:ss. */
export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

/** Format a 24h clock hour as HH:MM. */
export function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** Weighted choice from [value, weight] pairs. */
export function weightedPick(rng, pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let roll = rng.float() * total;
  for (const [v, w] of pairs) {
    roll -= w;
    if (roll <= 0) return v;
  }
  return pairs[0][0];
}

/** Ease-out cubic for UI animations. */
export function easeOut(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

/** Ease-in-out quadratic for camera moves. */
export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Angle of the vector from (ax, az) to (bx, bz), in the game's convention. */
export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

/** Move a point toward a target by at most step metres. */
export function moveToward(x, z, tx, tz, step) {
  const dx = tx - x;
  const dz = tz - z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= step || d === 0) return { x: tx, z: tz, arrived: true };
  return { x: x + (dx / d) * step, z: z + (dz / d) * step, arrived: false };
}

/** True when two circles on the ground overlap. */
export function circlesOverlap(ax, az, ar, bx, bz, br) {
  const dx = ax - bx;
  const dz = az - bz;
  const r = ar + br;
  return dx * dx + dz * dz < r * r;
}
