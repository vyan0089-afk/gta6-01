// world.js — The city of Tanjung Matahari, generated from a fixed seed.
// A grid of roads every 64 m, blocks filled with shophouses, towers, villas
// and market stalls, a beach and sea to the south, a harbour to the east and
// a hill district to the north. Generation is pure and seeded: the same seed
// always builds the same city, and the renderer only ever draws what this
// module describes. Buildings carry their district, height, colour and a
// window pattern so the renderer can shade them without any texture file.

import { Rng, clamp } from './rng.js';
import { WORLD, DISTRICTS, STREETS_NS, STREETS_EW, KERIS_SPOTS, TOUR_SPOTS, STALLS, BILLBOARDS } from './config.js';
import { hash2 } from './math3.js';

/** Road lines: roads run at x and z = -288, -224, ... 288 (every 64 m). */
export const ROAD_LINES = [];
for (let v = -288; v <= 288; v += 64) ROAD_LINES.push(v);

/** Snap a coordinate to the nearest road line. */
export function nearestRoadLine(v) {
  let best = ROAD_LINES[0];
  let bestD = Infinity;
  for (const line of ROAD_LINES) {
    const d = Math.abs(line - v);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

/** True when (x, z) is on a road (within the asphalt half-width). */
export function isOnRoad(x, z) {
  const hw = WORLD.roadWidth / 2 + 1;
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < hw || Math.abs(z - line) < hw) return true;
  }
  return false;
}

/** True when (x, z) is on the beach or in the sea. */
export function isBeach(x, z) {
  return z > WORLD.beachZ - 28 && z <= WORLD.beachZ;
}

/** True when (x, z) is in the sea. */
export function isSea(x, z) {
  return z > WORLD.beachZ;
}

/** Which district contains (x, z); falls back to the nearest one. */
export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.cx;
    const dz = z - d.cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

/** Street name for (x, z): the nearest road line names the street. */
export function streetAt(x, z) {
  const dx = Math.abs(x - nearestRoadLine(x));
  const dz = Math.abs(z - nearestRoadLine(z));
  if (dx <= dz) {
    const idx = Math.abs(Math.round((nearestRoadLine(x) + 288) / 64)) % STREETS_NS.length;
    return STREETS_NS[idx];
  }
  const idx = Math.abs(Math.round((nearestRoadLine(z) + 288) / 64)) % STREETS_EW.length;
  return STREETS_EW[idx];
}

/** A building: position, footprint, height, colour and district. */
export class Building {
  constructor(x, z, w, d, h, colour, district, kind) {
    this.x = x;
    this.z = z;
    this.w = w;
    this.d = d;
    this.h = h;
    this.colour = colour;
    this.district = district;
    this.kind = kind; // 'shophouse' | 'tower' | 'villa' | 'stall' | 'warehouse' | 'mosque' | 'tower-clock'
    this.seed = hash2(Math.round(x), Math.round(z));
    this.roof = this.seed > 0.6 ? '#8a4a3a' : this.seed > 0.3 ? '#3a4a5a' : '#5a6b7a';
    this.lit = this.seed > 0.5;
  }
}

/** A palm tree on the beach or along the boulevard. */
export class Palm {
  constructor(x, z, h, lean) {
    this.x = x;
    this.z = z;
    this.h = h;
    this.lean = lean;
  }
}

/** A street light pole. */
export class Lamp {
  constructor(x, z) {
    this.x = x;
    this.z = z;
  }
}

/** A boat in the harbour or out at sea. */
export class Boat {
  constructor(x, z, angle, kind, colour) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.kind = kind; // 'fishing' | 'ferry' | 'speed'
    this.colour = colour;
    this.bob = 0;
    this.speed = 0;
  }
}

/** A traffic light at an intersection. */
export class TrafficLight {
  constructor(x, z, axis) {
    this.x = x;
    this.z = z;
    this.axis = axis; // 'ns' | 'ew'
    this.phase = 0; // 0 green ns, 1 amber, 2 green ew, 3 amber
    this.timer = 0;
  }
}

/**
 * Build the whole city from the seed. Returns an object with buildings,
 * palms, lamps, boats, traffic lights, keris spots and tour spots.
 */
export function buildWorld(seed) {
  const rng = new Rng(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const boats = [];
  const lights = [];

  const shopColours = ['#e8c9a0', '#d8a86a', '#c98a5a', '#e0b890', '#b8d8c8', '#d8d8b8', '#e8a8a0', '#a8c8d8'];
  const towerColours = ['#8aa8c8', '#a8b8c8', '#c8a878', '#7a9ab8', '#b8a8c8'];
  const villaColours = ['#f0e8d8', '#e8d8c8', '#d8e8d8', '#f0d8c8'];

  // City blocks: between road lines, fill with buildings by district.
  for (let bx = -288; bx < 288; bx += 64) {
    for (let bz = -288; bz < 288; bz += 64) {
      const cx = bx + 32;
      const cz = bz + 32;
      if (cz > 240) continue; // beach strip stays open
      const district = districtAt(cx, cz);
      const roll = rng.float();
      if (district.id === 'pantai' && roll < 0.35) {
        // Beachfront: low stalls and open sand.
        buildings.push(new Building(cx - 12, cz, 16, 10, 4, '#e8c9a0', district, 'stall'));
        buildings.push(new Building(cx + 14, cz + 6, 14, 9, 4, '#d8a86a', district, 'stall'));
        continue;
      }
      if (district.id === 'pasar' && roll < 0.5) {
        // Night market: rows of small stalls around a courtyard.
        for (let s = 0; s < 5; s += 1) {
          buildings.push(new Building(cx - 18 + s * 9, cz - 14, 7, 6, 3.2, shopColours[rng.int(0, shopColours.length - 1)], district, 'stall'));
          buildings.push(new Building(cx - 18 + s * 9, cz + 14, 7, 6, 3.2, shopColours[rng.int(0, shopColours.length - 1)], district, 'stall'));
        }
        continue;
      }
      if (district.id === 'pelabuhan' && roll < 0.45) {
        buildings.push(new Building(cx, cz, 34, 18, 9, '#7a8a9a', district, 'warehouse'));
        continue;
      }
      if (district.id === 'bukit') {
        // Hill villas: one big house per block, gardens around it.
        buildings.push(new Building(cx, cz, 22, 16, 7 + rng.range(0, 4), villaColours[rng.int(0, villaColours.length - 1)], district, 'villa'));
        continue;
      }
      if (roll < 0.12) {
        // A tower rises above the shophouses.
        buildings.push(new Building(cx, cz, 20, 20, 26 + rng.range(0, 22), towerColours[rng.int(0, towerColours.length - 1)], district, 'tower'));
      } else {
        // Shophouses: two or three per block, facing the road.
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i += 1) {
          const ox = -14 + i * 15 + rng.range(-2, 2);
          const oz = rng.chance(0.5) ? -12 : 12;
          buildings.push(new Building(cx + ox, cz + oz, 12, 11, 6 + rng.range(0, 7), shopColours[rng.int(0, shopColours.length - 1)], district, 'shophouse'));
        }
      }
    }
  }

  // Landmarks, placed by hand so missions can find them.
  buildings.push(new Building(8, -92, 10, 10, 30, '#e8d8b8', districtAt(8, -92), 'tower-clock'));
  buildings.push(new Building(118, -8, 26, 20, 12, '#f0f0e8', districtAt(118, -8), 'mosque'));
  buildings.push(new Building(60, -40, 24, 16, 10, '#e8d8b8', districtAt(60, -40), 'shophouse'));
  buildings.push(new Building(200, 40, 8, 30, 6, '#d84a4a', districtAt(200, 40), 'shophouse'));

  // Palms along the beach and the boulevard.
  for (let x = -290; x <= 290; x += 18) {
    if (rng.chance(0.75)) palms.push(new Palm(x + rng.range(-4, 4), 262 + rng.range(-6, 10), 7 + rng.range(0, 3), rng.range(-0.15, 0.15)));
    if (rng.chance(0.4)) palms.push(new Palm(x + rng.range(-4, 4), 232 + rng.range(-3, 3), 6 + rng.range(0, 3), rng.range(-0.12, 0.12)));
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push(new Palm(rng.range(-280, 280), rng.range(-280, 220), 6 + rng.range(0, 3), rng.range(-0.15, 0.15)));
  }

  // Street lamps at every other intersection.
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      if ((Math.round(lx / 64) + Math.round(lz / 64)) % 2 === 0 && lz < 250) {
        lamps.push(new Lamp(lx + 9, lz + 9));
      }
    }
  }

  // Boats: fishing boats near the piers, a ferry and speedboats out at sea.
  for (let i = 0; i < 8; i += 1) {
    boats.push(new Boat(190 + rng.range(-40, 60), 292 + rng.range(0, 26), rng.angle(), 'fishing', rng.pick(['#c81e1e', '#2e6fc8', '#e8b73c', '#4a7ad8'])));
  }
  boats.push(new Boat(60, 305, Math.PI * 0.5, 'ferry', '#e8e8e8'));
  boats.push(new Boat(-60, 310, Math.PI * 0.9, 'ferry', '#d8b13c'));
  for (let i = 0; i < 3; i += 1) {
    boats.push(new Boat(rng.range(-200, 200), 300 + rng.range(0, 18), rng.angle(), 'speed', rng.pick(['#c81e1e', '#1e5dc8', '#e8e8e8'])));
  }

  // Traffic lights at the busiest intersections.
  const lightSpots = [
    [0, 0, 'ns'], [64, 0, 'ew'], [-64, 64, 'ns'], [128, 128, 'ew'],
    [-128, -64, 'ns'], [64, -128, 'ew'], [0, 192, 'ns'], [-192, 128, 'ew'],
  ];
  for (const [x, z, axis] of lightSpots) lights.push(new TrafficLight(x, z, axis));

  // Keris spots and tour spots are fixed data, copied fresh per world.
  const keris = KERIS_SPOTS.map((k) => ({ ...k, found: false }));
  const tours = TOUR_SPOTS.map((t) => ({ ...t, visited: false }));

  // Street props: market stalls, food carts, benches and billboards.
  const stalls = [];
  const carts = [];
  const benches = [];
  const billboards = [];
  for (let i = 0; i < STALLS.length; i += 1) {
    const stall = STALLS[i];
    stalls.push(new StallProp(16 + i * 12, 138 + (i % 2) * 24, 0, stall));
    stalls.push(new StallProp(64 + i * 8, 168 - (i % 2) * 10, Math.PI / 2, stall));
  }
  for (let i = 0; i < 6; i += 1) {
    carts.push(new FoodCart(-200 + i * 26, 244 + (i % 2) * 8, Math.PI / 2, STALLS[i % STALLS.length]));
  }
  const benchSpots = [
    [-40, 60, 0], [-20, 60, 0], [60, -110, 0], [80, -110, Math.PI], [118, -20, 0],
    [-120, 250, Math.PI / 2], [-96, 250, Math.PI / 2], [200, 210, 0], [8, -80, 0],
  ];
  for (const [x, z, a] of benchSpots) benches.push(new Bench(x, z, a));
  for (const board of BILLBOARDS) billboards.push(new Billboard(board.x, board.z, 0, board));

  return { buildings, palms, lamps, boats, lights, keris, tours, rng, stalls, carts, benches, billboards };
}

/** A market stall prop: a small roofed cart with a sign colour. */
export class StallProp {
  constructor(x, z, angle, stall) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.stall = stall;
    this.name = stall.name;
    this.colour = stall.colour;
  }
}

/** A bench in a park or square. */
export class Bench {
  constructor(x, z, angle) {
    this.x = x;
    this.z = z;
    this.angle = angle;
  }
}

/** A billboard on a pole over a road. */
export class Billboard {
  constructor(x, z, angle, board) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.text = board.text;
    this.sub = board.sub;
    this.colour = board.colour;
  }
}

/** A food cart with wheels, pushed around the market and beach. */
export class FoodCart {
  constructor(x, z, angle, stall) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.stall = stall;
  }
}

/** Clamp a position inside the drivable world (sea edge blocks cars). */
export function clampToWorld(x, z, margin) {
  const m = WORLD.half - (margin || 6);
  return {
    x: clamp(x, -m, m),
    z: clamp(z, -m, WORLD.beachZ + (margin || 6)),
  };
}

/** Find the nearest building to (x, z) within maxDist, or null. */
export function nearestBuilding(buildings, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const b of buildings) {
    const d = Math.sqrt((b.x - x) * (b.x - x) + (b.z - z) * (b.z - z));
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** A waypoint on a road near (x, z), snapped to the road grid. */
export function roadPoint(x, z) {
  return { x: nearestRoadLine(x), z: nearestRoadLine(z) };
}

/** Random road point, for spawning traffic and pedestrians. */
export function randomRoadPoint(rng) {
  const horizontal = rng.chance(0.5);
  const line = rng.pick(ROAD_LINES);
  const along = rng.range(-280, 280);
  return horizontal ? { x: along, z: line } : { x: line, z: along };
}

/** The narrow alleys of Gang Sanca: shortcuts only a local knows. */
export const ALLEYS = [
  { x1: -208, z1: 8, x2: -152, z2: 8, name: 'Gang Sempit' },
  { x1: -208, z1: 72, x2: -152, z2: 72, name: 'Gang Belakang' },
  { x1: -176, z1: -24, x2: -176, z2: 104, name: 'Gang Sanca Utama' },
  { x1: 8, z1: 120, x2: 72, z2: 120, name: 'Gang Pasar' },
];

/** True when (x, z) is inside one of the alleys. */
export function inAlley(x, z) {
  for (const a of ALLEYS) {
    const minX = Math.min(a.x1, a.x2) - 3;
    const maxX = Math.max(a.x1, a.x2) + 3;
    const minZ = Math.min(a.z1, a.z2) - 3;
    const maxZ = Math.max(a.z1, a.z2) + 3;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return a;
  }
  return null;
}

/** Simple building collision: push a circle out of a building's footprint. */
export function collideBuildings(buildings, x, z, radius) {
  let nx = x;
  let nz = z;
  for (const b of buildings) {
    const hx = b.w / 2 + radius;
    const hz = b.d / 2 + radius;
    const dx = nx - b.x;
    const dz = nz - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const pushX = hx - Math.abs(dx);
      const pushZ = hz - Math.abs(dz);
      if (pushX < pushZ) nx = b.x + Math.sign(dx || 1) * hx;
      else nz = b.z + Math.sign(dz || 1) * hz;
    }
  }
  return { x: nx, z: nz };
}

/** A point on the beach road, for spawning the player and races. */
export function beachRoadPoint(x) {
  return { x, z: 256 };
}
