// player.js — Raka, on foot and behind the wheel.
// On foot: WASD runs, Shift sprints, Space jumps a little, mouse drag orbits
// the camera. In a car: W/S throttle and brake/reverse, A/D steering that
// tightens with speed, Space handbrake, E to steal or leave a car. The car
// model is arcade, not simulation: it accelerates, grips, drifts a touch on
// the handbrake and bumps over kerbs, which is what a screenshot chase needs.
// The camera is a springy chase camera that sits behind the player and
// swings wide in a turn, so traffic and police stay in frame.

import { clamp, angleDiff } from './rng.js';
import { WORLD } from './config.js';
import { isSea, clampToWorld, collideBuildings } from './world.js';
import { clampCarToWorld } from './traffic.js';

/** The player: Raka, his body and whichever car he is driving. */
export class Player {
  constructor(x, z, angle) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.angle = angle;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0; // forward speed on foot, m/s
    this.health = 100;
    this.armour = 0;
    this.money = 300000;
    this.car = null; // the stolen TrafficCar/ParkedCar being driven
    this.carSpeed = 0; // m/s, signed
    this.steer = 0;
    this.onGround = true;
    this.jumpV = 0;
    this.running = false;
    this.sprinting = false;
    this.nitro = false;
    this.nitroFuel = 100;
    this.camYaw = angle + Math.PI;    this.camPitch = 0.32;
    this.camDist = 9;
    this.camX = x;
    this.camY = 6;
    this.camZ = z;
  }

  /** True when Raka is driving a car. */
  get inCar() {
    return this.car !== null;
  }

  /** Current speed in km/h for the speedometer. */
  speedKmh() {
    if (this.car) return Math.abs(this.carSpeed) * 3.6;
    return Math.abs(this.speed) * 3.6;
  }

  /** Step on-foot movement from input axes. */
  stepOnFoot(dt, input, world) {
    const sprint = input.sprint ? 1.7 : 1;
    const maxSpeed = 4.2 * sprint;
    const accel = 22;
    // Movement is relative to the camera yaw.
    const fwdX = Math.sin(this.camYaw + Math.PI);
    const fwdZ = Math.cos(this.camYaw + Math.PI);
    const rightX = Math.sin(this.camYaw + Math.PI / 2);
    const rightZ = Math.cos(this.camYaw + Math.PI / 2);
    const mx = fwdX * input.moveY + rightX * input.moveX;
    const mz = fwdZ * input.moveY + rightZ * input.moveX;
    const ml = Math.sqrt(mx * mx + mz * mz) || 1;
    const wantX = (mx / ml) * maxSpeed * (input.moveX || input.moveY ? 1 : 0);
    const wantZ = (mz / ml) * maxSpeed * (input.moveX || input.moveY ? 1 : 0);
    this.vx += (wantX - this.vx) * Math.min(1, accel * dt / maxSpeed + 6 * dt);
    this.vz += (wantZ - this.vz) * Math.min(1, accel * dt / maxSpeed + 6 * dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    this.running = this.speed > 0.5;
    this.sprinting = input.sprint && this.running;
    if (this.running) {
      const wantAngle = Math.atan2(this.vx, this.vz);
      let diff = wantAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, 12 * dt);
    }
    // Jump: a small hop, gravity brings him back.
    if (input.jump && this.onGround) {
      this.jumpV = 5.2;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.jumpV -= 14 * dt;
      this.y += this.jumpV * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.jumpV = 0;
        this.onGround = true;
      }
    }
    // The sea stops him: waist-deep water at the beach edge.
    if (isSea(this.x, this.z)) {
      this.x -= this.vx * dt * 1.5;
      this.z -= this.vz * dt * 1.5;
    }
    const c = clampToWorld(this.x, this.z, 8);
    this.x = c.x;
    this.z = c.z;
    // Buildings are solid: slide along their walls instead of through them.
    if (world && world.buildings) {
      const col = collideBuildings(world.buildings, this.x, this.z, 0.6);
      this.x = col.x;
      this.z = col.z;
    }
  }

  /** Step driving from input axes. Arcade handling, tuned for feel. */
  stepDriving(dt, input, garage) {
    const car = this.car;
    if (!car) return;
    const model = car.model;
    const top = model.top * (this.nitro && this.nitroFuel > 0 ? 1.35 : 1) * (garage ? garage.topMultiplier() : 1);
    const accel = model.accel * (garage ? garage.accelMultiplier() : 1);
    const brakePower = garage && garage.brakesUpgraded ? 2.2 : 1.6;
    let throttle = 0;
    if (input.moveY > 0) throttle = 1;
    if (input.moveY < 0) throttle = this.carSpeed > 0.5 ? -brakePower : -0.55; // brake, then reverse
    this.carSpeed += throttle * accel * dt;
    // Drag and rolling resistance.
    this.carSpeed -= this.carSpeed * 0.35 * dt;
    if (!input.moveY) this.carSpeed -= this.carSpeed * 0.9 * dt;
    if (input.handbrake) {
      this.carSpeed -= this.carSpeed * 2.2 * dt;
    }
    this.carSpeed = clamp(this.carSpeed, -top * 0.45, top);
    // Steering: sharper at low speed, gentle at high speed.
    const steerTarget = -input.moveX * (0.55 + 1.1 / (1 + Math.abs(this.carSpeed) * 0.12));
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const turnRate = this.steer * clamp(Math.abs(this.carSpeed) / 8, 0, 1) * (this.carSpeed >= 0 ? 1 : -1);
    this.angle += turnRate * dt * (input.handbrake ? 1.6 : 1);
    const fx = Math.sin(this.angle);
    const fz = Math.cos(this.angle);
    this.x += fx * this.carSpeed * dt;
    this.z += fz * this.carSpeed * dt;
    car.x = this.x;
    car.z = this.z;
    car.angle = this.angle;
    car.speed = this.carSpeed;
    // Nitro drains while held, refills slowly.
    if (this.nitro && this.nitroFuel > 0 && input.moveY > 0) {
      this.nitroFuel = Math.max(0, this.nitroFuel - 30 * dt);
    } else {
      this.nitroFuel = Math.min(100, this.nitroFuel + 4 * dt);
    }
    clampCarToWorld(car);
    this.x = car.x;
    this.z = car.z;
  }

  /** Steal the nearest car: become its driver. Returns the car or null. */
  enterCar(car, stats) {
    if (!car) return null;
    this.car = car;
    this.carSpeed = 0;
    this.angle = car.angle;
    this.x = car.x;
    this.z = car.z;
    if (stats) stats.carsStolen += 1;
    return car;
  }

  /** Leave the car: step out beside it, the car stays where it is. */
  exitCar() {
    if (!this.car) return null;
    const car = this.car;
    car.speed = 0;
    this.car = null;
    this.carSpeed = 0;
    this.x = car.x + Math.sin(car.angle + Math.PI / 2) * 2.4;
    this.z = car.z + Math.cos(car.angle + Math.PI / 2) * 2.4;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    return car;
  }

  /** Take damage, armour absorbing first. Returns true when Raka goes down. */
  hurt(damage) {
    let rest = damage;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest * 0.7);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    this.lastHurtAt = 0;
    this.damageFlash = 1;
    if (this.health <= 0) {
      this.health = 0;
      return true;
    }
    return false;
  }

  /** Heal up to full health. */
  heal(amount) {
    this.health = Math.min(100, this.health + amount);
  }

  /**
   * Regeneration: after 8 seconds without damage, health creeps back at
   * 2 per second (never above 60 without food or a garage service). The
   * city is forgiving to a careful driver.
   */
  regen(dt) {
    this.lastHurtAt = (this.lastHurtAt || 0) + dt;
    this.damageFlash = Math.max(0, (this.damageFlash || 0) - dt * 2);
    if (this.lastHurtAt > 8 && this.health > 0 && this.health < 60) {
      this.health = Math.min(60, this.health + 2 * dt);
    }
  }

  /** Eat street food: instant health, costs money. */
  eatFood(cost, healAmount) {
    if (this.money < cost) return false;
    this.money -= cost;
    this.heal(healAmount);
    return true;
  }

  /** Buy armour from a street vendor (a rare sight, but they exist). */
  buyArmour(cost) {
    if (this.money < cost || this.armour >= 100) return false;
    this.money -= cost;
    this.armour = Math.min(100, this.armour + 50);
    return true;
  }

  /** Step the chase camera toward its ideal spot behind the player. */
  stepCamera(dt, input) {
    if (input.lookDX) this.camYaw += input.lookDX * 0.004;
    if (input.lookDY) this.camPitch = clamp(this.camPitch + input.lookDY * 0.002, 0.08, 0.9);
    // When moving, the camera settles behind the direction of travel.
    const movingAngle = this.car ? this.angle : this.angle;
    const behind = movingAngle + Math.PI;
    const diff = angleDiff(this.camYaw, behind);
    const follow = this.car ? 2.2 : 1.4;
    if (Math.abs(diff) > 0.05) this.camYaw += diff * Math.min(1, follow * dt);
    const dist = this.car ? 11 : 8.5;
    const height = this.car ? 4.6 : 3.6;
    const tx = this.x - Math.sin(this.camYaw) * dist;
    const ty = height + this.y;
    const tz = this.z - Math.cos(this.camYaw) * dist;
    const k = Math.min(1, 6 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camZ += (tz - this.camZ) * k;
    this.camDist = dist;
  }

  /** Camera eye and target for the renderer. */
  cameraEye() {
    return [this.camX, this.camY, this.camZ];
  }

  cameraTarget() {
    return [this.x, 1.6 + this.y, this.z];
  }
}
