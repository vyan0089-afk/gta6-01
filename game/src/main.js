// main.js — Tanjung Matahari: bootstrap, game loop and the state machine.
// This is the entry point the page loads. It builds the world (city,
// traffic, crowd, police, missions, races, jobs, garage, weather, audio),
// runs the frame loop, routes input to the right system for the current
// screen (title, playing, paused, map, dead, busted), and exposes the
// live game as window.__game for tests and screenshots. Screenshots are
// staged through ?shot=chase|mission|night|map, which plays the real game
// forward and then raises window.__shotReady.

import { Rng } from './rng.js';
import { WORLD, NEW_GAME, SAVE } from './config.js';
import { buildWorld, ROAD_LINES, districtAt } from './world.js';
import { Traffic } from './traffic.js';
import { TaxiLogic } from './traffic.js';
import { Crowd } from './peds.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions, MISSION_DEFS } from './missions.js';
import { Combat } from './combat.js';
import { AmmoPickups } from './combat.js';
import { AudioSystem } from './audio.js';
import { Weather } from './weather.js';
import { Renderer } from './render.js';
import { Hud, showScreen, hideScreens } from './hud.js';
import { Input } from './input.js';
import { Stats } from './stats.js';
import { Garage } from './garage.js';
import { Races } from './races.js';
import { Jobs } from './jobs.js';
import { Achievements } from './achievements.js';
import { Dialogue, MISSION_DIALOGUE, TIPS, randomStreetLine, randomJingle } from './dialogue.js';
import { Effects } from './effects.js';
import { Autosave, writeSave, readSave, slotSummary, slotHasSave, applySave, newestSaveSlot } from './save.js';
import { stageShot, shotFromUrl } from './shots.js';

/** Game version, shown on the title screen. */
export const VERSION = '1.0.0';
/** Build tag for the dossier. */
export const BUILD_TAG = 'tanjung-matahari-v7';

/** The whole game, in one object. */
export class Game {
  constructor() {
    this.rng = new Rng(WORLD.seed);
    this.seed = WORLD.seed;
    this.state = 'title';
    this.world = buildWorld(WORLD.seed);
    this.worldRoads = ROAD_LINES;
    this.traffic = new Traffic(WORLD.seed);
    this.taxiLogic = new TaxiLogic();
    this.crowd = new Crowd(WORLD.seed);
    this.player = new Player(NEW_GAME.startX, NEW_GAME.startZ, NEW_GAME.startAngle);
    this.player.money = NEW_GAME.money;
    this.police = new Police();
    this.missions = new Missions();
    this.missions.armTotals();
    this.combat = new Combat();
    this.ammoPickups = new AmmoPickups();
    this.audio = new AudioSystem();
    this.weather = new Weather(WORLD.seed);
    this.stats = new Stats();
    this.garage = new Garage();
    this.races = new Races();
    this.jobs = new Jobs(WORLD.seed);
    this.achievements = new Achievements();
    this.dialogue = new Dialogue();
    this.effects = new Effects(WORLD.seed);
    this.autosave = new Autosave();
    this.input = new Input();
    this.hud = null;
    this.renderer = null;
    this.time = 0;
    this.frame = 0;
    this.fps = 0;
    this.fpsTimer = 0;
    this.fpsCount = 0;
    this.shotMode = shotFromUrl();
    this.photoMode = false; // F9 hides the HUD for clean screenshots.
    this.version = VERSION;
    this.danger = { x: 0, z: 0, active: false };
    this.streetTimer = 0;
    this.jingleTimer = 20;
    this.tipIndex = 0;
    this.kerisPickupTimer = 0;
    // Traffic light cycle: 8 s green NS, 2 s amber, 8 s green EW, 2 s amber.
    this.lightTimer = 0;
  }

  /** Alias: the crowd is also exposed as peds for tests and screenshots. */
  get peds() {
    return this.crowd;
  }

  /** Attach canvas, HUD, input and menu buttons. */
  boot() {
    const canvas = document.getElementById('game');
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.input.attach();
    this.audio.onJingle = (stationId) => {
      const line = randomJingle(this.rng, stationId);
      this.dialogue.sayNow('Radio', line);
    };
    document.querySelectorAll('button[data-a]').forEach((btn) => {
      btn.addEventListener('click', () => this.menuAction(btn.dataset.a, btn));
    });
    document.getElementById('titleTip').textContent = 'Tip: ' + TIPS[0];
    this.refreshSlots();
    if (this.shotMode) {
      stageShot(this.shotMode, this);
      if (this.shotMode === 'map') this.fillMapScreen();
      showScreen(this.shotMode === 'map' ? 'mapScreen' : null);
      if (this.shotMode !== 'map') hideScreens();
      this.renderOnce();
      window.__shotReady = true;
    } else {
      showScreen('titleScreen');
      this.renderOnce();
    }
    window.__game = this;
    window.__shotError = null;
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Render a single frame without advancing the clock (title/shot use). */
  renderOnce() {
    try {
      const eye = this.player.cameraEye();
      const target = this.player.cameraTarget();
      this.renderer.render(this, eye, target, 0);
      if (this.hud) this.hud.update(this);
    } catch (e) {
      window.__shotError = String(e && e.message ? e.message : e);
    }
  }

  /** The frame loop. */
  loop(t) {
    const dt = Math.min(0.05, (t - (this._last || t)) / 1000 || 0.016);
    this._last = t;
    try {
      this.frame += 1;
      this.fpsCount += 1;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 1) {
        this.fps = this.fpsCount;
        this.fpsCount = 0;
        this.fpsTimer = 0;
        const el = document.getElementById('fps');
        if (el) el.textContent = `${this.fps} fps`;
      }
      this.input.update();
      if (this.shotMode) {
        // Staged screenshot frame: frozen, so the capture matches the stage.
      } else if (this.state === 'playing') this.stepPlaying(dt);
      else if (this.state === 'title') this.stepTitle(dt);
      else if (this.state === 'map' && this.input.pressed('KeyM', 'Escape', 'KeyP')) this.resume();
      else if (this.state === 'paused' && this.input.pressed('Escape', 'KeyP')) this.resume();
      if (this.state === 'playing' || this.state === 'title' || this.state === 'map') {
        const eye = this.player.cameraEye();
        const target = this.player.cameraTarget();
        if (this.effects) {
          eye[0] += this.effects.shakeX;
          eye[1] += this.effects.shakeY;
        }
        this.renderer.render(this, eye, target, dt);
        if (this.hud) this.hud.update(this);
      }
      this.input.endFrame();
    } catch (e) {
      window.__shotError = String(e && e.message ? e.message : e);
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }

  /** Title screen: the city lives behind the menu. */
  stepTitle(dt) {
    this.time += dt;
    this.weather.step(dt, this.player);
    this.traffic.step(dt, this.world);
    this.crowd.step(dt, this.danger);
    this.player.stepCamera(dt, this.input);
    this.stepLights(dt);
    if (this.input.pressed('Enter')) this.menuAction('new');
  }

  /** The main gameplay step. */
  stepPlaying(dt) {
    this.time += dt;
    const p = this.player;
    const inp = this.input;
    this.audio.ensure();
    // Camera + movement.
    p.stepCamera(dt, inp);
    if (p.car) {
      p.nitro = inp.sprint && this.garage.nitroFitted;
      p.stepDriving(dt, inp, this.garage);
    } else {
      p.stepOnFoot(dt, inp, this.world);
    }
    // World systems.
    this.weather.step(dt, p);
    // Lightning strikes: a flash of sparks where the bolt lands.
    const strike = this.weather.takeStrike();
    if (strike) {
      this.effects.sparks(strike.x, 8, strike.z, 24);
      this.effects.kick(0.4);
      this.audio.playSfx('thunder');
    }
    this.traffic.step(dt, this.world);
    this.taxiLogic.step(dt, this.traffic, this.crowd);
    this.crowd.step(dt, this.danger);
    this.crowd.revive(dt);
    this.police.step(dt, p, this.weather.night);
    this.combat.step(dt);
    this.ammoPickups.step(dt, this);
    this.missions.step(dt, this);
    this.races.step(dt, this);
    this.jobs.step(dt, this);
    this.garage.step(dt);
    this.dialogue.step(dt);
    this.achievements.step(dt);
    this.stats.step(dt, p);
    p.regen(dt);
    this.autosave.step(dt, this);
    this.audio.step(dt, p, this.police.wanted);
    this.effects.step(dt);
    this.stepCarEffects(dt);
    const nearMiss = this.traffic.nearMisses(p);
    if (nearMiss > 0) {
      this.stats.addRespect(2 * nearMiss);
      this.dialogue.sayNow('Raka', 'Hampir! Itu namanya menyetir.');
    }
    this.traffic.collisions(p, this);
    if (inp.pressed('KeyH')) this.traffic.honkNear(p.x, p.z, this);
    this.stepLights(dt);
    this.stepKeris(dt);
    this.stepTours(dt);
    this.stepStreetChatter(dt);
    this.stepSpeedAchievement();
    // Edge-triggered actions.
    if (inp.pressed('KeyE', 'PadA')) this.actionEnter();
    if (inp.pressed('KeyQ', 'PadY')) {
      this.combat.cycle();
      this.hud.flashWeaponWheel(this);
    }
    // Number keys: in the garage they buy services, elsewhere they pick weapons.
    const inGarage = this.garage.playerInside(p);
    if (inp.pressed('Digit1') && !inGarage) { this.combat.select(0); this.hud.flashWeaponWheel(this); }
    if (inp.pressed('Digit2') && !inGarage) { this.combat.select(1); this.hud.flashWeaponWheel(this); }
    if (inp.pressed('Digit3') && !inGarage) { this.combat.select(2); this.hud.flashWeaponWheel(this); }
    if (inp.pressed('KeyT')) this.combat.reload();
    if (inp.pressed('KeyR')) {
      this.audio.nextStation();
      this.dialogue.sayNow('Radio', this.audio.stationDef.name + ' — ' + this.audio.stationDef.desc);
    }
    if (inp.pressed('KeyM')) this.openMap();
    if (inp.pressed('Escape', 'KeyP', 'PadStart')) this.pause();
    // Photo mode: F9 hides the HUD for clean screenshots.
    if (inp.pressed('F9')) {
      this.photoMode = !this.photoMode;
      document.body.classList.toggle('photoMode', this.photoMode);
      this.hud.say(`Mode foto ${this.photoMode ? 'aktif' : 'mati'}`);
    }
    if (inp.frameClicked && !p.car) {
      const victims = this.combat.fire(this, p.angle);
      if (victims.length > 0) this.dialogue.sayNow('Raka', 'Itu peringatan terakhir.');
    }
    if (this.garage.playerInside(p)) this.garageKeys(inp);
    // Busted / wasted.
    if (this.police.busted) {
      this.police.applyBust(p);
      this.stats.timesBusted += 1;
      this.audio.playSfx('busted');
      this.state = 'busted';
      showScreen('bustedScreen');
    }
    if (p.health <= 0) {
      this.stats.timesWasted += 1;
      this.state = 'dead';
      showScreen('deadScreen');
    }
  }

  /** Car effects: handbrake skids, tyre smoke, nitro flame, exhaust. */
  stepCarEffects(dt) {
    const p = this.player;
    if (!p.car) return;
    if (this.input.handbrake && Math.abs(p.carSpeed) > 6) {
      this.effects.addSkid(p.x, p.z, p.angle);
      this.effects.tyreSmoke(p.x, p.z);
    }
    if (p.nitro && p.nitroFuel > 0 && Math.abs(p.carSpeed) > 5) {
      this.effects.nitroFlame(p.x, p.z, p.angle);
    }
    this.exhaustTimer = (this.exhaustTimer || 0) - dt;
    if (this.exhaustTimer <= 0 && Math.abs(p.carSpeed) > 2) {
      this.exhaustTimer = 0.4;
      this.effects.exhaust(p.x, p.z, p.angle);
    }
  }

  /** Traffic light cycle. */
  stepLights(dt) {
    this.lightTimer += dt;
    const cycle = this.lightTimer % 20;
    const phase = cycle < 8 ? 0 : cycle < 10 ? 1 : cycle < 18 ? 2 : 3;
    for (const l of this.world.lights) l.phase = phase;
  }

  /** Keris pickup: stand close to a golden keris to collect it. */
  stepKeris(dt) {
    this.kerisPickupTimer -= dt;
    const p = this.player;
    for (const k of this.world.keris) {
      if (k.found) continue;
      const dx = k.x - p.x;
      const dz = k.z - p.z;
      if (dx * dx + dz * dz < 2.5 * 2.5 && this.kerisPickupTimer <= 0) {
        k.found = true;
        this.stats.foundKeris();
        this.kerisPickupTimer = 1;
        this.effects.kerisSparkle(k.x, k.z);
        this.effects.float(`${k.name} ditemukan!`, k.x, k.z, '#ffd94a');
        this.audio.playSfx('keris');
        this.dialogue.sayNow('Raka', `${k.name} ditemukan! (${this.stats.kerisFound}/12) — ${k.hint}`);
        this.achievements.check('keris', this.stats.kerisFound);
      }
    }
  }

  /** Tour spots: visiting one marks it on the map screen. */
  stepTours(dt) {
    const p = this.player;
    for (const t of this.world.tours) {
      if (t.visited) continue;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      if (dx * dx + dz * dz < 12 * 12) {
        t.visited = true;
        this.stats.toursVisited = this.world.tours.filter((x) => x.visited).length;
        this.achievements.check('tour', this.stats.toursVisited);
        this.dialogue.sayNow('Raka', `Tempat wisata: ${t.name} — ${t.desc}`);
      }
    }
  }

  /** Occasional street chatter from the crowd. */
  stepStreetChatter(dt) {
    this.streetTimer -= dt;
    if (this.streetTimer <= 0) {
      this.streetTimer = 18 + this.rng.range(0, 14);
      if (!this.dialogue.line()) {
        const [who, text] = randomStreetLine(this.rng);
        this.dialogue.sayNow(who, text);
      }
    }
  }

  /** Speed achievements from the live speedometer. */
  stepSpeedAchievement() {
    const kmh = this.player.speedKmh();
    if (kmh > 150) this.achievements.check('speed', Math.floor(kmh));
  }

  /** E key: enter/exit a car, store at the garage, start a job. */
  actionEnter() {
    const p = this.player;
    // At the garage with a car: store it.
    if (p.car && this.garage.playerInside(p)) {
      if (this.garage.storeCar(p, this)) return;
    }
    // Near a job board on foot: start the job.
    if (!p.car) {
      const board = this.jobs.boardNear(p);
      if (board && !this.jobs.active) {
        this.jobs.start(board, this);
        return;
      }
    }
    if (p.car) {
      const car = p.exitCar();
      this.traffic.release(car);
      return;
    }
    const car = this.traffic.nearestCar(p.x, p.z, 5);
    if (!car) return;
    if (car.locked && this.rng.float() < 0.5) {
      this.dialogue.sayNow('Raka', 'Terkunci! Cari mobil lain.');
      return;
    }
    this.traffic.steal(car);
    p.enterCar(car, this.stats);
    this.stats.carsStolenThisMission += 1;
    this.achievements.check('cars', this.stats.carsStolen);
    this.achievements.check('money', p.money);
    this.police.addHeat(1, p);
    this.audio.playSfx('click');
    this.dialogue.sayNow('Raka', `${car.model.name} — milikku sekarang.`);
    if (this.police.wanted === 1) this.achievements.check('wanted', 1);
  }

  /** Garage keys 1/2/3 while inside the yard. */
  garageKeys(inp) {
    const p = this.player;
    if (inp.pressed('Digit1')) this.garage.fullService(p, this);
    if (inp.pressed('Digit2')) this.garage.fitNitro(p, this);
    if (inp.pressed('Digit3')) this.garage.repair(p, this);
  }

  /** Pause the game. */
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.refreshSlots();
    showScreen('pauseScreen');
  }

  /** Resume from pause or map. */
  resume() {
    this.state = 'playing';
    hideScreens();
  }

  /** Open the map screen. */
  openMap() {
    if (this.state !== 'playing') return;
    this.state = 'map';
    this.fillMapScreen();
    showScreen('mapScreen');
  }

  /** Fill the map screen: missions, career, achievements, tours. */
  fillMapScreen() {
    const mm = document.getElementById('mapMissions');
    if (mm) {
      mm.innerHTML = MISSION_DEFS.map((def, i) => {
        const cls = this.missions.done.has(def.id) ? 'done' : (this.missions.active && this.missions.active.id === def.id ? 'active' : '');
        const mark = this.missions.done.has(def.id) ? '✓' : (cls === 'active' ? '▶' : '·');
        return `<div class="mapRow ${cls}"><span>${mark} Bab ${def.chapter} — ${def.title}</span><span>Rp ${def.reward.toLocaleString('id-ID')}</span></div>`;
      }).join('');
    }
    const chapter = this.missions.active ? this.missions.active.chapter : 3;
    const chEl = document.getElementById('mapChapter');
    if (chEl) chEl.textContent = `Bab ${chapter} — ${chapter === 1 ? 'Pulang ke Sanca' : chapter === 2 ? 'Pelabuhan' : 'Raja Tanjung'}`;
    const ms = document.getElementById('mapStats');
    if (ms) {
      ms.innerHTML = '<table>' + this.stats.careerLines().map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('') + '</table>';
    }
    const ac = document.getElementById('achCount');
    if (ac) ac.textContent = `(${this.achievements.count()}/${this.achievements.total})`;
    const al = document.getElementById('achList');
    if (al) {
      al.innerHTML = this.achievements.list().map((a) => `<div class="${a.unlocked ? '' : 'locked'}">${a.unlocked ? '🏆' : '🔒'} <b>${a.name}</b> — ${a.desc}</div>`).join('');
    }
    const tl = document.getElementById('tourList');
    if (tl) {
      tl.innerHTML = this.world.tours.map((t) => `${t.visited ? '✓' : '·'} ${t.name}`).join(' · ');
    }
    // Race panel: best times and wins per circuit.
    const rl = document.getElementById('raceList');
    if (rl) {
      rl.innerHTML = this.races.raceLines().map((l) => `<div class="mapRow"><span>${l}</span></div>`).join('');
    }
    // Side-job board: what each job pays and how often it was done.
    const jl = document.getElementById('jobList');
    if (jl) {
      jl.innerHTML = this.jobs.jobSummary().map((l) => `<div class="mapRow"><span>${l}</span></div>`).join('');
    }
    const career = document.getElementById('mapCareer');
    if (career) career.textContent = this.stats.summaryLine();
  }

  /** Refresh the save-slot summaries on title and pause screens. */
  refreshSlots() {
    const newest = newestSaveSlot();
    const html = [1, 2, 3].map((slot) => {
      const has = slotHasSave(slot);
      const label = has ? slotSummary(slot) : '— kosong —';
      const tag = newest === slot ? ' ★ terbaru' : '';
      return `<div class="slot"><b>Slot ${slot}${tag}</b><br>${label}<br><button data-a="load-${slot}" ${has ? '' : 'disabled'}>Muat</button> <button data-a="save-${slot}">Simpan</button></div>`;
    }).join('');
    const ts = document.getElementById('titleSlots');
    if (ts) ts.innerHTML = html;
    const ps = document.getElementById('pauseSlots');
    if (ps) ps.innerHTML = html;
    // Rebind freshly written buttons.
    document.querySelectorAll('#titleSlots button[data-a], #pauseSlots button[data-a]').forEach((btn) => {
      btn.addEventListener('click', () => this.menuAction(btn.dataset.a, btn));
    });
    // Title screen career line from the newest save, when there is one.
    const careerEl = document.getElementById('titleCareer');
    if (careerEl) {
      if (newest) {
        const data = readSave(newest);
        careerEl.textContent = `Terakhir bermain (slot ${newest}): Misi ${data.missionIndex}/8 · Rp ${Math.floor(data.money).toLocaleString('id-ID')} · ${data.kerisFound.length}/12 keris`;
      } else {
        careerEl.textContent = 'Belum ada simpanan — mulai petualanganmu di Tanjung Matahari.';
      }
    }
  }

  /** Save the game into a slot (autosave flag writes slot 1 quietly). */
  saveGame(slot, quiet) {
    const ok = writeSave(this, slot === 0 ? 1 : slot);
    if (!quiet && ok) this.dialogue.sayNow('Raka', `Progres disimpan di slot ${slot}.`);
    this.refreshSlots();
    return ok;
  }

  /** Load a save from a slot. */
  loadGame(slot) {
    const data = readSave(slot);
    if (!data) return false;
    // Fresh world, then apply the save on top.
    this.world = buildWorld(WORLD.seed);
    this.traffic = new Traffic(WORLD.seed);
    this.crowd = new Crowd(WORLD.seed);
    this.player = new Player(data.x, data.z, data.angle);
    this.police = new Police();
    this.missions = new Missions();
    this.missions.armTotals();
    this.combat = new Combat();
    this.ammoPickups = new AmmoPickups();
    this.stats = new Stats();
    this.garage = new Garage();
    this.races = new Races();
    this.jobs = new Jobs(WORLD.seed);
    this.achievements = new Achievements();
    this.effects = new Effects(WORLD.seed);
    applySave(this, data);
    this.state = 'playing';
    hideScreens();
    return true;
  }

  /** Start a brand-new game. */
  newGame() {
    this.world = buildWorld(WORLD.seed);
    this.traffic = new Traffic(WORLD.seed);
    this.crowd = new Crowd(WORLD.seed);
    this.player = new Player(NEW_GAME.startX, NEW_GAME.startZ, NEW_GAME.startAngle);
    this.player.money = NEW_GAME.money;
    this.police = new Police();
    this.missions = new Missions();
    this.missions.armTotals();
    this.combat = new Combat();
    this.ammoPickups = new AmmoPickups();
    this.stats = new Stats();
    this.garage = new Garage();
    this.races = new Races();
    this.jobs = new Jobs(WORLD.seed);
    this.achievements = new Achievements();
    this.dialogue = new Dialogue();
    this.effects = new Effects(WORLD.seed);
    this.achievements.check('start', 1);
    this.dialogue.say(MISSION_DIALOGUE.m1);
    this.state = 'playing';
    hideScreens();
  }

  /** Respawn after death or bust: back at the beach road, health restored. */
  respawn() {
    const p = this.player;
    p.health = 100;
    p.armour = 0;
    p.x = NEW_GAME.startX;
    p.z = NEW_GAME.startZ;
    p.angle = NEW_GAME.startAngle;
    p.camYaw = NEW_GAME.startAngle + Math.PI;
    if (p.car) {
      this.traffic.release(p.car);
      p.car = null;
      p.carSpeed = 0;
    }
    this.police.clear();
    // A death mid-mission restarts the mission from its first stage.
    if (this.missions.active && this.missions.stageIndex > 0) {
      this.missions.fail(this);
      this.missions.retry(this);
    }
    this.state = 'playing';
    hideScreens();
  }

  /** Menu button actions. */
  menuAction(action, btn) {
    this.audio.ensure();
    if (action === 'new') this.newGame();
    else if (action === 'continue') {
      if (!this.loadGame(1)) this.newGame();
    } else if (action === 'continue-newest') {
      const slot = newestSaveSlot();
      if (slot && this.loadGame(slot)) return;
      this.newGame();
    } else if (action === 'resume') this.resume();
    else if (action === 'save') this.saveGame(1);
    else if (action === 'map') this.openMap();
    else if (action === 'quit') {
      this.state = 'title';
      this.refreshSlots();
      showScreen('titleScreen');
    } else if (action === 'help') showScreen('helpScreen');
    else if (action === 'back') showScreen('titleScreen');
    else if (action === 'respawn') this.respawn();
    else if (action.startsWith('load-')) {
      const slot = Number(action.slice(5));
      this.loadGame(slot);
    } else if (action.startsWith('save-')) {
      const slot = Number(action.slice(5));
      this.saveGame(slot);
    }
  }
}

/** Boot the game once the DOM is ready. */
function bootGame() {
  const game = new Game();
  window.__game = game;
  try {
    game.boot();
  } catch (e) {
    window.__shotError = String(e && e.message ? e.message : e);
    console.error(e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGame);
} else {
  bootGame();
}
