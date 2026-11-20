// save.js — Save slots and autosave for Tanjung Matahari.
// Three slots in localStorage, each holding the whole career: position,
// money, health, mission progress, keris, cars stolen, side jobs, garage
// and the game clock. Autosave writes slot 0's companion record every
// minute and after every mission, so a crash never costs a whole evening.
// Saves are plain JSON: readable, portable and easy to verify in a test.

import { SAVE } from './config.js';

/** The key for a slot number (1-based). */
export function slotKey(slot) {
  return SAVE.prefix + slot;
}

/** Build a save record from the live game. */
export function buildSaveRecord(game, slot) {
  const p = game.player;
  return {
    version: 1,
    slot,
    savedAt: new Date().toISOString(),
    money: Math.floor(p.money),
    health: Math.floor(p.health),
    armour: Math.floor(p.armour),
    respect: game.stats.respect,
    x: Math.round(p.x * 10) / 10,
    z: Math.round(p.z * 10) / 10,
    angle: Math.round(p.angle * 100) / 100,
    hour: Math.round(game.weather.hour * 100) / 100,
    missionIndex: game.missions.index,
    missionStage: game.missions.stageIndex,
    missionsDone: [...game.missions.done],
    kerisFound: game.world.keris.filter((k) => k.found).map((k) => k.id),
    carsStolen: game.stats.carsStolen,
    sideJobsDone: game.stats.sideJobsDone,
    racesWon: game.stats.racesWon,
    kills: game.combat.kills,
    garage: game.garage.cars.map((c) => ({ name: c.name, colour: c.colour })),
    achievements: [...game.achievements.unlocked],
    playSeconds: Math.floor(game.stats.playSeconds),
  };
}

/** Write a save record into a slot. Returns true on success. */
export function writeSave(game, slot) {
  try {
    const record = buildSaveRecord(game, slot);
    localStorage.setItem(slotKey(slot), JSON.stringify(record));
    return true;
  } catch (e) {
    return false;
  }
}

/** Read a save record from a slot, or null when empty or corrupt. */
export function readSave(slot) {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/** Validate a save record field by field; returns a list of problems. */
export function validateSave(data) {
  const problems = [];
  if (!data || typeof data !== 'object') return ['not an object'];
  if (data.version !== 1) problems.push('version is not 1');
  if (typeof data.money !== 'number' || data.money < 0) problems.push('money is invalid');
  if (typeof data.health !== 'number' || data.health < 0 || data.health > 100) problems.push('health is out of range');
  if (typeof data.x !== 'number' || typeof data.z !== 'number') problems.push('position is missing');
  if (Math.abs(data.x) > 400 || Math.abs(data.z) > 400) problems.push('position is outside the world');
  if (typeof data.missionIndex !== 'number' || data.missionIndex < 0 || data.missionIndex > 8) problems.push('missionIndex is out of range');
  if (!Array.isArray(data.kerisFound)) problems.push('kerisFound is not a list');
  if (!Array.isArray(data.missionsDone)) problems.push('missionsDone is not a list');
  if (typeof data.playSeconds !== 'number' || data.playSeconds < 0) problems.push('playSeconds is invalid');
  return problems;
}

/** True when a slot holds a valid save. */
export function slotValid(slot) {
  const data = readSave(slot);
  if (!data) return false;
  return validateSave(data).length === 0;
}

/** True when a slot holds a save. */
export function slotHasSave(slot) {
  return readSave(slot) !== null;
}

/** Short summary text for a slot, for the map screen. */
export function slotSummary(slot) {
  const data = readSave(slot);
  if (!data) return '— kosong —';
  const date = (data.savedAt || '').slice(0, 10);
  return `Misi ${data.missionIndex}/8 · Rp ${Math.floor(data.money).toLocaleString('id-ID')} · ${date}`;
}

/** Delete a slot's save. */
export function clearSave(slot) {
  try {
    localStorage.removeItem(slotKey(slot));
    return true;
  } catch (e) {
    return false;
  }
}

/** Export a slot's save as a shareable text block (for the map screen). */
export function exportSaveText(slot) {
  const data = readSave(slot);
  if (!data) return '';
  return [
    `TANJUNG MATAHARI — SAVE SLOT ${slot}`,
    `Misi: ${data.missionIndex}/8 · Uang: Rp ${Math.floor(data.money).toLocaleString('id-ID')}`,
    `Keris: ${data.kerisFound.length}/12 · Mobil dicuri: ${data.carsStolen}`,
    `Pekerjaan: ${data.sideJobsDone} · Balapan menang: ${data.racesWon}`,
    `Disimpan: ${data.savedAt}`,
  ].join('\n');
}

/** Compare two slots: which career is further along? */
export function compareSlots(a, b) {
  const da = readSave(a);
  const db = readSave(b);
  if (!da) return db ? b : 0;
  if (!db) return a;
  const score = (d) => d.missionIndex * 100 + d.kerisFound.length * 10 + d.carsStolen + d.sideJobsDone * 5;
  return score(da) >= score(db) ? a : b;
}

/** The newest save among the slots, or null when all are empty. */
export function newestSaveSlot() {
  let best = null;
  let bestTime = '';
  for (let slot = 1; slot <= SAVE.slots; slot += 1) {
    const data = readSave(slot);
    if (data && data.savedAt > bestTime) {
      bestTime = data.savedAt;
      best = slot;
    }
  }
  return best;
}

/** Apply a save record to the live game. */
export function applySave(game, data) {
  const p = game.player;
  p.money = data.money;
  p.health = data.health;
  p.armour = data.armour;
  p.x = data.x;
  p.z = data.z;
  p.angle = data.angle;
  p.camYaw = data.angle + Math.PI;
  game.weather.hour = data.hour;
  game.stats.respect = data.respect || 0;
  game.stats.carsStolen = data.carsStolen || 0;
  game.stats.sideJobsDone = data.sideJobsDone || 0;
  game.stats.racesWon = data.racesWon || 0;
  game.stats.playSeconds = data.playSeconds || 0;
  game.combat.kills = data.kills || 0;
  game.stats.kills = data.kills || 0;
  for (const k of game.world.keris) k.found = (data.kerisFound || []).includes(k.id);
  game.stats.kerisFound = game.world.keris.filter((k) => k.found).length;
  game.missions.done = new Set(data.missionsDone || []);
  game.missions.fromSave({ index: data.missionIndex, stageIndex: data.missionStage, done: data.missionsDone || [] });
  game.garage.cars = (data.garage || []).map((g) => ({ name: g.name, colour: g.colour, model: null }));
  game.garage.count = game.garage.cars.length;
  game.achievements.unlocked = new Set(data.achievements || []);
}

/** The autosave ticker: writes slot 1's autosave companion every minute. */
export class Autosave {
  constructor() {
    this.timer = SAVE.autosaveSeconds;
    this.lastWrite = 0;
  }

  step(dt, game) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SAVE.autosaveSeconds;
      this.lastWrite = game.stats.playSeconds;
      writeSave(game, 1);
    }
  }
}
