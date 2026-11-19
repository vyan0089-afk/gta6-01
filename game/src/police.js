// police.js — the wanted system of Tanjung Matahari. Heat rises with crime,
// police cars chase on the road graph, a helicopter joins at 4 stars and
// roadblocks close the city at 5. Dispatch units have names, and their
// radio chatter shows up in the HUD feed.

import { clamp, dist2D, angleDiff } from './math.js';
import { createCar, driveCar, CAR_MODELS } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

const UNITS = ['Elang-1', 'Kancil-2', 'Garuda-3', 'Sanca-4', 'Komodo-5', 'Rajawali-6', 'Banteng-7'];
const DISPATCH_LINES = [
  'Semua unit, tersangka di {place}.',
  'Unit {unit} menuju lokasi, tersangka mengendarai {car}.',
  'Perhatian, tersangka bersenjata. Minta bala bantuan.',
  'Helikopter diminta, tersangka melarikan diri ke arah {place}.',
  'Blokade dipasang di jalan utama. Jangan biarkan lolos.',
  'Tersangka terlihat di {place}. Kejar dengan hati-hati.',
];
const PLACES = ['Pasar Malam', 'Pelabuhan', 'Pantai Matahari', 'Kota Tua', 'Bukit Vila', 'Jalan Merdeka', 'Terminal'];

function bfsPath(graph, from, to) {
  if (from === to) return [to];
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of graph.edges.get(cur) ?? []) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === to) {
        const path = [to];
        let p = cur;
        while (p !== -1) { path.unshift(p); p = prev.get(p); }
        return path;
      }
      queue.push(nb);
    }
  }
  return [to];
}

export class PoliceSys {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.wanted = 0;
    this.cops = [];
    this.heli = null;
    this.roadblocks = [];
    this.feed = [];
    this.bustTimer = 0;
    this.calmTimer = 0;
    this.repathTimer = 0;
    this.dispatchTimer = 8;
    this.unitIndex = 0;
  }

  get level() { return this.wanted; }

  addHeat(amount, reason) {
    if (amount <= 0) return;
    this.heat = clamp(this.heat + amount, 0, 100);
    const w = Math.min(5, Math.ceil(this.heat / 20));
    if (w > this.wanted) {
      this.wanted = w;
      this.say(`Bintang ${w}: ${reason}`);
      if (w >= 4 && !this.heli) this.heli = { x: 0, z: 0, y: 42, angle: 0 };
    }
    this.calmTimer = 0;
  }

  clear() {
    this.heat = 0;
    this.wanted = 0;
    this.cops = [];
    this.heli = null;
    this.roadblocks = [];
    this.bustTimer = 0;
  }

  say(text) {
    this.feed.unshift({ text, t: 0 });
    if (this.feed.length > 4) this.feed.pop();
  }

  nearestNode(x, z) {
    let best = 0, bestD = Infinity;
    for (const n of this.city.graph.nodes) {
      const d = dist2D(x, z, n.x, n.z);
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  spawnCop(px, pz) {
    // Spawn on a road 70-120 units away.
    const a = this.rng.float() * Math.PI * 2;
    const d = 80 + this.rng.float() * 40;
    let x = px + Math.sin(a) * d;
    let z = pz + Math.cos(a) * d;
    x = clamp(x, -250, 250);
    z = clamp(z, -250, 250);
    const rp = nearestRoadPoint(this.city.roads, x, z);
    const car = createCar('police', rp.x, rp.z, this.rng.float() * Math.PI * 2, null, 'police');
    car.path = [];
    car.pathTimer = 0;
    this.cops.push(car);
    return car;
  }

  update(dt, ctx) {
    const { player, playerCar, colliders } = ctx;
    const px = playerCar ? playerCar.x : player.x;
    const pz = playerCar ? playerCar.z : player.z;

    // Heat decays when the player stays out of trouble.
    this.calmTimer += dt;
    if (this.calmTimer > 6 && this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 2.2);
      const w = Math.ceil(this.heat / 20);
      if (w < this.wanted) {
        this.wanted = w;
        if (w === 0) { this.say('Tersangka hilang dari pantauan. Patroli kembali normal.'); this.cops = []; this.heli = null; this.roadblocks = []; }
      }
    }

    // Keep the right number of patrol cars.
    const want = this.wanted === 0 ? 0 : Math.min(5, 1 + this.wanted);
    while (this.cops.length < want) this.spawnCop(px, pz);
    while (this.cops.length > want) this.cops.pop();

    // Dispatch chatter.
    this.dispatchTimer -= dt;
    if (this.dispatchTimer <= 0 && this.wanted > 0) {
      this.dispatchTimer = 9 + this.rng.float() * 6;
      const unit = UNITS[this.unitIndex++ % UNITS.length];
      const line = this.rng.pick(DISPATCH_LINES)
        .replace('{unit}', unit)
        .replace('{place}', this.rng.pick(PLACES))
        .replace('{car}', playerCar ? playerCar.def.name : 'berjalan kaki');
      this.say(`${unit}: ${line}`);
    }

    // Chase.
    this.repathTimer -= dt;
    const repath = this.repathTimer <= 0;
    if (repath) this.repathTimer = 1.0;
    const playerNode = this.nearestNode(px, pz);
    for (const cop of this.cops) {
      if (repath || !cop.path || cop.path.length === 0) {
        cop.path = bfsPath(this.city.graph, this.nearestNode(cop.x, cop.z), playerNode);
        cop.pathIndex = 0;
      }
      const wp = this.city.graph.nodes[cop.path[Math.min(cop.pathIndex ?? 0, cop.path.length - 1)]];
      if (wp) {
        const d = dist2D(cop.x, cop.z, wp.x, wp.z);
        if (d < 4 && cop.pathIndex < cop.path.length - 1) cop.pathIndex++;
      }
      const target = wp ?? { x: px, z: pz };
      const wantHeading = Math.atan2(target.x - cop.x, target.z - cop.z);
      const diff = angleDiff(cop.heading, wantHeading);
      const distToPlayer = dist2D(cop.x, cop.z, px, pz);
      // Ram the player when close; otherwise drive fast to the waypoint.
      const throttle = distToPlayer < 10 ? 1 : 0.85;
      driveCar(cop, throttle, clamp(diff * 1.8, -1, 1), dt, colliders, ctx.allCars);
      // Bust: a cop next to the player on foot.
      if (!playerCar && distToPlayer < 4.5) {
        this.bustTimer += dt;
      }
    }
    if (playerCar || this.cops.length === 0) this.bustTimer = Math.max(0, this.bustTimer - dt * 2);

    // Helicopter.
    if (this.wanted >= 4 && this.heli) {
      this.heli.angle += dt * 0.5;
      this.heli.x += ((px + Math.sin(this.heli.angle) * 14) - this.heli.x) * Math.min(1, dt * 0.8);
      this.heli.z += ((pz + Math.cos(this.heli.angle) * 14) - this.heli.z) * Math.min(1, dt * 0.8);
    } else if (this.wanted < 4) {
      this.heli = null;
    }

    // Roadblocks at 5 stars: two patrol cars parked ahead of the player.
    if (this.wanted >= 5 && this.roadblocks.length === 0) {
      this.say('Komodo-5: Blokade dipasang. Semua jalan keluar ditutup.');
      const heading = playerCar ? playerCar.heading : player.heading;
      const ax = px + Math.sin(heading) * 55;
      const az = pz + Math.cos(heading) * 55;
      for (const s of [-1, 1]) {
        const bx = ax + Math.cos(heading) * s * 4;
        const bz = az - Math.sin(heading) * s * 4;
        const block = createCar('police', bx, bz, heading + Math.PI / 2, null, 'police');
        block.speed = 0;
        this.roadblocks.push(block);
      }
    }
    if (this.wanted < 5) this.roadblocks = [];

    for (const f of this.feed) f.t += dt;
  }

  get busted() { return this.bustTimer > 2.5; }

  draw(r, time) {
    for (const cop of this.cops) {
      // drawCar is imported by game.js; police cars are drawn there via allCars.
    }
    if (this.heli) {
      const h = this.heli;
      // Body, tail, rotor.
      r.box(h.x, h.y, h.z, 5.5, 2.2, 3.2, 0, h.angle, 0, [0.15, 0.2, 0.35]);
      r.box(h.x - Math.sin(h.angle) * 4, h.y + 0.4, h.z - Math.cos(h.angle) * 4, 4, 1, 1.2, 0, h.angle, 0, [0.15, 0.2, 0.35]);
      const rot = time * 12;
      r.box(h.x, h.y + 1.4, h.z, 12, 0.15, 0.6, 0, rot, 0, [0.1, 0.1, 0.1]);
      r.box(h.x, h.y - 1.4, h.z, 0.5, 0.5, 0.5, 0, h.angle, 0, [1.0, 0.95, 0.6], 2);
    }
  }
}
