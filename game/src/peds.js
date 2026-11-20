// peds.js — the people of Tanjung Matahari.
//
// Pedestrians stroll the sidewalks, cross at intersections, and run away
// from gunfire, speeding cars and police chases. A few are mission actors:
// taxi passengers who wait with a yellow hat, and hostile gang members and
// debt collectors who carry pistols and fight back.

import { clamp, dist2D } from './math.js';
import { resolveCollisions } from './city.js';

// Skin tones and shirt colours, picked per ped from the seeded RNG so the
// crowd looks the same every run.
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
    x,
    z,
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
    deadAt: undefined,
    // Mission actors only.
    name: null,
    weapon: null,
    shootTimer: 0,
  };
}

// Pick a new stroll target: a nearby point on a sidewalk, i.e. just off
// the edge of a road. Peds walk road to road, which is what makes them
// read as people going somewhere rather than wandering the grass.
export function wanderTarget(ped, roads, rng) {
  const pickRoad = () => roads[Math.floor(rng.float() * roads.length)];
  if (rng.float() < 0.5) {
    ped.targetX = pickRoad() + (rng.float() < 0.5 ? 6.5 : -6.5);
    ped.targetZ = clamp(ped.z + (rng.float() - 0.5) * 120, -250, 250);
  } else {
    ped.targetX = clamp(ped.x + (rng.float() - 0.5) * 120, -250, 250);
    ped.targetZ = pickRoad() + (rng.float() < 0.5 ? 6.5 : -6.5);
  }
}

// How many peds of a given role are alive right now — the mission
// counter uses this instead of filtering inline in three places.
export function countAliveByRole(peds, role) {
  let n = 0;
  for (const p of peds) if (p.role === role && !p.dead) n++;
  return n;
}

// Scare every ped within `radius` of (x, z): they run for a couple of
// seconds. Gunfire and speeding cars both use this.
export function scatterNearby(peds, x, z, radius) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (dist2D(ped.x, ped.z, x, z) < radius) ped.flee = 2;
  }
}
export function spawnMarketCrowd(peds, x, z, n, rng) {
  return spawnCrowd(peds, x, z, n, rng, 'walker');
}

// Drop a small crowd around (x, z): the screenshot staging uses this to
// put sidewalk life where the camera looks, and the market uses it at
// rush hour. Returns the peds it created.
export function spawnCrowd(peds, x, z, n, rng, role = 'walker') {
  const made = [];
  for (let i = 0; i < n; i++) {
    const ped = createPed(x + (rng.float() - 0.5) * 24, z + (rng.float() - 0.5) * 16, rng, role);
    ped.targetX = x + (rng.float() - 0.5) * 40;
    ped.targetZ = z + (rng.float() - 0.5) * 24;
    peds.push(ped);
    made.push(ped);
  }
  return made;
}

// Place a few peds who stand still (at a warung cart, at a stall) instead
// of strolling: they give a staged shot a lived-in foreground without
// anyone walking out of frame mid-capture. Returns the peds it created.
export function spawnStanders(peds, spots, rng, role = 'walker') {
  const made = [];
  for (const [x, z, heading] of spots) {
    const ped = createPed(x, z, rng, role);
    ped.heading = heading;
    ped.targetX = x;
    ped.targetZ = z;
    ped.speed = 0;
    peds.push(ped);
    made.push(ped);
  }
  return made;
}

// One ped, one frame. ctx carries the collision boxes, the road list, the
// RNG, and a danger point (x, z) to flee from — or null when all is calm.
export function updatePed(ped, dt, ctx) {
  if (ped.dead) return;
  const { colliders, roads, rng, danger } = ctx;

  if (danger) {
    const d = dist2D(ped.x, ped.z, danger.x, danger.z);
    if (d < 26) ped.flee = 2.5;
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = danger
      ? Math.atan2(ped.x - danger.x, ped.z - danger.z)
      : ped.heading;
    ped.heading = away;
    const nx = ped.x + Math.sin(ped.heading) * 4.5 * dt;
    const nz = ped.z + Math.cos(ped.heading) * 4.5 * dt;
    const [rx, rz] = resolveCollisions(colliders, nx, nz, 0.6);
    ped.x = rx;
    ped.z = rz;
    return;
  }

  // A stander (speed 0) stays put until danger scares them off.
  if (ped.speed === 0) return;

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
  ped.x = rx;
  ped.z = rz;
}

// Draw a ped as stacked boxes: legs, torso, arms implied by the torso,
// head — plus a red bandana and a gun for hostiles, and a yellow hat for
// a waiting taxi passenger. A dead ped lies flat on the ground.
export function drawPed(r, ped, time) {
  if (ped.dead) {
    r.box(ped.x, 0.35, ped.z, 0.7, 0.7, 1.9, 0, ped.heading, Math.PI / 2, ped.shirt);
    return;
  }
  const bob = Math.sin(time * 8 + ped.id) * 0.06;
  const hostile = ped.role === 'gang' || ped.role === 'collector';
  // Legs.
  r.box(ped.x, 0.45 + bob, ped.z, 0.55, 0.9, 0.4, 0, ped.heading, 0, [0.2, 0.25, 0.35]);
  // Torso — dark for gang members, the ped's own shirt otherwise.
  r.box(ped.x, 1.25 + bob, ped.z, 0.7, 0.85, 0.45, 0, ped.heading, 0,
    hostile ? [0.15, 0.15, 0.18] : ped.shirt);
  // Head.
  r.box(ped.x, 1.95 + bob, ped.z, 0.5, 0.5, 0.5, 0, ped.heading, 0, ped.skin);
  if (hostile) {
    // Red bandana, and a pistol held out in front.
    r.box(ped.x, 2.15 + bob, ped.z, 0.55, 0.18, 0.55, 0, ped.heading, 0, [0.8, 0.1, 0.1]);
    r.box(
      ped.x + Math.sin(ped.heading) * 0.5, 1.3 + bob, ped.z + Math.cos(ped.heading) * 0.5,
      0.12, 0.12, 0.9, 0, ped.heading, 0, [0.1, 0.1, 0.1],
    );
  }
  if (ped.role === 'passenger') {
    r.box(ped.x, 2.3 + bob, ped.z, 0.4, 0.3, 0.4, 0, ped.heading, 0, [0.95, 0.8, 0.2]);
  }
}
