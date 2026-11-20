// hud.js — The heads-up display and the map screen.
//
// The HUD is plain DOM over the WebGL canvas: health and armour numbers,
// money, the wanted stars with their label, speed, the radio station, the
// clock, the street name, the mission stage and objective counter, the
// character dialogue line, the police-unit distance list, and a live minimap
// drawn on a small 2D canvas every frame. The map screen ("PETA TANJUNG
// MATAHARI") is a full overlay: mission list with SELESAI / BERJALAN /
// TERKUNCI states, career stats, collectibles and save slots. Nothing here
// reads the network; the minimap is drawn from the world data directly.

import { WANTED_LABELS, RESPECT_RANKS, LANDMARKS, SEA_X } from './config.js';
import { formatMoney, formatDistance } from './rng.js';
import { objectiveText, missionStageText, CHAPTER_NAMES, MISSIONS, SIDE_JOBS } from './missions.js';

/** Respect rank for a number of completed missions. */
export function respectRank(missionsDone) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (missionsDone >= r.at) rank = r;
  return rank;
}

/** Create the HUD controller, bound to the page's DOM ids. */
export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    hud: $('hud'), healthNum: $('healthNum'), armourNum: $('armourNum'),
    healthBar: $('healthBar'), armourBar: $('armourBar'),
    money: $('money'), stars: $('stars'), wantedLabel: $('wantedLabel'),
    speed: $('speed'), radioName: $('radioName'), clock: $('clock'),
    street: $('street'), objText: $('objText'), missionStage: $('missionStage'),
    dialogue: $('dialogue'), banner: $('banner'), bannerTitle: $('bannerTitle'),
    bannerSub: $('bannerSub'), policeList: $('policeList'),
    crimeFlash: $('crimeFlash'), minimap: $('minimap'),
    prompt: $('prompt'), wheel: $('wheel'), bustBar: $('bustBar'),
    bustFill: $('bustFill'), respect: $('respect'),
  };
  const mapCtx = els.minimap ? els.minimap.getContext('2d') : null;
  let bannerTimer = 0;
  let dialogueTimer = 0;
  let crimeTimer = 0;

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  /** Show the big centre banner for a few seconds. */
  function showBanner(title, sub) {
    setText(els.bannerTitle, title);
    setText(els.bannerSub, sub || '');
    if (els.banner) els.banner.classList.add('show');
    bannerTimer = 4;
  }

  /** Show a dialogue line at the bottom of the screen. */
  function setDialogue(line, keep) {
    setText(els.dialogue, line);
    if (els.dialogue) els.dialogue.classList.add('show');
    dialogueTimer = keep ? 7 : 5;
  }

  /** Flash the crime notice ("Mencuri mobil di jalan") briefly. */
  function flashCrime(reason) {
    if (!reason) return;
    setText(els.crimeFlash, `⚠ ${reason}`);
    if (els.crimeFlash) els.crimeFlash.classList.add('show');
    crimeTimer = 3;
  }

  /** Draw the live minimap: roads, sea, markers, cars, police, Raka. */
  function drawMinimap(game) {
    if (!mapCtx || !els.minimap) return;
    const S = els.minimap.width;
    const scale = S / 940;
    const toX = (x) => (x + 470) * scale;
    const toZ = (z) => (z + 470) * scale;
    const g = mapCtx;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#1d2b1f';
    g.fillRect(0, 0, S, S);
    // Sea on the west.
    g.fillStyle = '#1c5a8a';
    g.fillRect(0, 0, (SEA_X + 470) * scale + 20 * scale, S);
    // Roads.
    g.strokeStyle = '#5a5f66';
    g.lineWidth = 4;
    for (const a of game.roads.avenues) {
      g.beginPath();
      g.moveTo(toX(a.x), 0);
      g.lineTo(toX(a.x), S);
      g.stroke();
    }
    for (const s of game.roads.streets) {
      g.beginPath();
      g.moveTo(0, toZ(s.z));
      g.lineTo(S, toZ(s.z));
      g.stroke();
    }
    // Harbour.
    g.fillStyle = '#3a4a5a';
    g.fillRect(toX(-320), toZ(400), 640 * scale, 40 * scale);
    // Lighthouse.
    g.fillStyle = '#ffd24a';
    g.beginPath();
    g.arc(toX(LANDMARKS.lighthouse.x), toZ(LANDMARKS.lighthouse.z), 4, 0, Math.PI * 2);
    g.fill();
    // Traffic cars as white dots, police as blue dots.
    g.fillStyle = '#e8e8e8';
    for (const car of game.world.traffic) {
      g.fillRect(toX(car.x) - 1, toZ(car.z) - 1, 2, 2);
    }
    g.fillStyle = '#3a8cff';
    for (const car of game.world.policeCars) {
      g.beginPath();
      g.arc(toX(car.x), toZ(car.z), 3, 0, Math.PI * 2);
      g.fill();
    }
    if (game.world.helicopter) {
      g.fillStyle = '#ff5a5a';
      g.beginPath();
      g.arc(toX(game.world.helicopter.x), toZ(game.world.helicopter.z), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Mission marker: a yellow diamond.
    if (game.marker) {
      const mx = toX(game.marker.x);
      const my = toZ(game.marker.z);
      g.fillStyle = '#ffd21a';
      g.beginPath();
      g.moveTo(mx, my - 6);
      g.lineTo(mx + 5, my);
      g.lineTo(mx, my + 6);
      g.lineTo(mx - 5, my);
      g.closePath();
      g.fill();
      g.strokeStyle = '#7a5a00';
      g.lineWidth = 1;
      g.stroke();
    }
    // Raka: a white triangle pointing along his heading.
    const px = toX(game.player.x);
    const py = toZ(game.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(game.player.angle), Math.cos(game.player.angle)) + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.fillText('U', S - 14, 14);
  }

  /** Refresh every HUD element from the live game state. Call each frame. */
  function update(game, dt) {
    const p = game.player;
    const police = game.police;
    setText(els.healthNum, `${Math.ceil(p.health)}`);
    setText(els.armourNum, `${Math.ceil(p.armour)}`);
    if (els.healthBar) els.healthBar.style.width = `${Math.max(0, p.health)}%`;
    if (els.armourBar) els.armourBar.style.width = `${Math.max(0, p.armour)}%`;
    setText(els.money, formatMoney(p.money));
    // Wanted stars.
    const stars = '★'.repeat(police.wanted) + '☆'.repeat(5 - police.wanted);
    setText(els.stars, stars);
    setText(els.wantedLabel, WANTED_LABELS[police.wanted]);
    if (els.stars) els.stars.className = police.wanted > 0 ? 'stars hot' : 'stars';
    // Speed and radio.
    const kmh = p.onFoot ? 0 : Math.round(Math.abs(p.speed) * 3.6);
    setText(els.speed, p.onFoot ? 'JALAN KAKI' : `${kmh} km/j`);
    setText(els.radioName, game.audioStationName());
    setText(els.clock, game.clockText());
    setText(els.street, game.streetName());
    setText(els.objText, objectiveText(game.missions));
    setText(els.missionStage, missionStageText(game.missions));
    setText(els.respect, `${respectRank(game.missions.completed.length).name} · ${game.missions.completed.length}/8 misi`);
    // Police distance list.
    if (els.policeList) {
      const list = game.policeDistances();
      if (list.length === 0) {
        setText(els.policeList, police.wanted > 0 ? 'Polisi sedang menuju lokasimu…' : '');
      } else {
        els.policeList.innerHTML = list.map((u) => {
          const kind = u.kind === 'heli' ? '🚁' : '🚓';
          return `<div class="polRow"><span>${kind} ${u.name}</span><span>${formatDistance(u.dist)}</span></div>`;
        }).join('');
      }
    }
    // Bust timer bar.
    if (els.bustBar) {
      if (police.bustTimer > 0) {
        els.bustBar.classList.add('show');
        if (els.bustFill) els.bustFill.style.width = `${(police.bustTimer / 3) * 100}%`;
      } else {
        els.bustBar.classList.remove('show');
      }
    }
    // Context prompt (steal car, start job, accept mission).
    let prompt = '';
    if (game.nearCar) prompt = `[E] Curi ${game.nearCar.def.name}`;
    else if (game.nearJob) prompt = `[J] Mulai ${game.nearJob.name} — ${game.nearJob.blurb}`;
    else if (game.pendingMission !== null && game.pendingMission !== undefined) {
      prompt = `[Enter] Misi berikutnya: ${MISSIONS[game.pendingMission].title}`;
    } else if (!p.onFoot) prompt = '[E] Keluar mobil · [H] Klakson';
    setText(els.prompt, prompt);
    if (els.prompt) els.prompt.classList.toggle('show', prompt.length > 0);
    // Weapon wheel.
    if (els.wheel) {
      els.wheel.classList.toggle('show', game.wheelOpen);
      if (game.wheelOpen) {
        els.wheel.innerHTML = ['fists', 'pistol', 'shotgun'].map((w, i) => {
          const names = { fists: 'Tinju', pistol: 'Pistol', shotgun: 'Shotgun' };
          const ammo = w === 'fists' ? '∞' : `${p.ammo[w]} peluru`;
          const sel = p.weapon === w ? ' sel' : '';
          return `<div class="wheelSlot${sel}"><b>${i + 1} · ${names[w]}</b><span>${ammo}</span></div>`;
        }).join('');
      }
    }
    // Timers: banner, dialogue, crime flash fade out.
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0 && els.banner) els.banner.classList.remove('show');
    }
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0 && els.dialogue) els.dialogue.classList.remove('show');
    }
    if (crimeTimer > 0) {
      crimeTimer -= dt;
      if (crimeTimer <= 0 && els.crimeFlash) els.crimeFlash.classList.remove('show');
    }
    drawMinimap(game);
  }

  return { update, showBanner, setDialogue, flashCrime, drawMinimap };
}

/** Render the map screen rows (mission list, stats, collectibles, saves). */
export function renderMapPanel(doc, game) {
  const panel = doc.querySelector('.mapPanel');
  if (!panel) return;
  const missions = game.missions;
  const stats = game.stats;
  const rows = MISSIONS.map((m, i) => {
    let state = 'TERKUNCI';
    let cls = 'locked';
    if (missions.completed.includes(m.id)) { state = 'SELESAI'; cls = 'done'; }
    else if (missions.active && missions.active.mission.id === m.id) { state = 'BERJALAN'; cls = 'active'; }
    else if (i === missions.index && !missions.finishedStory) { state = 'TERSEDIA'; cls = 'avail'; }
    return `<div class="mapRow ${cls}"><span class="mapNum">${i + 1}</span><span class="mapTitle">${CHAPTER_NAMES[m.chapter]} — ${m.title}</span><span class="mapState">${state}</span></div>`;
  }).join('');
  const jobs = SIDE_JOBS.map((j) => `<div class="mapRow"><span class="mapNum">★</span><span class="mapTitle">Kerja: ${j.name} — ${j.blurb}</span><span class="mapState">Rp ${j.pay}</span></div>`).join('');
  const keris = game.world.collectibles.filter((c) => c.taken).length;
  const saves = [1, 2, 3].map((slot) => {
    const s = game.readSaveSlot(slot);
    const text = s ? `Slot ${slot} — Misi ${s.missionIndex + 1}/8 · ${formatMoney(s.money)} · ${s.clock}` : `Slot ${slot} — kosong`;
    return `<div class="mapRow"><span class="mapNum">💾</span><span class="mapTitle">${text}</span><span class="mapState">${s ? 'TERSIMPAN' : '—'}</span></div>`;
  }).join('');
  panel.innerHTML = `
    <h2>PETA TANJUNG MATAHARI</h2>
    <div class="mapSection">Misi Cerita</div>
    ${rows}
    <div class="mapSection">Kerja Sampingan</div>
    ${jobs}
    <div class="mapSection">Statistik Karier — ${respectRank(missions.completed.length).name}</div>
    <div class="mapStats">
      <div>Misi selesai: <b>${missions.completed.length}/8</b></div>
      <div>Kerja sampingan: <b>${missions.jobsDone}</b></div>
      <div>Mobil dicuri: <b>${stats.carsStolen}</b></div>
      <div>Jarak tempuh: <b>${stats.distanceKm.toFixed(1)} km</b></div>
      <div>Uang didapat: <b>${formatMoney(stats.moneyEarned)}</b></div>
      <div>Tembakan: <b>${stats.shotsFired}</b></div>
      <div>Penangkapan: <b>${stats.arrests}</b></div>
      <div>Keris emas: <b>${keris}/12</b></div>
      <div>Waktu main: <b>${game.playTimeText()}</b></div>
    </div>
    <div class="mapSection">Slot Simpanan</div>
    ${saves}
  `;
}
