// world.js — The city of Tanjung Matahari, generated from a seed.
//
// The city is a grid: avenues run north-south, streets run east-west, and the
// blocks between them hold buildings. West of the grid is the sea and a beach,
// south is the harbour with container stacks, north-west is the lighthouse on
// its point. Traffic cars drive the grid lanes and turn at intersections;
// pedestrians stroll the sidewalks and scatter when a car comes too close.
// Everything is placed by the seeded RNG, so seed 7 always builds the same
// Tanjung Matahari. Nothing here draws anything — render.js does that from
// these plain data structures.

import {
  AVENUES, STREETS, LANDMARKS, CAR_DEFS, CROWD,
  WORLD_HALF, SEA_X, HARBOUR_Z, ROAD_WIDTH, LANE_OFFSET,
} from './config.js';
import { makeRng, seedFromString, clamp, dist2d } from './rng.js';

/** Is a point on a road (within half the road width of an avenue or street)? */
export function isOnRoad(x, z) {
  for (const a of AVENUES) if (Math.abs(x - a.x) <= ROAD_WIDTH / 2 + 1) return true;
  for (const s of STREETS) if (Math.abs(z - s.z) <= ROAD_WIDTH / 2 + 1) return true;
  return false;
}

/** Snap a point to the nearest road centre line. */
export function nearestRoadPoint(x, z) {
  let bestA = AVENUES[0];
  let bestS = STREETS[0];
  for (const a of AVENUES) if (Math.abs(x - a.x) < Math.abs(x - bestA.x)) bestA = a;
  for (const s of STREETS) if (Math.abs(z - s.z) < Math.abs(z - bestS.z)) bestS = s;
  if (Math.abs(x - bestA.x) <= Math.abs(z - bestS.z)) return { x: bestA.x, z, axis: 'v' };
  return { x, z: bestS.z, axis: 'h' };
}

/** The name of the road nearest to a point, for the HUD street label. */
export function streetNameAt(x, z) {
  let bestA = AVENUES[0];
  let bestS = STREETS[0];
  for (const a of AVENUES) if (Math.abs(x - a.x) < Math.abs(x - bestA.x)) bestA = a;
  for (const s of STREETS) if (Math.abs(z - s.z) < Math.abs(z - bestS.z)) bestS = s;
  return Math.abs(x - bestA.x) <= Math.abs(z - bestS.z) ? bestA.name : bestS.name;
}

/** Build one building record for a block slot. */
function makeBuilding(rng, cx, cz, w, d) {
  const h = rng.range(9, 46);
  const tile = rng.int(0, 15);
  const palette = [
    [0.82, 0.72, 0.58], [0.75, 0.62, 0.55], [0.62, 0.70, 0.72],
    [0.85, 0.78, 0.62], [0.68, 0.60, 0.66], [0.58, 0.68, 0.60],
    [0.88, 0.68, 0.55], [0.55, 0.62, 0.75],
  ];
  const colour = rng.pick(palette);
  return {
    x: cx, z: cz, w, d, h, tile, colour,
    roof: [colour[0] * 0.75, colour[1] * 0.75, colour[2] * 0.75],
    neon: rng.chance(0.22) ? rng.pick([[0.95, 0.25, 0.45], [0.2, 0.85, 0.95], [0.95, 0.75, 0.15]]) : null,
  };
}

/** Build the whole city from a seed. Returns the world object. */
export function buildWorld(seed) {
  const rng = makeRng(seedFromString(`tanjung-${seed}`));
  const buildings = [];
  const stalls = [];
  const containers = [];
  const trees = [];

  // Buildings fill every block between two avenues and two streets.
  const xs = AVENUES.map((a) => a.x);
  const zs = STREETS.map((s) => s.z);
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iz = 0; iz < zs.length - 1; iz += 1) {
      const x0 = xs[ix] + ROAD_WIDTH / 2 + 6;
      const x1 = xs[ix + 1] - ROAD_WIDTH / 2 - 6;
      const z0 = zs[iz] + ROAD_WIDTH / 2 + 6;
      const z1 = zs[iz + 1] - ROAD_WIDTH / 2 - 6;
      const bw = x1 - x0;
      const bd = z1 - z0;
      // Skip the block that holds the alun-alun (open square) and the market.
      const isSquare = ix === 3 && iz === 3;
      const isMarket = ix === 3 && iz === 2;
      if (isSquare) {
        for (let t = 0; t < 8; t += 1) {
          trees.push({ x: x0 + rng.range(8, bw - 8), z: z0 + rng.range(8, bd - 8), h: rng.range(4, 7) });
        }
        continue;
      }
      if (isMarket) {
        // Pasar Malam: rows of food stalls with striped awnings.
        for (let s = 0; s < 10; s += 1) {
          stalls.push({
            x: x0 + 12 + (s % 5) * ((bw - 24) / 4),
            z: z0 + 14 + Math.floor(s / 5) * ((bd - 28) / 1),
            w: 8, d: 6,
            colour: rng.pick([[0.9, 0.3, 0.3], [0.15, 0.6, 0.8], [0.95, 0.75, 0.2], [0.5, 0.8, 0.3]]),
          });
        }
        continue;
      }
      // A normal block holds 2x2 buildings, sometimes 1 wide tower.
      const tower = rng.chance(0.3);
      if (tower) {
        buildings.push(makeBuilding(rng, (x0 + x1) / 2, (z0 + z1) / 2, bw * 0.62, bd * 0.62));
      } else {
        const cols = 2;
        const rows = 2;
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cz = 0; cz < rows; cz += 1) {
            const w = bw / cols - 8;
            const d = bd / rows - 8;
            buildings.push(makeBuilding(
              rng,
              x0 + (cx + 0.5) * (bw / cols),
              z0 + (cz + 0.5) * (bd / rows),
              w, d,
            ));
          }
        }
      }
      if (rng.chance(0.6)) {
        trees.push({ x: x0 + rng.range(4, bw - 4), z: z0 + rng.range(4, bd - 4), h: rng.range(3.5, 6) });
      }
    }
  }

  // Harbour container stacks, south of the grid.
  for (let i = 0; i < 26; i += 1) {
    containers.push({
      x: -300 + (i % 13) * 48 + rng.range(-6, 6),
      z: HARBOUR_Z + 18 + Math.floor(i / 13) * 16 + rng.range(-3, 3),
      w: 12, h: rng.range(2.4, 7.2), d: 3,
      colour: rng.pick([[0.8, 0.3, 0.2], [0.2, 0.5, 0.8], [0.9, 0.7, 0.15], [0.25, 0.65, 0.35], [0.7, 0.7, 0.72]]),
      angle: rng.chance(0.5) ? 0 : Math.PI / 2,
    });
  }

  // Beach palm trees along the west shore.
  for (let i = 0; i < 22; i += 1) {
    trees.push({ x: SEA_X + 8 + rng.range(0, 14), z: -400 + i * 38 + rng.range(-8, 8), h: rng.range(5, 8), palm: true });
  }

  const world = {
    seed,
    buildings,
    stalls,
    containers,
    trees,
    traffic: [],
    parked: [],
    pedestrians: [],
    collectibles: [],
    enemies: [],
    policeCars: [],
    helicopter: null,
    roadblocks: [],
  };

  // Parked cars line the roads, half on avenues, half on streets.
  const parkDefs = ['sedan', 'hatchback', 'pickup', 'van', 'taxi', 'sport'];
  for (let i = 0; i < CROWD.parkedCars; i += 1) {
    const vertical = rng.chance(0.5);
    const defId = rng.pick(parkDefs);
    const def = CAR_DEFS[defId];
    let x; let z; let angle;
    if (vertical) {
      const a = rng.pick(AVENUES);
      x = a.x + rng.pick([-1, 1]) * (ROAD_WIDTH / 2 - 2.4);
      z = rng.range(-380, 380);
      angle = rng.pick([0, Math.PI]);
    } else {
      const s = rng.pick(STREETS);
      z = s.z + rng.pick([-1, 1]) * (ROAD_WIDTH / 2 - 2.4);
      x = rng.range(-380, 380);
      angle = rng.pick([Math.PI / 2, -Math.PI / 2]);
    }
    world.parked.push({
      id: `parked-${i}`, def, defId,
      x, z, angle, speed: 0,
      colour: rng.pick(def.colours),
      owner: 'parked', hp: 100, honked: false,
    });
  }

  // Traffic cars drive the grid lanes.
  const trafficDefs = ['sedan', 'hatchback', 'pickup', 'van', 'taxi', 'sedan', 'hatchback'];
  for (let i = 0; i < CROWD.trafficCars; i += 1) {
    const vertical = rng.chance(0.5);
    const defId = rng.pick(trafficDefs);
    const def = CAR_DEFS[defId];
    let x; let z; let angle; let lane;
    if (vertical) {
      const a = rng.pick(AVENUES);
      lane = rng.pick([-1, 1]);
      x = a.x + lane * LANE_OFFSET;
      z = rng.range(-380, 380);
      angle = lane > 0 ? 0 : Math.PI;
    } else {
      const s = rng.pick(STREETS);
      lane = rng.pick([-1, 1]);
      z = s.z + lane * LANE_OFFSET;
      x = rng.range(-380, 380);
      angle = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    world.traffic.push({
      id: `traffic-${i}`, def, defId,
      x, z, angle, speed: rng.range(7, 13),
      colour: rng.pick(def.colours),
      owner: 'traffic', hp: 100,
      lane, vertical, targetSpeed: rng.range(7, 13),
      wait: 0,
    });
  }

  // Pedestrians stroll the sidewalks.
  const skinTones = [[0.85, 0.65, 0.5], [0.65, 0.45, 0.32], [0.55, 0.38, 0.28], [0.92, 0.75, 0.6]];
  const shirtColours = [
    [0.9, 0.25, 0.25], [0.2, 0.5, 0.9], [0.95, 0.8, 0.2], [0.3, 0.75, 0.35],
    [0.85, 0.5, 0.8], [0.95, 0.95, 0.95], [0.25, 0.25, 0.3], [0.9, 0.55, 0.2],
  ];
  for (let i = 0; i < CROWD.pedestrians; i += 1) {
    const near = rng.pick([
      LANDMARKS.pasarMalam, LANDMARKS.alunAlun, LANDMARKS.pantai,
      { x: 0, z: 0 }, { x: -120, z: 120 }, { x: 180, z: -60 },
    ]);
    const angle = rng.angle();
    world.pedestrians.push({
      id: `ped-${i}`,
      x: clamp(near.x + rng.range(-70, 70), -410, 410),
      z: clamp(near.z + rng.range(-70, 70), -410, 410),
      angle, speed: rng.range(0.8, 1.8),
      skin: rng.pick(skinTones), shirt: rng.pick(shirtColours),
      state: 'walk', panic: 0, targetX: 0, targetZ: 0,
      wanderTimer: rng.range(2, 8),
      line: null, lineTimer: 0,
    });
  }

  // Collectibles: 12 golden keris scattered around the city.
  const spots = [
    LANDMARKS.lighthouse, LANDMARKS.pantai, LANDMARKS.harbour,
    LANDMARKS.gangSanca, LANDMARKS.alunAlun, LANDMARKS.stasiun,
    { x: -360, z: -360 }, { x: 360, z: -360 }, { x: -360, z: 360 },
    { x: 360, z: 120 }, { x: -240, z: 240 }, { x: 120, z: -360 },
  ];
  spots.forEach((spot, i) => {
    world.collectibles.push({
      id: `keris-${i}`, x: spot.x + rng.range(-14, 14), z: spot.z + rng.range(-14, 14),
      taken: false, bob: rng.range(0, Math.PI * 2),
    });
  });

  return world;
}

/** Spawn a traffic car at a random grid edge, to keep the streets full. */
export function spawnTrafficCar(world, rng) {
  const defId = rng.pick(['sedan', 'hatchback', 'pickup', 'van', 'taxi']);
  const def = CAR_DEFS[defId];
  const vertical = rng.chance(0.5);
  const lane = rng.pick([-1, 1]);
  let x; let z; let angle;
  if (vertical) {
    const a = rng.pick(AVENUES);
    x = a.x + lane * LANE_OFFSET;
    z = lane > 0 ? -400 : 400;
    angle = lane > 0 ? 0 : Math.PI;
  } else {
    const s = rng.pick(STREETS);
    z = s.z + lane * LANE_OFFSET;
    x = lane > 0 ? -400 : 400;
    angle = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = {
    id: `traffic-${world.traffic.length}-${Math.floor(rng.range(0, 1e6))}`,
    def, defId, x, z, angle,
    speed: rng.range(7, 13), colour: rng.pick(def.colours),
    owner: 'traffic', hp: 100, lane, vertical,
    targetSpeed: rng.range(7, 13), wait: 0,
  };
  world.traffic.push(car);
  return car;
}

/** Move all traffic cars one step: follow lanes, slow for cars ahead, turn at intersections. */
export function stepTraffic(world, dt, rng) {
  for (let i = world.traffic.length - 1; i >= 0; i -= 1) {
    const car = world.traffic[i];
    // Leave the map: respawn at the far edge so the streets never empty.
    if (car.x < -420 || car.x > 420 || car.z < -420 || car.z > 430) {
      world.traffic.splice(i, 1);
      spawnTrafficCar(world, rng);
      continue;
    }
    // Slow down if another car is close ahead.
    let ahead = false;
    for (const other of world.traffic) {
      if (other === car) continue;
      const d = dist2d(car.x, car.z, other.x, other.z);
      if (d < 12) {
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const facing = Math.sin(car.angle) * dx + Math.cos(car.angle) * dz;
        if (facing > 0 && d < 12) { ahead = true; break; }
      }
    }
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -14 * dt, 8 * dt);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const onV = AVENUES.some((a) => Math.abs(car.x - a.x) < 1.2);
    const onH = STREETS.some((s) => Math.abs(car.z - s.z) < 1.2);
    if (car.vertical && onH && rng.chance(0.02)) {
      const s = STREETS.find((st) => Math.abs(car.z - st.z) < 1.2);
      if (s) {
        car.vertical = false;
        car.lane = rng.pick([-1, 1]);
        car.z = s.z + car.lane * LANE_OFFSET;
        car.angle = car.lane > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    } else if (!car.vertical && onV && rng.chance(0.02)) {
      const a = AVENUES.find((av) => Math.abs(car.x - av.x) < 1.2);
      if (a) {
        car.vertical = true;
        car.lane = rng.pick([-1, 1]);
        car.x = a.x + car.lane * LANE_OFFSET;
        car.angle = car.lane > 0 ? 0 : Math.PI;
      }
    }
  }
}

/** Move pedestrians: wander the sidewalks, panic-run from nearby cars. */
export function stepPedestrians(world, dt, player, rng) {
  for (const ped of world.pedestrians) {
    ped.wanderTimer -= dt;
    if (ped.lineTimer > 0) ped.lineTimer -= dt;
    // Panic: a car (or the player in a car) within 6 m makes them run away.
    let threat = null;
    const cars = world.traffic.concat(world.parked);
    for (const car of cars) {
      if (car.speed > 2 && dist2d(ped.x, ped.z, car.x, car.z) < 7) { threat = car; break; }
    }
    if (!threat && player && !player.onFoot && dist2d(ped.x, ped.z, player.x, player.z) < 7) threat = player;
    if (threat) {
      ped.state = 'panic';
      ped.panic = 2.5;
      const away = Math.atan2(ped.x - threat.x, ped.z - threat.z);
      ped.angle = away;
      ped.x += Math.sin(away) * 4.5 * dt;
      ped.z += Math.cos(away) * 4.5 * dt;
    } else if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.sin(ped.angle) * 3.5 * dt;
      ped.z += Math.cos(ped.angle) * 3.5 * dt;
    } else {
      ped.state = 'walk';
      if (ped.wanderTimer <= 0) {
        ped.angle = rng.angle();
        ped.wanderTimer = rng.range(3, 9);
      }
      ped.x += Math.sin(ped.angle) * ped.speed * dt;
      ped.z += Math.cos(ped.angle) * ped.speed * dt;
      // Stay inside the city and off the middle of roads when possible.
      if (ped.x < -415 || ped.x > 415 || ped.z < -415 || ped.z > 415) {
        ped.angle += Math.PI;
        ped.x = clamp(ped.x, -410, 410);
        ped.z = clamp(ped.z, -410, 410);
      }
    }
  }
}

/** Test whether a ground point is inside any building (for collision). */
export function hitsBuilding(world, x, z, margin) {
  for (const b of world.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin) return b;
  }
  return null;
}

/** Test whether a ground point is in the sea. */
export function inSea(x) {
  return x < SEA_X + 2;
}
