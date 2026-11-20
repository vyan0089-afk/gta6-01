// city.js — Tanjung Matahari, an original sun-soaked Indonesian coastal
// city. One seed builds the same streets, buildings, palms and harbour
// every time: the whole city is a single static mesh plus the collision
// boxes, the road graph and the named places the missions use.
//
// The layout: a 13x13 grid of roads 40 units apart, from -240 to 240.
// South of z = 258 is sand, then the sea. The market sits in the middle,
// the harbour in the south-east, villas in the north-west hills, and the
// old town in the west.

import { Rng, hashString } from './rng.js';
import { MeshBuilder } from './renderer.js';

// Warm sun-soaked palette. All colours are [r, g, b] in 0..1.
export const PALETTE = {
  grass: [0.42, 0.62, 0.30],
  sand: [0.87, 0.78, 0.58],
  asphalt: [0.23, 0.23, 0.26],
  sidewalk: [0.62, 0.60, 0.55],
  water: [0.10, 0.55, 0.62],
  wallCream: [0.93, 0.88, 0.76],
  wallWhite: [0.94, 0.94, 0.90],
  wallTerra: [0.78, 0.48, 0.32],
  wallTeal: [0.35, 0.62, 0.60],
  wallYellow: [0.90, 0.74, 0.42],
  wallPink: [0.88, 0.60, 0.58],
  roofTerra: [0.62, 0.30, 0.20],
  roofTeal: [0.20, 0.45, 0.48],
  roofGrey: [0.45, 0.46, 0.48],
  glass: [0.55, 0.75, 0.80],
  trunk: [0.45, 0.32, 0.20],
  frond: [0.25, 0.55, 0.28],
  lamp: [0.25, 0.25, 0.28],
  lampGlow: [1.0, 0.90, 0.55],
  stallRed: [0.80, 0.25, 0.22],
  stallGreen: [0.25, 0.60, 0.35],
  stallBlue: [0.25, 0.45, 0.75],
  containerRust: [0.75, 0.40, 0.22],
  containerBlue: [0.22, 0.42, 0.65],
  pier: [0.55, 0.42, 0.30],
  boatWhite: [0.92, 0.92, 0.90],
  boatRed: [0.75, 0.28, 0.25],
  sun: [1.0, 0.85, 0.45],
  cloud: [0.98, 0.98, 0.99],
};

export const ROAD_STEP = 40;
export const ROAD_COUNT = 13; // roads at -240, -200, ..., 240
export const CITY_HALF = 260;

export function roadCoords() {
  const out = [];
  for (let i = 0; i < ROAD_COUNT; i++) out.push(-240 + i * ROAD_STEP);
  return out;
}

function pickWall(rng) {
  const walls = [PALETTE.wallCream, PALETTE.wallWhite, PALETTE.wallTerra, PALETTE.wallTeal, PALETTE.wallYellow, PALETTE.wallPink];
  return rng.pick(walls);
}

function pickRoof(rng) {
  return rng.pick([PALETTE.roofTerra, PALETTE.roofTeal, PALETTE.roofGrey]);
}

function addPalm(mesh, x, z, rng) {
  const h = 7 + rng.float() * 3;
  mesh.box(x, h / 2, z, 0.7, h, 0.7, 0, 0, 0, PALETTE.trunk);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng.float() * 0.5;
    mesh.box(x + Math.cos(a) * 1.6, h + 0.4, z + Math.sin(a) * 1.6, 3.6, 0.25, 1.1, 0, -a, 0.5, PALETTE.frond);
  }
}

export function buildCity(seed = 1) {
  const rng = new Rng(hashString('tanjung-matahari-' + seed));
  const mesh = new MeshBuilder();
  const colliders = []; // {x0, z0, x1, z1, h}
  const roads = roadCoords();

  buildGround(mesh);
  buildRoads(mesh, roads);
  buildBlocks(mesh, colliders, roads, rng);
  buildHarbour(mesh, colliders);
  buildPalms(mesh, rng);
  buildWarungs(mesh, colliders);
  buildBeachProps(mesh, colliders, rng);
  buildLighthouse(mesh, colliders);
  buildLamps(mesh, roads);
  buildSky(mesh, rng);
  const graph = buildRoadGraph(roads);
  const locations = namedPlaces();

  return { mesh, colliders, roads, graph, locations, boats: harbourBoats(mesh, rng), seed };
}

// ---- Ground: grass base, sand beach, sea -------------------------------

function buildGround(mesh) {
  mesh.quad([[-900, -900], [900, -900], [900, 900], [-900, 900]], -0.05, PALETTE.grass);
  mesh.quad([[-900, 258], [900, 258], [900, 320], [-900, 320]], 0.0, PALETTE.sand);
  mesh.quad([[-900, 318], [900, 318], [900, 900], [-900, 900]], 0.02, PALETTE.water, 1);
}

// ---- Roads and sidewalks ------------------------------------------------

function buildRoads(mesh, roads) {
  for (const c of roads) {
    // North-south road, with a sidewalk on each side.
    mesh.quad([[c - 5, -260], [c + 5, -260], [c + 5, 260], [c - 5, 260]], 0.05, PALETTE.asphalt);
    mesh.quad([[c - 7, -260], [c - 5, -260], [c - 5, 260], [c - 7, 260]], 0.06, PALETTE.sidewalk);
    mesh.quad([[c + 5, -260], [c + 7, -260], [c + 7, 260], [c + 5, 260]], 0.06, PALETTE.sidewalk);
    // East-west road.
    mesh.quad([[-260, c - 5], [260, c - 5], [260, c + 5], [-260, c + 5]], 0.05, PALETTE.asphalt);
    mesh.quad([[-260, c - 7], [260, c - 7], [260, c - 5], [-260, c - 5]], 0.06, PALETTE.sidewalk);
    mesh.quad([[-260, c + 5], [260, c + 5], [260, c + 7], [-260, c + 7]], 0.06, PALETTE.sidewalk);
  }
}

// ---- Buildings, block by block ------------------------------------------

function districtOf(cx, cz) {
  if (cz > 200) return 'harbor';
  if (cz < -200) return 'villa';
  if (Math.abs(cx) <= 60 && Math.abs(cz) <= 60) return 'market';
  if (cx < -140) return 'oldtown';
  return 'town';
}

function buildBlocks(mesh, colliders, roads, rng) {
  const blockOf = (i, j) => {
    const x0 = roads[i] + 8;
    const x1 = roads[i + 1] - 8;
    const z0 = roads[j] + 8;
    const z1 = roads[j + 1] - 8;
    return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  };

  const addBuilding = (bx, bz, w, d, h, wall, roof) => {
    mesh.box(bx, h / 2, bz, w, h, d, 0, 0, 0, wall);
    // Glass band near the top, then the roof cap.
    mesh.box(bx, h * 0.72, bz, w + 0.06, h * 0.28, d + 0.06, 0, 0, 0, PALETTE.glass);
    mesh.box(bx, h + 0.5, bz, w * 0.82, 1.0, d * 0.82, 0, 0, 0, roof);
    colliders.push({ x0: bx - w / 2, z0: bz - d / 2, x1: bx + w / 2, z1: bz + d / 2, h });
  };

  for (let i = 0; i < ROAD_COUNT - 1; i++) {
    for (let j = 0; j < ROAD_COUNT - 1; j++) {
      const b = blockOf(i, j);
      const district = districtOf(b.cx, b.cz);
      if (district === 'harbor') continue; // handled by buildHarbour
      const roll = rng.float();
      if (district === 'market' && roll < 0.45) {
        buildMarketStalls(mesh, colliders, b, rng);
        continue;
      }
      if (roll < 0.12) {
        buildPark(mesh, colliders, b, rng);
        continue;
      }
      const tall = district === 'town' || district === 'market';
      const n = rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = (b.x1 - b.x0) / n - 3;
        const d = (b.z1 - b.z0) * (district === 'villa' ? 0.55 : 0.8);
        const bx = b.x0 + w / 2 + 1.5 + k * ((b.x1 - b.x0) / n);
        const bz = b.cz + (district === 'villa' ? -4 : 0);
        let h;
        if (district === 'villa') h = rng.range(5, 9);
        else if (district === 'oldtown') h = rng.range(6, 12);
        else if (tall) h = rng.range(10, 34);
        else h = rng.range(8, 18);
        addBuilding(bx, bz, w, d, h, pickWall(rng), pickRoof(rng));
        if (district === 'villa') {
          // Backyard pool behind the house.
          mesh.quad(
            [[bx - 4, bz + d / 2 + 2], [bx + 4, bz + d / 2 + 2], [bx + 4, bz + d / 2 + 8], [bx - 4, bz + d / 2 + 8]],
            0.08, PALETTE.water, 1,
          );
        }
      }
    }
  }
}

function buildMarketStalls(mesh, colliders, b, rng) {
  // Market stalls: low wooden counters under bright awnings.
  for (let s = 0; s < 5; s++) {
    const sx = b.x0 + 4 + s * 5.2;
    const sz = b.cz + (rng.float() - 0.5) * 8;
    const awn = rng.pick([PALETTE.stallRed, PALETTE.stallGreen, PALETTE.stallBlue, PALETTE.wallYellow]);
    mesh.box(sx, 1.1, sz, 3.6, 2.2, 3.0, 0, 0, 0, PALETTE.pier);
    mesh.box(sx, 2.5, sz, 4.2, 0.3, 3.6, 0, 0, 0, awn);
    colliders.push({ x0: sx - 1.8, z0: sz - 1.5, x1: sx + 1.8, z1: sz + 1.5, h: 2.6 });
  }
}

function buildPark(mesh, colliders, b, rng) {
  // A park: palms and a low fountain block in the middle.
  for (let p = 0; p < 4; p++) {
    addPalm(mesh, b.x0 + 4 + rng.float() * (b.x1 - b.x0 - 8), b.z0 + 4 + rng.float() * (b.z1 - b.z0 - 8), rng);
  }
  mesh.box(b.cx, 0.6, b.cz, 6, 1.2, 6, 0, 0, 0, PALETTE.glass);
  colliders.push({ x0: b.cx - 3, z0: b.cz - 3, x1: b.cx + 3, z1: b.cz + 3, h: 1.2 });
}

// ---- Harbour (south-east): pier, containers, cranes, boats -------------

function buildHarbour(mesh, colliders) {
  const pierX = 150;
  mesh.box(pierX, 0.8, 290, 60, 1.6, 60, 0, 0, 0, PALETTE.pier);
  mesh.box(pierX, 0.8, 340, 24, 1.6, 80, 0, 0, 0, PALETTE.pier);
  colliders.push({ x0: pierX - 30, z0: 260, x1: pierX + 30, z1: 320, h: 1.6 });
  colliders.push({ x0: pierX - 12, z0: 320, x1: pierX + 12, z1: 380, h: 1.6 });
  const contCols = [PALETTE.containerRust, PALETTE.containerBlue, PALETTE.stallGreen, PALETTE.wallYellow];
  for (let i = 0; i < 14; i++) {
    const cx = 90 + (i % 7) * 13;
    const cz = 268 + Math.floor(i / 7) * 12;
    mesh.box(cx, 1.4, cz, 10, 2.8, 4.5, 0, 0, 0, contCols[i % contCols.length]);
    colliders.push({ x0: cx - 5, z0: cz - 2.25, x1: cx + 5, z1: cz + 2.25, h: 2.8 });
  }
  // A second row, stacked two high, for the far side of the yard.
  for (let i = 0; i < 4; i++) {
    const cx = 96 + i * 13;
    const cz = 292;
    mesh.box(cx, 1.4, cz, 10, 2.8, 4.5, 0, 0, 0, contCols[(i + 2) % contCols.length]);
    mesh.box(cx, 4.2, cz, 10, 2.8, 4.5, 0, 0, 0, contCols[(i + 3) % contCols.length]);
    colliders.push({ x0: cx - 5, z0: cz - 2.25, x1: cx + 5, z1: cz + 2.25, h: 5.6 });
  }
  // Fuel tank: a squat cylinder faked with a wide, short box and a domed cap.
  mesh.box(215, 3, 300, 12, 6, 12, 0, 0, 0, PALETTE.containerBlue);
  mesh.box(215, 6.5, 300, 8, 1.5, 8, 0, 0, 0, PALETTE.roofGrey);
  colliders.push({ x0: 209, z0: 294, x1: 221, z1: 306, h: 7 });
  // Cranes.
  for (const cx of [80, 210]) {
    mesh.box(cx, 14, 272, 2, 28, 2, 0, 0, 0, PALETTE.lamp);
    mesh.box(cx + 8, 26, 272, 18, 2, 2, 0, 0, 0, PALETTE.containerRust);
    colliders.push({ x0: cx - 1, z0: 271, x1: cx + 1, z1: 273, h: 28 });
  }
}

function harbourBoats(mesh, rng) {
  const boats = [];
  for (let i = 0; i < 5; i++) {
    const bx = -180 + i * 90 + rng.float() * 20;
    const bz = 380 + rng.float() * 120;
    mesh.box(bx, 0.9, bz, 14, 1.8, 5, 0, rng.range(0, Math.PI), 0, PALETTE.boatWhite);
    mesh.box(bx, 2.2, bz, 5, 2.4, 4, 0, 0, 0, PALETTE.boatRed);
    boats.push({ x: bx, z: bz });
  }
  return boats;
}

// ---- Palms, warung carts, lamps, sky ------------------------------------

function buildPalms(mesh, rng) {
  // Palms along the two boulevards.
  for (const c of [-120, 0, 120]) {
    for (let t = -220; t <= 220; t += 40) {
      addPalm(mesh, c + 8, t, rng);
      addPalm(mesh, c - 8, t + 20, rng);
    }
  }
  // Beach palms.
  for (let t = -240; t <= 240; t += 48) addPalm(mesh, t + 12, 252, rng);
}

function buildWarungs(mesh, colliders) {
  // Warung food carts along Jalan Pantai (the beach road, z = 240), with
  // striped awnings on the sea-side sidewalk: the chase road reads as a
  // night-market street, not an empty boulevard.
  const awns = [PALETTE.stallRed, PALETTE.stallGreen, PALETTE.wallYellow, PALETTE.stallBlue];
  for (let i = 0; i < 6; i++) {
    const wx = -180 + i * 72;
    const wz = 248;
    mesh.box(wx, 1.0, wz, 3.2, 2.0, 2.2, 0, 0, 0, PALETTE.pier);
    mesh.box(wx, 2.2, wz, 3.8, 0.25, 2.8, 0, 0, 0, awns[i % awns.length]);
    mesh.box(wx, 2.6, wz, 0.5, 0.5, 0.5, 0, 0, 0, PALETTE.lampGlow, 2);
    colliders.push({ x0: wx - 1.6, z0: wz - 1.1, x1: wx + 1.6, z1: wz + 1.1, h: 2.4 });
  }
}

function buildBeachProps(mesh, colliders, rng) {
  // Beach life on the sand: striped umbrellas with a low bench under each,
  // so the beach road reads as a place people actually spend the afternoon.
  const umbrellaCols = [PALETTE.stallRed, PALETTE.stallBlue, PALETTE.wallYellow, PALETTE.stallGreen];
  for (let i = 0; i < 8; i++) {
    const ux = -210 + i * 60 + rng.float() * 10;
    const uz = 272 + rng.float() * 14;
    const col = umbrellaCols[i % umbrellaCols.length];
    mesh.box(ux, 2.6, uz, 0.25, 2.6, 0.25, 0, 0, 0, PALETTE.pier);
    mesh.box(ux, 4.0, uz, 5.5, 0.3, 5.5, 0, rng.float() * 0.6, 0, col);
    mesh.box(ux + 2.5, 0.5, uz + 1.5, 3.2, 0.9, 1.4, 0, 0.4, 0, PALETTE.pier);
    colliders.push({ x0: ux - 0.3, z0: uz - 0.3, x1: ux + 0.3, z1: uz + 0.3, h: 4 });
  }
}

function buildLighthouse(mesh, colliders) {
  // Menara Tanjung: the striped lighthouse at the west end of the beach,
  // the landmark every chase on Jalan Pantai drives past. Tall enough to
  // be a navigation point from anywhere in the city.
  const lx = -225;
  const lz = 285;
  mesh.box(lx, 12, lz, 8, 24, 8, 0, 0, 0, PALETTE.wallWhite);
  mesh.box(lx, 12, lz, 8.4, 4, 8.4, 0, 0, 0, PALETTE.stallRed);
  mesh.box(lx, 20, lz, 8.4, 4, 8.4, 0, 0, 0, PALETTE.stallRed);
  mesh.box(lx, 25.5, lz, 6, 3, 6, 0, 0, 0, PALETTE.lamp);
  mesh.box(lx, 27.5, lz, 3, 2, 3, 0, 0, 0, PALETTE.lampGlow, 2);
  colliders.push({ x0: lx - 4, z0: lz - 4, x1: lx + 4, z1: lz + 4, h: 28 });
}

function buildLamps(mesh, roads) {
  for (const c of roads) {
    for (let t = -240; t <= 240; t += 80) {
      mesh.box(c + 6, 2.5, t, 0.3, 5, 0.3, 0, 0, 0, PALETTE.lamp);
      mesh.box(c + 6, 5.1, t, 0.9, 0.5, 0.9, 0, 0, 0, PALETTE.lampGlow, 2);
      mesh.box(t, 2.5, c + 6, 0.3, 5, 0.3, 0, 0, 0, PALETTE.lamp);
      mesh.box(t, 5.1, c + 6, 0.9, 0.5, 0.9, 0, 0, 0, PALETTE.lampGlow, 2);
    }
  }
}

function buildSky(mesh, rng) {
  // Sun and clouds (emissive, so they never fog out).
  mesh.box(-320, 230, -420, 46, 46, 2, 0, 0.6, 0, PALETTE.sun, 2);
  for (let i = 0; i < 7; i++) {
    const cx = -400 + rng.float() * 800;
    const cz = -450 + rng.float() * 700;
    mesh.box(cx, 130 + rng.float() * 40, cz, 60 + rng.float() * 60, 6, 24, 0, rng.float(), 0, PALETTE.cloud, 2);
  }
}

// ---- Road graph (intersections) ------------------------------------------

function buildRoadGraph(roads) {
  const graph = { nodes: [], edges: new Map() };
  for (let i = 0; i < ROAD_COUNT; i++) {
    for (let j = 0; j < ROAD_COUNT; j++) {
      const id = i * ROAD_COUNT + j;
      graph.nodes.push({ id, x: roads[i], z: roads[j] });
      graph.edges.set(id, []);
    }
  }
  const nodeId = (i, j) => i * ROAD_COUNT + j;
  for (let i = 0; i < ROAD_COUNT; i++) {
    for (let j = 0; j < ROAD_COUNT; j++) {
      const id = nodeId(i, j);
      if (i > 0) graph.edges.get(id).push(nodeId(i - 1, j));
      if (i < ROAD_COUNT - 1) graph.edges.get(id).push(nodeId(i + 1, j));
      if (j > 0) graph.edges.get(id).push(nodeId(i, j - 1));
      if (j < ROAD_COUNT - 1) graph.edges.get(id).push(nodeId(i, j + 1));
    }
  }
  return graph;
}

// ---- Named places --------------------------------------------------------

function namedPlaces() {
  return {
    home: { name: 'Rumah Raka', x: -40, z: -40 },
    garage: { name: 'Bengkel Tanjung', x: -80, z: -40 },
    market: { name: 'Pasar Malam', x: 0, z: 0 },
    harbor: { name: 'Pelabuhan', x: 150, z: 285 },
    villa: { name: 'Vila Bukit', x: -160, z: -220 },
    safehouse: { name: 'Rumah Aman', x: 200, z: -200 },
    beach: { name: 'Pantai Matahari', x: -120, z: 270 },
    taxiStand: { name: 'Pangkalan Taksi', x: 80, z: 40 },
    raceStart: { name: 'Garis Start Pantai', x: -200, z: 240 },
    oldtown: { name: 'Kota Tua', x: -200, z: 0 },
    bank: { name: 'Bank Tanjung', x: 40, z: -120 },
    gangHQ: { name: 'Markas Gang', x: 160, z: 120 },
  };
}

// ---- Collision and road helpers ------------------------------------------

// Circle (x, z, radius) vs building AABBs: push the circle out.
export function resolveCollisions(colliders, x, z, r) {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(nx, c.x1));
    const cz = Math.max(c.z0, Math.min(nz, c.z1));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = nx - c.x0;
        const pr = c.x1 - nx;
        const pt = nz - c.z0;
        const pb = c.z1 - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = c.x0 - r;
        else if (m === pr) nx = c.x1 + r;
        else if (m === pt) nz = c.z0 - r;
        else nz = c.z1 + r;
      }
    }
  }
  return [nx, nz];
}

export function pointInCollider(colliders, x, z) {
  for (const c of colliders) {
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return c;
  }
  return null;
}

// Nearest point on the road network to (x, z).
export function nearestRoadPoint(roads, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const rx of roads) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, z };
    }
  }
  for (const rz of roads) {
    const d = Math.abs(z - rz);
    if (d < bestD) {
      bestD = d;
      best = { x, z: rz };
    }
  }
  return best;
}
