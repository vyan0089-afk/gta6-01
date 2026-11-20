// police.js — The wanted system and the police who answer it.
//
// Wanted runs 0 to 5. Committing a crime in sight adds heat; hiding from the
// police lets it cool. At each level a matching number of patrol cars chase
// Raka, ramming his car or cornering him on foot. At wanted 4 a helicopter
// joins and circles overhead with a spotlight. At wanted 5 the police throw
// roadblocks across the road ahead. On foot, if a patrol car gets close while
// Raka is slow, the bust timer starts — three seconds and he is caught,
// loses some money, and wakes up at the hospital.

import { POLICE_COUNT, BUST_SECONDS, WANTED_DECAY, CAR_DEFS, LANDMARKS, POLICE_UNITS } from './config.js';
import { clamp, dist2d, angleDelta, makeRng } from './rng.js';
import { nearestRoadPoint } from './world.js';

/** Create the police state. */
export function createPolice() {
  return {
    wanted: 0,
    heat: 0,            // fractional heat; wanted is the visible level
    bustTimer: 0,
    busted: false,
    sirenTimer: 0,
    lastCrime: '',
    crimeTimer: 0,
    heliAngle: 0,
    roadblockTimer: 0,
    spawnTimer: 0,
  };
}

/** Visible wanted level from fractional heat: rounds, so a fresh 1-star
 *  crime does not vanish the moment heat decays a hair below 1. */
export function heatToLevel(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.floor(heat + 0.5));
}

/** Add heat. `reason` shows in the HUD crime flash. */
export function addWanted(police, amount, reason) {
  if (amount <= 0) {
    // A small nudge: firing a gun or crashing still counts a little.
    police.heat = clamp(police.heat + 0.08, 0, 5);
  } else {
    police.heat = clamp(police.heat + amount, 0, 5);
  }
  const level = heatToLevel(police.heat);
  if (level > police.wanted && reason) {
    police.lastCrime = reason;
    police.crimeTimer = 4;
  }
  police.wanted = level;
  return police.wanted;
}

/** How far the nearest police unit is, for the HUD distance list. */
export function policeDistances(world, player) {
  const list = [];
  for (const car of world.policeCars) {
    list.push({
      name: car.unitName,
      dist: Math.round(dist2d(player.x, player.z, car.x, car.z)),
      kind: 'car',
    });
  }
  if (world.helicopter) {
    list.push({
      name: 'Helikopter Elang',
      dist: Math.round(dist2d(player.x, player.z, world.helicopter.x, world.helicopter.z)),
      kind: 'heli',
    });
  }
  list.sort((a, b) => a.dist - b.dist);
  return list.slice(0, 4);
}

/** Spawn one patrol car on a road near the player. */
function spawnPoliceCar(world, player, rng, index) {
  const road = nearestRoadPoint(player.x, player.z);
  const spawnAt = { x: road.x, z: road.z };
  // Put it a little way off along the road so it drives in, sirens wailing.
  const dir = rng.pick([1, -1]);
  if (road.axis === 'v') spawnAt.z = clamp(road.z + dir * rng.range(60, 110), -400, 400);
  else spawnAt.x = clamp(road.x + dir * rng.range(60, 110), -400, 400);
  const unit = POLICE_UNITS[index % POLICE_UNITS.length];
  const car = {
    id: `police-${Date.now()}-${index}`,
    def: CAR_DEFS.police, defId: 'police',
    x: spawnAt.x, z: spawnAt.z,
    angle: Math.atan2(player.x - spawnAt.x, player.z - spawnAt.z),
    speed: 0, colour: [0.92, 0.92, 0.94],
    owner: 'police', hp: 200, unitName: unit.name,
    lightPhase: rng.range(0, 1),
  };
  world.policeCars.push(car);
  return car;
}

/** Put roadblock cars across the road ahead of the player (wanted 5). */
function placeRoadblock(world, player, rng) {
  const road = nearestRoadPoint(player.x, player.z);
  const ahead = 55;
  const fx = Math.sin(player.angle);
  const fz = Math.cos(player.angle);
  const cx = clamp(player.x + fx * ahead, -400, 400);
  const cz = clamp(player.z + fz * ahead, -400, 400);
  world.roadblocks = [];
  for (let i = -1; i <= 1; i += 1) {
    const perp = player.angle + Math.PI / 2;
    world.roadblocks.push({
      x: cx + Math.sin(perp) * i * 5.5,
      z: cz + Math.cos(perp) * i * 5.5,
      angle: player.angle + Math.PI / 2,
      def: CAR_DEFS.police,
      colour: [0.92, 0.92, 0.94],
      unitName: 'Roadblock',
    });
  }
}

/** Step the whole police system one frame. */
export function stepPolice(police, world, player, dt, game) {
  const rng = game.rng;
  police.sirenTimer -= dt;
  if (police.crimeTimer > 0) police.crimeTimer -= dt;

  // Keep the right number of patrol cars on the street.
  const want = POLICE_COUNT[police.wanted];
  police.spawnTimer -= dt;
  if (world.policeCars.length < want && police.spawnTimer <= 0) {
    spawnPoliceCar(world, player, rng, world.policeCars.length);
    police.spawnTimer = 1.2;
    if (police.sirenTimer <= 0) {
      game.audio.siren();
      police.sirenTimer = 6;
    }
  }
  if (world.policeCars.length > want) {
    world.policeCars.length = want;
  }

  // Helicopter at wanted 4+.
  if (police.wanted >= 4 && !world.helicopter) {
    world.helicopter = {
      x: player.x + 40, z: player.z - 40, y: 55,
      angle: 0, rotor: 0,
    };
  } else if (police.wanted < 4 && world.helicopter) {
    world.helicopter = null;
  }
  if (world.helicopter) {
    const heli = world.helicopter;
    police.heliAngle += dt * 0.55;
    // A wide, low orbit so the helicopter stays in the chase camera's frame.
    heli.x = player.x + Math.cos(police.heliAngle) * 60;
    heli.z = player.z + Math.sin(police.heliAngle) * 60;
    heli.y = 22 + Math.sin(police.heliAngle * 2) * 2;
    heli.rotor += dt * 22;
    heli.angle = Math.atan2(player.x - heli.x, player.z - heli.z);
  }

  // Roadblocks at wanted 5, refreshed every 25 seconds.
  police.roadblockTimer -= dt;
  if (police.wanted >= 5) {
    if (world.roadblocks.length === 0 || police.roadblockTimer <= 0) {
      placeRoadblock(world, player, rng);
      police.roadblockTimer = 25;
    }
  } else if (world.roadblocks.length > 0) {
    world.roadblocks = [];
  }

  // Patrol cars chase: steer toward the player, ram the player's car.
  for (const car of world.policeCars) {
    car.lightPhase += dt * 3;
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const d = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    const turn = clamp(angleDelta(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    car.angle += turn;
    const targetSpeed = d > 60 ? 38 : d > 18 ? 30 : 16;
    car.speed += clamp(targetSpeed - car.speed, -20 * dt, 12 * dt);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    car.x = clamp(car.x, -425, 425);
    car.z = clamp(car.z, -425, 440);
    // Ramming the player's car damages it and slows the player.
    if (player.car && d < 5.2 && car.speed > 6) {
      player.car.speed *= 0.82;
      car.speed *= 0.7;
      if (Math.abs(car.speed) > 8) game.audio.punch();
    }
  }

  // Bust timer: on foot, slow, and a patrol car within 4 m.
  if (player.onFoot && police.wanted > 0 && !player.dead) {
    let nearest = Infinity;
    for (const car of world.policeCars) {
      nearest = Math.min(nearest, dist2d(player.x, player.z, car.x, car.z));
    }
    const playerSpeed = Math.abs(player.speed);
    if (nearest < 4.5 && playerSpeed < 2.5) {
      police.bustTimer += dt;
      if (police.bustTimer >= BUST_SECONDS) {
        police.busted = true;
        police.bustTimer = 0;
      }
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    }
  } else {
    police.bustTimer = 0;
  }

  // Wanted cools down when no police unit is close.
  let nearestPolice = Infinity;
  for (const car of world.policeCars) {
    nearestPolice = Math.min(nearestPolice, dist2d(player.x, player.z, car.x, car.z));
  }
  if (world.helicopter) {
    nearestPolice = Math.min(nearestPolice, dist2d(player.x, player.z, world.helicopter.x, world.helicopter.z));
  }
  const hidden = nearestPolice > 70;
  if (hidden && police.wanted > 0) {
    police.heat = Math.max(0, police.heat - WANTED_DECAY * dt * (player.onFoot ? 1.6 : 1));
    police.wanted = heatToLevel(police.heat);
  }
  return police;
}

/** Handle a bust: lose money, wake at the hospital, wanted cleared. */
export function resolveBust(police, player, world, game) {
  police.busted = false;
  police.wanted = 0;
  police.heat = 0;
  police.bustTimer = 0;
  const fine = Math.min(player.money, 250);
  player.money -= fine;
  world.policeCars = [];
  world.helicopter = null;
  world.roadblocks = [];
  if (player.car) {
    player.car.owner = 'parked';
    player.car = null;
  }
  player.onFoot = true;
  player.x = LANDMARKS.hospital.x + 12;
  player.z = LANDMARKS.hospital.z + 12;
  player.angle = Math.PI;
  player.speed = 0;
  player.health = 100;
  game.setDialogue(`Polisi: Ditangkap! Denda Rp ${fine}. Raka dibawa ke Rumah Sakit Harapan.`);
  game.audio.failSting();
  if (game.stats) game.stats.arrests += 1;
}

/** Clear all heat (used when a mission ends cleanly). */
export function clearWanted(police, world) {
  police.wanted = 0;
  police.heat = 0;
  police.bustTimer = 0;
  world.policeCars = [];
  world.helicopter = null;
  world.roadblocks = [];
}
