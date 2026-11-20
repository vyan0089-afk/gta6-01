// save.js — save and load through localStorage. Two slots, versioned, plain
// JSON. Nothing leaves the player's own browser. The map screen reads the
// slot metadata (mission reached, money, time saved) without loading the slot.

const KEY = (slot) => `tanjung-matahari-save-v1-slot-${slot}`;
export const SAVE_SLOTS = [1, 2];

export function saveGame(state, slot = 1) {
  try {
    const data = {
      version: 1,
      slot,
      savedAt: new Date().toISOString(),
      money: state.money,
      respect: state.respect,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      statuesTaken: state.statuesTaken ?? 0,
      collectedStatues: state.collectedStatues ?? [],
      dayMinutes: state.dayMinutes ?? 600,
      player: { x: state.player.x, z: state.player.z, heading: state.player.heading, health: state.player.health, armour: state.player.armour },
      garage: state.garage,
      weapons: state.weapons,
      radioStation: state.radioStation,
      ownedCars: state.ownedCars,
      settings: state.settings,
    };
    localStorage.setItem(KEY(slot), JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(slot = 1) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot = 1) {
  try { return localStorage.getItem(KEY(slot)) !== null; } catch (e) { return false; }
}

// Light metadata for the map screen: null when the slot is empty.
export function saveSlotInfo(slot) {
  const data = loadGame(slot);
  if (!data) return { slot, empty: true };
  return {
    slot,
    empty: false,
    savedAt: data.savedAt,
    money: data.money,
    respect: data.respect,
    missionIndex: data.missionIndex,
    missionsDone: (data.missionsDone ?? []).length,
    statuesTaken: data.statuesTaken ?? 0,
  };
}

export function clearSave(slot = 1) {
  try { localStorage.removeItem(KEY(slot)); } catch (e) { /* ignore */ }
}
