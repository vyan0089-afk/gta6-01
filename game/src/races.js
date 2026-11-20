// races.js — Street races of Tanjung Matahari: three circuits, three rivals.
// A race is a loop of checkpoints on the road grid. The player and two
// rival cars drive it; rivals follow the checkpoint line with their skill
// as a speed factor, rubber-banding a little so a race is never decided on
// the first corner. Finish all checkpoints first to win: money, respect and
// a race-won count. The HUD shows lap progress and the rival gaps; the
// renderer draws checkpoint gates as glowing arches over the road.

import { Rng } from './rng.js';
import { RIVALS } from './config.js';
import { rivalLine } from './dialogue.js';

/** The three circuits: checkpoint loops on the road grid. */
export const RACE_DEFS = [
  {
    id: 'pantai', name: 'Sirkuit Pantai', laps: 1, rival: 'dimas',
    start: { x: -210, z: 250 },
    checkpoints: [
      [-64, 256], [64, 256], [192, 256], [256, 192], [256, 64],
      [192, 0], [64, 0], [-64, 0], [-192, 0], [-256, 64], [-256, 192],
    ],
  },
  {
    id: 'kota', name: 'Sirkuit Kota Tua', laps: 1, rival: 'sari',
    start: { x: 0, z: -64 },
    checkpoints: [
      [128, -64], [192, -128], [128, -192], [0, -192], [-128, -192],
      [-192, -128], [-128, -64], [-64, -128], [64, -128],
    ],
  },
  {
    id: 'bukit', name: 'Sirkuit Bukit Senja', laps: 1, rival: 'bowo',
    start: { x: -40, z: -252 },
    checkpoints: [
      [64, -256], [192, -256], [256, -192], [192, -64], [64, -64],
      [-64, -64], [-192, -64], [-256, -192], [-128, -256],
    ],
  },
];

/** One rival car in a race. */
export class RivalCar {
  constructor(def, index, rng) {
    this.def = def;
    this.colour = def.colour;
    this.name = def.name;
    this.skill = def.skill;
    this.checkpoint = 0;
    this.progress = 0;
    this.x = 0;
    this.z = 0;
    this.angle = 0;
    this.speed = 0;
    this.finished = false;
    this.finishTime = 0;
  }

  /** Drive toward the next checkpoint. */
  step(dt, checkpoints, elapsed) {
    if (this.finished) return;
    const cp = checkpoints[this.checkpoint];
    if (!cp) {
      this.finished = true;
      this.finishTime = elapsed;
      return;
    }
    const dx = cp[0] - this.x;
    const dz = cp[1] - this.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 10) {
      this.checkpoint += 1;
      return;
    }
    const want = Math.atan2(dx / d, dz / d);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const top = 30 * this.skill;
    this.speed += (top - this.speed) * Math.min(1, 1.2 * dt);
    this.x += Math.sin(this.angle) * this.speed * dt;
    this.z += Math.cos(this.angle) * this.speed * dt;
    this.progress = this.checkpoint + (1 - Math.min(1, d / 80));
  }
}

/** One running race. */
export class Race {
  constructor(def, game) {
    this.def = def;
    this.checkpoints = def.checkpoints;
    this.checkpoint = 0;
    this.elapsed = 0;
    this.finished = false;
    this.won = false;
    this.countdown = 3;
    this.rivals = [];
    const rng = new Rng(900 + def.checkpoints.length);
    const rivalDefs = [RIVALS[0], RIVALS[1]];
    rivalDefs.forEach((rd, i) => {
      const r = new RivalCar(rd, i, rng);
      r.x = def.start.x + (i + 1) * 6;
      r.z = def.start.z + 4;
      r.angle = Math.PI / 2;
      this.rivals.push(r);
    });
    this.bestTime = game.stats.racesWon > 0 ? 95 : 0;
  }

  /** Next checkpoint position, or null when done. */
  nextCheckpoint() {
    return this.checkpoints[this.checkpoint] || null;
  }

  /** Step the race: countdown, player progress, rivals, finish. */
  step(dt, game) {
    if (this.finished) return;
    if (this.countdown > 0) {
      this.countdown -= dt;
      return;
    }
    this.elapsed += dt;
    const p = game.player;
    const cp = this.nextCheckpoint();
    if (cp) {
      const dx = cp[0] - p.x;
      const dz = cp[1] - p.z;
      if (Math.sqrt(dx * dx + dz * dz) < 11) {
        this.checkpoint += 1;
        game.audio.playSfx('pickup');
        if (this.checkpoint >= this.checkpoints.length) {
          this.finish(game, true);
          return;
        }
      }
    }
    for (const r of this.rivals) {
      r.step(dt, this.checkpoints, this.elapsed);
      if (r.finished && !this.finished) {
        // A rival finished first: the player can still finish, but loses.
        this.finish(game, false);
        return;
      }
    }
    if (this.elapsed > 300) this.finish(game, false);
  }

  /** Finish the race: pay the winner, record the result. */
  finish(game, playerWon) {
    this.finished = true;
    this.won = playerWon;
    const rivalId = this.def.rival || 'dimas';
    if (playerWon) {
      const prize = 120000;
      game.player.money += prize;
      game.stats.earn(prize);
      game.stats.wonRace();
      game.achievements.check('race', game.stats.racesWon);
      game.dialogue.sayNow('Raka', `${this.def.name} dimenangkan! +Rp ${prize.toLocaleString('id-ID')}`);
      const line = rivalLine(rivalId, 'win', game.rng);
      if (line) game.dialogue.sayNow(line[0], line[1]);
      game.audio.playSfx('mission');
    } else {
      game.stats.lostRace();
      const line = rivalLine(rivalId, 'lose', game.rng);
      if (line) game.dialogue.sayNow(line[0], line[1]);
      else game.dialogue.sayNow('Dimas "Petir"', 'Kalah lagi, Raka. Latihan dulu, baru tantang aku.');
    }
  }

  /** HUD progress text: checkpoints and elapsed time. */
  progressText() {
    if (this.countdown > 0) return `Start dalam ${Math.ceil(this.countdown)}...`;
    return `${this.def.name}: checkpoint ${Math.min(this.checkpoint + 1, this.checkpoints.length)}/${this.checkpoints.length} — ${this.elapsed.toFixed(1)} dtk`;
  }

  /** Gap to the leading rival, in metres, for the HUD. */
  gapToLeader(game) {
    let best = Infinity;
    for (const r of this.rivals) {
      if (r.finished) continue;
      const d = Math.sqrt((r.x - game.player.x) * (r.x - game.player.x) + (r.z - game.player.z) * (r.z - game.player.z));
      best = Math.min(best, d);
    }
    return best === Infinity ? 0 : Math.round(best);
  }
}

/** The race system: start races, track the running one. */
export class Races {
  constructor() {
    this.active = null;
    this.wins = {};
    this.bestTimes = {};
    this.timeTrial = null;
  }

  /** Start a race by id. Returns the race, or null when one runs. */
  start(id, game) {
    if (this.active && !this.active.finished) return this.active;
    const def = RACE_DEFS.find((r) => r.id === id);
    if (!def) return null;
    this.active = new Race(def, game);
    // Place the player at the start line in a fresh car if on foot.
    const p = game.player;
    p.x = def.start.x;
    p.z = def.start.z;
    p.angle = Math.PI / 2;
    if (!p.car) {
      const car = game.traffic.parked.find((c) => !c.stolen) || game.traffic.cars[0];
      if (car) {
        game.traffic.steal(car);
        p.enterCar(car, null);
      }
    }
    if (p.car) {
      p.car.x = def.start.x;
      p.car.z = def.start.z;
      p.car.angle = Math.PI / 2;
      p.carSpeed = 0;
    }
    game.dialogue.sayNow('Raka', `${def.name} — ${def.checkpoints.length} checkpoint. Gas!`);
    return this.active;
  }

  /** Step the running race. */
  step(dt, game) {
    if (this.active) {
      this.active.step(dt, game);
      if (this.active.finished) {
        this.wins[this.active.def.id] = this.active.won;
        if (this.active.won) {
          const prev = this.bestTimes[this.active.def.id];
          if (!prev || this.active.elapsed < prev) {
            this.bestTimes[this.active.def.id] = this.active.elapsed;
          }
        }
        this.active = null;
      }
    }
    if (this.timeTrial) {
      this.timeTrial.step(dt, game);
      if (this.timeTrial.finished) {
        if (this.timeTrial.won) {
          const prev = this.bestTimes[this.timeTrial.def.id + '-tt'];
          if (!prev || this.timeTrial.elapsed < prev) {
            this.bestTimes[this.timeTrial.def.id + '-tt'] = this.timeTrial.elapsed;
          }
        }
        this.timeTrial = null;
      }
    }
  }

  /** True when the player has won the named race before. */
  hasWon(id) {
    return !!this.wins[id];
  }

  /** Best time for a circuit, or null when never finished. */
  bestTime(id) {
    return this.bestTimes[id] || null;
  }

  /** Start a time trial: same circuit, no rivals, beat your best time. */
  startTimeTrial(id, game) {
    const def = RACE_DEFS.find((r) => r.id === id);
    if (!def) return null;
    const race = new Race(def, game);
    race.rivals = [];
    this.timeTrial = race;
    game.dialogue.sayNow('Raka', `Time trial ${def.name} — kalahkan waktumu sendiri!`);
    return race;
  }

  /** Lines for the map screen's race panel. */
  raceLines() {
    return RACE_DEFS.map((def) => {
      const best = this.bestTimes[def.id];
      const tt = this.bestTimes[def.id + '-tt'];
      const won = this.wins[def.id] ? '✓ menang' : 'belum menang';
      return `${def.name}: ${won}${best ? ` — terbaik ${best.toFixed(1)} dtk` : ''}${tt ? ` — time trial ${tt.toFixed(1)} dtk` : ''}`;
    });
  }
}
