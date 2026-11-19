// main.js — boots Tanjung Matahari: canvas, game loop, and the deterministic
// screenshot staging used by shots.json (?shot=title|drive|mission|city).
// Without a ?shot param the game starts on the title screen, like a player
// would see it.

import { Game } from './game.js';
import { createCar, driveCar } from './vehicles.js';
import { createPed } from './peds.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

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
  if (kind === 'drive') {
    // Raka in a Panther GT on the coastal road, wanted 3, two patrol cars on his tail.
    const car = createCar('sport', -40, 240, 0, [0.9, 0.15, 0.15], 'player');
    car.engine = 1;
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = car.x;
    game.player.z = car.z;
    game.camera.yaw = Math.PI;
    game.police.heat = 60;
    game.police.wanted = 3;
    game.police.say('Elang-1: Tersangka melaju di Jalan Pantai. Kejar!');
    game.missions.objective = 'Kabur dari kejaran polisi di Jalan Pantai';
    game.missions.marker = { x: 160, z: 240, radius: 9, label: 'Kabur' };
    fixedSteps(150, (i) => {
      // Autopilot: full throttle, gentle weave.
      const c = game.playerCar;
      if (c) driveCar(c, 1, Math.sin(i / 40) * 0.35, 1 / 60, game.city.colliders, game.allCars);
    });
    game.shotFrozen = true;
    return;
  }
  if (kind === 'mission') {
    // On foot in the market, pistol out, gang members closing in.
    // Camera yaw equals the player heading: the camera sits behind Raka
    // and looks where he faces, toward the market and the gang.
    game.player.x = -2;
    game.player.z = 10;
    game.player.heading = Math.PI;
    game.camera.yaw = Math.PI;
    game.weapons.current = 'pistol';
    game.weapons.hasShotgun = true;
    game.missions.objective = 'Usir 5 anggota Gang Sanca dari Pasar Malam';
    game.missions.marker = { x: 0, z: 0, radius: 12, label: 'Lawan' };
    const gangSpots = [[4, -8], [9, -11], [-2, -12], [12, -4], [-8, -6]];
    for (let i = 0; i < 5; i++) {
      const ped = createPed(gangSpots[i][0], gangSpots[i][1], R, 'gang');
      ped.name = 'Gang Sanca';
      ped.weapon = 'pistol';
      ped.shootTimer = 2;
      game.peds.push(ped);
      game.missions.spawnedPeds.push(ped);
    }
    // A parked hero car and a taxi for street life.
    const taxi = createCar('taxi', 12, 14, 1.2, null, 'traffic');
    game.cars.push(taxi);
    fixedSteps(90);
    game.shotFrozen = true;
    return;
  }
  if (kind === 'city') {
    // Wide postcard view: handled by the camera in render(). Just settle the world.
    game.time = 30;
    fixedSteps(60);
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
