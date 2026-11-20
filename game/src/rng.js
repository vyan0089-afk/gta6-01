// rng.js — Seeded random numbers for Tanjung Matahari.
//
// Every random choice in the city (building heights, traffic colours, pedestrian
// outfits, radio jingles) comes from one seeded generator, so the same seed always
// builds the same city. The generator is a small mulberry32-style hash: cheap,
// deterministic, and good enough for a game world. Nothing here touches the
// network or the clock; the seed is the only input.

/** Make a new generator from any 32-bit seed. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function nextUint32() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  return {
    /** Next raw 32-bit unsigned integer. */
    nextUint32,
    /** Next float in [0, 1). */
    next() {
      return nextUint32() / 4294967296;
    },
    /** Next float in [min, max). */
    range(min, max) {
      return min + (max - min) * (nextUint32() / 4294967296);
    },
    /** Next integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor((nextUint32() / 4294967296) * (max - min + 1));
    },
    /** True with probability p (0..1). */
    chance(p) {
      return (nextUint32() / 4294967296) < p;
    },
    /** Pick one element of a non-empty array. */
    pick(list) {
      return list[Math.floor((nextUint32() / 4294967296) * list.length)];
    },
    /** Pick `count` distinct elements, in order, from a list. */
    pickMany(list, count) {
      const copy = list.slice();
      const out = [];
      for (let i = 0; i < count && copy.length > 0; i += 1) {
        const at = Math.floor((nextUint32() / 4294967296) * copy.length);
        out.push(copy.splice(at, 1)[0]);
      }
      return out;
    },
    /** Shuffle a copy of a list (Fisher-Yates). */
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor((nextUint32() / 4294967296) * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    /** A random angle in radians, 0..2*pi. */
    angle() {
      return (nextUint32() / 4294967296) * Math.PI * 2;
    },
    /** A random unit-ish 2D direction as {x, z}. */
    direction() {
      const a = (nextUint32() / 4294967296) * Math.PI * 2;
      return { x: Math.cos(a), z: Math.sin(a) };
    },
    /** A random pastel-ish colour as [r, g, b] floats 0..1. */
    pastel() {
      const base = 0.45 + (nextUint32() / 4294967296) * 0.4;
      return [
        Math.min(1, base + (nextUint32() / 4294967296) * 0.3),
        Math.min(1, base + (nextUint32() / 4294967296) * 0.3),
        Math.min(1, base + (nextUint32() / 4294967296) * 0.3),
      ];
    },
  };
}

/** Hash a short string into a 32-bit seed (FNV-1a). */
export function seedFromString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference from `from` to `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Distance between two points on the ground plane. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Format a distance in metres as "123 m" or "1.2 km". */
export function formatDistance(metres) {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

/** Format a money amount as Indonesian rupiah-ish "Rp 12.500". */
export function formatMoney(amount) {
  const n = Math.max(0, Math.round(amount));
  return `Rp ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Format seconds of play as "12:34". */
export function formatClock(totalSeconds) {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
