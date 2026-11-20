// save.js — saving and loading through localStorage.
//
// Two slots, versioned, plain JSON. Nothing leaves the player's own
// browser, and a save from a future version of the game is refused rather
// than half-loaded. The map screen reads the light slot metadata (mission
// reached, money, time saved) without loading the whole slot.

const KEY = (slot) => `tanjung-matahari-save-v1-slot-${slot}`;
const SAVE_VERSION = 1;
export const SAVE_SLOTS = [1, 2];

// Write the current game state into a slot. Returns true on success;
// storage can be full or disabled, and that must never crash the game.
export function saveGame(state, slot = 1) {
  try {
    const data = {
      version: SAVE_VERSION,
      slot,
      savedAt: new Date().toISOString(),
      money: state.money,
      respect: state.respect,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      statuesTaken: state.statuesTaken ?? 0,
      collectedStatues: state.collectedStatues ?? [],
      dayMinutes: state.dayMinutes ?? 600,
      player: {
        x: state.player.x,
        z: state.player.z,
        heading: state.player.heading,
        health: state.player.health,
        armour: state.player.armour,
      },
      garage: state.garage,
      weapons: state.weapons,
      radioStation: state.radioStation,
      ownedCars: state.ownedCars,
      stats: state.stats ?? { carsStolen: 0, shotsFired: 0, distanceDriven: 0, foesDown: 0 },
      settings: state.settings,
    };
    localStorage.setItem(KEY(slot), JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

// Read a slot back, or null when it is empty, corrupt or from another
// version of the game.
export function loadGame(slot = 1) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot = 1) {
  try {
    return localStorage.getItem(KEY(slot)) !== null;
  } catch (e) {
    return false;
  }
}

// Slot metadata for every slot, in order: the title screen only needs to
// know whether a save exists, the map screen shows the detail.
export function listSaves() {
  return SAVE_SLOTS.map((slot) => saveSlotInfo(slot));
}

// Light metadata for the map screen: null-ish when the slot is empty.
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
  try {
    localStorage.removeItem(KEY(slot));
  } catch (e) {
    // Nothing to clear, or storage is unavailable — either way, move on.
  }
}

// Wipe every slot: starting a brand-new game clears slot 1 and slot 2,
// so an old save can never leak back in through "Lanjutkan".
export function clearAllSaves() {
  for (const slot of SAVE_SLOTS) clearSave(slot);
}
