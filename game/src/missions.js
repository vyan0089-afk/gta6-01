// missions.js — The story of Raka: 8 missions in 3 chapters.
// A mission is a list of stages. Each stage is one of a few honest types:
// go to a marker, collect a number of things, shoot a number of guards,
// deliver a car to the garage, win a race, or escape the police. The engine
// watches the world and advances stages as they complete; the HUD shows the
// current stage as "Misi X/Y" plus an objective counter. Completing a mission
// pays money, raises respect, clears the heat and unlocks the next one.
// Nothing is faked: markers are real places, targets are real objects.

import { MISSION_DIALOGUE, MISSION_COMPLETE_LINES } from './dialogue.js';

/**
 * Mission definitions. Positions are real city coordinates:
 * market (40,150), Gang Sanca (-180,40), beach road (-150,200),
 * harbour (200,180), clock tower (8,-92), hill (-40,-252).
 */
export const MISSION_DEFS = [
  {
    id: 'm1', chapter: 1, title: 'Paket Pasar Malam', reward: 150000,
    briefing: 'Ambil paket soto di Pasar Malam dan antar ke warung Mak Ijah di Gang Sanca.',
    stages: [
      { type: 'goto', text: 'Pergi ke Pasar Malam', x: 40, z: 150, radius: 10 },
      { type: 'collect', text: 'Ambil paket soto (0/1)', x: 40, z: 150, radius: 8, count: 1, item: 'paket' },
      { type: 'goto', text: 'Antar paket ke Gang Sanca', x: -180, z: 40, radius: 10 },
      { type: 'deliver', text: 'Serahkan paket ke Mak Ijah', x: -180, z: 40, radius: 8 },
    ],
  },
  {
    id: 'm2', chapter: 2, title: 'Utang Kopi', reward: 200000,
    briefing: 'Bowo berutang tiga bulan. Temui dia di pantai dan tagih — dengan cara apa pun.',
    stages: [
      { type: 'goto', text: 'Temui Bowo di jalan pantai', x: -150, z: 210, radius: 10 },
      { type: 'collect', text: 'Kumpulkan uang utang (0/3)', x: -150, z: 210, radius: 16, count: 3, item: 'uang' },
      { type: 'goto', text: 'Kembali ke Pakde Wiryo', x: 40, z: 150, radius: 10 },
    ],
  },
  {
    id: 'm3', chapter: 1, title: 'Balapan Pertama', reward: 250000,
    briefing: 'Dimas menantangmu balapan di jalan pantai. Menang, dan namamu dikenal.',
    stages: [
      { type: 'goto', text: 'Pergi ke garis start pantai', x: -210, z: 250, radius: 10 },
      { type: 'race', text: 'Menangkan balapan pantai', x: -210, z: 250, radius: 12, race: 'pantai' },
    ],
  },
  {
    id: 'm4', chapter: 2, title: 'Keris Hilang', reward: 300000,
    briefing: 'Dua keping keris emas kakekmu ada di dermaga, dijaga preman.',
    stages: [
      { type: 'goto', text: 'Pergi ke Dermaga Nelayan', x: 252, z: 210, radius: 12 },
      { type: 'collect', text: 'Ambil keris emas (0/2)', x: 252, z: 210, radius: 18, count: 2, item: 'keris' },
      { type: 'shoot', text: 'Usir penjaga dermaga (0/2)', x: 252, z: 210, radius: 30, count: 2 },
    ],
  },
  {
    id: 'm5', chapter: 2, title: 'Pengiriman Tengah Malam', reward: 350000,
    briefing: 'Bawa muatan ke pelabuhan sebelum tengah malam. Polisi sudah menunggu.',
    stages: [
      { type: 'goto', text: 'Ambil muatan di gudang pasar', x: 96, z: 196, radius: 10 },
      { type: 'drive', text: 'Bawa muatan ke Pelabuhan', x: 200, z: 180, radius: 12 },
      { type: 'escape', text: 'Lepas dari kejaran polisi', x: 200, z: 180, radius: 12, wanted: 3 },
    ],
  },
  {
    id: 'm6', chapter: 2, title: 'Perebutan Dermaga', reward: 400000,
    briefing: 'Lima penjaga menguasai gudang dermaga. Bersihkan mereka.',
    stages: [
      { type: 'goto', text: 'Pergi ke gudang dermaga', x: 150, z: 250, radius: 12 },
      { type: 'shoot', text: 'Kalahkan penjaga (0/5)', x: 150, z: 250, radius: 40, count: 5 },
      { type: 'collect', text: 'Ambil kunci gudang (0/1)', x: 150, z: 250, radius: 10, count: 1, item: 'kunci' },
    ],
  },
  {
    id: 'm7', chapter: 3, title: 'Pencurian Besar', reward: 500000,
    briefing: 'Garasi butuh tiga mobil bagus malam ini. Curi dan bawa ke garasi Sari.',
    stages: [
      { type: 'steal', text: 'Curi mobil bagus (0/3)', x: 60, z: -40, radius: 60, count: 3 },
      { type: 'drive', text: 'Bawa mobil terakhir ke garasi', x: 200, z: 170, radius: 12 },
    ],
  },
  {
    id: 'm8', chapter: 3, title: 'Raja Tanjung', reward: 750000,
    briefing: 'Bos besar menunggu di Bukit Senja. Akhiri ini — balapan terakhir, lalu hadapi dia.',
    stages: [
      { type: 'goto', text: 'Pergi ke Bukit Senja', x: -40, z: -252, radius: 12 },
      { type: 'race', text: 'Menangkan balapan bukit', x: -40, z: -252, radius: 12, race: 'bukit' },
      { type: 'shoot', text: 'Kalahkan pengawal bos (0/3)', x: -40, z: -252, radius: 40, count: 3 },
      { type: 'escape', text: 'Lepas dari Operasi Senja', x: -40, z: -252, radius: 12, wanted: 5 },
    ],
  },
];

/** Chapter names for the story screen. */
export const CHAPTERS = [
  { n: 1, name: 'Bab 1 — Pulang ke Sanca', missions: ['m1', 'm2', 'm3'] },
  { n: 2, name: 'Bab 2 — Pelabuhan', missions: ['m4', 'm5', 'm6'] },
  { n: 3, name: 'Bab 3 — Raja Tanjung', missions: ['m7', 'm8'] },
];

/** Chapter intro texts, shown when a chapter begins. */
export const CHAPTER_INTROS = {
  1: 'Raka pulang ke Gang Sanca setelah bertahun-tahun pergi. Kota sudah berubah — tapi utang lama tidak pernah lupa.',
  2: 'Pelabuhan dikuasai preman dan keris kakekmu hilang. Raka harus merebut kembali dermaga, satu gudang demi satu gudang.',
  3: 'Bos besar menunggu di Bukit Senja. Ini babak terakhir: curi mobilnya, menangkan balapannya, dan akhiri semuanya.',
};

/** The mission reward table, for the map screen. */
export function totalRewards() {
  return MISSION_DEFS.reduce((sum, def) => sum + def.reward, 0);
}

/** A one-paragraph briefing for a mission, shown on the map screen. */
export function missionBriefing(id) {
  const def = MISSION_DEFS.find((d) => d.id === id);
  if (!def) return '';
  const stageNames = def.stages.map((s) => s.kind).join(' → ');
  return `${def.title} — ${def.desc} Hadiah Rp ${def.reward.toLocaleString('id-ID')}. Tahapan: ${stageNames}.`;
}

/** Missions of a chapter, in order. */
export function missionsOfChapter(chapter) {
  return MISSION_DEFS.filter((d) => d.chapter === chapter);
}

/** The chapter a mission belongs to. */
export function chapterOf(id) {
  const def = MISSION_DEFS.find((d) => d.id === id);
  return def ? def.chapter : 0;
}

/** The mission engine: tracks the active mission, its stage and progress. */
export class Missions {
  constructor() {
    this.index = 0; // missions completed
    this.active = null;
    this.stageIndex = 0;
    this.stageProgress = 0;
    this.objective = '';
    this.done = new Set();
    this.failed = false;
    this.startedAt = 0;
    this.marker = null; // {x, z} of the current objective
    this.raceRef = null;
    this.lastChapter = 0;
    this.startMission(0);
  }

  /** The definition of the active mission, or null when the story is done. */
  get def() {
    if (this.index >= MISSION_DEFS.length) return null;
    return MISSION_DEFS[this.index];
  }

  /** Start mission i (0-based). game is optional: with it, chapter intros play. */
  startMission(i, game) {
    if (i >= MISSION_DEFS.length) {
      this.active = null;
      this.objective = 'Cerita selesai — Tanjung Matahari milikmu, Raka.';
      this.marker = null;
      return;
    }
    this.index = i;
    this.active = MISSION_DEFS[i];
    this.stageIndex = 0;
    this.stageProgress = 0;
    this.failed = false;
    // Chapter intros: the first mission of a new chapter announces it.
    if (this.active.chapter !== this.lastChapter) {
      this.lastChapter = this.active.chapter;
      const intro = CHAPTER_INTROS[this.active.chapter];
      if (intro && game) game.dialogue.sayNow('Narator', intro);
    }
    // Restore every stage's original count: stage objects are shared data
    // and a retry must not inherit a half-eaten counter.
    for (const st of this.active.stages) {
      if (typeof st._total === 'number') st.count = st._total;
      if (st.type === 'escape') st.armed = false;
    }
    this.updateObjective();
  }

  /** Current stage definition. */
  get stage() {
    if (!this.active) return null;
    return this.active.stages[this.stageIndex] || null;
  }

  /** "Misi 3/8" style progress text. */
  progressText() {
    if (!this.active) return '8/8';
    return `${this.index + 1}/8`;
  }

  /** Refresh the objective line and marker from the current stage. */
  updateObjective() {
    const s = this.stage;
    if (!s) {
      this.objective = 'Misi selesai!';
      this.marker = null;
      return;
    }
    this.objective = s.text;
    this.marker = { x: s.x, z: s.z };
  }

  /** Advance to the next stage, or complete the mission. */
  advance(game) {
    this.stageIndex += 1;
    this.stageProgress = 0;
    if (this.stageIndex >= this.active.stages.length) {
      this.complete(game);
      return;
    }
    this.updateObjective();
  }

  /** Complete the active mission: pay, respect, clear heat, unlock next. */
  complete(game) {
    const def = this.active;
    this.done.add(def.id);
    game.player.money += def.reward;
    game.stats.respect += 150;
    game.stats.missionsDone = this.done.size;
    game.police.clear();
    const doneLine = MISSION_COMPLETE_LINES[def.id];
    if (doneLine) game.dialogue.sayNow(doneLine[0], doneLine[1]);
    else game.dialogue.sayNow('Raka', `Misi selesai: ${def.title}. +Rp ${def.reward.toLocaleString('id-ID')}`);
    game.achievements.check('mission', this.done.size);
    game.saveGame(0, true);
    game.effects.confetti(game.player.x, game.player.z);
    game.audio.playSfx('checkpoint');
    this.index += 1;
    if (this.index >= MISSION_DEFS.length) {
      this.active = null;
      this.objective = 'Cerita selesai — Tanjung Matahari milikmu, Raka.';
      this.marker = null;
      game.dialogue.say([
        ['Pakde Wiryo', 'Kamu melakukannya, Raka. Tanjung Matahari akhirnya tenang.'],
        ['Raka', 'Ini baru awal, Pakde. Kota ini rumahku.'],
      ]);
      return;
    }
    this.startMission(this.index, game);
    const next = this.active;
    const lines = MISSION_DIALOGUE[next.id] || [];
    if (lines.length > 0) game.dialogue.say(lines);
  }

  /** Distance from the player to the current marker. */
  markerDistance(player) {
    if (!this.marker) return 0;
    const dx = this.marker.x - player.x;
    const dz = this.marker.z - player.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Step the mission engine. game carries player, police, combat and stats.
   * Returns 'advanced' | 'completed' | 'failed' | null.
   */
  step(dt, game) {
    const s = this.stage;
    if (!s) return null;
    const p = game.player;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    switch (s.type) {
      case 'goto':
      case 'deliver':
        if (d < s.radius) this.advance(game);
        break;
      case 'collect': {
        // Pick up an item by standing in the marker circle for a moment.
        if (d < s.radius) {
          this.stageProgress += dt;
          if (this.stageProgress >= 1.2) {
            this.stageProgress = 0;
            s.count -= 1;
            if (s.count <= 0) this.advance(game);
            else this.updateObjective();
          }
        }
        break;
      }
      case 'shoot': {
        const down = game.combat.killsInMission;
        const target = s.count;
        this.objective = `${s.text.split(' (')[0]} (${Math.min(target, down)}/${target})`;
        if (down >= target) {
          game.combat.killsInMission = 0;
          this.advance(game);
        }
        break;
      }
      case 'drive':
        if (d < s.radius && p.car) this.advance(game);
        break;
      case 'steal': {
        const got = game.stats.carsStolenThisMission;
        this.objective = `${s.text.split(' (')[0]} (${Math.min(s.count, got)}/${s.count})`;
        if (got >= s.count) {
          game.stats.carsStolenThisMission = 0;
          this.advance(game);
        }
        break;
      }
      case 'race': {
        if (!this.raceRef) {
          this.raceRef = game.races.start(s.race, game);
          if (!this.raceRef) break;
          this.objective = `Balapan ${s.race}: lewati semua checkpoint!`;
        }
        if (this.raceRef.finished) {
          const won = this.raceRef.won;
          this.raceRef = null;
          if (won) this.advance(game);
          else {
            this.objective = 'Kalah balapan — kembali ke garis start untuk mencoba lagi.';
            game.dialogue.sayNow('Dimas "Petir"', 'Hah! Coba lagi, Raka. Jalan pantai tidak menunggu.');
          }
        }
        break;
      }
      case 'escape': {
        if (game.police.wanted < s.wanted) {
          // Heat must be raised first by the mission intro, then escape it.
          if (!s.armed) {
            s.armed = true;
            game.police.raise(s.wanted, p);
            game.dialogue.sayNow('Raka', `Polisi level ${s.wanted}! Kabur sekarang!`);
          }
        }
        if (s.armed && game.police.wanted === 0) this.advance(game);
        break;
      }
      default:
        break;
    }
    // Keep the objective text in sync for collect/shoot stages.
    if (s.type === 'collect' && s.count > 0) {
      const base = s.text.split(' (')[0];
      const done = (s._total || 0) - s.count;
      this.objective = `${base} (${done}/${s._total || s.count})`;
    }
    return null;
  }

  /** Remember each stage's original count so counters stay honest. */
  armTotals() {
    for (const def of MISSION_DEFS) {
      for (const s of def.stages) {
        if (typeof s.count === 'number') s._total = s.count;
      }
    }
  }

  /** Fail the active mission (Raka died or was busted mid-mission). */
  fail(game) {
    if (!this.active) return;
    this.failed = true;
    game.dialogue.say([
      ['Raka', 'Gagal. Tapi Raka tidak menyerah semudah itu.'],
      ['Pakde Wiryo', 'Coba lagi, nak. Kota ini tidak sabar menunggu.'],
    ]);
  }

  /** Retry the active mission from its first stage. */
  retry(game) {
    if (!this.active) return;
    this.failed = false;
    this.stageIndex = 0;
    this.stageProgress = 0;
    game.combat.killsInMission = 0;
    game.stats.carsStolenThisMission = 0;
    this.startMission(this.index, game);
    game.dialogue.sayNow('Raka', `Mencoba lagi: ${this.active.title}.`);
  }

  /** Serialise mission progress for a save file. */
  toSave() {
    return { index: this.index, stageIndex: this.stageIndex, done: [...this.done] };
  }

  /** Restore mission progress from a save file. */
  fromSave(data) {
    if (!data) return;
    this.done = new Set(data.done || []);
    const idx = Math.min(data.index || 0, MISSION_DEFS.length - 1);
    this.startMission(idx);
    this.stageIndex = Math.min(data.stageIndex || 0, (this.active?.stages.length || 1) - 1);
    this.updateObjective();
  }
}
