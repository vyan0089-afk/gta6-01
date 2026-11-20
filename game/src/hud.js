// hud.js — the whole interface: health/armour/money, wanted stars, objective
// text, live canvas minimap, speed, radio, dispatch feed, weapon wheel and
// the title / pause / garage / game-over menus. All DOM, drawn over the
// WebGL canvas.

export const RESPECT_RANKS = [
  { at: 0, name: 'Anak Baru' },
  { at: 30, name: 'Sopir Handal' },
  { at: 80, name: 'Juragan Jalanan' },
  { at: 150, name: 'Legenda Tanjung' },
];

export function respectRank(respect) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (respect >= r.at) rank = r;
  return rank.name;
}

const WEAPONS = [
  { id: 'fists', name: 'Tinju', key: '1' },
  { id: 'pistol', name: 'Pistol', key: '2' },
  { id: 'shotgun', name: 'Senapan', key: '3' },
];

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.build();
    this.minimap = this.root.querySelector('#minimap');
    this.mm = this.minimap.getContext('2d');
  }

  build() {
    this.root.innerHTML = `
      <div id="vignette"></div>
      <div id="status">
        <div class="bar"><span class="label">NYAWA</span><div class="track"><div id="hp" class="fill hp"></div></div><span class="num" id="hpNum">100</span></div>
        <div class="bar"><span class="label">ROMPI</span><div class="track"><div id="armour" class="fill armour"></div></div><span class="num" id="armourNum">0</span></div>
        <div id="money">$0</div>
        <div id="respect">Anak Baru</div>
      </div>
      <div id="wanted"></div>
      <div id="clock"></div>
      <div id="objective"><div id="stageLine"></div><div id="objText"></div><div id="objCounter"></div><div id="objTimer"></div></div>
      <div id="feed"></div>
      <div id="policeInfo"></div>
      <div id="prompt"></div>
      <div id="dialogue"></div>
      <div id="banner"><div id="bannerTitle"></div><div id="bannerSub"></div></div>
      <div id="speed"><span id="speedNum">0</span><span id="speedUnit">km/j</span><div id="carName"></div><div id="carCond"></div></div>
      <div id="radio"></div>
      <div id="wheel"></div>
      <canvas id="minimap" width="220" height="220"></canvas>
      <div id="menu"></div>
    `;
    this.el = {};
    for (const id of ['hp', 'armour', 'hpNum', 'armourNum', 'money', 'respect', 'wanted', 'clock', 'stageLine', 'objText', 'objCounter', 'objTimer', 'feed', 'policeInfo', 'prompt', 'dialogue', 'banner', 'bannerTitle', 'bannerSub', 'speed', 'speedNum', 'carName', 'carCond', 'radio', 'wheel', 'menu', 'vignette']) {
      this.el[id] = this.root.querySelector('#' + id);
    }
  }

  setStatus({ health, armour, money, respect }) {
    this.el.hp.style.width = Math.max(0, health) + '%';
    this.el.armour.style.width = Math.max(0, armour) + '%';
    this.el.hpNum.textContent = Math.round(Math.max(0, health));
    this.el.armourNum.textContent = Math.round(Math.max(0, armour));
    this.el.money.textContent = '$' + Math.floor(money).toLocaleString('en-US');
    this.el.respect.textContent = respectRank(respect) + '  ·  ' + respect + ' respect';
  }

  // In-game clock: "17:48 · Sore". The game clock starts at 10:15 and runs
  // one game minute every two real seconds.
  setClock(text) {
    this.el.clock.textContent = text;
  }

  // "Misi 6/8 · Tahap 1/2 · Malam di Tanjung" and the stage counter
  // ("Usir 2/5"). Empty strings hide the line; free roam shows its own line.
  setMissionInfo(stageLine, counter) {
    this.el.stageLine.textContent = stageLine ?? '';
    this.el.stageLine.style.display = stageLine ? 'block' : 'none';
    this.el.objCounter.textContent = counter ?? '';
    this.el.objCounter.style.display = counter ? 'block' : 'none';
  }

  // One spoken line under the screen while a mission runs; hidden otherwise.
  setDialogue(text) {
    this.el.dialogue.textContent = text ?? '';
    this.el.dialogue.style.display = text ? 'block' : 'none';
  }

  // Nearest chasing units with distance, e.g. "Elang-1 · 38 m".
  setPoliceInfo(units) {
    if (!units || units.length === 0) {
      this.el.policeInfo.innerHTML = '';
      return;
    }
    this.el.policeInfo.innerHTML = units.map((u) => `<div class="policeLine">${u.name} · ${u.dist} m</div>`).join('');
  }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
    this.el.wanted.innerHTML = stars;
  }

  setObjective(text, timer = null) {
    this.el.objText.textContent = text;
    this.el.objTimer.textContent = timer !== null && timer > 0 ? Math.ceil(timer) + ' dtk' : '';
  }

  setSpeed(kmh, inCar, carName = '', condition = '') {
    this.el.speed.style.display = inCar ? 'block' : 'none';
    this.el.speedNum.textContent = Math.round(kmh);
    this.el.carName.textContent = carName;
    this.el.carCond.textContent = condition ? `Kondisi: ${condition}` : '';
  }

  setRadio(station, on) {
    this.el.radio.innerHTML = on
      ? `<b>${station.name}</b> — ${station.genre}<br><span>${station.track}</span>`
      : 'Radio mati (R untuk nyalakan)';
  }

  setFeed(lines) {
    this.el.feed.innerHTML = lines.map((l) => `<div class="feedLine">${l.text}</div>`).join('');
  }

  setPrompt(text) {
    this.el.prompt.textContent = text ?? '';
    this.el.prompt.style.display = text ? 'block' : 'none';
  }

  showBanner(title, sub) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub ?? '';
    this.el.banner.classList.add('show');
    clearTimeout(this._bannerTO);
    this._bannerTO = setTimeout(() => this.el.banner.classList.remove('show'), 4800);
  }

  damageFlash() {
    this.el.vignette.classList.add('hit');
    setTimeout(() => this.el.vignette.classList.remove('hit'), 180);
  }

  showWheel(selected) {
    this.el.wheel.innerHTML = WEAPONS.map((w) => `<div class="wslot ${w.id === selected ? 'sel' : ''}"><b>${w.key}</b> ${w.name}</div>`).join('');
    this.el.wheel.style.display = 'flex';
  }
  hideWheel() { this.el.wheel.style.display = 'none'; }

  // ---- Minimap ----
  drawMinimap(state) {
    this.drawMapInto(this.mm, 220, state);
  }

  // The same map drawing at any size: the 220px HUD minimap and the big
  // canvas on the map screen share this, so both always agree.
  drawMapInto(c, S, state) {
    const half = 300;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10, 30, 25, 0.85)';
    c.fillRect(0, 0, S, S);
    // Sea.
    c.fillStyle = '#1a6f7d';
    c.fillRect(0, (318 + half) / 600 * S, S, S);
    // Beach.
    c.fillStyle = '#c9b98a';
    c.fillRect(0, (258 + half) / 600 * S, S, ((318 - 258) / 600) * S);
    // Roads.
    c.strokeStyle = '#8a8a8a';
    c.lineWidth = 2;
    for (const rc of state.roads) {
      const [x1] = toMap(rc, 0);
      c.beginPath(); c.moveTo(x1, 0); c.lineTo(x1, S); c.stroke();
      const [, z1] = toMap(0, rc);
      c.beginPath(); c.moveTo(0, z1); c.lineTo(S, z1); c.stroke();
    }
    // Buildings.
    c.fillStyle = '#5a5a62';
    for (const b of state.colliders) {
      const [x, z] = toMap(b.x0, b.z0);
      const [x2, z2] = toMap(b.x1, b.z1);
      c.fillRect(x, z, Math.max(1, x2 - x), Math.max(1, z2 - z));
    }
    // Mission marker (pulsing yellow).
    if (state.marker) {
      const [x, z] = toMap(state.marker.x, state.marker.z);
      const r = 7 + Math.sin(state.time * 5) * 2;
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000';
      c.font = 'bold 10px sans-serif';
      c.textAlign = 'center';
      c.fillText('!', x, z + 3.5);
    }
    // Police (red dots), traffic (white dots).
    for (const p of state.police) {
      const [x, z] = toMap(p.x, p.z);
      c.fillStyle = '#ff3b30';
      c.beginPath(); c.arc(x, z, 3, 0, Math.PI * 2); c.fill();
    }
    for (const t of state.traffic) {
      const [x, z] = toMap(t.x, t.z);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    // Player arrow (rotates with heading).
    const [px, pz] = toMap(state.player.x, state.player.z);
    c.save();
    c.translate(px, pz);
    c.rotate(state.player.heading);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2.5); c.lineTo(-5, 5); c.closePath();
    c.fill();
    c.restore();
    // North arrow.
    c.fillStyle = '#fff';
    c.font = 'bold 12px sans-serif';
    c.textAlign = 'left';
    c.fillText('N ↑', 8, 16);
  }

  // ---- Menus ----
  showMenu(html) {
    this.el.menu.innerHTML = html;
    this.el.menu.style.display = 'flex';
  }
  hideMenu() {
    this.el.menu.innerHTML = '';
    this.el.menu.style.display = 'none';
  }

  showTitle(hasSave, cb) {
    this.showMenu(`
      <div class="panel title">
        <div class="gameTitle">TANJUNG<br>MATAHARI</div>
        <div class="tagline">Kota pantai. Jalanan panas. Satu sopir yang tak bisa diam.</div>
        <div class="btns">
          ${hasSave ? '<button data-a="continue">▶ Lanjutkan</button>' : ''}
          <button data-a="new">＋ Permainan Baru</button>
          <button data-a="how">Cara Bermain</button>
          <button data-a="settings">Pengaturan</button>
        </div>
        <div class="foot">Game orisinal karya tim Tanjung Matahari · dibuat untuk make.fun gta6-01</div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => cb(b.dataset.a));
    });
  }

  showHow(cb) {
    this.showMenu(`
      <div class="panel">
        <h2>Cara Bermain</h2>
        <div class="help">
          <p><b>W A S D</b> — jalan / gas, rem, belok &nbsp;·&nbsp; <b>Mouse</b> — putar kamera (tahan &amp; seret)</p>
          <p><b>E</b> — masuk/keluar mobil, ambil peti, mulai kerja &nbsp;·&nbsp; <b>Shift</b> — lari</p>
          <p><b>F</b> — pukul &nbsp;·&nbsp; <b>Klik kiri</b> — tembak &nbsp;·&nbsp; <b>Q (tahan)</b> — roda senjata, <b>1/2/3</b> — ganti senjata</p>
          <p><b>R</b> — ganti stasiun radio &nbsp;·&nbsp; <b>Spasi</b> — rem tangan &nbsp;·&nbsp; <b>Esc</b> — jeda &nbsp;·&nbsp; <b>M</b> — peta &amp; misi</p>
          <p>Curi mobil, kerjakan 8 misi cerita Raka, naikkan respect, dan hindari polisi. Bintang 4 ke atas: helikopter ikut mengejar. Bintang 5: blokade jalan.</p>
          <p>Simpan otomatis setiap misi selesai. Uang dipakai untuk upgrade mobil di Bengkel Tanjung.</p>
        </div>
        <div class="btns"><button data-a="back">Kembali</button></div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  showSettings(settings, cb) {
    this.showMenu(`
      <div class="panel">
        <h2>Pengaturan</h2>
        <div class="help">
          <label>Volume: <input type="range" id="setVol" min="0" max="100" value="${Math.round(settings.volume * 100)}"></label><br><br>
          <label>Kecepatan kamera: <input type="range" id="setSens" min="20" max="200" value="${Math.round(settings.sensitivity * 100)}"></label><br><br>
          <label><input type="checkbox" id="setMusic" ${settings.music ? 'checked' : ''}> Musik radio</label>
        </div>
        <div class="btns"><button data-a="back">Kembali</button></div>
      </div>`);
    const vol = this.el.menu.querySelector('#setVol');
    const sens = this.el.menu.querySelector('#setSens');
    const mus = this.el.menu.querySelector('#setMusic');
    vol.addEventListener('input', () => cb('volume', vol.value / 100));
    sens.addEventListener('input', () => cb('sensitivity', sens.value / 100));
    mus.addEventListener('change', () => cb('music', mus.checked));
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  showPause(cb) {
    this.showMenu(`
      <div class="panel">
        <h2>Jeda</h2>
        <div class="btns">
          <button data-a="resume">Lanjutkan</button>
          <button data-a="map">Peta &amp; Misi (M)</button>
          <button data-a="save">Simpan Sekarang</button>
          <button data-a="settings">Pengaturan</button>
          <button data-a="quit">Keluar ke Menu Utama</button>
        </div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  // The map screen (M): a big map of Tanjung, the 8 story missions with
  // progress, career stats, patung collectibles and the two save slots.
  // data: {missions, money, respect, statuesTaken, statuesTotal, slots,
  //        mapState, clock}. cb actions: resume | save-1 | save-2 | close.
  showMap(data, cb) {
    const mark = (s) => (s === 'done' ? '✓ SELESAI' : s === 'current' ? '► BERJALAN' : '· TERKUNCI');
    const slotLine = (s) => {
      if (s.empty) return `Slot ${s.slot} — Kosong`;
      const when = s.savedAt ? new Date(s.savedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return `Slot ${s.slot} — Misi ${s.missionIndex + 1}/8 · $${Math.floor(s.money)} · ${s.missionsDone} misi selesai · ${when}`;
    };
    this.showMenu(`
      <div class="panel mapPanel">
        <h2>PETA TANJUNG MATAHARI</h2>
        <div class="mapClock">${data.clock ?? ''}</div>
        <div class="mapGrid">
          <div class="mapCol">
            <canvas id="bigmap" width="300" height="300"></canvas>
          </div>
          <div class="mapCol">
            <div class="mapSec"><h3>Misi Cerita — ${data.missions.filter((m) => m.state === 'done').length}/8 selesai</h3>
              ${data.missions.map((m) => `<div class="mapRow"><span>${m.chapter} — ${m.title}</span><b>${mark(m.state)}</b></div>`).join('')}
            </div>
            <div class="mapSec"><h3>Karier Raka</h3>
              <div class="mapRow"><span>Uang</span><b>$${Math.floor(data.money)}</b></div>
              <div class="mapRow"><span>Pangkat</span><b>${respectRank(data.respect)} (${data.respect} respect)</b></div>
              <div class="mapRow"><span>Patung Tanjung</span><b>${data.statuesTaken}/${data.statuesTotal} terkumpul</b></div>
            </div>
            <div class="mapSec"><h3>Simpanan</h3>
              ${data.slots.map((s) => `<div class="mapRow"><span>${slotLine(s)}</span></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="btns mapBtns">
          <button data-a="resume">Lanjutkan (M)</button>
          <button data-a="save-1">Simpan ke Slot 1</button>
          <button data-a="save-2">Simpan ke Slot 2</button>
        </div>
      </div>`);
    const big = this.el.menu.querySelector('#bigmap');
    if (big && data.mapState) this.drawMapInto(big.getContext('2d'), 300, data.mapState);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  showGarage(garage, money, cb) {
    const rows = [
      { id: 'engine', name: 'Mesin', desc: 'Top speed +12% per level', level: garage.engine, cost: 400 * (garage.engine + 1), max: 3 },
      { id: 'armour', name: 'Pelindung Mobil', desc: 'Mobil lebih tahan tabrakan', level: garage.armour, cost: 350 * (garage.armour + 1), max: 3 },
      { id: 'paint', name: 'Cat Baru', desc: 'Ganti warna mobilmu', level: garage.paint, cost: 200, max: 1 },
    ];
    this.showMenu(`
      <div class="panel">
        <h2>Bengkel Tanjung</h2>
        <p>Uangmu: <b>$${Math.floor(money)}</b></p>
        ${rows.map((r) => `<div class="shopRow"><b>${r.name}</b> — ${r.desc}<br>Level ${r.level}/${r.max} · Harga $${r.cost} ${r.level >= r.max ? '(MAX)' : `<button data-a="buy-${r.id}">Beli</button>`}</div>`).join('')}
        <div class="btns"><button data-a="close">Tutup Bengkel</button></div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  showGameOver(reason, cb) {
    this.showMenu(`
      <div class="panel">
        <h2>${reason === 'busted' ? 'TERTANGKAP!' : 'KAMU TUMBANG!'}</h2>
        <p>${reason === 'busted' ? 'Polisi menangkapmu. Denda $200, bintangmu hilang.' : 'Kamu kehabisan nyawa. Denda rumah sakit $200.'}</p>
        <div class="btns"><button data-a="respawn">Bangun Lagi</button></div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }

  showComplete(cb) {
    this.showMenu(`
      <div class="panel">
        <h2>LEGENDARIS!</h2>
        <p>Kamu menyelesaikan semua 8 misi cerita. Raka kini Legenda Tanjung. Kota ini milikmu — teruslah berkendara, kerjakan kerja sampingan, dan jaga namamu tetap besar.</p>
        <div class="btns"><button data-a="free">Terus Bermain</button></div>
      </div>`);
    this.el.menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => cb(b.dataset.a)));
  }
}
