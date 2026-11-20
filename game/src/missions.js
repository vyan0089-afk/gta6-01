// missions.js — the story of Raka, driver of Tanjung Matahari. Eight staged
// missions across three chapters, plus repeatable side jobs (taxi, delivery,
// street race). Every stage has one clear objective shown on screen.

import { dist2D } from './math.js';

export const CHAPTERS = ['Bab 1 — Sopir Baru', 'Bab 2 — Nama di Jalanan', 'Bab 3 — Juragan Tanjung'];

// Stage types:
//  goto      {loc, radius}          walk/drive to a place
//  steal     {model, loc}           get into the marked car
//  deliver   {loc, radius, time?}   reach a place (optional timer)
//  race      {points:[{x,z}], label} drive through checkpoints in order
//  defeat    {loc, count, role}     defeat N hostiles at a place
//  survive   {seconds}              stay alive / keep the wanted level
//  escape    {loc, radius}          reach a place while wanted >= level

export const MISSIONS = [
  {
    id: 'm1', chapter: 0, title: 'Kunci Pertama',
    briefing: 'Bengkel Tanjung butuh mobil. Ambil sedan di Pasar Malam dan antar ke bengkel. Jangan sampai ketahuan.',
    reward: { money: 250, respect: 10 },
    stages: [
      { type: 'goto', loc: 'market', radius: 10, text: 'Pergi ke Pasar Malam' },
      { type: 'steal', model: 'sedan', loc: 'market', text: 'Curi sedan yang ditandai (E untuk masuk)' },
      { type: 'deliver', loc: 'garage', radius: 8, text: 'Antar mobil ke Bengkel Tanjung' },
    ],
  },
  {
    id: 'm2', chapter: 0, title: 'Antar Cepat',
    briefing: 'Paket penting harus sampai ke Pelabuhan dalam 100 detik. Gaspol, tapi jangan tabrak polisi.',
    reward: { money: 350, respect: 12 },
    stages: [
      { type: 'goto', loc: 'market', radius: 8, text: 'Ambil paket di Pasar Malam' },
      { type: 'deliver', loc: 'harbor', radius: 10, time: 100, text: 'Antar paket ke Pelabuhan (100 detik)' },
    ],
  },
  {
    id: 'm3', chapter: 0, title: 'Balap Pantai',
    briefing: 'Anak-anak pantai menantangmu balapan. Lima gerbang di jalan pantai. Menang dan namamu naik.',
    reward: { money: 500, respect: 18 },
    stages: [
      { type: 'goto', loc: 'raceStart', radius: 8, text: 'Pergi ke garis start di Pantai Matahari' },
      { type: 'race', points: [{ x: -120, z: 240 }, { x: 0, z: 240 }, { x: 120, z: 240 }, { x: 200, z: 200 }, { x: 200, z: 120 }], time: 75, text: 'Lewati 5 gerbang balapan' },
    ],
  },
  {
    id: 'm4', chapter: 1, title: 'Tamu Pelabuhan',
    briefing: 'Tiga peti di dermaga harus dipindah sebelum polisi datang. Ambil semuanya, lalu kabur.',
    reward: { money: 600, respect: 20 },
    stages: [
      { type: 'goto', loc: 'harbor', radius: 10, text: 'Pergi ke Pelabuhan' },
      { type: 'collect', loc: 'harbor', count: 3, text: 'Kumpulkan 3 peti di dermaga (E di dekat peti)' },
      { type: 'escape', loc: 'safehouse', radius: 10, wanted: 2, text: 'Kabur dari polisi ke Rumah Aman' },
    ],
  },
  {
    id: 'm5', chapter: 1, title: 'Utang Lama',
    briefing: 'Penagih utang menunggu di gang Kota Tua. Selesaikan dengan tinju atau pistol. Ambil uangnya.',
    reward: { money: 700, respect: 22 },
    stages: [
      { type: 'goto', loc: 'oldtown', radius: 10, text: 'Pergi ke gang Kota Tua' },
      { type: 'defeat', loc: 'oldtown', count: 4, role: 'collector', text: 'Kalahkan 4 penagih utang' },
      { type: 'deliver', loc: 'home', radius: 8, text: 'Bawa uangnya pulang ke Rumah Raka' },
    ],
  },
  {
    id: 'm6', chapter: 1, title: 'Malam di Tanjung',
    briefing: 'Polisi sudah mengincarmu. Bertahan dengan bintang 3 dan sampai ke Rumah Aman tanpa tertangkap.',
    reward: { money: 800, respect: 25 },
    stages: [
      { type: 'survive', seconds: 45, wanted: 3, text: 'Bertahan 45 detik dengan bintang 3' },
      { type: 'escape', loc: 'safehouse', radius: 10, wanted: 1, text: 'Sampai ke Rumah Aman' },
    ],
  },
  {
    id: 'm7', chapter: 2, title: 'Perang Gang',
    briefing: 'Gang Sanca menyerbu Pasar Malam. Usir mereka dari dua titik sebelum pasar hancur.',
    reward: { money: 1000, respect: 30 },
    stages: [
      { type: 'defeat', loc: 'market', count: 5, role: 'gang', text: 'Usir 5 anggota Gang Sanca dari Pasar Malam' },
      { type: 'defeat', loc: 'gangHQ', count: 4, role: 'gang', text: 'Serbu markas mereka di Jalan Gang' },
    ],
  },
  {
    id: 'm8', chapter: 2, title: 'Rampokan Terakhir',
    briefing: 'Panther GT emas di Vila Bukit. Curi, lalu lari dari kejaran bintang 5 ke kapal di Pelabuhan.',
    reward: { money: 2000, respect: 50 },
    stages: [
      { type: 'goto', loc: 'villa', radius: 10, text: 'Pergi ke Vila Bukit' },
      { type: 'steal', model: 'sport', loc: 'villa', text: 'Curi Panther GT emas (E untuk masuk)' },
      { type: 'escape', loc: 'harbor', radius: 12, wanted: 5, text: 'Kabur dengan bintang 5 ke Pelabuhan' },
    ],
  },
];

export const SIDE_JOBS = {
  taxi: { title: 'Taksi', briefing: 'Antar penumpang ke tujuannya.', reward: 120 },
  delivery: { title: 'Kurir', briefing: 'Antar paket tepat waktu.', reward: 150 },
  race: { title: 'Balap Liar', briefing: 'Lima gerbang, waktu tercepat menang.', reward: 200 },
};

// One spoken line per mission stage, shown under the objective while the
// mission runs. Raka talks to himself; Pak Haji runs the garage; Sari
// hosts the evening radio. Short, in Indonesian, no more than a sentence.
export const DIALOGUE = {
  m1: [
    'Raka: Sedan itu parkir di Pasar Malam. Ambil diam-diam.',
    'Raka: Kuncinya masih nempel. Rezeki anak soleh.',
    'Raka: Bengkel Tanjung tinggal lurus. Jangan bikin baret.',
  ],
  m2: [
    'Raka: Paketnya sudah di tangan. Pelabuhan, 100 detik!',
    'Raka: Jalan pantai paling cepat. Gaspol!',
  ],
  m3: [
    'Raka: Garis start di Pantai Matahari. Jangan malu-maluin.',
    'Raka: Lima gerbang. Yang paling cepat yang namanya naik.',
  ],
  m4: [
    'Raka: Tiga peti di dermaga. Angkat sebelum polisi datang.',
    'Raka: Peti terakhir. Sekarang kabur!',
    'Raka: Bintang dua nempel terus. Rumah Aman, cepat!',
  ],
  m5: [
    'Raka: Penagih utang nunggu di gang Kota Tua. Bereskan.',
    'Raka: Empat orang. Satu-satu saja.',
    'Raka: Uangnya sudah di tangan. Pulang, bawa ke rumah.',
  ],
  m6: [
    'Raka: Tiga bintang di belakangku. Tahan 45 detik!',
    'Raka: Bintang sudah turun. Rumah Aman tinggal sebentar lagi.',
  ],
  m7: [
    'Raka: Gang Sanca menyerbu pasar. Usir mereka semua!',
    'Raka: Markas mereka di Jalan Gang. Habiskan.',
  ],
  m8: [
    'Raka: Panther GT emas di Vila Bukit. Ini rampokan terakhir.',
    'Raka: Mobilnya sudah di tangan. Sekarang lari!',
    'Raka: Bintang lima! Ke Pelabuhan, ke kapal. Ini akhirnya!',
  ],
};

export class MissionSys {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0; // current story mission
    this.done = [];
    this.active = null; // {mission, stage, data}
    this.sideJob = null;
    this.marker = null; // {x, z, radius, label}
    this.banner = null; // {title, sub, t}
    this.objective = 'Buka peta misi: pergi ke penanda kuning.';
    this.spawnedCars = [];
    this.spawnedPeds = [];
    this.collectibles = [];
    this.raceIndex = 0;
    this.timer = 0;
    this.allComplete = false;
  }

  loc(name) { return this.city.locations[name]; }

  showBanner(title, sub) { this.banner = { title, sub, t: 0 }; }

  // The spoken line for the current stage, or '' when no mission runs.
  currentDialogue() {
    if (!this.active) return '';
    const lines = DIALOGUE[this.active.mission.id];
    if (!lines) return '';
    return lines[Math.min(this.active.stage, lines.length - 1)] ?? '';
  }

  // "Usir 2/5", "Peti 1/3", "Gerbang 2/5", "43 dtk tersisa" — the counter
  // the HUD shows next to the objective. '' when the stage has no count.
  counterText() {
    if (!this.active) return '';
    const stage = this.active.mission.stages[this.active.stage];
    if (stage.type === 'defeat') {
      const total = this.spawnedPeds.length;
      const down = this.spawnedPeds.filter((p) => p.dead).length;
      return total > 0 ? `Usir ${down}/${total}` : '';
    }
    if (stage.type === 'collect') {
      const total = this.collectibles.length;
      const got = this.collectibles.filter((c) => c.taken).length;
      return `Peti ${got}/${total}`;
    }
    if (stage.type === 'race') {
      return `Gerbang ${this.raceIndex}/${stage.points.length}`;
    }
    if (stage.type === 'survive') {
      return `${Math.max(0, Math.ceil(this.timer))} dtk tersisa`;
    }
    return '';
  }

  // Mission list for the map screen: every story mission with its state.
  progressList() {
    return MISSIONS.map((m, i) => ({
      id: m.id,
      chapter: CHAPTERS[m.chapter],
      title: m.title,
      state: this.done.includes(m.id) ? 'done' : i === this.index ? 'current' : i < this.index ? 'done' : 'locked',
    }));
  }

  startMission(i) {
    const m = MISSIONS[i];
    if (!m) { this.allComplete = true; return; }
    this.index = i; // the current mission, so the HUD stage line reads Misi 6/8, not 1/8
    this.active = { mission: m, stage: 0, data: {} };
    this.showBanner(`${CHAPTERS[m.chapter]}`, `${m.title} — ${m.briefing}`);
    this.setupStage();
  }

  setupStage() {
    const stage = this.active.mission.stages[this.active.stage];
    this.timer = stage.time ?? stage.seconds ?? 0;
    this.raceIndex = 0;
    this.collectibles = [];
    this.spawnedPeds = [];
    if (stage.type === 'goto' || stage.type === 'deliver' || stage.type === 'escape') {
      const l = this.loc(stage.loc);
      this.marker = { x: l.x, z: l.z, radius: stage.radius, label: l.name };
    } else if (stage.type === 'steal') {
      const l = this.loc(stage.loc);
      this.marker = { x: l.x, z: l.z, radius: 8, label: 'Mobil target' };
    } else if (stage.type === 'race') {
      const p = stage.points[0];
      this.marker = { x: p.x, z: p.z, radius: 9, label: 'Gerbang 1/' + stage.points.length };
    } else if (stage.type === 'defeat') {
      const l = this.loc(stage.loc);
      this.marker = { x: l.x, z: l.z, radius: 12, label: 'Lawan' };
    } else if (stage.type === 'collect') {
      const l = this.loc(stage.loc);
      for (let i = 0; i < stage.count; i++) {
        this.collectibles.push({ x: l.x - 12 + i * 12, z: l.z + 6, taken: false });
      }
      this.marker = { x: l.x, z: l.z, radius: 14, label: 'Peti' };
    } else if (stage.type === 'survive') {
      this.marker = null;
    }
    this.objective = stage.text;
  }

  advanceStage() {
    this.active.stage++;
    if (this.active.stage >= this.active.mission.stages.length) {
      this.completeMission();
    } else {
      this.setupStage();
    }
  }

  completeMission() {
    const m = this.active.mission;
    this.done.push(m.id);
    this.showBanner('MISI SELESAI', `${m.title} — +$${m.reward.money}, +${m.reward.respect} respect`);
    this.active = null;
    this.marker = null;
    this.objective = 'Misi selesai. Misi berikutnya tersedia di penanda kuning.';
    this._reward = m.reward;
    this.index++;
    if (this.index >= MISSIONS.length) this.allComplete = true;
  }

  takeReward() {
    const r = this._reward;
    this._reward = null;
    return r;
  }

  // Side jobs ------------------------------------------------------------
  startSideJob(kind, playerPos) {
    if (this.active || this.sideJob) return false;
    const job = SIDE_JOBS[kind];
    this.sideJob = { kind, ...job, stage: 0, timer: kind === 'delivery' ? 80 : kind === 'race' ? 60 : 0 };
    if (kind === 'taxi') {
      this.marker = { x: playerPos.x + 10, z: playerPos.z + 6, radius: 6, label: 'Penumpang' };
      this.objective = 'Jemput penumpang taksi';
    } else if (kind === 'delivery') {
      const l = this.loc('market');
      this.marker = { x: l.x, z: l.z, radius: 8, label: 'Paket' };
      this.objective = 'Ambil paket di Pasar Malam';
    } else if (kind === 'race') {
      this.raceIndex = 0;
      const pts = [{ x: -200, z: 240 }, { x: -80, z: 240 }, { x: 40, z: 240 }, { x: 160, z: 200 }, { x: 160, z: 80 }];
      this.sideJob.points = pts;
      this.marker = { x: pts[0].x, z: pts[0].z, radius: 9, label: 'Gerbang 1/5' };
      this.objective = 'Balap liar: lewati 5 gerbang';
    }
    this.showBanner('KERJA SAMPINGAN', job.title);
    return true;
  }

  finishSideJob(success) {
    const job = this.sideJob;
    this.sideJob = null;
    this.marker = null;
    if (success && job) {
      this.showBanner('KERJA SELESAI', `${job.title} — +$${job.reward}`);
      this._reward = { money: job.reward, respect: 3 };
    } else {
      this.objective = 'Kerja sampingan batal.';
    }
  }

  // Per-frame checks. ctx: {player, playerCar, police, game}
  update(dt, ctx) {
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 5) this.banner = null;
    }
    if (this.sideJob) { this.updateSideJob(dt, ctx); return; }
    if (!this.active) return;
    const stage = this.active.mission.stages[this.active.stage];
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    if (stage.time) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.showBanner('GAGAL', 'Waktu habis. Coba lagi dari awal misi.');
        this.active = null;
        this.marker = null;
        this.objective = 'Misi gagal. Pergi ke penanda kuning untuk mengulang.';
        return;
      }
    }
    switch (stage.type) {
      case 'goto':
      case 'deliver': {
        const l = this.loc(stage.loc);
        if (dist2D(px, pz, l.x, l.z) < stage.radius) this.advanceStage();
        break;
      }
      case 'steal': {
        if (ctx.playerCar && ctx.playerCar.missionTarget) this.advanceStage();
        break;
      }
      case 'race': {
        const p = stage.points[this.raceIndex];
        if (dist2D(px, pz, p.x, p.z) < 9) {
          this.raceIndex++;
          if (this.raceIndex >= stage.points.length) this.advanceStage();
          else {
            const np = stage.points[this.raceIndex];
            this.marker = { x: np.x, z: np.z, radius: 9, label: `Gerbang ${this.raceIndex + 1}/${stage.points.length}` };
          }
        }
        break;
      }
      case 'defeat': {
        const alive = this.spawnedPeds.filter((p) => !p.dead).length;
        if (this.spawnedPeds.length > 0 && alive === 0) this.advanceStage();
        break;
      }
      case 'collect': {
        const left = this.collectibles.filter((c) => !c.taken).length;
        if (left === 0) this.advanceStage();
        break;
      }
      case 'survive': {
        this.timer -= dt;
        if (ctx.police.wanted < (stage.wanted ?? 1)) {
          // Lost the heat: fail the stage, keep the mission.
          this.showBanner('GAGAL', 'Bintangmu hilang. Polisi harus tetap mengejarmu.');
          this.active = null;
          this.marker = null;
          this.objective = 'Misi gagal. Pergi ke penanda kuning untuk mengulang.';
          return;
        }
        if (this.timer <= 0) this.advanceStage();
        break;
      }
      case 'escape': {
        if (ctx.police.wanted < (stage.wanted ?? 1)) {
          this.showBanner('GAGAL', 'Bintangmu hilang sebelum sampai tujuan.');
          this.active = null;
          this.marker = null;
          this.objective = 'Misi gagal. Pergi ke penanda kuning untuk mengulang.';
          return;
        }
        const l = this.loc(stage.loc);
        if (dist2D(px, pz, l.x, l.z) < stage.radius) this.advanceStage();
        break;
      }
      default:
        break;
    }
  }

  updateSideJob(dt, ctx) {
    const job = this.sideJob;
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    if (job.timer > 0) {
      job.timer -= dt;
      if (job.timer <= 0) { this.finishSideJob(false); return; }
    }
    if (job.kind === 'taxi') {
      if (job.stage === 0) {
        if (this.marker && dist2D(px, pz, this.marker.x, this.marker.z) < 6) {
          job.stage = 1;
          const l = this.loc('beach');
          this.marker = { x: l.x, z: l.z, radius: 9, label: 'Tujuan penumpang' };
          this.objective = 'Antar penumpang ke Pantai Matahari';
        }
      } else if (this.marker && dist2D(px, pz, this.marker.x, this.marker.z) < 9) {
        this.finishSideJob(true);
      }
    } else if (job.kind === 'delivery') {
      if (job.stage === 0) {
        const l = this.loc('market');
        if (dist2D(px, pz, l.x, l.z) < 8) {
          job.stage = 1;
          const h = this.loc('harbor');
          this.marker = { x: h.x, z: h.z, radius: 10, label: 'Tujuan paket' };
          this.objective = 'Antar paket ke Pelabuhan';
        }
      } else if (this.marker && dist2D(px, pz, this.marker.x, this.marker.z) < 10) {
        this.finishSideJob(true);
      }
    } else if (job.kind === 'race') {
      const p = job.points[this.raceIndex];
      if (dist2D(px, pz, p.x, p.z) < 9) {
        this.raceIndex++;
        if (this.raceIndex >= job.points.length) this.finishSideJob(true);
        else {
          const np = job.points[this.raceIndex];
          this.marker = { x: np.x, z: np.z, radius: 9, label: `Gerbang ${this.raceIndex + 1}/5` };
        }
      }
    }
  }
}
