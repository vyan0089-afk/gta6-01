// hud.js — The HUD of Tanjung Matahari: health, wanted stars, money,
// mission, dialogue, police distances, speedometer, radio, clock, street
// name and the live minimap. The HUD is DOM over the WebGL canvas: cheap
// to update, crisp to read, and honest — every number comes from the live
// game state. The minimap is a 2D canvas redrawn each frame: roads, the
// beach, buildings, traffic, police, the mission marker and the player arrow.

import { fmtMoney, fmtClock, clamp } from './rng.js';
import { WORLD, DISTRICTS } from './config.js';
import { districtAt, streetAt } from './world.js';

/** Cache of HUD element handles. */
export class Hud {
  constructor() {
    this.el = {};
    const ids = [
      'healthNum', 'healthBar', 'armourNum', 'armourBar', 'money', 'stars',
      'objTitle', 'objText', 'objCount', 'dialogBox', 'dialogWho', 'dialogText',
      'policeDist', 'speed', 'speedUnit', 'radioName', 'clock', 'streetName',
      'weaponName', 'ammo', 'respectRank', 'kerisCount', 'minimap', 'toast',
      'toastTitle', 'toastText', 'garagePanel', 'jobText', 'wantedLabel',
      'chapterLabel', 'fps', 'hintBar', 'weaponWheel',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.last = {};
    this.mm = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.wheelShownAt = -10;
  }

  /** Flash the weapon wheel for a moment (Q or 1/2/3 pressed). */
  flashWeaponWheel(game) {
    this.wheelShownAt = game.time;
  }

  /** Render the weapon wheel overlay when it is showing. */
  drawWeaponWheel(game) {
    const el = this.el.weaponWheel;
    if (!el) return;
    if (game.time - this.wheelShownAt > 1.6) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const rows = game.combat ? ['Tinju', 'Pistol Pindad', 'Senapan Laras'] : [];
    el.innerHTML = '<div style="font-weight:800;color:#ffd94a;margin-bottom:4px">SENJATA (Q)</div>' +
      rows.map((name, i) => {
        const sel = game.combat.weaponIndex === i ? ' sel' : '';
        const ammo = i === 0 ? '∞' : `${game.combat.ammo[['fists', 'pistol', 'shotgun'][i]] ?? 0}`;
        return `<div class="wwRow${sel}">${i + 1} · ${name} — ${ammo}</div>`;
      }).join('');
  }

  /** Set text only when it changed (avoids layout churn). */
  set(id, text) {
    const e = this.el[id];
    if (!e) return;
    if (this.last[id] !== text) {
      this.last[id] = text;
      e.textContent = text;
    }
  }

  /** Set a bar width only when it changed. */
  setBar(id, frac) {
    const e = this.el[id];
    if (!e) return;
    const pct = Math.round(clamp(frac, 0, 1) * 100);
    if (this.last[id] !== pct) {
      this.last[id] = pct;
      e.style.width = pct + '%';
    }
  }

  /** Update every HUD field from the live game. */
  update(game) {
    const p = game.player;
    this.set('healthNum', `${Math.ceil(p.health)}`);
    this.setBar('healthBar', p.health / 100);
    this.set('armourNum', `${Math.ceil(p.armour)}`);
    this.setBar('armourBar', p.armour / 100);
    this.set('money', `Rp ${fmtMoney(p.money)}`);
    const stars = '★'.repeat(game.police.wanted) + '☆'.repeat(5 - game.police.wanted);
    this.set('stars', stars);
    const starsEl = document.getElementById('stars');
    if (starsEl) {
      const heat = game.police.wanted;
      starsEl.style.color = heat >= 4 ? '#ff5a3c' : heat >= 2 ? '#ffb13c' : '#ffd94a';
      starsEl.style.fontSize = heat >= 4 ? '26px' : '22px';
    }
    this.set('wantedLabel', game.police.wanted > 0 ? game.police.unitName() : 'Aman');
    const m = game.missions;
    this.set('objTitle', m.active ? `${m.active.title} — Misi ${m.progressText()}` : 'Cerita Selesai');
    this.set('objText', m.objective);
    const dist = m.markerDistance(p);
    this.set('objCount', m.marker ? `${Math.round(dist)} m` : '');
    this.set('chapterLabel', m.active ? `Bab ${m.active.chapter}` : 'Tanjung Matahari');
    // Dialogue.
    const line = game.dialogue.line();
    const box = this.el.dialogBox;
    if (box) {
      if (line) {
        box.style.display = 'block';
        this.set('dialogWho', line.who);
        this.set('dialogText', line.text);
      } else {
        box.style.display = 'none';
      }
    }
    // Police distances.
    const dists = game.police.unitDistances(p);
    if (game.police.wanted > 0) {
      this.set('policeDist', `Polisi: ${dists.map((d) => `${d}m`).join(' · ')}${game.police.bustTimer > 0 ? ` — DITANGKAP ${game.police.bustTimer.toFixed(1)}` : ''}`);
    } else {
      this.set('policeDist', '');
    }
    // Speedometer, radio, clock, street.
    this.set('speed', `${Math.round(p.speedKmh())}`);
    this.set('speedUnit', p.car ? 'km/jam' : 'lari');
    this.set('radioName', game.audio.stationDef.name);
    this.set('clock', fmtClock(game.weather.hour) + ' · ' + game.weather.describe());
    this.set('streetName', `${streetAt(p.x, p.z)} — ${districtAt(p.x, p.z).name}`);
    // Weapon + ammo.
    const w = game.combat.weapon;
    this.set('weaponName', w.name);
    const ammo = game.combat.ammoLeft();
    this.set('ammo', ammo === Infinity ? '∞' : `${ammo} / ${game.combat.reserve[w.id] || 0}`);
    // Respect + keris.
    this.set('respectRank', `${game.stats.rank().name} (${game.stats.respect})`);
    this.set('kerisCount', `Keris ${game.stats.kerisFound}/12`);
    // Respect progress: how close to the next rank.
    const rp = document.getElementById('respectBar');
    if (rp) rp.style.width = `${Math.round(game.stats.rankProgress() * 100)}%`;
    const rn = document.getElementById('respectNext');
    if (rn) {
      const toNext = game.stats.respectToNext();
      rn.textContent = toNext > 0 ? `+${toNext} ke peringkat berikutnya` : 'Peringkat tertinggi!';
    }
    // Job line.
    this.set('jobText', game.jobs.objectiveText());
    // Race progress while a race runs.
    const race = game.races.active || game.races.timeTrial;
    const re = document.getElementById('raceText');
    if (re) {
      if (race) {
        const gap = race.gapToLeader ? race.gapToLeader(game) : 0;
        re.textContent = `${race.progressText()}${gap > 0 ? ` — rival terdekat ${gap} m` : ''}`;
        re.style.display = 'block';
      } else {
        re.style.display = 'none';
      }
    }
    // Garage panel.
    const gp = this.el.garagePanel;
    if (gp) {
      if (game.garage.playerInside(p)) {
        gp.style.display = 'block';
        gp.innerHTML = game.garage.panelLines(p).map((l) => `<div>${l}</div>`).join('');
        if (game.garage.message) gp.innerHTML += `<div class="garageMsg">${game.garage.message}</div>`;
      } else {
        gp.style.display = 'none';
      }
    }
    // Achievement toast.
    const toast = this.el.toast;
    if (toast) {
      const a = game.achievements.toast;
      if (a) {
        toast.style.display = 'block';
        this.set('toastTitle', `🏆 ${a.name}`);
        this.set('toastText', a.desc);
      } else {
        toast.style.display = 'none';
      }
    }
    // Hint bar: contextual controls.
    let hint = 'WASD jalan · E curi mobil · Q senjata · R radio · M peta · Esc jeda';
    if (p.car) hint = 'W/S gas & rem · A/D belok · Spasi rem tangan · Shift nitro · E keluar mobil';
    if (game.garage.playerInside(p)) hint = 'E simpan mobil · 1 servis Rp 75rb · 2 nitro Rp 120rb · 3 perbaiki Rp 40rb';
    this.set('hintBar', hint);
    this.drawWeaponWheel(game);
    this.drawMinimap(game);
    // Damage flash and low-health pulse.
    const df = document.getElementById('damageFlash');
    if (df) {
      const flash = game.player.damageFlash || 0;
      df.style.opacity = String(Math.min(1, flash));
      if (game.player.health > 0 && game.player.health <= 25) df.classList.add('low');
      else df.classList.remove('low');
    }
  }

  /** Draw the live minimap: city, traffic, police, marker, player. */
  drawMinimap(game) {
    const ctx = this.mm;
    if (!ctx) return;
    const S = 168;
    const scale = S / (WORLD.size + 60);
    const toX = (x) => (x + WORLD.half + 30) * scale;
    const toY = (z) => (z + WORLD.half + 30) * scale;
    ctx.clearRect(0, 0, S, S);
    // Base: land, beach, sea.
    ctx.fillStyle = '#3a5a34';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#c8a860';
    ctx.fillRect(0, toY(WORLD.beachZ - 28), S, S - toY(WORLD.beachZ - 28));
    ctx.fillStyle = '#1e5f8a';
    ctx.fillRect(0, toY(WORLD.beachZ), S, S - toY(WORLD.beachZ));
    // Roads.
    ctx.strokeStyle = '#555550';
    ctx.lineWidth = 3;
    for (const line of game.worldRoads) {
      ctx.beginPath();
      ctx.moveTo(toX(-WORLD.half), toY(line));
      ctx.lineTo(toX(WORLD.half), toY(line));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(line), toY(-WORLD.half));
      ctx.lineTo(toX(line), toY(WORLD.beachZ - 28));
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8a7a5a';
    for (const bd of game.world.buildings) {
      ctx.fillRect(toX(bd.x - bd.w / 2), toY(bd.z - bd.d / 2), Math.max(1.5, bd.w * scale), Math.max(1.5, bd.d * scale));
    }
    // Keris (gold dots).
    ctx.fillStyle = '#ffd94a';
    for (const k of game.world.keris) {
      if (!k.found) {
        ctx.beginPath();
        ctx.arc(toX(k.x), toY(k.z), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Traffic (white), police (red), mission marker (yellow diamond).
    ctx.fillStyle = '#e8e8e8';
    for (const c of game.traffic.cars) ctx.fillRect(toX(c.x) - 1, toY(c.z) - 1, 2, 2);
    ctx.fillStyle = '#ff2a2a';
    for (const u of game.police.units) {
      ctx.beginPath();
      ctx.arc(toX(u.x), toY(u.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.police.heli) {
      ctx.fillStyle = '#ff7a7a';
      ctx.beginPath();
      ctx.arc(toX(game.police.heli.x), toY(game.police.heli.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const m = game.missions.marker;
    if (m) {
      ctx.fillStyle = '#ffe93c';
      const mx = toX(m.x);
      const my = toY(m.z);
      ctx.beginPath();
      ctx.moveTo(mx, my - 6);
      ctx.lineTo(mx + 5, my);
      ctx.lineTo(mx, my + 6);
      ctx.lineTo(mx - 5, my);
      ctx.closePath();
      ctx.fill();
    }
    // Player arrow.
    const p = game.player;
    ctx.save();
    ctx.translate(toX(p.x), toY(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.angle), Math.cos(p.angle)));
    ctx.fillStyle = '#ffe93c';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 14, 14);
  }
}

/** Show or hide a menu overlay by id. */
export function showScreen(id) {
  for (const s of ['titleScreen', 'pauseScreen', 'mapScreen', 'deadScreen', 'bustedScreen', 'helpScreen']) {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? 'flex' : 'none';
  }
}

/** Hide every menu overlay (back to pure gameplay). */
export function hideScreens() {
  showScreen(null);
}
