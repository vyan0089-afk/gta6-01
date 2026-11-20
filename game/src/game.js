// game.js — Tanjung Matahari itself: the player on foot and behind the
// wheel, carjacking, combat, police chases, missions, side jobs, the garage
// and the save. This file owns the world state; renderer.js draws it and
// hud.js shows it.
//
// The frame is: update(dt) moves the world, render() draws it, and the HUD
// refreshes from the same state, so what the player sees always matches
// what the game thinks is true.

import { Rng, hashString } from './rng.js';
import { clamp, clampAngle, lerp, angleDiff, dist2D, smoothstep, mat4Perspective, mat4LookAt } from './math.js';
import { Renderer } from './renderer.js';
import { buildCity, resolveCollisions, nearestRoadPoint } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Hud } from './hud.js';
import { createCar, driveCar, updateTraffic, drawCar, conditionLabel, spawnParkedCar, spawnTrafficCar, CAR_MODELS } from './vehicles.js';
import { createPed, updatePed, wanderTarget, spawnCrowd, spawnMarketCrowd, scatterNearby, drawPed } from './peds.js';
import { PoliceSys, wantedLabel } from './police.js';
import { MissionSys, MISSIONS } from './missions.js';
import { saveGame, loadGame, hasSave, clearSave, clearAllSaves, saveSlotInfo } from './save.js';

// Raka's look: red shirt, dark trousers, warm skin tone.
const RAKA = { shirt: [0.85, 0.25, 0.22], pants: [0.20, 0.22, 0.30], skin: [0.85, 0.65, 0.50] };

// Twelve golden "Patung Tanjung" statues hidden near the city's landmarks:
// the collectible the map screen counts (X/12). Fixed spots, no RNG.
const STATUE_SPOTS = [
  { near: 'home', dx: -8, dz: 6 }, { near: 'garage', dx: 8, dz: -6 },
  { near: 'market', dx: 14, dz: 10 }, { near: 'market', dx: -14, dz: -10 },
  { near: 'harbor', dx: -20, dz: -8 }, { near: 'beach', dx: 10, dz: -6 },
  { near: 'villa', dx: 6, dz: 10 }, { near: 'safehouse', dx: -8, dz: 8 },
  { near: 'oldtown', dx: 10, dz: 6 }, { near: 'taxiStand', dx: -8, dz: -8 },
  { near: 'raceStart', dx: 8, dz: -8 }, { near: 'gangHQ', dx: -10, dz: 10 },
];

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.seed = opts.seed ?? 1;
    this.rng = new Rng(hashString('tanjung-game-' + this.seed));
    this.city = buildCity(this.seed);
    this.renderer = new Renderer(canvas);
    this.renderer.setStatic(this.city.mesh);
    this.lighting = 'day';
    this.renderer.setLighting('day');
    // In-game clock: starts 10:15, one game minute every two real seconds.
    this.dayMinutes = 10 * 60 + 15;
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.hud = new Hud();
    this.police = new PoliceSys(this.city, this.rng);
    this.missions = new MissionSys(this.city, this.rng);

    this.state = 'title'; // title | playing | paused | map | garage | gameover | complete
    this.time = 0;
    this.money = 300;
    this.respect = 0;
    this.missionIndex = 0;
    this.garage = { engine: 0, armour: 0, paint: 0 };
    this.weapons = { current: 'fists', pistolAmmo: 60, shotgunAmmo: 24, hasPistol: true, hasShotgun: false };
    this.settings = { volume: 0.5, sensitivity: 1.0, music: true };
    this.ownedCars = [];

    this.player = { x: -40, z: -40, heading: 0, health: 100, armour: 0, speed: 0, lastDamage: -99 };
    this.playerCar = null;
    this.cars = [];
    this.peds = [];
    // Career stats, shown on the map screen and kept in the save.
    this.stats = { carsStolen: 0, shotsFired: 0, distanceDriven: 0, foesDown: 0 };
    this.camera = { yaw: 0, pitch: 0.42, dist: 10 };
    this.camPos = [0, 8, -20];
    this.camTarget = [0, 2, 0];
    this.shotMode = opts.shot ?? null;
    this.shotFrozen = false;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.muzzle = 0;
    this.stageKey = '';
    this.interactTarget = null;
    this.damageCooldown = 0;

    this.spawnWorld();
    this.statues = STATUE_SPOTS.map((s, i) => {
      const l = this.city.locations[s.near];
      return { id: i, x: l.x + s.dx, z: l.z + s.dz, taken: false };
    });
    this.hud.showTitle(hasSave(), (a) => this.titleAction(a));
    this.hud.setRadio(this.audio.currentStation(), true);
    // M / Esc closes the map screen. update() is paused while the map is
    // open, so the normal key handling never sees the press — this listener
    // catches it instead.
    window.addEventListener('keydown', (e) => {
      if (this.state === 'map' && (e.code === 'KeyM' || e.code === 'Escape')) {
        this.state = 'playing';
        this.hud.hideMenu();
        this.hud.minimap.style.display = '';
        this.input.poll();
      }
    });
  }

  // Switch the lighting preset and remember it (staging uses 'golden' /
  // 'night'; normal play stays on 'day').
  setLighting(preset) {
    this.lighting = preset;
    this.renderer.setLighting(preset);
  }

  // "17:48 · Sore" for the HUD clock and the map screen.
  clockText() {
    const mins = Math.floor(this.dayMinutes) % (24 * 60);
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const part = hh < 11 ? 'Pagi' : hh < 15 ? 'Siang' : hh < 18 ? 'Sore' : 'Malam';
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${part}`;
  }

  // ---- World setup ------------------------------------------------------

  spawnWorld() {
    const roads = this.city.roads;
    // Parked cars along the streets, ready to be stolen.
    const parkedModels = ['sedan', 'hatch', 'sport', 'van', 'truck', 'sedan', 'hatch'];
    for (let i = 0; i < 20; i++) {
      this.cars.push(spawnParkedCar(this.rng, roads, parkedModels));
    }
    // Traffic. Sedans and hatches are the common cars; trucks and bajaj
    // are rarer, so the mix reads like a real Indonesian street. Denser
    // than v1: the city must never look empty from the driver's seat.
    const trafficMix = [['sedan', 3], ['hatch', 2], ['van', 2], ['taxi', 2], ['truck', 1], ['bajaj', 2]];
    for (let i = 0; i < 32; i++) {
      this.cars.push(spawnTrafficCar(this.rng, roads, trafficMix));
    }
    // Pedestrians, scattered across the whole city.
    for (let i = 0; i < 60; i++) {
      const x = (this.rng.float() - 0.5) * 460;
      const z = (this.rng.float() - 0.5) * 460;
      const ped = createPed(x, z, this.rng, 'walker');
      wanderTarget(ped, roads, this.rng);
      this.peds.push(ped);
    }
  }

  get allCars() {
    return [...this.cars, ...this.police.cops, ...this.police.roadblocks, ...this.missions.spawnedCars];
  }

  // ---- Menus ------------------------------------------------------------

  titleAction(action) {
    this.audio.ensure();
    if (action === 'continue') {
      const s = loadGame();
      if (s) this.applySave(s);
      this.startPlaying();
    } else if (action === 'new') {
      clearAllSaves();
      this.startPlaying();
    } else if (action === 'how') {
      this.hud.showHow((a) => {
        if (a === 'back') this.hud.showTitle(hasSave(), (x) => this.titleAction(x));
      });
    } else if (action === 'settings') {
      this.hud.showSettings(this.settings, (a, v) => this.settingsAction(a, v, 'title'));
    }
  }

  settingsAction(action, value, from) {
    if (action === 'volume') {
      this.settings.volume = value;
      if (this.audio.master) this.audio.master.gain.value = value;
    } else if (action === 'sensitivity') {
      this.settings.sensitivity = value;
    } else if (action === 'music') {
      this.settings.music = value;
      this.audio.radioOn = value;
    } else if (action === 'back') {
      if (from === 'title') this.hud.showTitle(hasSave(), (a) => this.titleAction(a));
      else this.hud.showPause((a) => this.pauseAction(a));
    }
  }

  pauseAction(action) {
    if (action === 'resume') {
      this.state = 'playing';
      this.hud.hideMenu();
    } else if (action === 'map') {
      this.toggleMap();
    } else if (action === 'save') {
      saveGame(this.saveState());
      this.hud.showPause((a) => this.pauseAction(a));
    } else if (action === 'settings') {
      this.hud.showSettings(this.settings, (a, v) => this.settingsAction(a, v, 'pause'));
    } else if (action === 'quit') {
      this.state = 'title';
      this.hud.showTitle(hasSave(), (a) => this.titleAction(a));
    }
  }

  // ---- Map screen (M) ----------------------------------------------------

  toggleMap() {
    if (this.state === 'map') {
      this.state = 'playing';
      this.hud.hideMenu();
      this.hud.minimap.style.display = '';
      this.input.poll();
      return;
    }
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = 'map';
    // The small minimap is empty while the map is open (it only draws while
    // playing), so hide it instead of showing a dead black box.
    this.hud.minimap.style.display = 'none';
    this.hud.showMap(this.mapData(), (a) => this.mapAction(a));
  }

  mapData() {
    return {
      missions: this.missions.progressList(),
      nextMission: this.missions.nextMission(),
      money: this.money,
      respect: this.respect,
      statuesTaken: this.statues.filter((s) => s.taken).length,
      statuesTotal: this.statues.length,
      stats: this.stats,
      slots: [saveSlotInfo(1), saveSlotInfo(2)],
      clock: this.clockText(),
      mapState: {
        roads: this.city.roads,
        colliders: this.city.colliders,
        marker: this.missions.marker,
        police: this.police.cops,
        traffic: this.cars.filter((c) => c.owner === 'traffic'),
        player: this.player,
        time: this.time,
      },
    };
  }

  mapAction(action) {
    if (action === 'resume') {
      this.state = 'playing';
      this.hud.hideMenu();
      this.input.poll();
    } else if (action === 'save-1' || action === 'save-2') {
      const slot = action === 'save-1' ? 1 : 2;
      saveGame(this.saveState(), slot);
      // Re-show so the slot line updates to the save just made.
      this.hud.showMap(this.mapData(), (a) => this.mapAction(a));
    }
  }

  garageAction(action) {
    if (action === 'close') {
      this.state = 'playing';
      this.hud.hideMenu();
      return;
    }
    const kind = action.replace('buy-', '');
    const costs = { engine: 400 * (this.garage.engine + 1), armour: 350 * (this.garage.armour + 1), paint: 200 };
    const maxes = { engine: 3, armour: 3, paint: 1 };
    if (this.garage[kind] >= maxes[kind]) return;
    if (this.money < costs[kind]) {
      this.hud.setPrompt('Uang tidak cukup!');
      return;
    }
    this.money -= costs[kind];
    this.garage[kind]++;
    if (this.playerCar) {
      if (kind === 'engine') this.playerCar.engine = this.garage.engine;
      if (kind === 'armour') this.playerCar.armour = this.garage.armour;
      if (kind === 'paint') this.playerCar.paint = [this.rng.float(), this.rng.float(), this.rng.float()];
    }
    this.audio.blip(990, 0.15);
    this.hud.showGarage(this.garage, this.money, (a) => this.garageAction(a));
  }

  applySave(s) {
    this.money = s.money;
    this.respect = s.respect;
    this.missionIndex = s.missionIndex;
    this.missions.index = s.missionIndex;
    this.missions.done = s.missionsDone ?? [];
    this.player.x = s.player.x;
    this.player.z = s.player.z;
    this.player.heading = s.player.heading;
    this.player.health = s.player.health;
    this.player.armour = s.player.armour;
    this.garage = s.garage;
    this.weapons = s.weapons;
    this.audio.station = s.radioStation ?? 0;
    this.ownedCars = s.ownedCars ?? [];
    this.dayMinutes = s.dayMinutes ?? 615;
    if (s.stats) Object.assign(this.stats, s.stats);
    const taken = new Set(s.collectedStatues ?? []);
    this.statues.forEach((st) => {
      st.taken = taken.has(st.id);
    });
    Object.assign(this.settings, s.settings ?? {});
  }

  saveState() {
    return {
      money: this.money,
      respect: this.respect,
      missionIndex: this.missions.index,
      missionsDone: this.missions.done,
      player: this.player,
      garage: this.garage,
      weapons: this.weapons,
      radioStation: this.audio.station,
      ownedCars: this.ownedCars,
      settings: this.settings,
      dayMinutes: this.dayMinutes,
      stats: { ...this.stats },
      statuesTaken: this.statues.filter((s) => s.taken).length,
      collectedStatues: this.statues.filter((s) => s.taken).map((s) => s.id),
    };
  }

  startPlaying() {
    this.state = 'playing';
    this.hud.hideMenu();
    if (this.missions.index < MISSIONS.length && !this.missions.active) {
      this.missions.startMission(this.missions.index);
    }
    this.hud.setObjective(this.missions.objective);
  }

  // ---- Combat -----------------------------------------------------------

  damagePlayer(amount, source) {
    if (this.state !== 'playing') return;
    const now = this.time;
    // A short invulnerability window so one burst cannot stack.
    if (now - this.damageCooldown < 0.25) return;
    this.damageCooldown = now;
    let rest = amount;
    if (this.player.armour > 0) {
      const absorbed = Math.min(this.player.armour, rest * 0.6);
      this.player.armour -= absorbed;
      rest -= absorbed;
    }
    this.player.health = Math.max(0, this.player.health - rest);
    this.player.lastDamage = now;
    this.hud.damageFlash();
    this.audio.thud();
    if (this.player.health <= 0) this.gameOver('wasted');
  }

  punch() {
    if (this.punchTimer > 0 || this.playerCar) return;
    this.punchTimer = 0.4;
    this.audio.blip(180, 0.1, 'square', 0.25);
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const dx = ped.x - this.player.x;
      const dz = ped.z - this.player.z;
      const d = Math.hypot(dx, dz);
      // In range and roughly in front of Raka.
      if (d < 2.4 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
        ped.hp -= 30;
        if (ped.hp <= 0) this.killPed(ped);
      }
    }
  }

  shoot() {
    if (this.shootTimer > 0 || this.playerCar) return;
    const w = this.weapons.current;
    if (w === 'fists') {
      this.punch();
      return;
    }
    if (w === 'pistol' && this.weapons.pistolAmmo <= 0) return;
    if (w === 'shotgun' && this.weapons.shotgunAmmo <= 0) return;
    this.shootTimer = w === 'shotgun' ? 0.7 : 0.22;
    this.muzzle = 0.08;
    if (w === 'pistol') this.weapons.pistolAmmo--;
    else this.weapons.shotgunAmmo--;
    this.stats.shotsFired++;
    this.audio.gunshot();
    const pellets = w === 'shotgun' ? 5 : 1;
    for (let p = 0; p < pellets; p++) {
      const spread = (p - (pellets - 1) / 2) * 0.06 + (this.rng.float() - 0.5) * 0.03;
      const dx = Math.sin(this.player.heading + spread);
      const dz = Math.cos(this.player.heading + spread);
      let best = null;
      let bestD = w === 'shotgun' ? 26 : 42;
      for (const ped of this.peds) {
        if (ped.dead) continue;
        const rx = ped.x - this.player.x;
        const rz = ped.z - this.player.z;
        const d = Math.hypot(rx, rz);
        if (d < bestD && (rx * dx + rz * dz) / Math.max(d, 0.01) > 0.985) {
          best = ped;
          bestD = d;
        }
      }
      if (best) {
        best.hp -= w === 'shotgun' ? 22 : 34;
        if (best.hp <= 0) this.killPed(best);
      }
    }
    // Scare nearby peds and raise a little heat when shooting in the open.
    this.police.addHeat(2, 'Tembakan terdengar');
    scatterNearby(this.peds, this.player.x, this.player.z, 30);
  }

  killPed(ped) {
    ped.dead = true;
    ped.deadAt = this.time;
    if (ped.role === 'walker') {
      // Killing a bystander is the fastest way to five stars.
      this.police.addHeat(30, 'Warga tewas');
    } else {
      // Hostiles drop cash.
      const drop = 30 + Math.floor(this.rng.float() * 50);
      this.money += drop;
      this.stats.foesDown++;
      this.hud.setPrompt(`+$${drop} dari ${ped.name ?? 'musuh'}`);
    }
  }

  gameOver(reason) {
    this.state = 'gameover';
    this.money = Math.max(0, this.money - 200);
    this.police.clear();
    this.player.health = 100;
    this.player.armour = Math.min(this.player.armour, 50);
    this.hud.showGameOver(reason, (a) => {
      if (a === 'respawn') {
        const home = this.city.locations.home;
        this.player.x = home.x;
        this.player.z = home.z;
        this.playerCar = null;
        this.state = 'playing';
        this.hud.hideMenu();
      }
    });
  }

  // ---- Interaction (E) ---------------------------------------------------

  nearestCar(maxD = 4) {
    let best = null;
    let bestD = maxD;
    for (const car of this.allCars) {
      if (car.owner === 'police') continue;
      const d = dist2D(this.player.x, this.player.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  interact() {
    if (this.state !== 'playing') return;
    const m = this.missions;
    // Collect a crate.
    for (const c of m.collectibles) {
      if (!c.taken && dist2D(this.player.x, this.player.z, c.x, c.z) < 3.5) {
        c.taken = true;
        this.audio.pickup();
        this.hud.setPrompt('Peti diambil!');
        return;
      }
    }
    // Collect a Patung Tanjung statue.
    for (const s of this.statues) {
      if (!s.taken && dist2D(this.player.x, this.player.z, s.x, s.z) < 3.5) {
        s.taken = true;
        this.audio.pickup();
        const got = this.statues.filter((q) => q.taken).length;
        this.hud.setPrompt(`Patung Tanjung ${got}/${this.statues.length}!`);
        return;
      }
    }
    if (this.playerCar) {
      // Exit the car, stepping out to the left.
      const car = this.playerCar;
      this.player.x = car.x - Math.cos(car.heading) * 2.5;
      this.player.z = car.z + Math.sin(car.heading) * 2.5;
      this.player.heading = car.heading;
      this.playerCar = null;
      return;
    }
    // Enter the nearest car.
    const car = this.nearestCar();
    if (car) {
      const stolen = car.owner === 'parked' || car.owner === 'traffic';
      this.playerCar = car;
      if (stolen) {
        this.police.addHeat(25, 'Mobil dicuri');
        this.stats.carsStolen++;
        car.owner = 'player';
        this.cars = this.cars.filter((c) => c !== car);
      }
      this.audio.blip(520, 0.1);
      return;
    }
    // Garage.
    const g = this.city.locations.garage;
    if (dist2D(this.player.x, this.player.z, g.x, g.z) < 10) {
      this.state = 'garage';
      this.hud.showGarage(this.garage, this.money, (a) => this.garageAction(a));
      return;
    }
    // Mission start marker: stand at home to begin the next story mission.
    if (!m.active && !m.sideJob && this.missions.index < MISSIONS.length) {
      const start = this.city.locations.home;
      if (dist2D(this.player.x, this.player.z, start.x, start.z) < 12) {
        m.startMission(this.missions.index);
        return;
      }
    }
    // Side jobs at their stands: taxi and race at their starts, courier
    // work from the market.
    if (!m.active && !m.sideJob) {
      const taxi = this.city.locations.taxiStand;
      if (dist2D(this.player.x, this.player.z, taxi.x, taxi.z) < 8) {
        m.startSideJob('taxi', this.player);
        return;
      }
      const race = this.city.locations.raceStart;
      if (dist2D(this.player.x, this.player.z, race.x, race.z) < 8) {
        m.startSideJob('race', this.player);
        return;
      }
      const market = this.city.locations.market;
      if (dist2D(this.player.x, this.player.z, market.x, market.z) < 8) {
        m.startSideJob('delivery', this.player);
        return;
      }
    }
  }

  // ---- Mission staging (spawns for the current stage) --------------------

  stageMissionSpawns() {
    const m = this.missions;
    if (!m.active) return;
    const stage = m.active.mission.stages[m.active.stage];
    const key = m.active.mission.id + ':' + m.active.stage;
    if (key === this.stageKey) return;
    this.stageKey = key;
    if (stage.type === 'steal') {
      const l = this.city.locations[stage.loc];
      const color = stage.model === 'sport' ? [0.95, 0.75, 0.15] : null;
      const car = createCar(stage.model, l.x + 4, l.z + 4, 0.5, color, 'mission');
      car.missionTarget = true;
      m.spawnedCars.push(car);
    }
    if (stage.type === 'defeat') {
      const l = this.city.locations[stage.loc];
      for (let i = 0; i < stage.count; i++) {
        const ped = createPed(l.x + (this.rng.float() - 0.5) * 16, l.z + (this.rng.float() - 0.5) * 16, this.rng, stage.role);
        ped.name = stage.role === 'gang' ? 'Gang Sanca' : 'Penagih Utang';
        ped.weapon = 'pistol';
        ped.shootTimer = 1 + this.rng.float();
        m.spawnedPeds.push(ped);
        this.peds.push(ped);
      }
      // A few shoppers caught in the fight, who will run when it starts.
      spawnMarketCrowd(this.peds, l.x + 20, l.z + 12, 3, this.rng);
    }
    if (stage.type === 'survive' || stage.type === 'escape') {
      // Make sure the wanted level the stage demands is actually there.
      if (this.police.wanted < (stage.wanted ?? 1)) {
        this.police.heat = (stage.wanted ?? 1) * 20;
        this.police.wanted = stage.wanted ?? 1;
        this.police.say(`Bintang ${stage.wanted}: ${stage.text}`);
      }
    }
  }

  // ---- Update ------------------------------------------------------------

  update(dt) {
    if (this.state === 'title' || this.state === 'gameover' || this.state === 'complete') return;
    if (this.state === 'paused' || this.state === 'garage' || this.state === 'map') return;
    this.time += dt;
    this.dayMinutes += dt * 0.5; // one game minute every two real seconds
    const input = this.input;
    const axis = input.axis();
    const mouse = input.consumeMouse();
    this.camera.yaw -= mouse.dx * 0.004 * this.settings.sensitivity;
    this.camera.pitch = clamp(this.camera.pitch + mouse.dy * 0.002 * this.settings.sensitivity, 0.15, 1.1);

    // Pause.
    if (input.wasPressed('Escape')) {
      this.state = 'paused';
      this.hud.showPause((a) => this.pauseAction(a));
      input.poll();
      return;
    }
    // Map screen (M).
    if (input.consumePressed('KeyM')) {
      this.toggleMap();
      input.poll();
      return;
    }
    // Weapon wheel: hold Q, then 1/2/3 — or just press 1/2/3 directly.
    const pickWeapon = () => {
      if (input.wasPressed('Digit1')) this.weapons.current = 'fists';
      if (input.wasPressed('Digit2') && this.weapons.hasPistol) this.weapons.current = 'pistol';
      if (input.wasPressed('Digit3') && this.weapons.hasShotgun) this.weapons.current = 'shotgun';
    };
    if (input.down('KeyQ')) {
      this.hud.showWheel(this.weapons.current, { pistol: this.weapons.pistolAmmo, shotgun: this.weapons.shotgunAmmo });
      pickWeapon();
    } else {
      this.hud.hideWheel();
      pickWeapon();
    }
    // Radio.
    if (input.wasPressed('KeyR')) {
      const st = this.audio.nextStation();
      this.hud.setRadio(st, this.audio.radioOn);
      this.audio.stationJingle();
    }
    // Horn: a short honk while driving, just for the joy of it.
    if (input.wasPressed('KeyH') && this.playerCar) {
      this.audio.blip(370, 0.25, 'square', 0.18);
      this.audio.blip(440, 0.25, 'square', 0.12);
    }
    if (input.wasPressed('KeyE')) this.interact();
    if (input.wasPressed('KeyF')) this.punch();
    if (input.consumeClick()) this.shoot();
    if (this.punchTimer > 0) this.punchTimer -= dt;
    if (this.shootTimer > 0) this.shootTimer -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;

    // ---- Player movement ----
    const camFwdX = Math.sin(this.camera.yaw);
    const camFwdZ = Math.cos(this.camera.yaw);
    const camRightX = Math.cos(this.camera.yaw);
    const camRightZ = -Math.sin(this.camera.yaw);
    if (this.playerCar) {
      const car = this.playerCar;
      const throttle = axis.y;
      let steer = -axis.x;
      if (input.down('Space')) {
        car.speed *= Math.max(0, 1 - dt * 3);
        steer *= 1.4;
      }
      driveCar(car, throttle, steer, dt, this.city.colliders, this.allCars);
      this.stats.distanceDriven += Math.abs(car.speed) * dt;
      this.player.x = car.x;
      this.player.z = car.z;
      this.player.heading = car.heading;
      // Running over pedestrians.
      for (const ped of this.peds) {
        if (ped.dead) continue;
        if (dist2D(car.x, car.z, ped.x, ped.z) < 2.2 && Math.abs(car.speed) > 6) {
          ped.hp = 0;
          this.killPed(ped);
          car.speed *= 0.8;
        }
      }
      this.audio.setEngine(Math.abs(car.speed) / car.def.topSpeed, true);
      this.audio.setSiren(this.police.wanted > 0);
    } else {
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = run ? 6.2 : 3.4;
      const mx = camFwdX * axis.y + camRightX * axis.x;
      const mz = camFwdZ * axis.y + camRightZ * axis.x;
      const ml = Math.hypot(mx, mz);
      if (ml > 0.01) {
        const nx = this.player.x + (mx / ml) * speed * dt;
        const nz = this.player.z + (mz / ml) * speed * dt;
        const [rx, rz] = resolveCollisions(this.city.colliders, nx, nz, 0.6);
        this.player.x = rx;
        this.player.z = rz;
        this.player.heading = Math.atan2(mx / ml, mz / ml);
        this.player.speed = speed;
      } else {
        this.player.speed = 0;
      }
      this.audio.setEngine(0, false);
      this.audio.setSiren(this.police.wanted > 0);
    }

    // Health regen after ten calm seconds.
    if (this.time - this.player.lastDamage > 10 && this.player.health > 0 && this.player.health < 100) {
      this.player.health = Math.min(100, this.player.health + 2 * dt);
    }

    // ---- Traffic & pedestrians ----
    const others = this.allCars;
    for (const car of this.cars) {
      if (car.owner === 'traffic') {
        updateTraffic(car, { ...this.city.graph, roads: this.city.roads }, dt, this.city.colliders, others, this.rng);
      }
    }
    const danger = this.police.wanted > 0 ? { x: this.player.x, z: this.player.z } : null;
    for (const ped of this.peds) {
      if (ped.role === 'gang' || ped.role === 'collector') {
        this.updateHostile(ped, dt);
      } else {
        updatePed(ped, dt, { colliders: this.city.colliders, roads: this.city.roads, rng: this.rng, danger });
      }
    }
    // Dead walkers linger on the ground for a while, then fade out of the
    // world. Mission hostiles stay until the stage ends.
    this.peds = this.peds.filter((p) => !p.dead || p.role !== 'walker' || this.time - (p.deadAt ?? this.time) < 30);

    // ---- Police ----
    this.police.update(dt, { player: this.player, playerCar: this.playerCar, colliders: this.city.colliders, allCars: others });
    if (this.police.busted) this.gameOver('busted');

    // ---- Missions ----
    this.stageMissionSpawns();
    this.missions.update(dt, { player: this.player, playerCar: this.playerCar, police: this.police, game: this });
    const reward = this.missions.takeReward();
    if (reward) {
      this.money += reward.money;
      this.respect += reward.respect;
      this.audio.missionJingle();
      saveGame(this.saveState());
      if (this.missions.allComplete && this.state === 'playing') {
        this.state = 'complete';
        this.hud.showComplete((a) => {
          if (a === 'free') {
            this.state = 'playing';
            this.hud.hideMenu();
          }
        });
      } else if (this.missions.index < MISSIONS.length && !this.missions.active && !this.missions.sideJob) {
        this.missions.startMission(this.missions.index);
      }
    }
    if (this.missions.banner) {
      this.hud.showBanner(this.missions.banner.title, this.missions.banner.sub);
      this.missions.banner = null;
    }

    // ---- Interaction prompt & HUD ----
    this.updatePrompt();
    this.refreshHud();
    this.audio.update();

    input.poll();
  }

  // Every HUD setter in one place, called each frame from update() and once
  // after screenshot staging poses the world, so the frozen frame's DOM
  // (counter, clock, money) matches the posed state instead of the last
  // simulated step.
  refreshHud() {
    this.hud.setStatus({ health: this.player.health, armour: this.player.armour, money: this.money, respect: this.respect });
    this.hud.setWanted(this.police.wanted);
    this.hud.setWantedLabel(wantedLabel(this.police.wanted));
    this.hud.setClock(this.clockText());
    const mm = this.missions;
    this.hud.setMissionInfo(
      mm.active
        ? `Misi ${mm.index + 1}/8 · Tahap ${mm.active.stage + 1}/${mm.active.mission.stages.length} · ${mm.active.mission.title}`
        : 'Mode Bebas — Jelajahi Tanjung Matahari',
      mm.counterText(),
    );
    // In free roam Raka mutters to himself, a new line every 12 seconds.
    const freeRoamIndex = mm.active ? -1 : Math.floor(this.time / 12);
    this.hud.setDialogue(mm.currentDialogue(freeRoamIndex));
    this.hud.setSpeed(
      this.playerCar ? Math.abs(this.playerCar.speed) * 3.6 : 0,
      !!this.playerCar,
      this.playerCar ? this.playerCar.def.name : '',
      this.playerCar ? `${conditionLabel(this.playerCar)} ${Math.max(0, Math.round(this.playerCar.hp))}%` : '',
    );
    this.hud.setPoliceInfo(this.police.wanted > 0 ? this.police.unitsWithDistance(this.player) : []);
    // The survive stage's countdown already shows in the counter
    // ("44 dtk tersisa"); the objective timer would print it twice.
    const stage = mm.active ? mm.active.mission.stages[mm.active.stage] : null;
    const timer = stage && stage.type === 'survive' ? null : (this.missions.timer > 0 ? this.missions.timer : null);
    this.hud.setObjective(this.missions.objective, timer);
    this.hud.setFeed(this.police.feed);
  }

  // A hostile ped: walk toward the player, shoot when in range.
  updateHostile(ped, dt) {
    if (ped.dead) return;
    const d = dist2D(ped.x, ped.z, this.player.x, this.player.z);
    if (d > 60) return; // dormant until the player is near
    const want = Math.atan2(this.player.x - ped.x, this.player.z - ped.z);
    ped.heading += clamp(clampAngle(want - ped.heading), -3 * dt, 3 * dt);
    if (d > 8) {
      const nx = ped.x + Math.sin(ped.heading) * 3.4 * dt;
      const nz = ped.z + Math.cos(ped.heading) * 3.4 * dt;
      const [rx, rz] = resolveCollisions(this.city.colliders, nx, nz, 0.6);
      ped.x = rx;
      ped.z = rz;
    }
    ped.shootTimer -= dt;
    if (ped.shootTimer <= 0 && d < 30) {
      ped.shootTimer = 1.4 + this.rng.float() * 0.8;
      this.audio.gunshot();
      if (this.rng.float() < 0.4) this.damagePlayer(6 + this.rng.float() * 5, ped.name);
    }
  }

  updatePrompt() {
    if (this.playerCar) {
      this.hud.setPrompt('E — Keluar dari mobil');
      return;
    }
    const car = this.nearestCar();
    if (car) {
      const label = car.missionTarget ? 'Mobil target' : car.def.name;
      const stealNote = car.owner === 'parked' || car.owner === 'traffic' ? ' (mencuri = bintang)' : '';
      this.hud.setPrompt(`E — Masuk ${label}${stealNote}`);
      return;
    }
    for (const c of this.missions.collectibles) {
      if (!c.taken && dist2D(this.player.x, this.player.z, c.x, c.z) < 3.5) {
        this.hud.setPrompt('E — Ambil peti');
        return;
      }
    }
    for (const s of this.statues) {
      if (!s.taken && dist2D(this.player.x, this.player.z, s.x, s.z) < 3.5) {
        this.hud.setPrompt('E — Ambil Patung Tanjung');
        return;
      }
    }
    const g = this.city.locations.garage;
    if (dist2D(this.player.x, this.player.z, g.x, g.z) < 10) {
      this.hud.setPrompt('E — Bengkel Tanjung (upgrade mobil)');
      return;
    }
    if (!this.missions.active && !this.missions.sideJob && this.missions.index < MISSIONS.length) {
      const home = this.city.locations.home;
      if (dist2D(this.player.x, this.player.z, home.x, home.z) < 12) {
        this.hud.setPrompt(`E — Mulai misi: ${MISSIONS[this.missions.index].title}`);
        return;
      }
    }
    if (!this.missions.active && !this.missions.sideJob) {
      const taxi = this.city.locations.taxiStand;
      if (dist2D(this.player.x, this.player.z, taxi.x, taxi.z) < 8) {
        this.hud.setPrompt('E — Kerja taksi');
        return;
      }
      const race = this.city.locations.raceStart;
      if (dist2D(this.player.x, this.player.z, race.x, race.z) < 8) {
        this.hud.setPrompt('E — Balap liar');
        return;
      }
      const market = this.city.locations.market;
      if (dist2D(this.player.x, this.player.z, market.x, market.z) < 8) {
        this.hud.setPrompt('E — Kerja kurir');
        return;
      }
    }
    this.hud.setPrompt(null);
  }

  // ---- Render ------------------------------------------------------------

  render() {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 720;
    this.renderer.resize(w, h);
    const dt = 1 / 60;

    // Camera.
    let camTarget;
    let camPos;
    if (this.shotMode === 'map' || this.shotMode === 'city') {
      // High view over the city for the map screen backdrop / postcard.
      camPos = [150, 130, 400];
      camTarget = [0, 0, 60];
    } else if (this.state === 'title') {
      // Slow orbit around the city, looking south so the sea sits behind it.
      const t = this.time * 0.05;
      camPos = [Math.sin(t) * 200, 45, -280 + Math.cos(t) * 30];
      camTarget = [0, 14, 40];
    } else {
      const px = this.player.x;
      const pz = this.player.z;
      const dist = this.playerCar ? 14 : 10;
      const height = this.playerCar ? 5.5 : 4.2;
      // The camera looks along the direction of travel, from behind the
      // car: yaw is the heading itself. (v1 used heading + PI, which put
      // the camera in front of the car looking back — the drive shot
      // showed the road the car had already left, and everything staged
      // "ahead" of it sat behind the camera.)
      const yaw = this.playerCar ? this.player.heading : this.camera.yaw;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      camPos = [px - fx * dist, height, pz - fz * dist];
      camTarget = [px + fx * 4, 2, pz + fz * 4];
      // Keep the camera out of buildings: lift it if inside a collider.
      const hit = this.city.colliders.find(
        (c) => camPos[0] > c.x0 && camPos[0] < c.x1 && camPos[2] > c.z0 && camPos[2] < c.z1 && height < c.h,
      );
      if (hit) camPos[1] = hit.h + 3;
    }
    this.camPos = camPos;
    this.camTarget = camTarget;
    const aspect = w / h;
    const proj = mat4Perspective(1.05, aspect, 0.5, 1200);
    const view = mat4LookAt(camPos, camTarget, [0, 1, 0]);

    const r = this.renderer;
    r.begin(proj, view, dt);

    // Mission marker: a small floating diamond that bobs and spins, a flat
    // disc under it, and a thin dashed route line from the player to it.
    // (The old 20-unit beam is gone: it filled the whole mission shot.)
    const marker = this.missions.marker;
    if (marker && this.state === 'playing') {
      const bob = Math.sin(this.time * 3) * 0.4;
      const pulse = 1 + smoothstep(0, 1, (Math.sin(this.time * 4) + 1) / 2) * 0.15;
      r.box(marker.x, 4.2 + bob, marker.z, 1.0 * pulse, 1.0 * pulse, 1.0 * pulse, Math.PI / 4, this.time * 1.5, 0, [1.0, 0.85, 0.2], 2);
      r.box(marker.x, 0.25, marker.z, 3.2, 0.5, 3.2, 0, 0, 0, [1.0, 0.85, 0.2], 2);
      const px = this.player.x;
      const pz = this.player.z;
      const dx = marker.x - px;
      const dz = marker.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > 14) {
        const steps = Math.min(24, Math.floor(dist / 7));
        const ang = Math.atan2(dx, dz);
        // Start at the second dash: the first sits under the camera and
        // reads as a slab, not a line.
        for (let i = 2; i <= steps; i++) {
          const t = i / (steps + 1);
          r.box(px + dx * t, 0.15, pz + dz * t, 0.7, 0.12, 3.2, 0, ang, 0, [1.0, 0.85, 0.2], 2);
        }
      }
    }
    // Patung Tanjung statues (golden, gently spinning).
    for (const s of this.statues) {
      if (s.taken) continue;
      r.box(s.x, 0.5, s.z, 1.6, 1.0, 1.6, 0, 0, 0, [0.5, 0.45, 0.4]);
      r.box(s.x, 1.8, s.z, 0.9, 1.8, 0.9, 0, this.time * 0.4, 0, [0.95, 0.8, 0.25], 2);
    }
    // Collectible crates.
    for (const c of this.missions.collectibles) {
      if (c.taken) continue;
      r.box(c.x, 1, c.z, 2.2, 2.2, 2.2, 0, this.time * 0.8, 0, [0.75, 0.5, 0.2]);
      r.box(c.x, 2.4, c.z, 2.4, 0.3, 2.4, 0, this.time * 0.8, 0, [1.0, 0.85, 0.2], 2);
    }
    // Race checkpoint rings (drawn as flat markers).
    if (this.missions.active) {
      const stage = this.missions.active.mission.stages[this.missions.active.stage];
      if (stage.type === 'race') {
        const p = stage.points[this.missions.raceIndex];
        if (p) r.box(p.x, 0.5, p.z, 14, 1, 14, 0, 0, 0, [0.2, 0.8, 1.0], 2);
      }
    }

    // Player on foot.
    if (!this.playerCar && this.state !== 'title') {
      const p = this.player;
      const bob = Math.sin(this.time * 10) * (p.speed > 0 ? 0.08 : 0);
      r.box(p.x, 0.45 + bob, p.z, 0.55, 0.9, 0.4, 0, p.heading, 0, RAKA.pants);
      r.box(p.x, 1.25 + bob, p.z, 0.7, 0.85, 0.45, 0, p.heading, 0, RAKA.shirt);
      r.box(p.x, 1.95 + bob, p.z, 0.5, 0.5, 0.5, 0, p.heading, 0, RAKA.skin);
      if (this.weapons.current !== 'fists') {
        r.box(p.x + Math.sin(p.heading) * 0.5, 1.35 + bob, p.z + Math.cos(p.heading) * 0.5, 0.14, 0.14, 0.8, 0, p.heading, 0, [0.12, 0.12, 0.12]);
      }
      if (this.muzzle > 0) {
        r.box(p.x + Math.sin(p.heading) * 1.4, 1.4, p.z + Math.cos(p.heading) * 1.4, 0.5, 0.5, 0.5, 0, p.heading, 0, [1.0, 0.9, 0.4], 2);
      }
    }

    // Cars.
    for (const car of this.allCars) drawCar(r, car, this.time);
    // Pedestrians.
    for (const ped of this.peds) drawPed(r, ped, this.time);
    // Helicopter.
    this.police.draw(r, this.time);

    r.end();

    // Minimap + HUD (only while playing).
    if (this.state === 'playing') {
      this.hud.drawMinimap({
        roads: this.city.roads,
        colliders: this.city.colliders,
        marker: this.missions.marker,
        police: this.police.cops,
        traffic: this.cars.filter((c) => c.owner === 'traffic'),
        player: this.player,
        time: this.time,
      });
    }
  }
}
