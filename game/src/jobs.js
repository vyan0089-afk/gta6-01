// jobs.js — Side jobs in Tanjung Matahari: taxi, courier and night guard.
// Three honest jobs, each a small state machine with a pickup point, a
// destination, a timer and a payout. A job starts at its board — the taxi
// stand at Kota Tua, the courier desk at Pasar Malam, the guard post at the
// harbour — and pays in cash plus respect. Jobs are the fastest way to earn
// money between story missions, and the map screen counts them.

import { Rng } from './rng.js';

/** Job definitions: where they start, what they pay, how long they take. */
export const JOB_DEFS = [
  {
    id: 'taxi', name: 'Taksi Kota', icon: '🚕',
    desc: 'Antar penumpang keliling kota. Cepat dan sopan dibayar lebih.',
    start: { x: 60, z: -110, name: 'Pangkalan Taksi, Alun-alun' },
    pay: 60000, timeLimit: 150,
  },
  {
    id: 'courier', name: 'Kurir Kilat', icon: '📦',
    desc: 'Tiga paket, tiga alamat, satu tenggat. Jangan terlambat.',
    start: { x: 40, z: 150, name: 'Meja Kurir, Pasar Malam' },
    pay: 90000, timeLimit: 180,
  },
  {
    id: 'guard', name: 'Jaga Dermaga', icon: '🌙',
    desc: 'Ronda malam di pelabuhan. Usir pencuri yang masuk.',
    start: { x: 200, z: 180, name: 'Pos Jaga, Pelabuhan' },
    pay: 75000, timeLimit: 120,
  },
];

/** Destinations a job can send the player to. */
const DESTINATIONS = [
  { x: -120, z: 240, name: 'Pantai Matahari' },
  { x: 60, z: -40, name: 'Kota Tua' },
  { x: 118, z: -8, name: 'Masjid Agung' },
  { x: 200, z: 170, name: 'Pelabuhan' },
  { x: -180, z: 40, name: 'Gang Sanca' },
  { x: -40, z: -252, name: 'Bukit Senja' },
  { x: 168, z: -140, name: 'Stasiun Tua' },
  { x: 40, z: 150, name: 'Pasar Malam' },
];

/** One running job. */
export class Job {
  constructor(def, rng) {
    this.def = def;
    this.phase = 'pickup'; // 'pickup' | 'deliver' | 'done'
    this.dest = rng.pick(DESTINATIONS);
    this.stopsLeft = def.id === 'courier' ? 3 : 1;
    this.timeLeft = def.timeLimit;
    this.earned = 0;
    // Fare meter: the longer and faster the delivery, the better the pay.
    this.distance = 0;
    this.lastX = 0;
    this.lastZ = 0;
    this.patience = 100; // passengers lose patience when you drive badly
    this.tips = 0;
  }

  /** Current target position. */
  target() {
    if (this.phase === 'pickup') return this.def.start;
    return this.dest;
  }

  /** Current target name for the HUD. */
  targetName() {
    if (this.phase === 'pickup') return this.def.start.name;
    return this.dest.name;
  }

  /** Final payout: base pay + distance bonus + tips, scaled by patience. */
  payout() {
    const distanceBonus = Math.floor(this.distance / 100) * 2500;
    const patienceFactor = 0.5 + this.patience / 200;
    return Math.floor((this.def.pay + distanceBonus + this.tips) * patienceFactor);
  }
}

/** The side-job system. */
export class Jobs {
  constructor(seed) {
    this.rng = new Rng(seed + 404);
    this.active = null;
    this.completed = 0;
    this.completedByJob = {};
    this.failed = 0;
    this.nearBoard = null;
  }

  /** The nearest job board to the player within 12 m, or null. */
  boardNear(player) {
    for (const def of JOB_DEFS) {
      const dx = def.start.x - player.x;
      const dz = def.start.z - player.z;
      if (dx * dx + dz * dz < 12 * 12) return def;
    }
    return null;
  }

  /** Start a job. Returns false when one is already running. */
  start(def, game) {
    if (this.active) return false;
    this.active = new Job(def, this.rng);
    game.dialogue.sayNow('Raka', `${def.name}: ${def.desc}`);
    game.audio.playSfx('click');
    return true;
  }

  /** Finish the active job: pay, count, respect. */
  finish(game) {
    if (!this.active) return 0;
    const pay = this.active.payout();
    game.player.money += pay;
    game.stats.earn(pay);
    game.stats.finishedJob(pay);
    this.completed += 1;
    this.completedByJob[this.active.def.id] = (this.completedByJob[this.active.def.id] || 0) + 1;
    game.achievements.check('job', this.completed);
    game.dialogue.sayNow('Raka', `${this.active.def.name} selesai! +Rp ${pay.toLocaleString('id-ID')}`);
    game.audio.playSfx('mission');
    this.active = null;
    return pay;
  }

  /** Fail the active job (time ran out). */
  fail(game) {
    if (!this.active) return;
    game.dialogue.sayNow('Raka', `${this.active.def.name} gagal — waktunya habis.`);
    this.failed += 1;
    this.active = null;
  }

  /** Step the active job: timer, pickup and delivery detection. */
  step(dt, game) {
    if (!this.active) return;
    const job = this.active;
    job.timeLeft -= dt;
    if (job.timeLeft <= 0) {
      this.fail(game);
      return;
    }
    const p = game.player;
    // Fare meter: track distance while delivering; rough driving costs patience.
    if (job.phase === 'deliver') {
      const moved = Math.sqrt((p.x - job.lastX) * (p.x - job.lastX) + (p.z - job.lastZ) * (p.z - job.lastZ));
      job.distance += moved;
      if (p.car && Math.abs(p.carSpeed) > 30) job.tips += dt * 120; // fast delivery earns tips
      if (p.car && Math.abs(p.carSpeed) < 2 && moved < 0.1) job.patience -= dt * 0.4; // dawdling annoys
      job.patience = Math.max(0, Math.min(100, job.patience));
    }
    job.lastX = p.x;
    job.lastZ = p.z;
    const t = job.target();
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (job.phase === 'pickup' && d < 9) {
      job.phase = 'deliver';
      game.dialogue.sayNow('Penumpang', `Tolong antar ke ${job.dest.name}, ya.`);
      game.audio.playSfx('pickup');
    } else if (job.phase === 'deliver' && d < 9) {
      if (job.def.id === 'courier' && job.stopsLeft > 1) {
        job.stopsLeft -= 1;
        job.dest = this.rng.pick(DESTINATIONS);
        game.dialogue.sayNow('Raka', `Paket ${3 - job.stopsLeft}/3 selesai. Lanjut!`);
        game.audio.playSfx('pickup');
      } else if (job.def.id === 'guard') {
        // Guard job: clear the guards near the harbour instead of a delivery.
        if (game.crowd.guardsLeft() <= 2) this.finish(game);
        else game.dialogue.sayNow('Kapten Budi', `Masih ada ${game.crowd.guardsLeft()} pencuri di dermaga!`);
      } else {
        this.finish(game);
      }
    }
    // Guard job can also finish by clearing guards anywhere near the post.
    if (job.def.id === 'guard' && job.phase === 'deliver' && game.crowd.guardsLeft() <= 2) {
      this.finish(game);
    }
  }

  /** Objective text for the HUD while a job runs. */
  objectiveText() {
    if (!this.active) return '';
    const job = this.active;
    const verb = job.phase === 'pickup' ? 'Pergi ke' : 'Antar ke';
    const fare = job.phase === 'deliver' ? ` — argo Rp ${Math.floor(job.payout()).toLocaleString('id-ID')}` : '';
    return `${job.def.name}: ${verb} ${job.targetName()} — ${Math.ceil(job.timeLeft)} dtk${fare}`;
  }

  /** A short summary of the job board for the map screen. */
  jobSummary() {
    const lines = [];
    for (const def of JOB_DEFS) {
      const done = this.completedByJob[def.id] || 0;
      lines.push(`${def.name}: ${done}x selesai — Rp ${def.pay.toLocaleString('id-ID')} sekali jalan`);
    }
    return lines;
  }
}
