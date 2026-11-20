// stats.js — Career stats and respect for Tanjung Matahari.
// One object holds everything the map screen shows and everything the
// save file stores: money earned, cars stolen, keris found, races won,
// side jobs done, distance driven and walked, time played. Respect is a
// single score that maps onto the ranks in config.js: missions, keris,
// races and clean-ish driving all feed it. The HUD's respect bar and the
// map screen's career panel both read from here, so the numbers never
// disagree.

import { RESPECT_RANKS } from './config.js';

/** The career record. */
export class Stats {
  constructor() {
    this.money = 300000;
    this.moneyEarned = 0;
    this.respect = 0;
    this.missionsDone = 0;
    this.carsStolen = 0;
    this.carsStolenThisMission = 0;
    this.kerisFound = 0;
    this.sideJobsDone = 0;
    this.racesWon = 0;
    this.racesRun = 0;
    this.kills = 0;
    this.distanceDriven = 0;
    this.distanceWalked = 0;
    this.playSeconds = 0;
    this.topSpeed = 0;
    this.timesBusted = 0;
    this.timesWasted = 0;
    this.toursVisited = 0;
  }

  /** Earn money (mission pay, job pay, race winnings). */
  earn(amount) {
    this.moneyEarned += amount;
    return amount;
  }

  /** The respect rank for the current score. */
  rank() {
    let rank = RESPECT_RANKS[0];
    for (const r of RESPECT_RANKS) {
      if (this.respect >= r.min) rank = r;
    }
    return rank;
  }

  /** Progress to the next rank as 0..1 (1 when at the top rank). */
  rankProgress() {
    const idx = RESPECT_RANKS.findIndex((r) => r.name === this.rank().name);
    if (idx >= RESPECT_RANKS.length - 1) return 1;
    const cur = RESPECT_RANKS[idx];
    const next = RESPECT_RANKS[idx + 1];
    return (this.respect - cur.min) / (next.min - cur.min);
  }

  /** Add respect points (missions, keris, races, jobs). */
  addRespect(n) {
    this.respect += n;
  }

  /** Step per-frame accumulators: play time, distances, top speed. */
  step(dt, player) {
    this.playSeconds += dt;
    if (player.car) {
      this.distanceDriven += Math.abs(player.carSpeed) * dt;
      this.topSpeed = Math.max(this.topSpeed, Math.abs(player.carSpeed) * 3.6);
    } else {
      this.distanceWalked += player.speed * dt;
    }
  }

  /** A keris was found: count it and pay respect. */
  foundKeris() {
    this.kerisFound += 1;
    this.addRespect(40);
  }

  /** A side job finished: count it and pay respect. */
  finishedJob(pay) {
    this.sideJobsDone += 1;
    this.addRespect(25);
    return pay;
  }

  /** A race won: count it and pay respect. */
  wonRace() {
    this.racesWon += 1;
    this.racesRun += 1;
    this.addRespect(60);
  }

  /** A race run but lost. */
  lostRace() {
    this.racesRun += 1;
  }

  /** Lines for the map screen's career panel. */
  careerLines() {
    return [
      ['Misi cerita selesai', `${this.missionsDone} / 8`],
      ['Mobil dicuri', `${this.carsStolen}`],
      ['Keris emas', `${this.kerisFound} / 12`],
      ['Pekerjaan sampingan', `${this.sideJobsDone}`],
      ['Balapan dimenangkan', `${this.racesWon} / ${this.racesRun}`],
      ['Uang didapat', `Rp ${Math.floor(this.moneyEarned).toLocaleString('id-ID')}`],
      ['Jarak menyetir', `${(this.distanceDriven / 1000).toFixed(1)} km`],
      ['Jarak berjalan', `${(this.distanceWalked / 1000).toFixed(1)} km`],
      ['Kecepatan tertinggi', `${Math.round(this.topSpeed)} km/jam`],
      ['Waktu bermain', `${Math.floor(this.playSeconds / 60)} menit`],
      ['Peringkat hormat', this.rank().name],
    ];
  }

  /** Serialise for debugging and tests. */
  toJSON() {
    return {
      money: this.money,
      respect: this.respect,
      missionsDone: this.missionsDone,
      carsStolen: this.carsStolen,
      kerisFound: this.kerisFound,
      sideJobsDone: this.sideJobsDone,
      racesWon: this.racesWon,
      kills: this.kills,
      playSeconds: Math.floor(this.playSeconds),
    };
  }

  /** Session bests: fastest escape, longest chase, biggest single payout. */
  bests() {
    return {
      topSpeed: Math.round(this.topSpeed),
      distanceDrivenKm: (this.distanceDriven / 1000).toFixed(1),
      distanceWalkedKm: (this.distanceWalked / 1000).toFixed(1),
      moneyEarned: Math.floor(this.moneyEarned),
    };
  }

  /** A one-line career summary for the title screen. */
  summaryLine() {
    return `Misi ${this.missionsDone}/8 · ${this.carsStolen} mobil dicuri · ${this.kerisFound}/12 keris · ${this.racesWon} balapan menang`;
  }

  /** Respect needed for the next rank, or 0 at the top. */
  respectToNext() {
    const rank = this.rank();
    const idx = RESPECT_RANKS.findIndex((r) => r.name === rank.name);
    if (idx >= RESPECT_RANKS.length - 1) return 0;
    return RESPECT_RANKS[idx + 1].min - this.respect;
  }
}
