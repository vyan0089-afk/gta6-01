// save.js — Saving Tanjung Matahari.
//
// Three save slots in localStorage, plus the career stats that the map
// screen shows. A slot holds everything needed to resume: Raka's position,
// health, armour, money, weapons and ammo, the mission index and which
// missions are done, the wanted level, the clock, the radio station, the
// collectibles taken, and the career totals. New Game wipes all three slots
// first, so a fresh story never inherits an old one. Every read is wrapped
// so a corrupt or foreign slot is treated as empty, never as a crash —
// localStorage in a file:// page can hold another game's data under the
// same key, and this game must not die on it.

import { formatClock } from './rng.js';

export const SAVE_PREFIX = 'tanjung-matahari-save-v4-slot-';
export const SAVE_VERSION = 4;

/** Fresh career stats. */
export function freshStats() {
  return {
    missionsCompleted: 0,
    carsStolen: 0,
    distanceKm: 0,
    moneyEarned: 0,
    shotsFired: 0,
    arrests: 0,
    playSeconds: 0,
  };
}

/** The localStorage key for a slot (1, 2 or 3). */
export function slotKey(slot) {
  return `${SAVE_PREFIX}${slot}`;
}

/** Read one slot. Returns the parsed save, or null when empty/corrupt. */
export function readSlot(slot) {
  try {
    const raw = window.localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

/** Write one slot. Returns true when it stuck. */
export function writeSlot(slot, data) {
  try {
    const payload = { ...data, version: SAVE_VERSION, savedAt: Date.now() };
    window.localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

/** Wipe all three slots (New Game). Returns how many were cleared. */
export function clearAllSlots() {
  let cleared = 0;
  for (let slot = 1; slot <= 3; slot += 1) {
    try {
      if (window.localStorage.getItem(slotKey(slot)) !== null) cleared += 1;
      window.localStorage.removeItem(slotKey(slot));
    } catch (err) { /* storage may be unavailable */ }
  }
  return cleared;
}

/** Build a save object from the live game. */
export function snapshotGame(game) {
  const p = game.player;
  return {
    version: SAVE_VERSION,
    x: p.x, z: p.z, angle: p.angle,
    health: p.health, armour: p.armour, money: p.money,
    weapon: p.weapon, ammo: { ...p.ammo },
    missionIndex: game.missions.index,
    completed: [...game.missions.completed],
    jobsDone: game.missions.jobsDone,
    wanted: game.police.wanted,
    clock: game.clockSeconds,
    station: game.audio.station,
    collectibles: game.world.collectibles.map((c) => c.taken),
    stats: { ...game.stats },
    playSeconds: game.stats.playSeconds,
  };
}

/** A short human-readable summary of a slot, for the map screen. */
export function slotSummary(slot) {
  const s = readSlot(slot);
  if (!s) return null;
  return {
    missionIndex: s.missionIndex,
    money: s.money,
    clock: formatClock(s.clock),
    completed: s.completed.length,
    savedAt: s.savedAt ? new Date(s.savedAt).toLocaleString('id-ID') : '',
  };
}

/** Apply a save object to a fresh game. Returns true on success. */
export function applySnapshot(game, save) {
  if (!save) return false;
  const p = game.player;
  p.x = save.x; p.z = save.z; p.angle = save.angle;
  p.health = save.health; p.armour = save.armour; p.money = save.money;
  p.weapon = save.weapon || 'fists';
  p.ammo = { pistol: save.ammo?.pistol ?? 24, shotgun: save.ammo?.shotgun ?? 8 };
  p.onFoot = true; p.car = null;
  game.missions.index = save.missionIndex;
  game.missions.completed = [...(save.completed || [])];
  game.missions.jobsDone = save.jobsDone || 0;
  game.missions.finishedStory = save.missionIndex >= 8;
  game.clockSeconds = save.clock ?? 6 * 3600 + 30 * 60;
  game.audio.setStation(save.station ?? 0);
  if (Array.isArray(save.collectibles)) {
    save.collectibles.forEach((taken, i) => {
      if (game.world.collectibles[i]) game.world.collectibles[i].taken = !!taken;
    });
  }
  if (save.stats) game.stats = { ...freshStats(), ...save.stats };
  // Resume: the next mission is pending, not auto-started, so the player
  // chooses the moment. If the story is done, free-roam continues.
  if (!game.missions.finishedStory) game.pendingMission = save.missionIndex;
  return true;
}

/** List all three slots as summaries (null for empty ones). */
export function listSlots() {
  return [1, 2, 3].map((slot) => slotSummary(slot));
}
