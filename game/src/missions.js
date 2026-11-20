// missions.js — The story of Raka and the eight missions of Tanjung Matahari.
//
// Three chapters, eight missions, one arc: Raka arrives broke in Tanjung
// Matahari, owes the Gang Sanca, works his way up through the night market,
// and finally takes the gang's harbour stronghold and escapes to the
// lighthouse. Each mission is a list of stages; a stage is one of:
//   reach  — stand inside the small yellow diamond marker
//   defeat — beat a number of named enemies (counter shown as "Usir 2/5")
//   collect — pick up a number of glowing items
//   drive  — take a specific car to a place
//   survive — stay alive (and keep the wanted level) for N seconds
//   enter  — get into any car (or a specific one)
// The engine tracks the active stage, counts progress, plays the jingle on
// completion, pays the reward and unlocks the next mission. Side jobs
// (ojek, paket, taksi) are small repeatable missions started with J near
// their markers. Dialogue is picked from alternate lines so a replayed
// mission does not sound identical.

import { LANDMARKS } from './config.js';
import { dist2d } from './rng.js';

/** The eight story missions, in order. */
export const MISSIONS = [
  {
    id: 'm1', chapter: 1, title: 'Sambutan Raka',
    briefing: 'Raka baru sampai di Tanjung Matahari dengan Rp 300 di saku. Sari menunggunya di Pasar Malam.',
    stages: [
      { type: 'reach', x: LANDMARKS.pasarMalam.x, z: LANDMARKS.pasarMalam.z, radius: 8, label: 'Temui Sari di Pasar Malam' },
    ],
    reward: 300,
    dialogue: [
      'Sari: Raka! Akhirnya sampai juga. Kota ini keras — tapi kau lebih keras.',
      'Raka: Aku tidak datang untuk kalah, Sari. Aku datang untuk menang.',
    ],
    altDialogue: [
      'Sari: Jalanan Tanjung tidak ramah, Raka. Jaga dirimu.',
      'Raka: Tenang. Aku sudah hafal semua gang di kota ini.',
    ],
  },
  {
    id: 'm2', chapter: 1, title: 'Utang Gang Sanca',
    briefing: 'Preman Gang Sanca menagih utang lama di gang belakang pasar. Usir mereka berlima.',
    stages: [
      { type: 'defeat', count: 5, x: LANDMARKS.gangSanca.x, z: LANDMARKS.gangSanca.z, radius: 26, label: 'Usir preman Gang Sanca', enemyName: 'Preman Sanca' },
    ],
    reward: 500,
    dialogue: [
      'Preman: Hei, Raka! Bos Sanca kirim salam — dan tagihan!',
      'Raka: Tagihan? Yang kubayar cuma tinju. Lima orang, lima tinju.',
    ],
    altDialogue: [
      'Preman: Kau pikir bisa lari dari utang? Gang Sanca tidak lupa!',
      'Raka: Aku tidak lari. Aku datang menagih balik.',
    ],
  },
  {
    id: 'm3', chapter: 1, title: 'Antar Paket Senja',
    briefing: 'Sari butuh tiga paket diantar keliling kota sebelum senja. Ambil paketnya di pasar.',
    stages: [
      { type: 'collect', count: 3, x: LANDMARKS.pasarMalam.x, z: LANDMARKS.pasarMalam.z, radius: 30, label: 'Kumpulkan 3 paket di pasar', itemName: 'Paket' },
      { type: 'reach', x: LANDMARKS.stasiun.x, z: LANDMARKS.stasiun.z, radius: 9, label: 'Antar paket ke Stasiun Tanjung' },
    ],
    reward: 450,
    dialogue: [
      'Sari: Paket-paket ini harus sampai sebelum senja. Aku percaya padamu, Raka.',
      'Raka: Tiga paket, satu sore. Gampang.',
    ],
    altDialogue: [
      'Sari: Hati-hati di Jalan Merdeka, polisi lagi razia.',
      'Raka: Razia? Aku cuma kurir paket, Sari.',
    ],
  },
  {
    id: 'm4', chapter: 2, title: 'Kejar-Kejaran Pantai',
    briefing: 'Polisi mengincar Raka di pantai. Bertahan 45 detik dalam kejar-kejaran, lalu kabur ke mercusuar.',
    stages: [
      { type: 'survive', seconds: 45, wanted: 3, label: 'Bertahan dari kejaran polisi', x: LANDMARKS.pantai.x, z: LANDMARKS.pantai.z, radius: 60 },
      { type: 'reach', x: LANDMARKS.lighthouse.x + 30, z: LANDMARKS.lighthouse.z + 20, radius: 10, label: 'Kabur ke Mercusuar Tanjung' },
    ],
    reward: 700,
    dialogue: [
      'Raka: Mereka pikir bisa menangkapku di pantainya sendiri? Lihat saja.',
      'Polisi: Unit Elang, target melaju ke arah barat! Jangan sampai lolos!',
    ],
    altDialogue: [
      'Raka: Pantai ini milikku. Setiap pasirnya kuhafal.',
      'Polisi: Semua unit, tutup Jalan Pantai Barat!',
    ],
  },
  {
    id: 'm5', chapter: 2, title: 'Rampok Truk Es',
    briefing: 'Truk es Gang Sanca parkir di dermaga. Curi truk itu dan bawa ke pelabuhan.',
    stages: [
      { type: 'enter', vehicle: 'truck', label: 'Curi Truk Es di dermaga', x: LANDMARKS.harbour.x - 60, z: LANDMARKS.harbour.z - 30, radius: 14 },
      { type: 'drive', x: LANDMARKS.harbour.x, z: LANDMARKS.harbour.z, radius: 12, label: 'Bawa truk ke Pelabuhan Tanjung' },
    ],
    reward: 900,
    dialogue: [
      'Raka: Truk es… isinya bukan cuma es, kan? Bos Sanca pasti marah besar.',
      'Sari: Bawa ke pelabuhan. Aku yang urus pembelinya.',
    ],
    altDialogue: [
      'Raka: Truk sebesar ini tidak bisa hilang begitu saja. Kecuali malam ini.',
      'Sari: Cepat, sebelum penjaga dermaga sadar.',
    ],
  },
  {
    id: 'm6', chapter: 2, title: 'Selamatkan Sari',
    briefing: 'Gang Sanca menculik Sari dan menyembunyikannya di stasiun. Kalahkan enam penjaga, lalu temui Sari.',
    stages: [
      { type: 'defeat', count: 6, x: LANDMARKS.stasiun.x, z: LANDMARKS.stasiun.z, radius: 30, label: 'Kalahkan penjaga stasiun', enemyName: 'Penjaga Sanca' },
      { type: 'reach', x: LANDMARKS.stasiun.x + 10, z: LANDMARKS.stasiun.z - 6, radius: 7, label: 'Selamatkan Sari' },
    ],
    reward: 1000,
    dialogue: [
      'Sari: Raka! Mereka bilang kau tidak akan datang…',
      'Raka: Mereka salah. Aku selalu datang.',
    ],
    altDialogue: [
      'Penjaga: Bos bilang, siapa pun yang datang, habisi!',
      'Raka: Kalau begitu, habisi aku dulu.',
    ],
  },
  {
    id: 'm7', chapter: 3, title: 'Serbu Markas',
    briefing: 'Waktunya membalas. Serbu markas Gang Sanca di timur kota dan kalahkan delapan anak buah Bos Sanca.',
    stages: [
      { type: 'defeat', count: 8, x: LANDMARKS.markas.x, z: LANDMARKS.markas.z, radius: 34, label: 'Kalahkan anak buah Bos Sanca', enemyName: 'Anak Buah Sanca' },
    ],
    reward: 1500,
    dialogue: [
      'Bos Sanca: Jadi ini si Raka yang sok jago itu. Anak-anak, beri dia pelajaran!',
      'Raka: Pelajaran hari ini: jangan pernah menculik Sari.',
    ],
    altDialogue: [
      'Bos Sanca: Kota ini milikku, Raka. Kau cuma tamu yang tidak diundang.',
      'Raka: Tamu yang akan mengambil alih rumahmu.',
    ],
  },
  {
    id: 'm8', chapter: 3, title: 'Pelarian Terakhir',
    briefing: 'Seluruh kota mengejar Raka. Bertahan dengan wanted 5, lalu kabur ke mercusuar untuk mengakhiri semuanya.',
    stages: [
      { type: 'survive', seconds: 40, wanted: 5, label: 'Bertahan dari seluruh kota', x: 0, z: 0, radius: 400 },
      { type: 'reach', x: LANDMARKS.lighthouse.x + 30, z: LANDMARKS.lighthouse.z + 20, radius: 10, label: 'Kabur ke Mercusuar Tanjung' },
    ],
    reward: 2500,
    dialogue: [
      'Raka: Lima bintang. Seluruh kota. Tapi mercusuar itu sudah menunggu.',
      'Sari: Sampai di mercusuar, kita bebas, Raka. Bebas!',
    ],
    altDialogue: [
      'Polisi: Semua unit ke mercusuar! Target tidak boleh lolos!',
      'Raka: Kalau ini akhir, biarlah akhir yang gemilang.',
    ],
  },
];

export const CHAPTER_NAMES = {
  1: 'Bab 1 — Awal di Tanjung',
  2: 'Bab 2 — Naik Daun',
  3: 'Bab 3 — Bos Tanjung',
};

/** The three repeatable side jobs. */
export const SIDE_JOBS = [
  {
    id: 'ojek', name: 'Ojek Kilat', pay: 220,
    blurb: 'Antar penumpang secepatnya ke tujuannya.',
    start: { x: LANDMARKS.alunAlun.x, z: LANDMARKS.alunAlun.z },
    dest: { x: LANDMARKS.pantai.x + 20, z: LANDMARKS.pantai.z },
    destName: 'Pantai Matahari',
  },
  {
    id: 'paket', name: 'Antar Paket', pay: 260,
    blurb: 'Ambil paket di pasar, antar ke pelabuhan.',
    start: { x: LANDMARKS.pasarMalam.x, z: LANDMARKS.pasarMalam.z },
    dest: { x: LANDMARKS.harbour.x, z: LANDMARKS.harbour.z - 20 },
    destName: 'Pelabuhan Tanjung',
  },
  {
    id: 'taksi', name: 'Taksi Senja', pay: 300,
    blurb: 'Penumpang stasiun mau ke mercusuar. Jangan sampai terlambat.',
    start: { x: LANDMARKS.stasiun.x, z: LANDMARKS.stasiun.z },
    dest: { x: LANDMARKS.lighthouse.x + 30, z: LANDMARKS.lighthouse.z + 20 },
    destName: 'Mercusuar Tanjung',
  },
];

/** Create the mission tracker. */
export function createMissions() {
  return {
    index: 0,               // next story mission to play
    completed: [],          // ids of finished story missions
    active: null,           // { mission, stageIndex, progress, timer, ... }
    sideJob: null,          // active side job, if any
    jobsDone: 0,
    attempts: {},           // mission id -> attempt count (drives alt dialogue)
    finishedStory: false,
  };
}

/** The mission currently active, or null. */
export function activeMission(missions) {
  return missions.active ? missions.active.mission : null;
}

/** Human-readable objective line for the HUD, e.g. "Usir preman Gang Sanca — 2/5". */
export function objectiveText(missions) {
  const a = missions.active;
  if (!a) {
    if (missions.finishedStory) return 'Cerita selesai — Legenda Tanjung!';
    return 'Bebas berkeliling — tekan M untuk peta';
  }
  const stage = a.mission.stages[a.stageIndex];
  if (stage.type === 'defeat' || stage.type === 'collect') {
    return `${stage.label} — ${a.progress}/${stage.count}`;
  }
  if (stage.type === 'survive') {
    return `${stage.label} — ${Math.max(0, Math.ceil(stage.seconds - a.timer))} dtk`;
  }
  return stage.label;
}

/** Mission stage label like "Misi 2/8 — Tahap 1/2". */
export function missionStageText(missions) {
  const a = missions.active;
  if (!a) return missions.finishedStory ? 'Cerita Tamat' : 'Mode Bebas';
  return `Misi ${missions.index + 1}/8 — Tahap ${a.stageIndex + 1}/${a.mission.stages.length}`;
}

/** Start a story mission by index. Spawns its stage content. */
export function startMission(missions, index, game) {
  const mission = MISSIONS[index];
  if (!mission) return null;
  missions.index = index;
  missions.attempts[mission.id] = (missions.attempts[mission.id] ?? 0) + 1;
  const active = {
    mission, stageIndex: 0, progress: 0, timer: 0,
    spawned: false, collected: 0, startWanted: 0,
  };
  missions.active = active;
  const lines = missions.attempts[mission.id] > 1 ? mission.altDialogue : mission.dialogue;
  game.setDialogue(lines[0]);
  game.setDialogue(lines[1], true);
  game.showBanner(`${CHAPTER_NAMES[mission.chapter]}`, mission.title);
  prepareStage(active, game);
  return active;
}

/** Set up the current stage: spawn enemies, items, wanted, markers. */
export function prepareStage(active, game) {
  const stage = active.mission.stages[active.stageIndex];
  active.progress = 0;
  active.timer = 0;
  active.spawned = true;
  const world = game.world;
  if (stage.type === 'defeat') {
    game.clearEnemies();
    for (let i = 0; i < stage.count + 2; i += 1) {
      const a = (i / (stage.count + 2)) * Math.PI * 2;
      game.spawnEnemy(
        stage.x + Math.cos(a) * (8 + (i % 3) * 5),
        stage.z + Math.sin(a) * (8 + (i % 3) * 5),
        stage.enemyName || 'Musuh',
        60 + active.stageIndex * 10,
      );
    }
  }
  if (stage.type === 'collect') {
    game.clearPickups();
    for (let i = 0; i < stage.count; i += 1) {
      const a = (i / stage.count) * Math.PI * 2 + 0.4;
      game.spawnPickup(stage.x + Math.cos(a) * 14, stage.z + Math.sin(a) * 14, stage.itemName || 'Paket');
    }
  }
  if (stage.type === 'survive') {
    game.setWanted(stage.wanted);
    if (game.player.onFoot) {
      // Survive stages are chases: put Raka in a car if he is on foot.
      const near = game.nearestParkedCar(20);
      if (near) game.stealCarSilently(near);
    }
  }
  if (stage.type === 'enter') {
    game.ensureVehicleNear(stage.x, stage.z, stage.vehicle || 'truck');
  }
}

/** Advance the active stage: returns 'stage' | 'mission' | null. */
export function stepMissions(missions, game, dt) {
  const a = missions.active;
  if (!a) return null;
  const stage = a.mission.stages[a.stageIndex];
  const p = game.player;

  if (stage.type === 'reach') {
    if (dist2d(p.x, p.z, stage.x, stage.z) < stage.radius) return advanceStage(missions, game);
  } else if (stage.type === 'drive') {
    if (!p.onFoot && dist2d(p.x, p.z, stage.x, stage.z) < stage.radius) return advanceStage(missions, game);
  } else if (stage.type === 'enter') {
    if (!p.onFoot && (!stage.vehicle || p.car?.defId === stage.vehicle)) return advanceStage(missions, game);
  } else if (stage.type === 'defeat') {
    if (a.progress >= stage.count) return advanceStage(missions, game);
  } else if (stage.type === 'collect') {
    if (a.progress >= stage.count) return advanceStage(missions, game);
  } else if (stage.type === 'survive') {
    a.timer += dt;
    if (a.timer >= stage.seconds) return advanceStage(missions, game);
  }
  return null;
}

/** Move to the next stage, or finish the mission. */
function advanceStage(missions, game) {
  const a = missions.active;
  const mission = a.mission;
  a.stageIndex += 1;
  if (a.stageIndex >= mission.stages.length) {
    completeMission(missions, game);
    return 'mission';
  }
  game.audio.cash();
  prepareStage(a, game);
  return 'stage';
}

/** Pay out, jingle, unlock the next mission. */
function completeMission(missions, game) {
  const mission = missions.active.mission;
  missions.completed.push(mission.id);
  missions.active = null;
  game.clearEnemies();
  game.clearPickups();
  game.player.money += mission.reward;
  game.audio.missionJingle();
  game.showBanner('MISI SELESAI', `${mission.title} — +Rp ${mission.reward}`);
  game.setDialogue(`Raka: ${mission.title} selesai. Rp ${mission.reward} masuk.`);
  if (game.stats) {
    game.stats.missionsCompleted += 1;
    game.stats.moneyEarned += mission.reward;
  }
  missions.index += 1;
  if (missions.index >= MISSIONS.length) {
    missions.finishedStory = true;
    game.showBanner('TAMAT — LEGENDA TANJUNG', 'Raka menguasai Tanjung Matahari!');
    game.setDialogue('Sari: Kau melakukannya, Raka. Kota ini milik kita sekarang.');
    return;
  }
  // The next mission starts when the player reaches its marker, via the HUD prompt.
  game.pendingMission = missions.index;
}

/** Start the pending next mission (called when the player accepts the prompt). */
export function startPendingMission(missions, game) {
  if (game.pendingMission === null || game.pendingMission === undefined) return null;
  const index = game.pendingMission;
  game.pendingMission = null;
  return startMission(missions, index, game);
}

/** Start a side job by id, if the player stands near its start marker. */
export function startSideJob(missions, jobId, game) {
  const job = SIDE_JOBS.find((j) => j.id === jobId);
  if (!job || missions.sideJob) return null;
  missions.sideJob = {
    job, timer: 0, phase: 'pickup',
    passenger: null,
  };
  game.setDialogue(`Penumpang: Tolong antar saya ke ${job.destName}.`);
  game.showBanner('KERJA SAMPINGAN', `${job.name} — ke ${job.destName}`);
  return missions.sideJob;
}

/** Step the active side job. Returns 'done' when paid out. */
export function stepSideJob(missions, game, dt) {
  const sj = missions.sideJob;
  if (!sj) return null;
  const p = game.player;
  sj.timer += dt;
  if (sj.phase === 'pickup') {
    if (dist2d(p.x, p.z, sj.job.start.x, sj.job.start.z) < 8) {
      sj.phase = 'drive';
      game.setDialogue('Penumpang: Sudah naik. Jalan, mas!');
    }
    return null;
  }
  if (sj.phase === 'drive') {
    if (!p.onFoot && dist2d(p.x, p.z, sj.job.dest.x, sj.job.dest.z) < 10) {
      const pay = sj.job.pay;
      game.player.money += pay;
      game.audio.cash();
      game.audio.missionJingle();
      game.showBanner('KERJA SELESAI', `${sj.job.name} — +Rp ${pay}`);
      game.setDialogue('Penumpang: Terima kasih, mas! Ini upahnya.');
      missions.sideJob = null;
      missions.jobsDone += 1;
      if (game.stats) game.stats.moneyEarned += pay;
      return 'done';
    }
  }
  return null;
}

/** The nearest side-job start marker, if the player is close to one. */
export function nearbySideJob(missions, player) {
  if (missions.sideJob) return null;
  for (const job of SIDE_JOBS) {
    if (dist2d(player.x, player.z, job.start.x, job.start.z) < 12) return job;
  }
  return null;
}

/** Where the mission marker (small yellow diamond) should be drawn, if any. */
export function currentMarker(missions, game) {
  const a = missions.active;
  if (a) {
    const stage = a.mission.stages[a.stageIndex];
    if (stage.x !== undefined && stage.z !== undefined) return { x: stage.x, z: stage.z };
    return null;
  }
  if (missions.sideJob) {
    const sj = missions.sideJob;
    return sj.phase === 'pickup'
      ? { x: sj.job.start.x, z: sj.job.start.z }
      : { x: sj.job.dest.x, z: sj.job.dest.z };
  }
  if (game.pendingMission !== null && game.pendingMission !== undefined) {
    const next = MISSIONS[game.pendingMission];
    if (next) {
      const s0 = next.stages[0];
      if (s0.x !== undefined) return { x: s0.x, z: s0.z };
    }
  }
  return null;
}
