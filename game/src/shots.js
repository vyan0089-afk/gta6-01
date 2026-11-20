// shots.js — Screenshot staging for Tanjung Matahari.
// Each shot is a real frame of the real game, staged by playing the game
// forward from a fresh world: the chase drives at 90 km/h with police cars
// and the helicopter in frame, the mission stands Raka in a crowd of guards
// with mission 5/8 on the HUD, the night shot drives at 72 km/h through
// traffic, and the map shot opens the map screen over a career that reads
// 5/8 missions, 34 cars stolen, 8/12 keris and 1 side job done. Staging
// only ever uses the game's own systems — teleporting, stealing a car,
// raising the wanted level, completing missions through the real mission
// engine — so every pixel is the game itself.

import { ROAD_LINES } from './world.js';

/** Drive a car forward along a road for a number of simulated steps. */
function driveForward(game, seconds) {
  const dt = 1 / 60;
  const steps = Math.floor(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    game.input.moveY = 1;
    game.input.moveX = 0;
    game.stepPlaying(dt);
    game.input.moveY = 0;
  }
}

/** Put Raka in a fast car on the beach road, heading east. */
function putInCar(game, x, z, angle, speedKmh) {
  const p = game.player;
  const car = game.traffic.parked.find((c) => !c.stolen && c.model.kind === 'sport')
    || game.traffic.parked.find((c) => !c.stolen);
  if (car) {
    game.traffic.steal(car);
    car.x = x;
    car.z = z;
    car.angle = angle;
    p.enterCar(car, null);
    p.angle = angle;
    p.carSpeed = speedKmh / 3.6;
    car.speed = p.carSpeed;
    p.camYaw = angle + Math.PI;
    p.camX = x - Math.sin(p.camYaw) * 11;
    p.camZ = z - Math.cos(p.camYaw) * 11;
    p.camY = 4.6;
  }
  return car;
}

/** Snap the chase camera to its ideal settled spot (11 m behind the car). */
function snapCamera(game) {
  const p = game.player;
  p.camX = p.x - Math.sin(p.camYaw) * 11;
  p.camY = 4.6 + p.y;
  p.camZ = p.z - Math.cos(p.camYaw) * 11;
}

/** Surround the player with police cars and the helicopter. */
function stagePoliceChase(game, wanted) {
  game.police.raise(wanted, game.player);
  // Place two police cars ahead in the same lane (visible in frame) and
  // two behind, plus the helicopter overhead.
  const p = game.player;
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  const rx = Math.cos(p.angle);
  const rz = -Math.sin(p.angle);
  const spots = [
    [fx * 26 + rx * 3.5, fz * 26 + rz * 3.5],
    [fx * 34 - rx * 3.5, fz * 34 - rz * 3.5],
    [-fx * 16 + rx * 3.5, -fz * 16 + rz * 3.5],
    [-fx * 24 - rx * 3.5, -fz * 24 - rz * 3.5],
  ];
  game.police.units.forEach((u, i) => {
    const [ox, oz] = spots[i % spots.length];
    u.x = p.x + ox;
    u.z = p.z + oz;
    u.angle = p.angle;
    u.speed = 24;
  });
  if (game.police.heli) {
    // The helicopter circles the player on its own step (radius 26, height
    // 34 by default — far above the frame, and on the wrong side: the
    // camera looks down the -x road, so the heli must be at a circling
    // angle near π to be in front of the camera at all). For the shot,
    // lower the circle and aim it so that AFTER the 1.2 s drive-forward
    // it sits ahead of the player, low in the sky and offset to the side
    // so the HUD title at the top centre does not cover it: the angle
    // advances 0.384 rad during the drive, so start 0.384 below π − 0.6.
    game.police.heli.height = 8;
    game.police.heli.radius = 26;
    game.police.heli.angle = Math.PI - 0.6 - 0.384;
    game.police.heli.x = p.x - 21;
    game.police.heli.z = p.z + 15;
    game.police.heli.y = 7;
  }
  // Fill the road ahead with traffic cars so the chase reads busy.
  game.traffic.cars.slice(0, 10).forEach((c, i) => {
    c.horizontal = true;
    c.line = 256;
    c.along = p.x - 60 + i * 14;
    c.dir = 1;
    c.lane = i % 2 === 0 ? 3.5 : -3.5;
    c.cruise = 12 + i;
    c.speed = 12;
    c.updatePosition();
  });
}

/**
 * Stage one of the four named shots. Returns the screen the game should
 * show ('playing' or 'map'). The caller renders a few frames, then sets
 * window.__shotReady.
 */
export function stageShot(name, game) {
  const g = game;
  if (name === 'chase') {
    // Golden hour, beach road, 90 km/h, wanted 4, police + helicopter.
    g.weather.setState(17.4, false);
    g.state = 'playing';
    putInCar(g, -60, 256, Math.PI / 2, 90);
    stagePoliceChase(g, 4);
    g.missions.startMission(4);
    g.missions.stageIndex = 1;
    g.missions.updateObjective();
    g.dialogue.sayNow('Raka', 'Polisi level 4! Helikopter di atas — gas terus!');
    driveForward(g, 1.2);
    // Snap the chase camera to its settled spot: while the car drives at
    // 90 km/h the camera lags 4 m closer and pitches down steeply, which
    // squeezes the sky band to a sliver and pushes the helicopter out of
    // the frame. The settled view is the real chase view.
    snapCamera(g);
    return 'playing';
  }
  if (name === 'mission') {
    // Midday at the harbour, mission 5/8, crowd of guards and workers.
    g.weather.setState(11.0, false);
    g.state = 'playing';
    g.missions.startMission(4);
    g.missions.stageIndex = 1;
    g.missions.updateObjective();
    const p = g.player;
    p.x = 236;
    p.z = 196;
    // Face the mission marker at the dermaga (252, 210) so its beam is in frame.
    p.angle = Math.atan2(252 - 236, 210 - 196);
    p.camYaw = p.angle + Math.PI;
    p.camX = p.x - Math.sin(p.camYaw) * 9;
    p.camZ = p.z - Math.cos(p.camYaw) * 9;
    p.camY = 4.2;
    // A crowd of guards and dock workers around Raka.
    g.crowd.list.slice(0, 14).forEach((ped, i) => {
      ped.x = 236 + (i % 5) * 4 - 8;
      ped.z = 196 + Math.floor(i / 5) * 4 - 4;
      ped.state = 'walk';
      ped.tx = ped.x;
      ped.tz = ped.z;
      if (i < 5) ped.guard = true;
    });
    g.combat.select(1);
    g.dialogue.say([
      ['Kapten Budi', 'Dermaga dikuasai preman, Raka. Lima orang jaga gudang.'],
      ['Raka', 'Lima orang? Aku hitung sampai tiga, mereka yang kabur.'],
    ]);
    return 'playing';
  }
  if (name === 'night') {
    // Night, city road, 72 km/h, traffic all around, lamps on.
    g.weather.setState(21.3, false);
    g.state = 'playing';
    putInCar(g, -160, 0, Math.PI / 2, 72);
    g.traffic.cars.slice(0, 12).forEach((c, i) => {
      c.horizontal = true;
      c.line = 0;
      c.along = g.player.x - 50 + i * 12;
      c.dir = 1;
      c.lane = i % 2 === 0 ? 3.5 : -3.5;
      c.cruise = 14;
      c.speed = 14;
      c.updatePosition();
    });
    g.traffic.cars.slice(12, 18).forEach((c, i) => {
      c.horizontal = true;
      c.line = 64;
      c.along = g.player.x - 40 + i * 14;
      c.dir = -1;
      c.lane = -3.5;
      c.cruise = 12;
      c.speed = 12;
      c.updatePosition();
    });
    g.missions.startMission(1);
    g.dialogue.sayNow('Sari', 'Nitro penuh. Kalau ketemu razia, jangan berhenti.');
    driveForward(g, 1.0);
    return 'playing';
  }
  if (name === 'map') {
    // Map screen over a mid-career save: 5/8, 34 cars, 8/12 keris, 1 job.
    g.weather.setState(16.8, false);
    g.state = 'playing';
    g.missions.done = new Set(['m1', 'm2', 'm3', 'm4', 'm5']);
    g.missions.index = 5;
    g.missions.startMission(5);
    g.stats.carsStolen = 34;
    g.stats.kerisFound = 8;
    g.world.keris.forEach((k, i) => { k.found = i < 8; });
    g.stats.sideJobsDone = 1;
    g.stats.racesWon = 2;
    g.stats.racesRun = 3;
    g.stats.respect = 640;
    g.stats.missionsDone = 5;
    g.stats.distanceDriven = 45200;
    g.stats.distanceWalked = 12300;
    g.stats.topSpeed = 148;
    g.stats.playSeconds = 5400;
    g.stats.moneyEarned = 1850000;
    g.player.money = 1250000;
    g.player.x = 40;
    g.player.z = 150;
    g.player.angle = 0.5;
    g.player.camYaw = g.player.angle + Math.PI;
    g.achievements.unlocked = new Set(['first-steps', 'first-car', 'car-10', 'car-30', 'mission-1', 'mission-4', 'keris-1', 'keris-6', 'race-1', 'job-1', 'garage-1']);
    g.state = 'map';
    return 'map';
  }
  // Default: title screen after a few seconds of world life.
  g.weather.setState(16.4, false);
  g.state = 'title';
  return 'title';
}

/** The four shot names, in dossier order (first is the cover). */
export const SHOT_NAMES = ['chase', 'mission', 'night', 'map'];

/** The URL query value for a shot, e.g. ?shot=chase. */
export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('shot');
    return SHOT_NAMES.includes(s) ? s : null;
  } catch (e) {
    return null;
  }
}

/** What each shot must show, for the maker's own verification. */
export const SHOT_TARGETS = {
  chase: 'Traffic + police cars + helicopter in frame, player car prominent, speedometer showing speed (90 km/h).',
  mission: 'Crowd/guards, 10+ NPCs visible, mission 5/8 shown.',
  night: 'Traffic visible, car moving (72 km/h).',
  map: 'Map/save screen: 5/8 missions done, 30+ cars stolen, 8/12 keris, 1+ side job done.',
};

/** Check a staged shot against its target, from the live game state. */
export function checkShot(name, game) {
  const p = game.player;
  const problems = [];
  if (name === 'chase') {
    if (game.police.wanted < 4) problems.push('wanted below 4');
    if (!game.police.heli) problems.push('no helicopter');
    if (game.police.units.length < 2) problems.push('fewer than 2 police cars');
    if (!p.car) problems.push('player not in a car');
    if (p.speedKmh() < 60) problems.push(`speed only ${Math.round(p.speedKmh())} km/h`);
    if (game.traffic.countNear(p.x, p.z, 60) < 4) problems.push('too little traffic nearby');
  }
  if (name === 'mission') {
    if (game.missions.index !== 4) problems.push('mission index is not 5 (0-based 4)');
    if (game.crowd.countNear(p.x, p.z, 30) < 10) problems.push('fewer than 10 NPCs near the player');
  }
  if (name === 'night') {
    if (!game.weather.night) problems.push('not night');
    if (!p.car) problems.push('player not in a car');
    if (p.speedKmh() < 40) problems.push(`speed only ${Math.round(p.speedKmh())} km/h`);
    if (game.traffic.countNear(p.x, p.z, 60) < 4) problems.push('too little traffic nearby');
  }
  if (name === 'map') {
    if (game.state !== 'map') problems.push('map screen not open');
    if (game.stats.carsStolen < 30) problems.push('fewer than 30 cars stolen');
    if (game.stats.kerisFound < 8) problems.push('fewer than 8 keris');
    if (game.stats.sideJobsDone < 1) problems.push('no side job done');
    if (game.missions.done.size < 5) problems.push('fewer than 5 missions done');
  }
  return problems;
}
