// player.js — Raka, on foot and behind the wheel.
//
// Raka walks the sidewalks, sprints with Shift, and drives anything with four
// wheels. Pressing E near a parked or traffic car steals it: the driver (if
// any) is pulled out, the wanted level rises, and the car becomes Raka's.
// Combat is fists up close (F), or a pistol / shotgun (click to fire) with
// real ammo counts. Driving is arcade-simple on purpose: accelerate, brake,
// steer harder at low speed, handbrake with Space, horn with H. All movement
// collides with buildings and the sea wall; cars also bounce off each other
// with a soft push so pile-ups never lock the game.

import { WEAPONS, WEAPON_ORDER, CAR_DEFS } from './config.js';
import { clamp, dist2d, angleDelta } from './rng.js';
import { hitsBuilding, inSea, isOnRoad } from './world.js';

const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.4;
const PLAYER_RADIUS = 0.7;

/** Create Raka's live state from a fresh snapshot. */
export function createPlayer(snapshot) {
  return {
    x: snapshot.x, z: snapshot.z, angle: snapshot.angle, speed: 0,
    health: snapshot.health, armour: snapshot.armour, money: snapshot.money,
    weapon: snapshot.weapon,
    ammo: { pistol: snapshot.ammo.pistol, shotgun: snapshot.ammo.shotgun },
    onFoot: true,
    car: null,           // the car Raka is driving, or null
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    dead: false,
    moving: false,
    mutterTimer: 14,
    distanceDriven: 0,
    carsStolen: 0,
    onFootDistance: 0,
  };
}

/** Try to move a point, sliding along building walls. Returns the new position. */
export function moveWithCollision(world, x, z, dx, dz, radius) {
  let nx = x + dx;
  let nz = z + dz;
  if (inSea(nx)) nx = x;
  if (hitsBuilding(world, nx, z, radius)) nx = x;
  if (hitsBuilding(world, nx, nz, radius)) nz = z;
  if (inSea(nx)) nx = x;
  nx = clamp(nx, -425, 425);
  nz = clamp(nz, -425, 440);
  return { x: nx, z: nz };
}

/** On-foot step: WASD relative to the camera heading. */
export function stepOnFoot(player, world, input, dt) {
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
  let fx = 0;
  let fz = 0;
  const heading = input.cameraYaw;
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  if (input.keys.has('KeyW')) { fx += sin; fz += cos; }
  if (input.keys.has('KeyS')) { fx -= sin; fz -= cos; }
  if (input.keys.has('KeyD')) { fx += cos; fz -= sin; }
  if (input.keys.has('KeyA')) { fx -= cos; fz += sin; }
  const len = Math.hypot(fx, fz);
  player.moving = len > 0.01;
  if (len > 0.01) {
    fx /= len;
    fz /= len;
    const targetAngle = Math.atan2(fx, fz);
    player.angle += clamp(angleDelta(player.angle, targetAngle), -9 * dt, 9 * dt);
    const moved = moveWithCollision(world, player.x, player.z, fx * speed * dt, fz * speed * dt, PLAYER_RADIUS);
    player.onFootDistance += dist2d(player.x, player.z, moved.x, moved.z);
    player.x = moved.x;
    player.z = moved.z;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
}

/** Find the nearest stealable car within reach of the player. */
export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = dist2d(player.x, player.z, car.x, car.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

/** Steal a car: pull the driver out if it is traffic, mark the theft. */
export function stealCar(player, car, game) {
  if (car.owner === 'traffic') {
    // The driver jumps out and runs away; the car is Raka's now.
    game.spawnFleeingDriver(car);
    game.addWanted(1, 'Mencuri mobil di jalan');
  } else if (car.owner === 'parked') {
    game.addWanted(1, 'Mencuri mobil parkir');
  }
  car.owner = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.z = car.z;
  player.angle = car.angle;
  player.carsStolen += 1;
  if (game.stats) game.stats.carsStolen += 1;
  game.setDialogue(`Raka: Mobil ${car.def.name} ini sekarang milikku.`);
  game.audio.horn();
  return car;
}

/** Get out of the car, stepping to the side of it. */
export function exitCar(player, world) {
  const car = player.car;
  if (!car) return;
  const side = Math.PI / 2;
  const px = car.x + Math.sin(car.angle + side) * 2.4;
  const pz = car.z + Math.cos(car.angle + side) * 2.4;
  const spot = moveWithCollision(world, car.x, car.z, px - car.x, pz - car.z, PLAYER_RADIUS);
  player.x = spot.x;
  player.z = spot.z;
  player.angle = car.angle;
  player.car = null;
  player.onFoot = true;
  player.speed = 0;
  car.speed = 0;
}

/** Driving step: W/S accelerate and brake, A/D steer, Space handbrake. */
export function stepDriving(player, world, input, dt, game) {
  const car = player.car;
  if (!car) return;
  const def = car.def;
  const forward = input.keys.has('KeyW');
  const back = input.keys.has('KeyS');
  const handbrake = input.keys.has('Space');
  const steerLeft = input.keys.has('KeyA');
  const steerRight = input.keys.has('KeyD');
  if (forward) car.speed += def.accel * dt;
  else if (back) {
    if (car.speed > 0.5) car.speed -= def.brake * dt;
    else car.speed -= def.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  car.speed = clamp(car.speed, -def.topSpeed * 0.4, def.topSpeed);
  const steerAmount = (steerLeft ? -1 : 0) + (steerRight ? 1 : 0);
  const steerFactor = clamp(1 - Math.abs(car.speed) / (def.topSpeed * 1.6), 0.35, 1);
  const turnRate = steerAmount * 1.9 * steerFactor * def.grip * (handbrake ? 1.5 : 1);
  if (Math.abs(car.speed) > 0.2) {
    car.angle += turnRate * dt * Math.sign(car.speed);
  }
  const dx = Math.sin(car.angle) * car.speed * dt;
  const dz = Math.cos(car.angle) * car.speed * dt;
  const moved = moveWithCollision(world, car.x, car.z, dx, dz, def.length / 2);
  const hitWall = (moved.x === car.x && Math.abs(dx) > 0.01) || (moved.z === car.z && Math.abs(dz) > 0.01);
  if (hitWall) {
    if (Math.abs(car.speed) > 12) {
      game.damagePlayer(0, Math.abs(car.speed) * 0.35, 'Menabrak tembok');
      game.audio.punch();
    }
    car.speed *= 0.35;
  }
  car.x = moved.x;
  car.z = moved.z;
  // Soft collision with other cars: push apart, lose a little speed.
  for (const other of game.allCars()) {
    if (other === car || other.wrecked) continue;
    const d = dist2d(car.x, car.z, other.x, other.z);
    const minD = (def.length + other.def.length) / 2 - 0.6;
    if (d < minD && d > 0.01) {
      const push = (minD - d) / 2;
      const nx = (car.x - other.x) / d;
      const nz = (car.z - other.z) / d;
      car.x += nx * push;
      car.z += nz * push;
      if (other.owner === 'traffic') {
        other.x -= nx * push;
        other.z -= nz * push;
        other.speed *= 0.5;
      }
      if (Math.abs(car.speed) > 9) {
        game.addWanted(0, '');
        car.speed *= 0.7;
      }
    }
  }
  player.x = car.x;
  player.z = car.z;
  player.angle = car.angle;
  player.speed = car.speed;
  player.distanceDriven += Math.abs(car.speed) * dt;
  if (game.stats) game.stats.distanceKm += (Math.abs(car.speed) * dt) / 1000;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  game.audio.setEngine(Math.abs(car.speed) / def.topSpeed, true);
}

/** Switch weapon by slot (0 fists, 1 pistol, 2 shotgun). */
export function selectWeapon(player, slot) {
  const id = WEAPON_ORDER[slot];
  if (!id) return false;
  if (id !== 'fists' && (player.ammo[id] ?? 0) <= 0 && player.weapon !== id) {
    return false;
  }
  player.weapon = id;
  return true;
}

/** Cycle to the next weapon that has ammo (Q / weapon wheel). */
export function cycleWeapon(player) {
  const current = WEAPON_ORDER.indexOf(player.weapon);
  for (let i = 1; i <= WEAPON_ORDER.length; i += 1) {
    const next = WEAPON_ORDER[(current + i) % WEAPON_ORDER.length];
    if (next === 'fists' || (player.ammo[next] ?? 0) > 0) {
      player.weapon = next;
      return next;
    }
  }
  return player.weapon;
}

/** Find enemies / police in front of the player within a cone. */
export function targetsInCone(player, targets, range, halfAngle) {
  const out = [];
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const d = dist2d(player.x, player.z, t.x, t.z);
    if (d > range) continue;
    const want = Math.atan2(t.x - player.x, t.z - player.z);
    if (Math.abs(angleDelta(player.angle, want)) < halfAngle) out.push({ target: t, dist: d });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

/** Punch: hits the nearest enemy or pedestrian in front, close range. */
export function punch(player, game) {
  if (player.punchTimer > 0) return false;
  player.punchTimer = 1 / WEAPONS.fists.rate;
  game.audio.punch();
  const w = WEAPONS.fists;
  const hits = targetsInCone(player, game.enemiesAlive(), w.range, 0.9);
  if (hits.length > 0) {
    const hit = hits[0].target;
    game.damageEnemy(hit, w.damage, 'tinju');
    return true;
  }
  const peds = targetsInCone(player, game.world.pedestrians.map((p) => ({ ...p, hp: 1 })), w.range, 0.9);
  if (peds.length > 0) {
    game.addWanted(1, 'Memukul warga');
    game.setDialogue('Warga: Tolong! Ada yang menyerang!');
    return true;
  }
  return false;
}

/** Shoot the current gun at the nearest target in front. Returns 'hit' | 'miss' | 'empty'. */
export function shoot(player, game) {
  const weapon = WEAPONS[player.weapon];
  if (!weapon || player.weapon === 'fists') return 'empty';
  if (player.shootTimer > 0) return 'wait';
  if ((player.ammo[player.weapon] ?? 0) <= 0) {
    game.setDialogue(`Raka: ${weapon.name} kehabisan peluru!`);
    return 'empty';
  }
  player.shootTimer = 1 / weapon.rate;
  player.ammo[player.weapon] -= 1;
  game.audio.gunshot(player.weapon === 'shotgun');
  if (game.stats) game.stats.shotsFired += 1;
  const spread = player.weapon === 'shotgun' ? 0.45 : 0.12;
  const hits = targetsInCone(player, game.enemiesAlive(), weapon.range, spread + 0.15);
  if (hits.length > 0) {
    const hit = hits[0].target;
    game.damageEnemy(hit, weapon.damage, weapon.name.toLowerCase());
    game.addWanted(1, 'Menembak di jalan');
    return 'hit';
  }
  // A missed shot still draws attention if police are near.
  game.addWanted(0, '');
  return 'miss';
}

/** Give the player ammo (mission rewards, pickups). */
export function giveAmmo(player, weaponId, amount) {
  if (weaponId === 'fists') return;
  player.ammo[weaponId] = (player.ammo[weaponId] ?? 0) + amount;
}

/** Heal / armour the player, clamped to 100. */
export function healPlayer(player, health, armour) {
  player.health = clamp(player.health + health, 0, 100);
  player.armour = clamp(player.armour + armour, 0, 100);
}
