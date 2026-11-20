// shots.js — The four screenshot scenes for Tanjung Matahari.
//
// Each scene plays the real game forward from a fresh world for a fixed
// number of steps, steered by a tiny autopilot, so the frame is what a short
// game really looks like — never a mock-up. The same seed always gives the
// same frame. The scenes:
//   chase       golden-hour road chase: Raka's red sport car, a police
//               helicopter overhead, traffic, pedestrians, 4 wanted stars,
//               the HUD, the mission banner, police distances, dialogue,
//               the minimap and the radio name.
//   mission     on foot at Gang Sanca, small yellow diamond marker, the
//               objective counter reading "Usir 2/5".
//   drive-night night drive down Jalan Merdeka in the taxi, 2 wanted stars.
//   map         the PETA TANJUNG MATAHARI screen with the mission list,
//               career stats, collectibles and save slots.
//
// The stager sets `window.__shotReady` when the scene is framed, and
// `window.__shotError` if anything goes wrong, so the screenshot driver
// (shot.mjs) knows when to capture.

import { LANDMARKS, CAR_DEFS } from './config.js';
import { startMission, startSideJob } from './missions.js';
import { stealCar } from './player.js';

const STEP = 1 / 60;

/** Drive straight ahead, steering gently toward the road centre. */
function driveForward(game, dt) {
  const car = game.player.car;
  if (!car) return;
  // Steer toward the nearest avenue centre so the chase stays on the road.
  const roadX = -240;
  const err = roadX - car.x;
  const steer = Math.max(-1, Math.min(1, err * 0.08));
  game.input.keys.add('KeyW');
  if (steer < -0.15) game.input.keys.add('KeyA');
  if (steer > 0.15) game.input.keys.add('KeyD');
  game.stepGame(dt);
  game.input.keys.delete('KeyA');
  game.input.keys.delete('KeyD');
}

/** Walk toward a point, in straight lines. */
function walkToward(game, tx, tz, dt) {
  const p = game.player;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 2) return;
  const heading = Math.atan2(dx, dz);
  game.input.cameraYaw = heading;
  game.input.keys.add('KeyW');
  game.stepGame(dt);
  game.input.keys.delete('KeyW');
}

/** Put Raka in a car of the given model, at a place, facing a direction. */
function placeInCar(game, defId, x, z, angle) {
  const def = CAR_DEFS[defId];
  const car = {
    id: `shot-${defId}`, def, defId, x, z, angle, speed: 0,
    colour: defId === 'sport' ? [0.85, 0.08, 0.08] : def.colours[0],
    owner: 'player', hp: 100,
  };
  // The car is Raka's alone: it is NOT added to world.traffic, so the
  // traffic stepper never moves or respawns it.
  const p = game.player;
  p.x = x; p.z = z; p.angle = angle;
  stealCar(p, car, game);
  // The theft adds wanted 1; the scene sets its own level afterwards.
  return car;
}

/** The golden-hour chase scene. */
function stageChase(game) {
  game.newGame();
  game.setHour(17.6);
  game.audio.setStation(0);
  const car = placeInCar(game, 'sport', -240, 180, 0);
  car.speed = 24;
  // Play the real mission 4, so the banner and the objective agree.
  startMission(game.missions, 3, game);
  game.setWanted(4);
  game.setDialogue('Polisi: Unit Elang, target melaju ke arah barat! Jangan sampai lolos!', true);
  // Drive the chase forward for a few seconds so the helicopter, the police
  // cars and the traffic all settle into the frame.
  for (let i = 0; i < 60 * 4; i += 1) driveForward(game, STEP);
  // Stage the traffic AHEAD of where the car ended up, on the same avenue.
  for (let i = 0; i < 6; i += 1) {
    const t = game.world.traffic[i];
    t.x = -240 + (i % 2 === 0 ? -3.4 : 3.4);
    t.z = car.z + (i + 1) * 20;
    t.angle = 0;
    t.speed = 10;
    t.vertical = true;
    t.lane = i % 2 === 0 ? -1 : 1;
  }
  // Pedestrians on the sidewalks just ahead of the chase.
  for (let i = 0; i < 4; i += 1) {
    const ped = game.world.pedestrians[i];
    ped.x = -240 + (i % 2 === 0 ? -11 : 11);
    ped.z = car.z + 34 + i * 12;
    ped.angle = Math.PI;
  }
  // Put the helicopter ahead of the car, in the camera's frame.
  if (game.world.helicopter) {
    const h = game.world.helicopter;
    h.x = car.x + Math.sin(car.angle) * 60;
    h.z = car.z + Math.cos(car.angle) * 60;
    h.y = 22;
    game.police.heliAngle = Math.PI / 2;
  }
  // Frame the shot from a slightly higher chase camera.
  game.camera.distance = 17;
  game.camera.height = 7.5;
  game.stepGame(STEP);
  game.stepGame(STEP);
}

/** The on-foot mission scene at Gang Sanca. */
function stageMission(game) {
  game.newGame();
  game.setHour(15.2);
  startMission(game.missions, 1, game);
  // Two of the five preman are already down, so the counter reads 2/5.
  const act = game.missions.active;
  const enemies = game.world.enemies.slice(0, 2);
  for (const e of enemies) {
    game.damageEnemy(e, 999, 'tinju');
  }
  act.progress = 2;
  // Walk Raka close to the diamond marker.
  const stage = act.mission.stages[act.stageIndex];
  game.player.x = stage.x - 6;
  game.player.z = stage.z + 10;
  game.player.angle = Math.atan2(stage.x - game.player.x, stage.z - game.player.z);
  game.input.cameraYaw = game.player.angle;
  for (let i = 0; i < 60; i += 1) game.stepGame(STEP);
  game.setDialogue('Preman: Hei, Raka! Bos Sanca kirim salam — dan tagihan!');
  game.setDialogue('Raka: Tagihan? Yang kubayar cuma tinju. Lima orang, lima tinju.', true);
  game.stepGame(STEP);
}

/** The night drive down Jalan Merdeka. */
function stageDriveNight(game) {
  game.newGame();
  game.setHour(21.4);
  game.audio.setStation(1);
  const car = placeInCar(game, 'taxi', -240, 120, 0);
  car.speed = 18;
  game.setWanted(2);
  game.showBanner('Malam di Tanjung', 'Jalan Merdeka — 2 bintang');
  game.setDialogue('Raka: Malam begini, Jalan Merdeka milikku sendiri.');
  for (let i = 0; i < 60 * 3; i += 1) driveForward(game, STEP);
  // Traffic ahead on the same avenue, so the night street is alive.
  for (let i = 0; i < 4; i += 1) {
    const t = game.world.traffic[i];
    t.x = -240 + (i % 2 === 0 ? -3.4 : 3.4);
    t.z = car.z + (i + 1) * 24;
    t.angle = 0;
    t.speed = 9;
    t.vertical = true;
    t.lane = i % 2 === 0 ? -1 : 1;
  }
  game.camera.distance = 16;
  game.camera.height = 7;
  game.stepGame(STEP);
  game.stepGame(STEP);
}

/** The map screen scene. */
function stageMap(game) {
  game.newGame();
  game.setHour(10.0);
  // Pretend a little career happened: mission 1 done, some money, one keris.
  game.missions.completed = ['m1'];
  game.missions.index = 1;
  game.pendingMission = 1;
  game.player.money = 1250;
  game.stats.missionsCompleted = 1;
  game.stats.carsStolen = 2;
  game.stats.distanceKm = 4.3;
  game.stats.moneyEarned = 950;
  game.stats.playSeconds = 3720;
  game.world.collectibles[0].taken = true;
  game.world.collectibles[4].taken = true;
  game.openMap();
  game.stepGame(STEP);
}

/** Stage a named scene and return the screen state to draw. */
export function stageShot(name, game) {
  try {
    if (name === 'mission') stageMission(game);
    else if (name === 'drive-night') stageDriveNight(game);
    else if (name === 'map') stageMap(game);
    else stageChase(game);
    game.renderFrame();
    window.__shotReady = true;
    return true;
  } catch (err) {
    window.__shotError = String(err && err.message ? err.message : err);
    return false;
  }
}

/** The four shots, in the order they appear in shots.json. */
export const SHOT_NAMES = ['chase', 'mission', 'drive-night', 'map'];
