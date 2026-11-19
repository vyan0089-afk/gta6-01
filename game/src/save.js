// save.js — save and load through localStorage. One slot, versioned, plain
// JSON. Nothing leaves the player's own browser.

const KEY = 'tanjung-matahari-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      money: state.money,
      respect: state.respect,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      player: { x: state.player.x, z: state.player.z, heading: state.player.heading, health: state.player.health, armour: state.player.armour },
      garage: state.garage,
      weapons: state.weapons,
      radioStation: state.radioStation,
      ownedCars: state.ownedCars,
      settings: state.settings,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
