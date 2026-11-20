// weather.js — Sky, sun and rain over Tanjung Matahari.
// The game clock runs from golden hour (16:24) through the night and back
// to morning. Sun angle, sky colour, fog and street-light glow all follow
// the clock, so the same street looks different at 17:00 and at 02:00.
// Rain comes in seeded showers with lightning flashes; the renderer reads
// this module every frame to pick its palette. Weather is a state machine,
// not a random switch: a shower lasts minutes, then clears.

import { Rng, clamp, lerp } from './rng.js';
import { CLOCK } from './config.js';

/** Sky palettes keyed by time of day: [sky top, sky horizon, fog, sun]. */
const PALETTES = [
  { hour: 0, top: [0.02, 0.03, 0.10], horizon: [0.08, 0.10, 0.20], fog: [0.05, 0.06, 0.13], sun: [0.9, 0.9, 1.0], ambient: 0.32 },
  { hour: 5, top: [0.05, 0.06, 0.16], horizon: [0.35, 0.22, 0.25], fog: [0.16, 0.14, 0.20], sun: [1.0, 0.55, 0.35], ambient: 0.42 },
  { hour: 7, top: [0.35, 0.60, 0.90], horizon: [0.75, 0.82, 0.92], fog: [0.62, 0.70, 0.82], sun: [1.0, 0.9, 0.7], ambient: 0.75 },
  { hour: 12, top: [0.20, 0.50, 0.92], horizon: [0.65, 0.80, 0.95], fog: [0.60, 0.72, 0.85], sun: [1.0, 0.98, 0.9], ambient: 0.95 },
  { hour: 16, top: [0.25, 0.55, 0.90], horizon: [0.80, 0.75, 0.55], fog: [0.72, 0.68, 0.60], sun: [1.0, 0.75, 0.4], ambient: 0.85 },
  { hour: 17.5, top: [0.35, 0.35, 0.62], horizon: [1.0, 0.55, 0.25], fog: [0.85, 0.55, 0.35], sun: [1.0, 0.55, 0.2], ambient: 0.62 },
  { hour: 18.5, top: [0.10, 0.12, 0.30], horizon: [0.55, 0.25, 0.30], fog: [0.35, 0.22, 0.28], sun: [1.0, 0.4, 0.25], ambient: 0.45 },
  { hour: 20, top: [0.02, 0.03, 0.10], horizon: [0.10, 0.10, 0.22], fog: [0.07, 0.07, 0.14], sun: [0.9, 0.9, 1.0], ambient: 0.34 },
  { hour: 24, top: [0.02, 0.03, 0.10], horizon: [0.08, 0.10, 0.20], fog: [0.05, 0.06, 0.13], sun: [0.9, 0.9, 1.0], ambient: 0.32 },
];

/** Interpolate between two palettes. */
function mixPalette(a, b, t) {
  const mix = (x, y) => [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];
  return {
    top: mix(a.top, b.top),
    horizon: mix(a.horizon, b.horizon),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    ambient: lerp(a.ambient, b.ambient, t),
  };
}

/** Palette for a given hour of the day. */
export function paletteForHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < PALETTES.length - 1; i += 1) {
    const a = PALETTES[i];
    const b = PALETTES[i + 1];
    if (h >= a.hour && h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour || 1);
      return mixPalette(a, b, t);
    }
  }
  return mixPalette(PALETTES[PALETTES.length - 2], PALETTES[PALETTES.length - 1], 0);
}

/** Sun direction for a given hour: rises east, sets west. */
export function sunDirection(hour) {
  const h = ((hour % 24) + 24) % 24;
  const dayFrac = (h - CLOCK.sunrise) / (CLOCK.sunset - CLOCK.sunrise);
  const ang = Math.PI * clamp(dayFrac, 0, 1);
  const elev = Math.sin(ang) * 0.9 + 0.08;
  return [Math.cos(ang) * 0.8, elev, 0.35];
}

/** True when the sun is below the horizon. */
export function isNight(hour) {
  const h = ((hour % 24) + 24) % 24;
  return h < CLOCK.sunrise || h > CLOCK.sunset;
}

/** One rain streak, drawn by the renderer as a falling line. */
export class RainDrop {
  constructor(x, y, z, speed) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.speed = speed;
  }
}

/** The weather system: clock, rain showers and lightning. */
export class Weather {
  constructor(seed) {
    this.rng = new Rng(seed + 303);
    this.hour = CLOCK.startHour;
    this.raining = false;
    this.rainAmount = 0; // 0..1
    this.rainTimer = 40 + this.rng.range(0, 60);
    this.lightning = 0; // flash intensity 0..1, decays fast
    this.lightningTimer = 0;
    this.lastStrike = null; // {x, z, t} of the most recent strike
    // Wind: direction and strength, changing slowly over minutes.
    this.windAngle = this.rng.angle();
    this.windSpeed = this.rng.range(1, 4);
    this.windTimer = 60;
    // Fog: denser at dawn and in the rain.
    this.fogDensity = 0.35;
    this.clouds = [];
    for (let i = 0; i < 10; i += 1) {
      this.clouds.push({
        x: this.rng.range(-300, 300),
        z: this.rng.range(-300, 300),
        s: this.rng.range(30, 70),
        v: this.rng.range(1.5, 4),
      });
    }
    this.drops = [];
    for (let i = 0; i < 240; i += 1) {
      this.drops.push(new RainDrop(this.rng.range(-60, 60), this.rng.range(0, 30), this.rng.range(-60, 60), this.rng.range(18, 30)));
    }
  }

  /** Current sky palette. */
  palette() {
    const p = paletteForHour(this.hour);
    if (this.raining) {
      const f = this.rainAmount * 0.45;
      p.top = [p.top[0] * (1 - f), p.top[1] * (1 - f), p.top[2] * (1 - f)];
      p.horizon = [p.horizon[0] * (1 - f), p.horizon[1] * (1 - f), p.horizon[2] * (1 - f)];
      p.ambient *= 1 - f * 0.4;
    }
    if (this.lightning > 0.05) {
      const l = this.lightning * 0.5;
      p.top = [Math.min(1, p.top[0] + l), Math.min(1, p.top[1] + l), Math.min(1, p.top[2] + l)];
      p.ambient = Math.min(1.2, p.ambient + l);
    }
    return p;
  }

  /** True when it is night right now. */
  get night() {
    return isNight(this.hour);
  }

  /** Step the clock, the rain state machine and the lightning. */
  step(dt, player) {
    this.hour += dt / CLOCK.secondsPerHour;
    if (this.hour >= 24) this.hour -= 24;
    this.rainTimer -= dt;
    if (this.rainTimer <= 0) {
      this.raining = !this.raining;
      this.rainTimer = this.raining ? this.rng.range(50, 140) : this.rng.range(90, 260);
    }
    const target = this.raining ? 1 : 0;
    this.rainAmount += (target - this.rainAmount) * Math.min(1, dt * 0.4);
    if (this.raining && this.rainAmount > 0.6) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightning = 1;
        this.lightningTimer = this.rng.range(4, 14);
        // A lightning strike lands somewhere near the city centre.
        this.lastStrike = {
          x: this.rng.range(-200, 200),
          z: this.rng.range(-200, 200),
          t: 0,
        };
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 4);
    // Wind shifts slowly; fog follows the hour and the rain.
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = this.rng.range(45, 120);
      this.windAngle += this.rng.range(-0.8, 0.8);
      this.windSpeed = this.rng.range(0.5, 6);
    }
    const h = ((this.hour % 24) + 24) % 24;
    const dawnFog = (h > 4 && h < 8) ? 0.25 : 0;
    const targetFog = 0.3 + dawnFog + this.rainAmount * 0.4;
    this.fogDensity += (targetFog - this.fogDensity) * Math.min(1, dt * 0.2);
    for (const c of this.clouds) {
      c.x += (c.v + Math.sin(this.windAngle) * this.windSpeed) * dt;
      c.z += Math.cos(this.windAngle) * this.windSpeed * dt * 0.4;
      if (c.x > 340) c.x = -340;
      if (c.z > 340) c.z = -340;
      if (c.z < -340) c.z = 340;
    }
    if (this.rainAmount > 0.02) {
      for (const d of this.drops) {
        d.y -= d.speed * dt;
        if (d.y < 0) {
          d.y = 28;
          d.x = player.x + this.rng.range(-60, 60);
          d.z = player.z + this.rng.range(-60, 60);
        }
      }
    }
  }

  /** Force a weather state (used by screenshot staging). */
  setState(hour, raining) {
    this.hour = hour;
    this.raining = raining;
    this.rainAmount = raining ? 1 : 0;
    this.lightning = 0;
  }

  /** Fog near/far distances for the renderer, from the fog density. */
  fogRange() {
    const near = 70 - this.fogDensity * 30;
    const far = 340 - this.fogDensity * 160;
    return { near: Math.max(30, near), far: Math.max(140, far) };
  }

  /** A short weather description for the HUD clock line. */
  describe() {
    if (this.raining) return this.lightning > 0.3 ? 'badai petir' : 'hujan';
    if (this.fogDensity > 0.55) return 'berkabut';
    if (this.windSpeed > 4.5) return 'berangin';
    const h = ((this.hour % 24) + 24) % 24;
    if (h >= 17 && h < 19) return 'senja emas';
    if (this.night) return 'cerah malam';
    return 'cerah';
  }

  /** Moon phase 0..1 for the night sky (a slow 28-day cycle in game time). */
  moonPhase() {
    return ((this.hour / 24) % 28) / 28;
  }

  /** A fresh lightning strike to show, or null. Consumes the strike. */
  takeStrike() {
    const s = this.lastStrike;
    this.lastStrike = null;
    return s;
  }
}
