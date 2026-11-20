// main.js — boots Tanjung Matahari: canvas, game loop, and the deterministic
// screenshot staging used by shots.json
// (?shot=chase|mission|drive|map). Without a ?shot param the game starts on
// the title screen, like a player would see it.

import { Game } from './game.js';
import { createCar, driveCar } from './vehicles.js';
import { spawnCrowd, spawnStanders } from './peds.js';
import { saveGame } from './save.js';
import { clamp } from './math.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('sr-status');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const shot = params.get('shot');

window.addEventListener('error', (e) => {
  window.__shotError = String(e.message || e.error);
  setStatus('Error: ' + (e.message || e.error));
});

let game;
try {
  game = new Game(canvas, { seed, shot });
} catch (e) {
  window.__shotError = String(e && e.message ? e.message : e);
  setStatus('Failed to start: ' + (e && e.message ? e.message : e));
  throw e;
}
window.__game = game;
// Debug handle for the shot tooling: which shot and seed staged this page.
window.__shotInfo = { shot: shot ?? null, seed };

// ---- Deterministic shot staging ---------------------------------------
// Each shot puts the world in a fixed state, runs the simulation a fixed
// number of steps, then freezes it so the captured frame is the same every
// time. The game still plays normally without a ?shot param.

function fixedSteps(n, drive) {
  for (let i = 0; i < n; i++) {
    if (drive) drive(i);
    game.update(1 / 60);
  }
}

// Autopilot that holds an eastbound car on its road: steer toward the
// centreline (heading PI/2 = east; too far south needs heading > PI/2,
// i.e. positive steer) plus a small weave. A bare sine weave drifts off
// the 10-unit road and into the blocks — the v1 drive shot did exactly
// that, ending on the sand.
function roadPilot(car, targetZ, i, colliders, allCars) {
  const steer = clamp((car.z - targetZ) * 0.06, -0.5, 0.5) + Math.sin(i / 20) * 0.08;
  driveCar(car, 1, steer, 1 / 60, colliders, allCars);
}

// Lay out a shot's own traffic in the two lanes of a road: eastbound cars
// at z - 4, westbound at z + 4, all offset from the player's centreline so
// nobody side-swipes the hero car mid-shot.
function stageTraffic(cars) {
  for (const [model, x, z, heading] of cars) {
    const t = createCar(model, x, z, heading, null, 'traffic');
    t.node = -1;
    game.cars.push(t);
  }
}

// Remove the random traffic from a stretch of road around (x, z), so the
// staged traffic is the only traffic the camera sees.
function clearTrafficNear(x, z, radius) {
  game.cars = game.cars.filter((c) => c.owner !== 'traffic' || Math.hypot(c.x - x, c.z - z) > radius);
}

function stageShot(kind) {
  game.state = 'playing';
  game.hud.hideMenu();
  const R = game.rng;
  if (kind === 'title') {
    game.state = 'title';
    game.time = 12; // late-afternoon light on the title orbit
    // The title menu from the constructor was hidden by stageShot's prologue;
    // show it again over the city backdrop.
    game.hud.showTitle(true, () => {});
    // Park a hero car on the beach road for the title backdrop.
    const car = createCar('sport', -120, 252, 2.4, [0.9, 0.15, 0.15], 'parked');
    game.cars.push(car);
    return;
  }
  if (kind === 'chase') {
    // COVER: golden-hour chase east along Jalan Pantai (z = 240). Raka in a
    // Panther GT, wanted 4, helicopter overhead, patrol cars and traffic on
    // the road, warung crowds on the sidewalk. Heading PI/2 drives +x, i.e.
    // along the road — the v1 drive shot drove +z, off the road onto sand.
    game.setLighting('golden');
    game.dayMinutes = 17 * 60 + 48; // 17:48, golden hour
    game.missions.startMission(5); // m6 "Malam di Tanjung": survive the heat
    game.missions.banner = null; // keep the transient title banner out of the frozen frame
    game.police.addHeat(80, 'Kejaran bintang 4 di Jalan Pantai');
    const car = createCar('sport', -60, 240, Math.PI / 2, [0.9, 0.15, 0.15], 'player');
    car.engine = 1;
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = car.x;
    game.player.z = car.z;
    game.missions.objective = 'Kabur dari kejaran bintang 4 di Jalan Pantai';
    clearTrafficNear(-60, 240, 90);
    stageTraffic([
      ['sedan', 15, 236, Math.PI / 2], ['taxi', 55, 236, Math.PI / 2], ['van', 100, 236, Math.PI / 2],
      ['hatch', 20, 244, -Math.PI / 2], ['bajaj', 65, 244, -Math.PI / 2], ['sedan', -35, 244, -Math.PI / 2],
    ]);
    // Sidewalk crowd by the warung carts, plus two vendors standing at
    // their carts watching the chase go past.
    spawnCrowd(game.peds, 10, 250, 6, R);
    spawnStanders(game.peds, [[-36, 249, Math.PI], [36, 249, Math.PI]], R);
    fixedSteps(120, (i) => {
      const c = game.playerCar;
      if (c) roadPilot(c, 240, i, game.city.colliders, game.allCars);
    });
    // Pose the chase for the frame: two patrol cars head-on ahead in both
    // lanes, helicopter low and ahead so it is actually in the frame.
    const px = game.playerCar.x;
    const pz = game.playerCar.z;
    if (game.police.cops[0]) {
      const c = game.police.cops[0];
      c.x = px + 34;
      c.z = 236;
      c.heading = -Math.PI / 2;
      c.speed = 12;
    }
    if (game.police.cops[1]) {
      const c = game.police.cops[1];
      c.x = px + 55;
      c.z = 244;
      c.heading = -Math.PI / 2;
      c.speed = 12;
    }
    game.police.heli = { x: px + 32, z: pz + 28, y: 13, angle: 0.5 };
    game.refreshHud();
    game.shotFrozen = true;
    return;
  }
  if (kind === 'mission') {
    // Golden-hour fight in the market: Raka on foot, pistol out, Gang Sanca
    // closing in — two already down, so the HUD counter reads "Usir 2/5".
    // Uses the real mission (m7 "Perang Gang"), not hand-placed actors.
    game.setLighting('golden');
    game.dayMinutes = 17 * 60 + 20; // 17:20, low sun over the market
    game.player.x = -2;
    game.player.z = 10;
    game.player.heading = Math.PI;
    game.camera.yaw = Math.PI;
    game.weapons.current = 'pistol';
    game.weapons.hasShotgun = true;
    game.missions.startMission(6); // m7, stage 1: defeat 5 gang at market
    game.missions.banner = null; // keep the transient title banner out of the frozen frame
    // Market shoppers caught in the fight.
    spawnCrowd(game.peds, 24, 18, 5, R);
    // A parked hero car and a taxi for street life.
    const taxi = createCar('taxi', 12, 14, 1.2, null, 'traffic');
    game.cars.push(taxi);
    fixedSteps(90);
    // Two gang members already down: mid-fight, counter at 2/5.
    const gang = game.missions.spawnedPeds;
    for (let i = 0; i < 2 && i < gang.length; i++) {
      gang[i].dead = true;
      gang[i].deadAt = game.time;
    }
    game.player.health = 82;
    game.player.armour = 40;
    game.money = 1250;
    game.refreshHud(); // sync the DOM counter ("Usir 2/5") and vitals
    game.shotFrozen = true;
    return;
  }
  if (kind === 'drive') {
    // Night drive: Raka in the gold Panther GT on Jalan Merdeka (z = 200),
    // wanted 2, lamps and headlights carrying the scene.
    game.setLighting('night');
    game.dayMinutes = 21 * 60 + 30; // 21:30
    const car = createCar('sport', -120, 200, Math.PI / 2, [0.95, 0.8, 0.15], 'player');
    car.engine = 1;
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = car.x;
    game.player.z = car.z;
    game.police.addHeat(40, 'Tersangka melaju di Jalan Merdeka');
    game.missions.objective = 'Jelajahi Jalan Merdeka di malam hari';
    game.missions.marker = { x: 120, z: 200, radius: 9, label: 'Jalan Merdeka' };
    clearTrafficNear(-120, 200, 90);
    stageTraffic([
      ['sedan', 10, 196, Math.PI / 2], ['taxi', 55, 196, Math.PI / 2], ['bajaj', 95, 196, Math.PI / 2],
      ['hatch', 0, 204, -Math.PI / 2], ['van', 50, 204, -Math.PI / 2],
    ]);
    spawnCrowd(game.peds, -40, 208, 5, R);
    fixedSteps(150, (i) => {
      const c = game.playerCar;
      if (c) roadPilot(c, 200, i, game.city.colliders, game.allCars);
    });
    game.refreshHud();
    game.shotFrozen = true;
    return;
  }
  if (kind === 'map') {
    // The map screen: golden-hour city behind the panel, 5 of 8 missions
    // done, 4 of 12 statues found, slot 1 holding a real save made here.
    game.setLighting('golden');
    game.dayMinutes = 17 * 60 + 48;
    game.money = 2450;
    game.respect = 87;
    game.missions.done = ['m1', 'm2', 'm3', 'm4', 'm5'];
    game.missions.index = 5;
    game.missions.objective = 'Misi 6: Malam di Tanjung menanti.';
    for (let i = 0; i < 4; i++) game.statues[i].taken = true;
    fixedSteps(30);
    saveGame(game.saveState(), 1);
    game.toggleMap();
    game.shotFrozen = true;
    return;
  }
  if (kind === 'city') {
    // Wide postcard view: handled by the camera in render(). Settle the
    // world, then park a few cars on the beach road for the foreground.
    game.time = 30;
    fixedSteps(60);
    const postcard = createCar('sport', -40, 244, Math.PI / 2, [0.9, 0.15, 0.15], 'parked');
    game.cars.push(postcard);
    game.shotFrozen = true;
    return;
  }
}

// ---- Main loop ----
let last = performance.now();
let frames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  try {
    if (game.state === 'title') game.time += dt;
    if (!game.shotFrozen) game.update(dt);
    game.render();
  } catch (e) {
    window.__shotError = String(e && e.message ? e.message : e);
    setStatus('Error: ' + (e && e.message ? e.message : e));
  }
  if (shot && frames === 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}

if (shot) {
  try {
    stageShot(shot);
    setStatus(`Tanjung Matahari — shot ${shot}`);
  } catch (e) {
    window.__shotError = String(e && e.message ? e.message : e);
  }
  // Give the renderer a few frames, then signal readiness for the screenshot.
  requestAnimationFrame(frame);
} else {
  setStatus('Tanjung Matahari — tekan tombol untuk mulai');
  requestAnimationFrame(frame);
}
