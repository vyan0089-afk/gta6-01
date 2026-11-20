// rng.js — seeded randomness for Tanjung Matahari.
//
// Everything random in the game — the city layout, traffic mix, pedestrian
// clothes, police chatter — comes from here, never from Math.random().
// Hand the same seed to buildCity() and you get the same streets, the same
// buildings, the same traffic, every single time. That is what makes the
// screenshots deterministic and the city fair to play in.

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

// FNV-1a over a string: turns a human-readable seed like
// 'tanjung-matahari-1' into a 32-bit number the generator can use.
export function hashString(str) {
  let h = FNV_OFFSET >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

// mulberry32: a tiny, fast, well-behaved PRNG. The state is one 32-bit word;
// each call stirs it and returns a float in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A friendly wrapper around a mulberry32 stream, with the helpers the game
// actually reaches for: ranges, integer rolls, picks, weighted picks,
// coin flips and shuffles.
export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed >>> 0);
  }

  // Raw float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max], both ends included.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // One element of an array, uniformly.
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Pick from [value, weight] pairs. Heavier entries win more often — this
  // is how sedans outnumber trucks on Tanjung's streets.
  weightedPick(entries) {
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= w;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // True or false, fifty-fifty.
  bool() {
    return this.next() < 0.5;
  }

  // +1 or -1, fifty-fifty: handy for picking a side of the road.
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  // Fisher-Yates shuffle. Returns a new array; the input is untouched.
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // A signed float in [-amount, amount]: handy for jitter and scatter.
  jitter(amount) {
    return (this.next() * 2 - 1) * amount;
  }
}
