// peds.js — pedestrians of Tanjung Matahari. They stroll the sidewalks,
// cross at intersections, and run away from gunfire, speeding cars and
// police chases. A few are mission actors (taxi passengers, gang members).

import { clamp, dist2D } from './math.js';
import { resolveCollisions } from './city.js';

const SKINS = [
  [0.85, 0.65, 0.50], [0.65, 0.45, 0.32], [0.95, 0.78, 0.62], [0.55, 0.38, 0.26],
];
const SHIRTS = [
  [0.85, 0.30, 0.25], [0.25, 0.55, 0.85], [0.95, 0.80, 0.30], [0.35, 0.70, 0.40],
  [0.90, 0.55, 0.75], [0.55, 0.35, 0.65], [0.95, 0.95, 0.95], [0.20, 0.20, 0.25],
];

let nextPedId = 1;

export function createPed(x, z, rng, role = 'walker') {
  return {
    id: nextPedId++,
    x, z,
    heading: rng.float() * Math.PI * 2,
    speed: 1.2 + rng.float() * 0.8,
    skin: SKINS[Math.floor(rng.float() * SKINS.length)],
    shirt: SHIRTS[Math.floor(rng.float() * SHIRTS.length)],
    role,
    hp: 100,
    flee: 0,
    targetX: x,
    targetZ: z,
    dead: false,
    // Mission actors.
    name: null,
    weapon: null,
  };
}

// Pick a new stroll target: a nearby point on a sidewalk (road edge).
export function wanderTarget(ped, roads, rng) {
  const rx = roads[Math.floor(rng.float() * roads.length)];
  const rz = roads[Math.floor(rng.float() * roads.length)];
  if (rng.float() < 0.5) {
    ped.targetX = rx + (rng.float() < 0.5 ? 6.5 : -6.5);
    ped.targetZ = Math.max(-250, Math.min(250, ped.z + (rng.float() - 0.5) * 120));
  } else {
    ped.targetX = Math.max(-250, Math.min(250, ped.x + (rng.float() - 0.5) * 120));
    ped.targetZ = rz + (rng.float() < 0.5 ? 6.5 : -6.5);
  }
}

export function updatePed(ped, dt, ctx) {
  if (ped.dead) return;
  const { colliders, roads, rng, danger } = ctx;
  // Danger: a point (x, z) to flee from, or null.
  if (danger) {
    const d = dist2D(ped.x, ped.z, danger.x, danger.z);
    if (d < 26) ped.flee = 2.5;
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = Math.atan2(ped.x - (danger ? danger.x : ped.x), ped.z - (danger ? danger.z : ped.z));
    ped.heading = away;
    const sp = 4.5;
    const nx = ped.x + Math.sin(ped.heading) * sp * dt;
    const nz = ped.z + Math.cos(ped.heading) * sp * dt;
    const [rx, rz] = resolveCollisions(colliders, nx, nz, 0.6);
    ped.x = rx; ped.z = rz;
    return;
  }
  const d = dist2D(ped.x, ped.z, ped.targetX, ped.targetZ);
  if (d < 2) {
    wanderTarget(ped, roads, rng);
    return;
  }
  const want = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
  let diff = want - ped.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
  const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
  const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
  const [rx, rz] = resolveCollisions(colliders, nx, nz, 0.6);
  ped.x = rx; ped.z = rz;
}

export function drawPed(r, ped, time) {
  if (ped.dead) {
    // Lying down.
    r.box(ped.x, 0.35, ped.z, 0.7, 0.7, 1.9, 0, ped.heading, Math.PI / 2, ped.shirt);
    return;
  }
  const bob = Math.sin(time * 8 + ped.id) * 0.06;
  const hostile = ped.role === 'gang' || ped.role === 'collector';
  // Legs, torso, arms, head.
  r.box(ped.x, 0.45 + bob, ped.z, 0.55, 0.9, 0.4, 0, ped.heading, 0, [0.2, 0.25, 0.35]);
  r.box(ped.x, 1.25 + bob, ped.z, 0.7, 0.85, 0.45, 0, ped.heading, 0, hostile ? [0.15, 0.15, 0.18] : ped.shirt);
  r.box(ped.x, 1.95 + bob, ped.z, 0.5, 0.5, 0.5, 0, ped.heading, 0, ped.skin);
  if (hostile) {
    // Bandana + weapon.
    r.box(ped.x, 2.15 + bob, ped.z, 0.55, 0.18, 0.55, 0, ped.heading, 0, [0.8, 0.1, 0.1]);
    r.box(ped.x + Math.sin(ped.heading) * 0.5, 1.3 + bob, ped.z + Math.cos(ped.heading) * 0.5, 0.12, 0.12, 0.9, 0, ped.heading, 0, [0.1, 0.1, 0.1]);
  }
  if (ped.role === 'passenger') {
    r.box(ped.x, 2.3 + bob, ped.z, 0.4, 0.3, 0.4, 0, ped.heading, 0, [0.95, 0.8, 0.2]);
  }
}
