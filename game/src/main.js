// main.js — Tanjung Matahari: the game object, the loop, and the wiring.
//
// This is the file index.html loads. It builds the world, the player, the
// police, the missions, the audio and the HUD, then runs the loop: read the
// input, step the simulation, draw the frame, refresh the HUD. The game has
// five screens — title, playing, paused, map and the dead/busted overlays —
// and a `?shot=` query that stages one of the four screenshot scenes
// instead of showing the title. Everything the other modules need from the
// game lives on the one `game` object, exposed as window.__game so the
// playtest and the shot driver can drive it.

import { buildWorld, stepTraffic, stepPedestrians, streetNameAt, nearestRoadPoint } from './world.js';
import { createPlayer, stepOnFoot, stepDriving, nearestCar, stealCar, exitCar, punch, shoot, selectWeapon, cycleWeapon, healPlayer, giveAmmo } from './player.js';
import { createPolice, stepPolice, addWanted, resolveBust, clearWanted, policeDistances } from './police.js';
import { createMissions, startMission, startPendingMission, stepMissions, stepSideJob, nearbySideJob, currentMarker, startSideJob, MISSIONS, SIDE_JOBS } from './missions.js';
import { createAudio, } from './audio.js';
import { createHud, renderMapPanel } from './hud.js';
import { createRenderer } from './render.js';
import { freshPlayerState, RADIO_STATIONS, CLOCK_START_SECONDS, CLOCK_RATE, MUTTERINGS, PED_LINES, CAR_DEFS } from './config.js';
import { makeRng, clamp, dist2d, angleDelta, formatClock } from './rng.js';
import { freshStats, snapshotGame, applySnapshot, writeSlot, readSlot, clearAllSlots, slotSummary } from './save.js';
import { stageShot } from './shots.js';

const GAME_SEED = 7;

/** Build the whole game and boot it. Called once from index.html's load. */
export function createGame(canvas, doc) {
  const rng = makeRng(GAME_SEED * 7919 + 13);
  const world = buildWorld(GAME_SEED);
  const player = createPlayer(freshPlayerState());
  const police = createPolice();
  const missions = createMissions();
  const audio = createAudio();
  const hud = createHud(doc);
  const renderer = createRenderer(canvas);

  const game = {
    world, player, police, missions, audio, hud, renderer, rng,
    roads: { avenues: [], streets: [] },
    landmarks: {},
    state: 'title',
    clockSeconds: CLOCK_START_SECONDS,
    hourOverride: null,
    stats: freshStats(),
    pickups: [],
    pendingMission: null,
    wheelOpen: false,
    camera: { distance: 15, height: 7, yaw: -Math.PI / 2 },
    input: { keys: new Set(), cameraYaw: -Math.PI / 2, dragging: false, lastX: 0, lastY: 0, moved: 0 },
    time: 0,
    playSeconds: 0,
    shotMode: null,
  };

  // Roads and landmarks are read from the config through the world module's data.
  game.roads.avenues = [
    { x: -360 }, { x: -240 }, { x: -120 }, { x: 0 }, { x: 120 }, { x: 240 }, { x: 360 },
  ];
  game.roads.streets = [
    { z: -360 }, { z: -240 }, { z: -120 }, { z: 0 }, { z: 120 }, { z: 240 }, { z: 360 },
  ];
  game.landmarks = {
    pasarMalam: { x: 0, z: 0 }, gangSanca: { x: -180, z: -60 },
    lighthouse: { x: -418, z: -360 }, harbour: { x: 120, z: 415 },
    hospital: { x: 240, z: -240 }, garage: { x: -60, z: 180 },
    markas: { x: 300, z: 300 }, pantai: { x: -400, z: 60 },
    stasiun: { x: 180, z: -180 }, alunAlun: { x: 60, z: 60 },
  };

  // ----- helpers the other modules call back into -----

  game.setDialogue = (line, keep) => hud.setDialogue(line, keep);
  game.showBanner = (title, sub) => hud.showBanner(title, sub);
  game.addWanted = (amount, reason) => {
    const level = addWanted(police, amount, reason);
    if (reason) hud.flashCrime(reason);
    return level;
  };
  game.setWanted = (level) => {
    police.heat = level;
    police.wanted = level;
  };
  game.clearWanted = () => clearWanted(police, world);
  game.audioStationName = () => {
    const st = RADIO_STATIONS[audio.station];
    return `${st.name} · ${st.freq}`;
  };
  game.clockText = () => {
    const h = Math.floor(game.clockSeconds / 3600) % 24;
    const m = Math.floor(game.clockSeconds / 60) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  game.playTimeText = () => formatClock(game.stats.playSeconds);
  game.streetName = () => streetNameAt(player.x, player.z);
  game.policeDistances = () => policeDistances(world, player);
  game.readSaveSlot = (slot) => slotSummary(slot);
  game.setHour = (hour) => {
    game.hourOverride = hour;
    // Keep the HUD clock in step with the staged hour of day.
    game.clockSeconds = hour * 3600;
  };
  game.currentHour = () => (game.hourOverride !== null ? game.hourOverride : (game.clockSeconds / 3600) % 24);

  Object.defineProperty(game, 'marker', {
    get() { return currentMarker(missions, game); },
  });
  Object.defineProperty(game, 'nearCar', {
    get() {
      if (!player.onFoot) return null;
      return nearestCar(player, world.parked.concat(world.traffic), 4.5);
    },
  });
  Object.defineProperty(game, 'nearJob', {
    get() { return nearbySideJob(missions, player); },
  });

  game.allCars = () => world.traffic.concat(world.parked, world.policeCars).concat(player.car ? [player.car] : []);
  game.enemiesAlive = () => world.enemies.filter((e) => e.hp > 0);

  game.spawnEnemy = (x, z, name, hp) => {
    const e = {
      x, z, angle: 0, hp, maxHp: hp, name,
      skin: [0.8, 0.6, 0.45], attackTimer: 0, speed: 3.4,
    };
    world.enemies.push(e);
    return e;
  };
  game.clearEnemies = () => { world.enemies = []; };
  game.spawnPickup = (x, z, name) => {
    const pk = { x, z, name, taken: false, bob: rng.range(0, Math.PI * 2) };
    game.pickups.push(pk);
    return pk;
  };
  game.clearPickups = () => { game.pickups = []; };

  game.damageEnemy = (enemy, amount, how) => {
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      const act = missions.active;
      if (act && act.mission.stages[act.stageIndex].type === 'defeat') {
        act.progress += 1;
      }
      if (rng.chance(0.35)) giveAmmo(player, rng.pick(['pistol', 'shotgun']), rng.pick([4, 6]));
      game.setDialogue(`Raka: Satu ${enemy.name} tumbang.`);
    }
  };

  game.damagePlayer = (amount, _unused, source) => {
    if (player.dead || game.state !== 'playing') return;
    if (player.hurtTimer > 0) return;
    player.hurtTimer = 0.4;
    let rest = amount;
    if (player.armour > 0) {
      const absorbed = Math.min(player.armour, rest);
      player.armour -= absorbed;
      rest -= absorbed;
    }
    player.health -= rest;
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      game.state = 'dead';
      showScreen('dead');
      audio.failSting();
    }
  };

  game.spawnFleeingDriver = (car) => {
    const ped = {
      id: `driver-${Date.now()}`, x: car.x + 2, z: car.z + 2,
      angle: rng.angle(), speed: 4, skin: [0.7, 0.5, 0.35],
      shirt: [0.9, 0.2, 0.2], state: 'panic', panic: 4,
      wanderTimer: 0, targetX: 0, targetZ: 0, line: null, lineTimer: 0,
    };
    world.pedestrians.push(ped);
    game.setDialogue('Sopir: Hei! Itu mobilku! Tolong!');
  };

  game.nearestParkedCar = (maxDist) => nearestCar(player, world.parked, maxDist || 30);

  game.stealCarSilently = (car) => {
    car.owner = 'player';
    player.car = car;
    player.onFoot = false;
    player.x = car.x; player.z = car.z; player.angle = car.angle;
  };

  game.ensureVehicleNear = (x, z, defId) => {
    const def = CAR_DEFS[defId] || CAR_DEFS.sedan;
    const found = world.parked.find((c) => c.defId === defId && dist2d(c.x, c.z, x, z) < 40);
    if (found) return found;
    const car = {
      id: `mission-${defId}`, def, defId,
      x: x + 4, z: z + 4, angle: Math.PI / 2, speed: 0,
      colour: def.colours[0], owner: 'parked', hp: 100,
    };
    world.parked.push(car);
    return car;
  };

  // ----- screens -----

  const screens = {
    title: doc.getElementById('title'),
    pause: doc.getElementById('pause'),
    map: doc.getElementById('mapOverlay'),
    dead: doc.getElementById('dead'),
    busted: doc.getElementById('busted'),
  };
  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].classList.toggle('show', key === name);
    }
    if (doc.getElementById('hud')) doc.getElementById('hud').classList.toggle('dim', name === 'title');
  }

  game.newGame = () => {
    clearAllSlots();
    const fresh = createPlayer(freshPlayerState());
    Object.assign(player, fresh);
    player.ammo = { pistol: 24, shotgun: 8 };
    Object.assign(police, createPolice());
    Object.assign(missions, createMissions());
    game.stats = freshStats();
    game.pickups = [];
    game.pendingMission = null;
    game.clockSeconds = CLOCK_START_SECONDS;
    game.hourOverride = null;
    game.state = 'playing';
    world.policeCars = [];
    world.helicopter = null;
    world.roadblocks = [];
    world.enemies = [];
    game.input.cameraYaw = player.angle;
    showScreen(null);
    startMission(missions, 0, game);
    audio.unlock();
  };

  game.continueGame = () => {
    const save = readSlot(1);
    if (!save) return false;
    Object.assign(player, createPlayer(freshPlayerState()));
    Object.assign(police, createPolice());
    Object.assign(missions, createMissions());
    game.stats = freshStats();
    game.pickups = [];
    applySnapshot(game, save);
    game.state = 'playing';
    showScreen(null);
    game.setDialogue('Raka: Lanjutkan dari mana kemarin berhenti.');
    audio.unlock();
    return true;
  };

  game.saveGame = (slot) => {
    const ok = writeSlot(slot, snapshotGame(game));
    if (ok) game.setDialogue(`Raka: Tersimpan di slot ${slot}.`);
    return ok;
  };

  game.openMap = () => {
    game.state = 'map';
    renderMapPanel(doc, game);
    showScreen('map');
  };
  game.closeMap = () => {
    game.state = 'playing';
    showScreen(null);
  };
  game.pauseGame = () => {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    showScreen('pause');
  };
  game.resumeGame = () => {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    showScreen(null);
  };

  // ----- input -----

  function onKeyDown(e) {
    if (e.repeat) return;
    audio.unlock();
    game.input.keys.add(e.code);
    if (game.state === 'title') {
      if (e.code === 'Enter') game.newGame();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'map') game.closeMap();
      else if (game.state === 'playing') game.pauseGame();
      else if (game.state === 'paused') game.resumeGame();
      return;
    }
    if (e.code === 'KeyM' && game.state === 'map') { game.closeMap(); return; }
    if (game.state !== 'playing') return;
    if (e.code === 'KeyM') { game.openMap(); return; }
    if (e.code === 'KeyE') {
      if (player.onFoot) {
        const car = game.nearCar;
        if (car) stealCar(player, car, game);
      } else {
        exitCar(player, world);
        audio.setEngine(0, false);
      }
      return;
    }
    if (e.code === 'KeyF') { punch(player, game); return; }
    if (e.code === 'KeyQ') {
      game.wheelOpen = !game.wheelOpen;
      if (game.wheelOpen) cycleWeapon(player);
      return;
    }
    if (e.code === 'Digit1') { selectWeapon(player, 0); game.wheelOpen = false; return; }
    if (e.code === 'Digit2') { selectWeapon(player, 1); game.wheelOpen = false; return; }
    if (e.code === 'Digit3') { selectWeapon(player, 2); game.wheelOpen = false; return; }
    if (e.code === 'KeyR') {
      const st = audio.nextStation();
      game.setDialogue(`Radio: ${RADIO_STATIONS[st].name} — ${RADIO_STATIONS[st].blurb}`);
      return;
    }
    if (e.code === 'KeyH') { audio.horn(); return; }
    if (e.code === 'KeyJ') {
      const job = game.nearJob;
      if (job) startSideJob(missions, job.id, game);
      return;
    }
    if (e.code === 'Enter') {
      if (game.pendingMission !== null && game.pendingMission !== undefined) {
        startPendingMission(missions, game);
      }
      return;
    }
  }
  function onKeyUp(e) {
    game.input.keys.delete(e.code);
  }
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('mousedown', (e) => {
    audio.unlock();
    game.input.dragging = true;
    game.input.lastX = e.clientX;
    game.input.lastY = e.clientY;
    game.input.moved = 0;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!game.input.dragging) return;
    const dx = e.clientX - game.input.lastX;
    const dy = e.clientY - game.input.lastY;
    game.input.lastX = e.clientX;
    game.input.lastY = e.clientY;
    game.input.moved += Math.abs(dx) + Math.abs(dy);
    game.input.cameraYaw -= dx * 0.005;
    game.camera.height = clamp(game.camera.height + dy * 0.03, 4, 14);
  });
  canvas.addEventListener('mouseup', (e) => {
    game.input.dragging = false;
    if (game.state === 'playing' && game.input.moved < 6) {
      if (player.weapon === 'fists') punch(player, game);
      else shoot(player, game);
    }
  });

  // Menu buttons.
  doc.querySelectorAll('button[data-a]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.click();
      const action = btn.getAttribute('data-a');
      if (action === 'new') game.newGame();
      else if (action === 'continue') {
        if (!game.continueGame()) game.setDialogue('Belum ada simpanan di slot 1.');
      } else if (action === 'howto') {
        const help = doc.getElementById('howto');
        if (help) help.classList.toggle('show');
      } else if (action === 'save') game.saveGame(1);
      else if (action === 'resume') game.resumeGame();
      else if (action === 'quit') { game.state = 'title'; showScreen('title'); }
      else if (action === 'close-map') game.closeMap();
      else if (action === 'respawn') {
        player.dead = false;
        player.health = 100;
        player.money = Math.max(0, player.money - 200);
        player.x = game.landmarks.hospital.x + 12;
        player.z = game.landmarks.hospital.z + 12;
        player.onFoot = true;
        player.car = null;
        game.clearWanted();
        game.state = 'playing';
        showScreen(null);
        game.setDialogue('Raka: Sakit… tapi belum mati. Rumah sakit lagi.');
      } else if (action === 'busted-ok') {
        resolveBust(police, player, world, game);
        game.state = 'playing';
        showScreen(null);
      }
    });
  });

  // ----- simulation step -----

  game.stepGame = (dt) => {
    game.time += dt;
    game.clockSeconds += dt * CLOCK_RATE;
    game.stats.playSeconds += dt;
    const hour = game.currentHour();

    // Player movement.
    if (game.state === 'playing' || game.shotMode) {
      if (player.onFoot) stepOnFoot(player, world, game.input, dt);
      else stepDriving(player, world, game.input, dt, game);
    }

    // World life.
    stepTraffic(world, dt, rng);
    stepPedestrians(world, dt, player, rng);
    stepPolice(police, world, player, dt, game);

    // Enemies chase and attack.
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      const d = dist2d(e.x, e.z, player.x, player.z);
      if (d < 45) {
        e.angle = Math.atan2(player.x - e.x, player.z - e.z);
        if (d > 2.2) {
          const moved = { x: e.x + Math.sin(e.angle) * e.speed * dt, z: e.z + Math.cos(e.angle) * e.speed * dt };
          e.x = moved.x; e.z = moved.z;
        } else if (e.attackTimer <= 0) {
          e.attackTimer = 0.9;
          game.damagePlayer(9, 0, e.name);
          game.setDialogue(`${e.name}: Rasakan ini, Raka!`);
        }
      }
      if (e.attackTimer > 0) e.attackTimer -= dt;
    }

    // Pickups and collectibles.
    for (const pk of game.pickups) {
      if (!pk.taken && dist2d(player.x, player.z, pk.x, pk.z) < 2.6) {
        pk.taken = true;
        const act = missions.active;
        if (act && act.mission.stages[act.stageIndex].type === 'collect') act.progress += 1;
        audio.cash();
      }
    }
    for (const c of world.collectibles) {
      if (!c.taken && dist2d(player.x, player.z, c.x, c.z) < 2.2) {
        c.taken = true;
        player.money += 100;
        audio.cash();
        game.setDialogue('Raka: Keris emas! Koleksi 1 dari 12.');
      }
    }

    // Missions and side jobs.
    if (game.state === 'playing' || game.shotMode) {
      stepMissions(missions, game, dt);
      stepSideJob(missions, game, dt);
    }

    // Free-roam mutterings.
    player.mutterTimer -= dt;
    if (player.mutterTimer <= 0 && game.state === 'playing' && !missions.active) {
      player.mutterTimer = 22;
      game.setDialogue(`Raka: ${rng.pick(MUTTERINGS)}`);
    }
    // Pedestrian chatter when bumped.
    for (const ped of world.pedestrians) {
      if (ped.lineTimer <= 0 && dist2d(ped.x, ped.z, player.x, player.z) < 2) {
        ped.line = rng.pick(PED_LINES);
        ped.lineTimer = 3;
        game.setDialogue(`Warga: ${ped.line}`);
      }
    }

    // Busted?
    if (police.busted && game.state === 'playing') {
      game.state = 'busted';
      showScreen('busted');
    }

    // Engine sound follows driving; quiet on foot.
    if (!player.car) audio.setEngine(0, false);

    // Camera: ease toward the car heading while driving.
    if (player.car) {
      game.input.cameraYaw += clamp(angleDelta(game.input.cameraYaw, player.car.angle), -1.4 * dt, 1.4 * dt);
    }
  };

  // ----- rendering -----

  game.renderFrame = () => {
    const hour = game.currentHour();
    let camX; let camY; let camZ; let tx; let ty; let tz;
    if (game.state === 'title') {
      // Slow orbit around the alun-alun behind the title screen.
      const a = game.time * 0.05;
      camX = 60 + Math.cos(a) * 90;
      camY = 55;
      camZ = 60 + Math.sin(a) * 90;
      tx = 60; ty = 4; tz = 60;
    } else {
      const yaw = game.input.cameraYaw;
      const dist = game.camera.distance;
      const height = game.camera.height;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      camX = player.x - fx * dist;
      camY = height + (player.car ? 1.5 : 0);
      camZ = player.z - fz * dist;
      tx = player.x + fx * 8;
      ty = 2;
      tz = player.z + fz * 8;
    }
    if (renderer) {
      try {
        renderer.draw(game, { x: camX, y: camY, z: camZ, tx, ty, tz }, hour, game.time);
      } catch (err) {
        window.__shotError = String(err && err.message ? err.message : err);
      }
    }
    if (game.state === 'playing' || game.shotMode) hud.update(game, 1 / 60);
  };

  // ----- main loop -----

  let last = performance.now();
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (game.state !== 'title' || game.time < 0.1) game.stepGame(dt);
    else game.time += dt;
    game.renderFrame();
    window.requestAnimationFrame(loop);
  }

  // ----- boot -----

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    game.shotMode = shot;
    game.state = 'playing';
    showScreen(null);
    stageShot(shot, game);
  } else {
    showScreen('title');
    const cont = doc.querySelector('button[data-a="continue"]');
    if (cont && !readSlot(1)) cont.setAttribute('disabled', 'disabled');
  }
  if (!renderer) {
    window.__shotError = 'WebGL2 tidak tersedia di browser ini';
  }
  window.__game = game;
  window.requestAnimationFrame(loop);
  return game;
}
