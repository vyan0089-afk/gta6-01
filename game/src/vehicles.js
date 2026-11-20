// vehicles.js — cars of Tanjung Matahari.
//
// Arcade driving physics, traffic that follows the road graph, and the
// box-built look of every car in the city: body, cabin, four wheels,
// headlights and taillights, plus a flashing light bar for police cars
// and a roof sign for taxis.

import { clamp, angleDiff, dist2D } from './math.js';
import { resolveCollisions, nearestRoadPoint } from './city.js';

// Every drivable model: Indonesian-flavoured names, top speed, how hard
// it accelerates, how sharply it turns, its size, and its paint options.
export const CAR_MODELS = {
  sedan: { name: 'Kijang Kota', topSpeed: 26, accel: 14, grip: 2.6, length: 4.4, width: 2.0, colors: [[0.75, 0.25, 0.22], [0.25, 0.45, 0.70], [0.85, 0.80, 0.75], [0.30, 0.60, 0.35]] },
  hatch: { name: 'Ceria', topSpeed: 24, accel: 15, grip: 3.0, length: 3.8, width: 1.9, colors: [[0.95, 0.75, 0.25], [0.30, 0.65, 0.55], [0.85, 0.45, 0.65], [0.55, 0.55, 0.60]] },
  sport: { name: 'Panther GT', topSpeed: 38, accel: 20, grip: 3.4, length: 4.6, width: 2.1, colors: [[0.90, 0.15, 0.15], [0.95, 0.80, 0.15], [0.15, 0.15, 0.18], [0.20, 0.45, 0.85]] },
  van: { name: 'Angkot', topSpeed: 20, accel: 10, grip: 2.2, length: 5.0, width: 2.1, colors: [[0.25, 0.60, 0.35], [0.90, 0.60, 0.20], [0.35, 0.45, 0.75]] },
  truck: { name: 'Truk Muatan', topSpeed: 18, accel: 8, grip: 1.8, length: 6.5, width: 2.4, colors: [[0.70, 0.45, 0.25], [0.35, 0.45, 0.55], [0.85, 0.75, 0.55]] },
  taxi: { name: 'Taksi Kuning', topSpeed: 25, accel: 13, grip: 2.6, length: 4.4, width: 2.0, colors: [[0.95, 0.80, 0.15]] },
  police: { name: 'Patroli', topSpeed: 32, accel: 18, grip: 3.2, length: 4.6, width: 2.1, colors: [[0.92, 0.92, 0.92]] },
  // Bajaj: the three-wheeled workhorse of Tanjung's side streets. It draws
  // and collides like every other car, just shorter and narrower.
  bajaj: { name: 'Bajaj', topSpeed: 16, accel: 11, grip: 3.4, length: 3.0, width: 1.6, colors: [[0.25, 0.65, 0.45], [0.90, 0.55, 0.15]] },
};

// Plain-language condition from a car's hit points, for the HUD readout.
export function conditionLabel(car) {
  if (!car) return '';
  if (car.hp >= 80) return 'Prima';
  if (car.hp >= 50) return 'Lecet';
  if (car.hp > 0) return 'Rusak parah';
  return 'Mogok';
}

let nextCarId = 1;

// Spawn helpers the world setup uses: a parked car at the side of a road,
// and a traffic car on a road, both placed from the seeded RNG.
export function spawnParkedCar(rng, roads, models) {
  const rx = roads[1 + Math.floor(rng.float() * (roads.length - 2))];
  const rz = roads[1 + Math.floor(rng.float() * (roads.length - 2))];
  const alongRoad = rng.float() < 0.5;
  const x = alongRoad ? rx + (rng.float() < 0.5 ? 7 : -7) : rx + (rng.float() - 0.5) * 30;
  const z = alongRoad ? rz + (rng.float() - 0.5) * 30 : rz + (rng.float() < 0.5 ? 7 : -7);
  const model = models[Math.floor(rng.float() * models.length)];
  return createCar(model, x, z, rng.float() * Math.PI * 2, null, 'parked');
}

export function spawnTrafficCar(rng, roads, weightedModels) {
  const rx = roads[Math.floor(rng.float() * roads.length)];
  const rz = roads[Math.floor(rng.float() * roads.length)];
  const model = rng.weightedPick(weightedModels);
  const car = createCar(model, rx, rz, rng.float() * Math.PI * 2, null, 'traffic');
  car.node = -1;
  return car;
}

export function createCar(model, x, z, heading, color, owner = 'traffic') {
  const def = CAR_MODELS[model];
  const id = nextCarId++;
  return {
    id,
    model,
    def,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    color: color ?? def.colors[0],
    owner,
    hp: 100,
    // Traffic AI state: which graph node it is heading from / to.
    node: -1,
    nextNode: -1,
    stuck: 0,
    // Police cars flash out of phase with each other; the phase is derived
    // from the car id so it is deterministic, not random.
    sirenPhase: (id * 1.7) % 10,
    // Player-car state (garage upgrades and paint).
    engine: 0,
    armour: 0,
    paint: null,
    // Mission state.
    missionTarget: false,
    unit: null,
    path: [],
    pathIndex: 0,
    pathTimer: 0,
  };
}

// Arcade driving: throttle -1..1, steer -1..1. Mutates the car in place.
export function driveCar(car, throttle, steerInput, dt, colliders, others) {
  const def = car.def;
  const top = def.topSpeed * (1 + car.engine * 0.12);
  const accel = def.accel * (1 + car.engine * 0.10);
  if (throttle > 0) {
    car.speed += accel * throttle * dt;
  } else if (throttle < 0) {
    // Backwards: hard brake while still rolling forward, gentle reverse
    // once stopped.
    if (car.speed > 0.5) car.speed += accel * throttle * 1.6 * dt;
    else car.speed += accel * throttle * 0.6 * dt;
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -top * 0.4, top);

  // Steering: stronger at low speed, none at a standstill, and it reverses
  // when the car rolls backwards.
  const steerTarget = steerInput * clamp(Math.abs(car.speed) / 6, 0, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * def.grip * (car.speed >= 0 ? 1 : -1) * dt
    * clamp(Math.abs(car.speed) / 8, 0.15, 1);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const [rx, rz] = resolveCollisions(colliders, nx, nz, 2.1);
  if ((rx !== nx || rz !== nz) && Math.abs(car.speed) > 4) {
    car.speed *= 0.45; // bump into a wall
    car.hp = Math.max(0, car.hp - 2);
  }
  car.x = rx;
  car.z = rz;

  // Car-to-car bumps: push overlapping cars apart, bleed speed off.
  if (others) {
    for (const o of others) {
      if (o === car) continue;
      const d = dist2D(car.x, car.z, o.x, o.z);
      const min = 3.4;
      if (d < min && d > 0.001) {
        const push = (min - d) / 2;
        const dx = (car.x - o.x) / d;
        const dz = (car.z - o.z) / d;
        car.x += dx * push;
        car.z += dz * push;
        if (Math.abs(car.speed) > 3) car.speed *= 0.7;
      }
    }
  }
}

// Traffic: follow the road graph from intersection to intersection,
// braking for the car ahead. A traffic car with no node yet snaps to the
// nearest intersection first.
export function updateTraffic(car, graph, dt, colliders, others, rng) {
  if (car.node < 0) {
    const rp = nearestRoadPoint(graph.roads, car.x, car.z);
    let best = 0;
    let bestD = Infinity;
    for (const n of graph.nodes) {
      const d = dist2D(rp.x, rp.z, n.x, n.z);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    car.node = best;
    car.nextNode = best;
  }
  const target = graph.nodes[car.nextNode];
  if (!target) return;
  const d = dist2D(car.x, car.z, target.x, target.z);
  if (d < 3) {
    const options = graph.edges.get(car.nextNode).filter((id) => id !== car.node);
    const pick = options.length > 0
      ? options[Math.floor(rng.float() * options.length)]
      : car.node;
    car.node = car.nextNode;
    car.nextNode = pick;
    return;
  }
  const wantHeading = Math.atan2(target.x - car.x, target.z - car.z);
  const diff = angleDiff(car.heading, wantHeading);
  const steer = clamp(diff * 1.6, -1, 1);
  // Brake for a car ahead in our lane.
  let throttle = 0.55;
  for (const o of others) {
    if (o === car) continue;
    const ahead = Math.sin(car.heading) * (o.x - car.x) + Math.cos(car.heading) * (o.z - car.z);
    const side = Math.abs(Math.cos(car.heading) * (o.x - car.x) - Math.sin(car.heading) * (o.z - car.z));
    if (ahead > 0 && ahead < 12 && side < 3) {
      throttle = -0.4;
      break;
    }
  }
  driveCar(car, throttle, steer, dt, colliders, others);
}

const DARK_GLASS = [0.10, 0.10, 0.11];

// Draw a car as boxes: body, cabin, four wheels, headlights and
// taillights, plus the extras that mark police cars and taxis.
export function drawCar(r, car, time) {
  const def = car.def;
  const L = def.length;
  const W = def.width;
  const c = car.paint ?? car.color;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const rx = Math.cos(car.heading);
  const rz = -Math.sin(car.heading);

  // Body and cabin.
  r.box(car.x, 0.75, car.z, W, 0.85, L, 0, car.heading, 0, c);
  const cabinColor = car.model === 'police' ? [0.92, 0.92, 0.92] : [0.15, 0.18, 0.22];
  const cabinLen = car.model === 'van' || car.model === 'truck' ? L * 0.62 : L * 0.45;
  const cabinOff = car.model === 'truck' ? L * 0.28 : -L * 0.05;
  r.box(car.x + fx * cabinOff, 1.45, car.z + fz * cabinOff, W * 0.86, 0.7, cabinLen, 0, car.heading, 0, cabinColor);

  // Wheels.
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wx = car.x + rx * sx * (W / 2) + fx * sz * (L * 0.32);
    const wz = car.z + rz * sx * (W / 2) + fz * sz * (L * 0.32);
    r.box(wx, 0.35, wz, 0.3, 0.7, 0.7, 0, car.heading, 0, DARK_GLASS);
  }

  // Headlights (emissive) at the front, taillights at the back.
  for (const s of [-1, 1]) {
    const hx = car.x + rx * s * (W * 0.32) + fx * (L * 0.48);
    const hz = car.z + rz * s * (W * 0.32) + fz * (L * 0.48);
    r.box(hx, 0.8, hz, 0.35, 0.18, 0.12, 0, car.heading, 0, [1.0, 0.95, 0.7], 2);
    const tx = car.x + rx * s * (W * 0.32) - fx * (L * 0.48);
    const tz = car.z + rz * s * (W * 0.32) - fz * (L * 0.48);
    r.box(tx, 0.8, tz, 0.35, 0.18, 0.12, 0, car.heading, 0, [0.9, 0.1, 0.1], 2);
  }

  if (car.model === 'police') {
    // Light bar, alternating red and blue.
    const phase = Math.floor(time * 4 + car.sirenPhase) % 2 === 0;
    const lx = car.x + fx * -0.1;
    const lz = car.z + fz * -0.1;
    r.box(lx - rx * 0.45, 1.95, lz - rz * 0.45, 0.5, 0.22, 0.5, 0, car.heading, 0, phase ? [1, 0.1, 0.1] : [0.15, 0.15, 0.4], 2);
    r.box(lx + rx * 0.45, 1.95, lz + rz * 0.45, 0.5, 0.22, 0.5, 0, car.heading, 0, phase ? [0.15, 0.15, 0.9] : [1, 0.1, 0.1], 2);
    // Blue POLISI stripe down the side.
    r.box(car.x, 0.95, car.z, W + 0.06, 0.3, L * 0.9, 0, car.heading, 0, [0.1, 0.2, 0.6]);
  }
  if (car.model === 'taxi') {
    // Glowing roof sign.
    r.box(car.x, 1.95, car.z, 0.9, 0.25, 0.5, 0, car.heading, 0, [1.0, 0.9, 0.3], 2);
  }
  if (car.model === 'truck') {
    // Cargo box on the back, slightly darker than the cab.
    r.box(car.x - fx * (L * 0.28), 1.5, car.z - fz * (L * 0.28), W * 0.92, 1.6, L * 0.42, 0, car.heading, 0, [0.55, 0.38, 0.28]);
  }
}
