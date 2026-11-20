// garage.js — Sari's garage at the harbour: store cars, fit nitro, repair.
// Drive a stolen car into the garage yard and press E to store it: the car
// joins your collection (up to 8) and the garage count on the HUD rises.
// Full service costs money and restores the car and Raka's armour; nitro is
// a one-time fit that gives every driven car a 35% top-speed boost while
// fuel lasts. The garage is also a mission destination: mission 7 ends here.

import { clamp } from './rng.js';
import { PAINT_JOBS, UPGRADES } from './config.js';

export const GARAGE_POS = { x: 200, z: 170, radius: 14 };
export const GARAGE_MAX_CARS = 8;
export const SERVICE_COST = 75000;
export const NITRO_COST = 120000;
export const REPAIR_COST = 40000;

/** One stored car. */
export class StoredCar {
  constructor(car) {
    this.name = car.model ? car.model.name : car.name || 'Mobil';
    this.colour = car.colour || '#c8ccd2';
    this.model = car.model || null;
    this.condition = 100;
  }
}

/** Sari's garage. */
export class Garage {
  constructor() {
    this.cars = [];
    this.nitroFitted = false;
    this.serviceCount = 0;
    this.message = '';
    this.messageTimer = 0;
    this.paintIndex = 0;
    this.upgradesOwned = new Set();
    this.armoured = false;
    this.brakesUpgraded = false;
  }

  /** Combined acceleration multiplier from owned upgrades. */
  accelMultiplier() {
    let m = 1;
    for (const id of this.upgradesOwned) {
      const u = UPGRADES.find((x) => x.id === id);
      if (u) m *= u.accel;
    }
    return m;
  }

  /** Combined top-speed multiplier from owned upgrades. */
  topMultiplier() {
    let m = 1;
    for (const id of this.upgradesOwned) {
      const u = UPGRADES.find((x) => x.id === id);
      if (u) m *= u.top;
    }
    return m;
  }

  /** Repaint the car the player is driving, cycling the paint list. */
  repaint(player, game) {
    if (!player.car) {
      this.message = 'Bawa mobil dulu, baru dicat.';
      this.messageTimer = 3;
      return false;
    }
    const paint = PAINT_JOBS[this.paintIndex % PAINT_JOBS.length];
    this.paintIndex += 1;
    if (player.money < paint.price) {
      this.message = `Uang tidak cukup untuk cat ${paint.name} (Rp ${paint.price.toLocaleString('id-ID')}).`;
      this.messageTimer = 4;
      return false;
    }
    player.money -= paint.price;
    player.car.colour = paint.colour;
    this.message = `Mobil dicat ${paint.name}! Polisi akan mengenalimu... dengan kagum.`;
    this.messageTimer = 4;
    game.audio.playSfx('pickup');
    return true;
  }

  /** Buy a performance upgrade by id. Returns false when unaffordable/owned. */
  buyUpgrade(id, player, game) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return false;
    if (this.upgradesOwned.has(id)) {
      this.message = `${up.name} sudah terpasang.`;
      this.messageTimer = 3;
      return false;
    }
    if (player.money < up.price) {
      this.message = `Uang tidak cukup untuk ${up.name} (Rp ${up.price.toLocaleString('id-ID')}).`;
      this.messageTimer = 4;
      return false;
    }
    player.money -= up.price;
    this.upgradesOwned.add(id);
    if (id === 'armour') this.armoured = true;
    if (id === 'brakes') this.brakesUpgraded = true;
    this.message = `${up.name} terpasang! ${up.desc}.`;
    this.messageTimer = 4;
    game.audio.playSfx('mission');
    return true;
  }

  /** The upgrade shop lines for the HUD. */
  shopLines() {
    return UPGRADES.map((u) => {
      const owned = this.upgradesOwned.has(u.id) ? ' [TERPASANG]' : '';
      return `${u.name} — ${u.desc} — Rp ${u.price.toLocaleString('id-ID')}${owned}`;
    });
  }

  /** How many cars are stored. */
  get count() {
    return this.cars.length;
  }

  set count(n) {
    // Setter kept for save/load compatibility: the array is the truth.
    while (this.cars.length > n) this.cars.pop();
  }

  /** True when the player is inside the garage yard. */
  playerInside(player) {
    const dx = player.x - GARAGE_POS.x;
    const dz = player.z - GARAGE_POS.z;
    return dx * dx + dz * dz < GARAGE_POS.radius * GARAGE_POS.radius;
  }

  /** Store the car the player is driving. Returns false when full. */
  storeCar(player, game) {
    if (!player.car) return false;
    if (this.cars.length >= GARAGE_MAX_CARS) {
      this.message = 'Garasi penuh! Maksimal 8 mobil.';
      this.messageTimer = 4;
      return false;
    }
    const car = player.car;
    this.cars.push(new StoredCar(car));
    player.exitCar();
    // The stored car leaves traffic: mark it stolen so it never respawns.
    car.stolen = true;
    car.x = GARAGE_POS.x + 6;
    car.z = GARAGE_POS.z + 6;
    this.message = `Mobil disimpan: ${this.cars[this.cars.length - 1].name}. Total ${this.cars.length}/8.`;
    this.messageTimer = 4;
    game.audio.playSfx('pickup');
    game.achievements.check('garage', this.cars.length);
    return true;
  }

  /** Full service: repair, armour and a wash. Costs money. */
  fullService(player, game) {
    if (player.money < SERVICE_COST) {
      this.message = 'Uang tidak cukup untuk servis penuh (Rp 75.000).';
      this.messageTimer = 4;
      return false;
    }
    player.money -= SERVICE_COST;
    player.health = 100;
    player.armour = 100;
    if (player.car) player.car.condition = 100;
    this.serviceCount += 1;
    this.message = 'Servis penuh selesai! Kesehatan dan armor pulih.';
    this.messageTimer = 4;
    game.audio.playSfx('mission');
    return true;
  }

  /** Fit nitro: faster top speed while fuel lasts. */
  fitNitro(player, game) {
    if (this.nitroFitted) {
      this.message = 'Nitro sudah terpasang.';
      this.messageTimer = 3;
      return false;
    }
    if (player.money < NITRO_COST) {
      this.message = 'Uang tidak cukup untuk nitro (Rp 120.000).';
      this.messageTimer = 4;
      return false;
    }
    player.money -= NITRO_COST;
    this.nitroFitted = true;
    this.message = 'Nitro terpasang! Tahan Shift saat menyetir untuk boost.';
    this.messageTimer = 4;
    game.audio.playSfx('mission');
    return true;
  }

  /** Repair only the current car, cheaper than full service. */
  repair(player, game) {
    if (player.money < REPAIR_COST) {
      this.message = 'Uang tidak cukup untuk perbaikan (Rp 40.000).';
      this.messageTimer = 4;
      return false;
    }
    player.money -= REPAIR_COST;
    player.health = Math.min(100, player.health + 40);
    this.message = 'Mobil diperbaiki, Raka. Hati-hati di jalan.';
    this.messageTimer = 4;
    return true;
  }

  /** Step the message timer. */
  step(dt) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (this.messageTimer <= 0) this.message = '';
  }

  /** Repair cost for a car, by how damaged it is (0..100). */
  repairCost(damage) {
    if (damage <= 0) return 0;
    return Math.round(400 + damage * 600);
  }

  /** What the garage can do for this player right now, as menu lines. */
  serviceMenu(player) {
    const lines = [];
    lines.push(`1 — Servis penuh (Rp 75.000): perbaiki, isi nitro, cuci`);
    lines.push(`2 — Pasang nitro (Rp 120.000)${this.nitroFitted ? ' — sudah terpasang' : ''}`);
    lines.push(`3 — Perbaiki saja (Rp 40.000)`);
    lines.push(`4 — Ganti cat (Rp 30.000–90.000)`);
    if (this.cars.length > 0) lines.push(`E — Simpan mobil ini (${this.cars.length}/${GARAGE_MAX_CARS})`);
    return lines;
  }

  /** The garage panel lines for the HUD. */
  panelLines(player) {
    return [
      `Garasi Sari — Pelabuhan`,
      `Mobil tersimpan: ${this.cars.length}/${GARAGE_MAX_CARS}`,
      `Nitro: ${this.nitroFitted ? 'TERPASANG' : 'belum (Rp 120.000)'}`,
      `Servis penuh: Rp 75.000 (E = simpan mobil, 1 = servis, 2 = nitro, 3 = perbaiki)`,
      `Servis dilakukan: ${this.serviceCount}x · ${this.shopLines()[0] || ''}`,
    ];
  }
}
