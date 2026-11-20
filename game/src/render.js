// render.js — The custom WebGL2 engine of Tanjung Matahari.
// No library, no textures, no assets: one shader, one dynamic vertex
// buffer, and a box-soup builder that draws the whole city every frame —
// ground and roads, buildings with lit windows, cars, pedestrians, palms,
// boats, lamps, the helicopter, rain and the mission beam. Colours are
// per-vertex; the shader adds a sun lambert term, an ambient term and
// distance fog from the weather palette. The camera is a standard
// perspective look-at. Everything the game draws goes through here, so a
// screenshot is always a true render of the live world.

import { matPerspective, matLookAt, matMultiply, hexRgb, shade, mixRgb, hash2 } from './math3.js';
import { WORLD } from './config.js';
import { paletteForHour, sunDirection, isNight } from './weather.js';
import { GARAGE_POS } from './garage.js';

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uSunDir;
uniform float uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
out vec3 vColor;
out float vFog;
void main() {
  vec4 world = vec4(aPos, 1.0);
  vec4 view = uView * world;
  gl_Position = uProj * view;
  float diff = max(dot(normalize(aNormal), normalize(uSunDir)), 0.0);
  float light = uAmbient + (1.0 - uAmbient) * diff;
  vColor = aColor * light;
  float dist = -view.z;
  vFog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in float vFog;
uniform vec3 uFogColor;
out vec4 outColor;
void main() {
  vec3 c = mix(vColor, uFogColor, vFog);
  outColor = vec4(c, 1.0);
}
`;

/** Compile a shader, throwing a readable error on failure. */
function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

/** A growing triangle soup: positions, normals and colours. */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  clear() {
    this.pos.length = 0;
    this.nor.length = 0;
    this.col.length = 0;
  }

  get triCount() {
    return this.pos.length / 9;
  }

  /** Push one triangle (3 corners, one normal, one colour). */
  tri(a, b, c, n, color) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i += 1) this.nor.push(n[0], n[1], n[2]);
    for (let i = 0; i < 3; i += 1) this.col.push(color[0], color[1], color[2]);
  }

  /** Push a quad as two triangles. Corners must wind counter-clockwise. */
  quad(a, b, c, d, n, color) {
    this.tri(a, b, c, n, color);
    this.tri(a, c, d, n, color);
  }

  /**
   * Push an axis-aligned box centred at (cx, cy, cz) with size (sx, sy, sz),
   * optionally rotated about Y by ry. cy is the centre height.
   */
  box(cx, cy, cz, sx, sy, sz, color, ry) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const cos = Math.cos(ry || 0);
    const sin = Math.sin(ry || 0);
    const rot = (x, z) => [cx + x * cos + z * sin, cz - x * sin + z * cos];
    const corners = [];
    for (const [lx, ly, lz] of [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
      [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz],
    ]) {
      const [rx, rz] = rot(lx, lz);
      corners.push([rx, cy + ly, rz]);
    }
    const [b0, b1, b2, b3, t0, t1, t2, t3] = corners;
    const up = [0, 1, 0];
    const down = [0, -1, 0];
    const north = [0, 0, -1];
    const south = [0, 0, 1];
    const east = [1, 0, 0];
    const west = [-1, 0, 0];
    this.quad(t0, t1, t2, t3, up, color);
    this.quad(b3, b2, b1, b0, down, color);
    this.quad(b0, b1, t1, t0, north, shade(color, 0.92));
    this.quad(b2, b3, t3, t2, south, shade(color, 0.85));
    this.quad(b1, b2, t2, t1, east, shade(color, 0.78));
    this.quad(b3, b0, t0, t3, west, shade(color, 0.78));
  }

  /** A flat quad on the ground at height y (normal up). */
  groundQuad(x0, z0, x1, z1, y, color) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], color);
  }

  /** A vertical quad facing +z (a wall, a sign, a window band). */
  wallQuad(x, y0, z, w, h, color, ry) {
    const cos = Math.cos(ry || 0);
    const sin = Math.sin(ry || 0);
    const hw = w / 2;
    const pts = [[-hw, y0, 0], [hw, y0, 0], [hw, y0 + h, 0], [-hw, y0 + h, 0]].map(([lx, ly, lz]) => [
      x + lx * cos + lz * sin, ly, z - lx * sin + lz * cos,
    ]);
    this.quad(pts[0], pts[1], pts[2], pts[3], [Math.sin(ry || 0), 0, Math.cos(ry || 0)], color);
  }
}

/** The renderer: owns the GL context, the shader and the frame. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
    if (!this.gl) throw new Error('WebGL2 is not available');
    const gl = this.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this.prog = gl.createProgram();
    gl.attachShader(this.prog, vs);
    gl.attachShader(this.prog, fs);
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error('program: ' + gl.getProgramInfoLog(this.prog));
    }
    this.uProj = gl.getUniformLocation(this.prog, 'uProj');
    this.uView = gl.getUniformLocation(this.prog, 'uView');
    this.uSunDir = gl.getUniformLocation(this.prog, 'uSunDir');
    this.uAmbient = gl.getUniformLocation(this.prog, 'uAmbient');
    this.uFogColor = gl.getUniformLocation(this.prog, 'uFogColor');
    this.uFogNear = gl.getUniformLocation(this.prog, 'uFogNear');
    this.uFogFar = gl.getUniformLocation(this.prog, 'uFogFar');
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.builder = new MeshBuilder();
    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.time = 0;
    this.drawnTris = 0;
    // Stars: fixed positions on the sky dome, from a seeded hash.
    this.stars = [];
    for (let i = 0; i < 90; i += 1) {
      const a = hash2(i, 7) * Math.PI * 2;
      const r = 380 + hash2(i, 13) * 60;
      const y = 120 + hash2(i, 29) * 220;
      this.stars.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, s: 1.5 + hash2(i, 41) * 2.5 });
    }
  }

  /** Resize the canvas to its display size. */
  resize() {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 720;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Upload the builder's triangles and draw them. */
  flush() {
    const gl = this.gl;
    const b = this.builder;
    const n = b.pos.length / 3;
    if (n === 0) return;
    const data = new Float32Array(n * 9);
    for (let i = 0; i < n; i += 1) {
      data[i * 9] = b.pos[i * 3];
      data[i * 9 + 1] = b.pos[i * 3 + 1];
      data[i * 9 + 2] = b.pos[i * 3 + 2];
      data[i * 9 + 3] = b.nor[i * 3];
      data[i * 9 + 4] = b.nor[i * 3 + 1];
      data[i * 9 + 5] = b.nor[i * 3 + 2];
      data[i * 9 + 6] = b.col[i * 3];
      data[i * 9 + 7] = b.col[i * 3 + 1];
      data[i * 9 + 8] = b.col[i * 3 + 2];
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    this.drawnTris += n / 3;
  }

  /** Render one frame of the live game. */
  render(game, eye, target, dt) {
    const gl = this.gl;
    this.time += dt;
    this.resize();
    const b = this.builder;
    b.clear();
    this.drawnTris = 0;
    const pal = game.weather.palette();
    const night = game.weather.night;
    const sunDir = sunDirection(game.weather.hour);
    gl.clearColor(pal.top[0], pal.top[1], pal.top[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog);
    matPerspective(this.proj, 1.15, this.canvas.width / this.canvas.height, 0.5, 900);
    matLookAt(this.view, eye, target, [0, 1, 0]);
    gl.uniformMatrix4fv(this.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.uView, false, this.view);
    gl.uniform3fv(this.uSunDir, sunDir);
    gl.uniform1f(this.uAmbient, pal.ambient);
    gl.uniform3fv(this.uFogColor, pal.fog);
    const fog = game.weather.fogRange();
    gl.uniform1f(this.uFogNear, fog.near);
    gl.uniform1f(this.uFogFar, fog.far);

    const px = game.player.x;
    const pz = game.player.z;
    this.drawGround(game, pal, night);
    this.drawCity(game, pal, night, px, pz);
    this.drawProps(game, px, pz);
    this.drawTraffic(game, night);
    this.drawCrowd(game);
    this.drawPlayer(game, night);
    this.drawPolice(game, night);
    this.drawKeris(game);
    this.drawAmmo(game);
    this.drawMarker(game);
    this.drawRace(game);
    this.drawBoats(game);
    this.drawSkyExtras(game, pal);
    this.drawRain(game, px, pz);
    this.drawTracers(game);
    this.drawEffects(game);
    this.flush();
  }

  /** Street props: market stalls, food carts, benches and billboards. */
  drawProps(game, px, pz) {
    const b = this.builder;
    for (const s of game.world.stalls) {
      const dx = s.x - px;
      const dz = s.z - pz;
      if (dx * dx + dz * dz > 200 * 200) continue;
      const col = hexRgb(s.colour);
      b.box(s.x, 0.9, s.z, 3.2, 1.8, 2.2, hexRgb('#7a5a3a'), s.angle);
      b.box(s.x, 2.1, s.z, 3.8, 0.25, 2.8, col, s.angle);
      b.box(s.x, 1.3, s.z, 2.8, 0.2, 1.8, hexRgb('#e8d8b8'), s.angle);
    }
    for (const c of game.world.carts) {
      const dx = c.x - px;
      const dz = c.z - pz;
      if (dx * dx + dz * dz > 200 * 200) continue;
      b.box(c.x, 0.8, c.z, 1.8, 1.2, 1.2, hexRgb(c.stall.colour), c.angle);
      b.box(c.x, 1.6, c.z, 2.2, 0.2, 1.6, hexRgb('#e8e8e8'), c.angle);
      b.box(c.x - 0.7, 0.3, c.z + 0.5, 0.3, 0.6, 0.3, hexRgb('#141414'), c.angle);
      b.box(c.x + 0.7, 0.3, c.z + 0.5, 0.3, 0.6, 0.3, hexRgb('#141414'), c.angle);
    }
    for (const bench of game.world.benches) {
      const dx = bench.x - px;
      const dz = bench.z - pz;
      if (dx * dx + dz * dz > 180 * 180) continue;
      b.box(bench.x, 0.55, bench.z, 2.2, 0.18, 0.7, hexRgb('#7a5a3a'), bench.angle);
      b.box(bench.x, 0.9, bench.z - 0.3, 2.2, 0.7, 0.15, hexRgb('#7a5a3a'), bench.angle);
      b.box(bench.x - 0.9, 0.25, bench.z, 0.15, 0.5, 0.6, hexRgb('#3a3a3a'), bench.angle);
      b.box(bench.x + 0.9, 0.25, bench.z, 0.15, 0.5, 0.6, hexRgb('#3a3a3a'), bench.angle);
    }
    for (const board of game.world.billboards) {
      const dx = board.x - px;
      const dz = board.z - pz;
      if (dx * dx + dz * dz > 260 * 260) continue;
      b.box(board.x - 4, 4, board.z, 0.5, 8, 0.5, hexRgb('#3a3a3a'), 0);
      b.box(board.x + 4, 4, board.z, 0.5, 8, 0.5, hexRgb('#3a3a3a'), 0);
      b.box(board.x, 8.5, board.z, 11, 3.4, 0.4, hexRgb(board.colour), 0);
      b.box(board.x, 8.5, board.z, 10.2, 0.7, 0.45, hexRgb('#1a1a1a'), 0);
    }
  }

  /** Particles and skid marks from the effects system. */
  drawEffects(game) {
    const b = this.builder;
    const fx = game.effects;
    if (!fx) return;
    for (const s of fx.skids) {
      const fade = Math.max(0.25, s.life / 60);
      const col = [0.08 * fade + 0.02, 0.08 * fade + 0.02, 0.08 * fade + 0.02];
      b.box(s.x, 0.14, s.z, 0.5, 0.02, s.length, col, s.angle);
    }
    for (const p of fx.particles) {
      const f = p.fade();
      const col = hexRgb(p.colour);
      const bright = 0.55 + 0.45 * f;
      b.box(p.x, p.y, p.z, p.size, p.size, p.size, [col[0] * bright, col[1] * bright, col[2] * bright], 0);
    }
  }

  /** Ground: grass, roads with dashes, sidewalks, beach and sea. */
  drawGround(game, pal, night) {
    const b = this.builder;
    const H = WORLD.half;
    // City grass / concrete base.
    b.groundQuad(-H, -H, H, WORLD.beachZ - 28, 0, hexRgb('#5a7a4a'));
    // Beach sand sits slightly below the grass so the beach road's asphalt
    // (y 0.08) always wins the depth test over it.
    b.groundQuad(-H, WORLD.beachZ - 28, H, WORLD.beachZ, -0.05, hexRgb('#e8c37a'));
    // Sea.
    const seaCol = night ? hexRgb('#0a2438') : hexRgb('#1e6f9a');
    b.groundQuad(-H, WORLD.beachZ, H, WORLD.beachZ + 60, -0.02, seaCol);
    // Roads: asphalt strips along every grid line, with sidewalks.
    const asphalt = hexRgb('#2e2e34');
    const sidewalk = hexRgb('#9a9a92');
    const dash = hexRgb('#e8c33c');
    for (const line of game.worldRoads) {
      b.groundQuad(-H, line - 7, H, line + 7, 0.08, asphalt);
      b.groundQuad(line - 7, -H, line + 7, WORLD.beachZ - 28, 0.08, asphalt);
      b.groundQuad(-H, line - 10, H, line - 7, 0.09, sidewalk);
      b.groundQuad(-H, line + 7, H, line + 10, 0.09, sidewalk);
      b.groundQuad(line - 10, -H, line - 7, WORLD.beachZ - 28, 0.09, sidewalk);
      b.groundQuad(line + 7, -H, line + 10, WORLD.beachZ - 28, 0.09, sidewalk);
      // Centre dashes.
      for (let d = -H + 8; d < H; d += 16) {
        b.groundQuad(d, line - 0.3, d + 5, line + 0.3, 0.12, dash);
        b.groundQuad(line - 0.3, d, line + 0.3, d + 5, 0.12, dash);
      }
    }
    // Park green in the centre.
    b.groundQuad(-56, 28, 8, 92, 0.06, hexRgb('#4a7a3a'));
  }

  /** Buildings, palms, lamps and traffic lights. */
  drawCity(game, pal, night, px, pz) {
    const b = this.builder;
    const winLit = night ? hexRgb('#ffd97a') : hexRgb('#2a3a4a');
    const winDark = hexRgb('#24303e');
    for (const bd of game.world.buildings) {
      const dx = bd.x - px;
      const dz = bd.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 280 * 280) continue;
      const col = hexRgb(bd.colour);
      b.box(bd.x, bd.h / 2, bd.z, bd.w, bd.h, bd.d, col, 0);
      // Roof cap.
      b.box(bd.x, bd.h + 0.3, bd.z, bd.w * 0.9, 0.6, bd.d * 0.9, hexRgb(bd.roof), 0);
      if (bd.kind === 'mosque') {
        b.box(bd.x - 8, bd.h + 4, bd.z - 6, 3, 8, 3, hexRgb('#f0f0e8'), 0);
        b.box(bd.x + 8, bd.h + 4, bd.z - 6, 3, 8, 3, hexRgb('#f0f0e8'), 0);
      }
      if (bd.kind === 'tower-clock') {
        b.box(bd.x, bd.h + 3, bd.z, 11, 3, 11, hexRgb('#d8c9a3'), 0);
      }
      // Window bands on the two long faces, only when near.
      if (d2 < 170 * 170) {
        const floors = Math.max(1, Math.floor(bd.h / 3.4));
        for (let f = 0; f < floors; f += 1) {
          const y = 2.2 + f * 3.4;
          if (y > bd.h - 1) break;
          const lit = bd.lit && (f % 2 === 0 || night);
          const wc = lit ? winLit : winDark;
          b.wallQuad(bd.x, y, bd.z - bd.d / 2 - 0.06, bd.w * 0.7, 1.1, wc, 0);
          b.wallQuad(bd.x, y, bd.z + bd.d / 2 + 0.06, bd.w * 0.7, 1.1, wc, Math.PI);
        }
      }
    }
    // Palms: trunk + crossed leaf quads.
    for (const palm of game.world.palms) {
      const dx = palm.x - px;
      const dz = palm.z - pz;
      if (dx * dx + dz * dz > 220 * 220) continue;
      b.box(palm.x, palm.h / 2, palm.z, 0.5, palm.h, 0.5, hexRgb('#7a5a3a'), palm.lean);
      const ly = palm.h + 0.6;
      const leaf = hexRgb('#2e7a2e');
      b.box(palm.x, ly, palm.z, 4.4, 0.25, 1.2, leaf, 0.4);
      b.box(palm.x, ly + 0.2, palm.z, 1.2, 0.25, 4.4, shade(leaf, 0.85), -0.3);
    }
    // Street lamps: pole + glowing head at night.
    for (const lamp of game.world.lamps) {
      const dx = lamp.x - px;
      const dz = lamp.z - pz;
      if (dx * dx + dz * dz > 200 * 200) continue;
      b.box(lamp.x, 2.8, lamp.z, 0.25, 5.6, 0.25, hexRgb('#3a3a42'), 0);
      const head = night ? hexRgb('#ffe9a8') : hexRgb('#8a8a7a');
      b.box(lamp.x, 5.7, lamp.z, 0.9, 0.35, 0.9, head, 0);
      if (night) b.groundQuad(lamp.x - 3, lamp.z - 3, lamp.x + 3, lamp.z + 3, 0.13, hexRgb('#6a5a30'));
    }
    // Traffic lights.
    for (const light of game.world.lights) {
      b.box(light.x, 2.4, light.z, 0.3, 4.8, 0.3, hexRgb('#2a2a2a'), 0);
      const green = light.phase === 0 || light.phase === 2;
      const red = hexRgb(green ? '#3a1a1a' : '#e81e1e');
      const grn = hexRgb(green ? '#1ee81e' : '#1a3a1a');
      b.box(light.x, 4.6, light.z + 0.4, 0.7, 0.7, 0.3, red, 0);
      b.box(light.x, 3.7, light.z + 0.4, 0.7, 0.7, 0.3, grn, 0);
    }
    // Garage yard: a painted rectangle and a sign post.
    b.groundQuad(GARAGE_POS.x - 12, GARAGE_POS.z - 10, GARAGE_POS.x + 12, GARAGE_POS.z + 10, 0.1, hexRgb('#5a4a3a'));
    b.box(GARAGE_POS.x - 11, 3, GARAGE_POS.z - 9, 0.3, 6, 0.3, hexRgb('#3a3a42'), 0);
    b.box(GARAGE_POS.x - 11, 6.2, GARAGE_POS.z - 9, 4, 1.2, 0.2, hexRgb('#e8b73c'), 0);
  }

  /** Traffic cars, parked cars and the player's stolen car is drawn by drawPlayer. */
  drawTraffic(game, night) {
    const b = this.builder;
    const drawCar = (car, isPolice) => {
      const col = isPolice ? hexRgb('#e8e8e8') : hexRgb(car.colour);
      const y = 0.55;
      const fx0 = Math.sin(car.angle);
      const fz0 = Math.cos(car.angle);
      b.box(car.x, y, car.z, 2.1, 0.75, 4.4, col, car.angle);
      // Cabin sits slightly toward the rear of the car, along its forward axis.
      b.box(car.x - fx0 * 0.2, y + 0.65, car.z - fz0 * 0.2, 1.8, 0.6, 2.2, hexRgb('#1a2530'), car.angle);
      const wheel = hexRgb('#141414');
      const fx = fx0;
      const fz = fz0;
      const rx = Math.cos(car.angle);
      const rz = -Math.sin(car.angle);
      for (const [along, side] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
        b.box(car.x + fx * along + rx * side * 1.0, 0.35, car.z + fz * along + rz * side * 1.0, 0.35, 0.7, 0.7, wheel, car.angle);
      }
      if (isPolice) {
        b.box(car.x, y + 0.1, car.z, 2.14, 0.3, 4.42, hexRgb('#1e5dc8'), car.angle);
        const flash = Math.sin(this.time * 8) > 0 ? hexRgb('#e81e1e') : hexRgb('#1e5dc8');
        b.box(car.x, y + 1.15, car.z - 0.2, 1.2, 0.3, 0.5, flash, car.angle);
      }
      if (night) {
        // Headlight cones on the ground ahead.
        const hx = car.x + fx * 7;
        const hz = car.z + fz * 7;
        b.groundQuad(hx - 2, hz - 3, hx + 2, hz + 3, 0.11, hexRgb('#5a5230'));
      }
    };
    for (const car of game.traffic.cars) {
      if (car.stolen) continue;
      drawCar(car, false);
    }
    for (const car of game.traffic.parked) {
      if (car.stolen) continue;
      drawCar(car, false);
    }
    // Race rivals.
    if (game.races.active) {
      for (const r of game.races.active.rivals) {
        drawCar({ x: r.x, z: r.z, angle: r.angle, colour: r.colour }, false);
      }
    }
  }

  /** Pedestrians and guards, with swinging legs. */
  drawCrowd(game) {
    const b = this.builder;
    const px = game.player.x;
    const pz = game.player.z;
    for (const p of game.crowd.list) {
      const dx = p.x - px;
      const dz = p.z - pz;
      if (dx * dx + dz * dz > 190 * 190) continue;
      if (p.state === 'down') {
        // Lying flat.
        b.box(p.x, 0.3, p.z, 0.6, 0.5, 1.7, hexRgb(p.shirt), p.angle);
        b.box(p.x, 0.3, p.z + 1.0, 0.45, 0.45, 0.45, hexRgb(p.skin), p.angle);
        continue;
      }
      if (p.state === 'sit') {
        // Sitting: torso lower, legs folded forward.
        b.box(p.x, 0.35, p.z, 0.62, 0.7, 0.4, hexRgb(p.shirt), p.angle);
        b.box(p.x, 0.85, p.z, 0.42, 0.42, 0.42, hexRgb(p.skin), p.angle);
        const fx = Math.sin(p.angle);
        const fz = Math.cos(p.angle);
        b.box(p.x + fx * 0.5, 0.25, p.z + fz * 0.5, 0.24, 0.4, 0.7, hexRgb(p.pants), p.angle);
        continue;
      }
      const swing = Math.sin(p.walkPhase) * 0.35;
      const fx = Math.sin(p.angle);
      const fz = Math.cos(p.angle);
      const rx = Math.cos(p.angle);
      const rz = -Math.sin(p.angle);
      // Legs.
      b.box(p.x + fx * swing + rx * 0.16, 0.45, p.z + fz * swing + rz * 0.16, 0.24, 0.9, 0.24, hexRgb(p.pants), p.angle);
      b.box(p.x - fx * swing - rx * 0.16, 0.45, p.z - fz * swing - rz * 0.16, 0.24, 0.9, 0.24, hexRgb(p.pants), p.angle);
      // Torso + head.
      b.box(p.x, 1.25, p.z, 0.62, 0.85, 0.4, hexRgb(p.shirt), p.angle);
      b.box(p.x, 1.95, p.z, 0.42, 0.42, 0.42, hexRgb(p.skin), p.angle);
      if (p.guard) {
        b.box(p.x, 2.2, p.z, 0.5, 0.16, 0.5, hexRgb('#0a0a0a'), p.angle);
        // Guard holds a baton.
        b.box(p.x + rx * 0.4, 1.3, p.z + rz * 0.4, 0.12, 0.9, 0.12, hexRgb('#3a3a3a'), p.angle);
      }
      if (p.state === 'phone') {
        // A phone glowing in their hand.
        b.box(p.x + fx * 0.35, 1.35, p.z + fz * 0.35, 0.16, 0.28, 0.06, hexRgb('#9ad8ff'), p.angle);
      }
      if (p.state === 'vend') {
        // Vendors wave a small flag over their stall.
        b.box(p.x, 2.5 + Math.sin(this.time * 3 + p.id) * 0.15, p.z, 0.7, 0.45, 0.06, hexRgb('#e8b73c'), p.angle);
      }
    }
  }

  /** Raka on foot, or his car when driving. */
  drawPlayer(game, night) {
    const b = this.builder;
    const p = game.player;
    if (p.car) {
      const car = p.car;
      const col = hexRgb(car.colour);
      const fx0 = Math.sin(car.angle);
      const fz0 = Math.cos(car.angle);
      b.box(car.x, 0.55, car.z, 2.1, 0.75, 4.4, col, car.angle);
      b.box(car.x - fx0 * 0.2, 1.2, car.z - fz0 * 0.2, 1.8, 0.6, 2.2, hexRgb('#1a2530'), car.angle);
      const wheel = hexRgb('#141414');
      const fx = fx0;
      const fz = fz0;
      const rx = Math.cos(car.angle);
      const rz = -Math.sin(car.angle);
      for (const [along, side] of [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]]) {
        b.box(car.x + fx * along + rx * side, 0.35, car.z + fz * along + rz * side, 0.35, 0.7, 0.7, wheel, car.angle);
      }
      // Raka's head visible in the cabin + nitro flame.
      b.box(car.x - fx * 0.3, 1.45, car.z - fz * 0.3, 0.4, 0.4, 0.4, hexRgb('#c89a6a'), car.angle);
      if (p.nitro && p.nitroFuel > 0 && Math.abs(p.carSpeed) > 5) {
        const bx = car.x - fx * 2.4;
        const bz = car.z - fz * 2.4;
        b.box(bx, 0.5, bz, 0.5, 0.5, 1.2, hexRgb('#3aa8ff'), car.angle);
      }
      if (night) {
        const hx = car.x + fx * 8;
        const hz = car.z + fz * 8;
        b.groundQuad(hx - 2.5, hz - 3.5, hx + 2.5, hz + 3.5, 0.11, hexRgb('#6a6238'));
      }
      return;
    }
    // On foot: yellow jacket, dark trousers, cap.
    const runSwing = p.running ? Math.sin(this.time * 9) * 0.3 : 0;
    const fx = Math.sin(p.angle);
    const fz = Math.cos(p.angle);
    b.box(p.x - fx * runSwing, 0.45 + p.y, p.z - fz * runSwing, 0.26, 0.9, 0.26, hexRgb('#2a2a3a'), p.angle);
    b.box(p.x + fx * runSwing, 0.45 + p.y, p.z + fz * runSwing, 0.26, 0.9, 0.26, hexRgb('#2a2a3a'), p.angle);
    b.box(p.x, 1.3 + p.y, p.z, 0.7, 0.9, 0.45, hexRgb('#e8b73c'), p.angle);
    b.box(p.x, 2.0 + p.y, p.z, 0.44, 0.44, 0.44, hexRgb('#c89a6a'), p.angle);
    b.box(p.x, 2.24 + p.y, p.z, 0.5, 0.16, 0.5, hexRgb('#c81e1e'), p.angle);
    if (game.combat.muzzle > 0) {
      const mx = p.x + Math.sin(p.angle) * 1.2;
      const mz = p.z + Math.cos(p.angle) * 1.2;
      b.box(mx, 1.5 + p.y, mz, 0.5, 0.5, 0.5, hexRgb('#ffe9a8'), p.angle);
    }
  }

  /** Police cars, helicopter and roadblocks. */
  drawPolice(game, night) {
    const b = this.builder;
    for (const unit of game.police.units) {
      const col = hexRgb('#e8e8e8');
      const ufx = Math.sin(unit.angle);
      const ufz = Math.cos(unit.angle);
      b.box(unit.x, 0.55, unit.z, 2.1, 0.75, 4.4, col, unit.angle);
      b.box(unit.x - ufx * 0.2, 1.2, unit.z - ufz * 0.2, 1.8, 0.6, 2.2, hexRgb('#1a2530'), unit.angle);
      b.box(unit.x, 0.65, unit.z, 2.14, 0.3, 4.42, hexRgb('#1e5dc8'), unit.angle);
      const flash = Math.sin(this.time * 9 + unit.x) > 0 ? hexRgb('#e81e1e') : hexRgb('#1e5dc8');
      b.box(unit.x - ufx * 0.2, 1.7, unit.z - ufz * 0.2, 1.2, 0.3, 0.5, flash, unit.angle);
    }
    const heli = game.police.heli;
    if (heli) {
      // White police livery with a blue stripe: readable against the sky.
      b.box(heli.x, heli.y, heli.z, 3.2, 1.6, 5.2, hexRgb('#e8eef4'), 0);
      b.box(heli.x, heli.y - 0.3, heli.z, 3.24, 0.5, 5.24, hexRgb('#1e5dc8'), 0);
      b.box(heli.x, heli.y + 0.2, heli.z - 4, 0.8, 0.8, 4.5, hexRgb('#1a2a3a'), 0);
      const rx = Math.cos(heli.rotor);
      const rz = Math.sin(heli.rotor);
      b.box(heli.x + rx * 3.4, heli.y + 1.1, heli.z + rz * 3.4, 7, 0.12, 0.4, hexRgb('#c8c8c8'), heli.rotor);
      b.box(heli.x, heli.y - 1.2, heli.z, 2.4, 0.3, 1.2, hexRgb('#3a3a3a'), 0);
      // Red POLISI marking on the side, as a small bright block.
      b.box(heli.x, heli.y + 0.5, heli.z, 3.3, 0.4, 2.0, hexRgb('#e81e1e'), 0);
      if (heli.searchlight) {
        b.groundQuad(heli.x - 4, heli.z - 4, heli.x + 4, heli.z + 4, 0.14, hexRgb('#8a8050'));
      }
    }
    for (const rb of game.police.roadblocks) {
      b.box(rb.x, 0.55, rb.z, 2.1, 0.75, 4.4, hexRgb('#e8e8e8'), rb.angle);
      b.box(rb.x + 6, 0.55, rb.z, 2.1, 0.75, 4.4, hexRgb('#e8e8e8'), rb.angle);
      b.box(rb.x + 3, 1.0, rb.z, 1.0, 1.0, 0.5, hexRgb('#e8b73c'), rb.angle);
    }
    for (const strip of game.police.spikes) {
      if (strip.used) continue;
      b.box(strip.x, 0.2, strip.z, 3.4, 0.25, 0.5, hexRgb('#1a1a1a'), strip.angle);
      for (let i = -1; i <= 1; i += 1) {
        b.box(strip.x + i * 1.1, 0.45, strip.z, 0.25, 0.5, 0.25, hexRgb('#c8c8c8'), strip.angle);
      }
    }
  }

  /** Golden keris collectibles, spinning and glowing. */
  drawKeris(game) {
    const b = this.builder;
    const px = game.player.x;
    const pz = game.player.z;
    for (const k of game.world.keris) {
      if (k.found) continue;
      const dx = k.x - px;
      const dz = k.z - pz;
      if (dx * dx + dz * dz > 200 * 200) continue;
      const spin = this.time * 1.5 + k.x;
      b.box(k.x, 1.1, k.z, 0.28, 1.4, 0.28, hexRgb('#ffd94a'), spin);
      b.box(k.x, 1.1, k.z, 0.9, 0.28, 0.28, hexRgb('#ffd94a'), spin);
      b.groundQuad(k.x - 1.2, k.z - 1.2, k.x + 1.2, k.z + 1.2, 0.13, hexRgb('#8a7030'));
    }
  }

  /** Ammo pickups: small green boxes that bob and glow. */
  drawAmmo(game) {
    const b = this.builder;
    if (!game.ammoPickups) return;
    const px = game.player.x;
    const pz = game.player.z;
    for (const a of game.ammoPickups.list) {
      if (a.taken) continue;
      const dx = a.x - px;
      const dz = a.z - pz;
      if (dx * dx + dz * dz > 180 * 180) continue;
      const bob = Math.sin(a.bob) * 0.15;
      const col = a.kind === 'shotgun' ? hexRgb('#e81e1e') : hexRgb('#2ee86a');
      b.box(a.x, 0.7 + bob, a.z, 0.7, 0.5, 0.7, col, 0);
      b.box(a.x, 1.1 + bob, a.z, 0.4, 0.3, 0.4, hexRgb('#e8e8e8'), 0);
    }
  }

  /** The mission marker: a tall beam and a floating diamond. */
  drawMarker(game) {
    const b = this.builder;
    const m = game.missions.marker;
    if (!m) return;
    const bob = Math.sin(this.time * 2) * 0.4;
    b.box(m.x, 12, m.z, 1.2, 24, 1.2, hexRgb('#ffe93c'), 0);
    b.box(m.x, 5 + bob, m.z, 1.4, 1.4, 1.4, hexRgb('#ffd94a'), this.time);
    b.groundQuad(m.x - 4, m.z - 4, m.x + 4, m.z + 4, 0.13, hexRgb('#8a7030'));
  }

  /** Race checkpoint gates. */
  drawRace(game) {
    const b = this.builder;
    const race = game.races.active;
    if (!race) return;
    const cp = race.nextCheckpoint();
    if (!cp) return;
    const [x, z] = cp;
    const gate = hexRgb('#2ee86a');
    b.box(x - 5, 3, z, 0.5, 6, 0.5, gate, 0);
    b.box(x + 5, 3, z, 0.5, 6, 0.5, gate, 0);
    b.box(x, 5.8, z, 10.5, 0.6, 0.6, gate, 0);
    b.groundQuad(x - 5, z - 2, x + 5, z + 2, 0.13, hexRgb('#1a5a30'));
  }

  /** Boats in the harbour and at sea, bobbing. */
  drawBoats(game) {
    const b = this.builder;
    for (const boat of game.world.boats) {
      const bob = Math.sin(this.time * 0.8 + boat.x) * 0.25;
      const col = hexRgb(boat.colour);
      if (boat.kind === 'ferry') {
        b.box(boat.x, 1.2 + bob, boat.z, 6, 2.4, 14, hexRgb('#e8e8e8'), boat.angle);
        b.box(boat.x, 3.0 + bob, boat.z, 5, 1.8, 10, col, boat.angle);
      } else if (boat.kind === 'speed') {
        b.box(boat.x, 0.9 + bob, boat.z, 2.2, 1.2, 6, col, boat.angle);
      } else {
        b.box(boat.x, 1.0 + bob, boat.z, 2.6, 1.4, 7, col, boat.angle);
        b.box(boat.x, 2.4 + bob, boat.z - 1, 0.25, 3.2, 0.25, hexRgb('#7a5a3a'), boat.angle);
        b.box(boat.x, 3.4 + bob, boat.z - 1, 0.2, 1.6, 1.8, hexRgb('#e8e8d8'), boat.angle);
      }
    }
  }

  /** Sun disc, moon and drifting clouds. */
  drawSkyExtras(game, pal) {
    const b = this.builder;
    const eye = game.player.cameraEye();
    const dir = sunDirection(game.weather.hour);
    const sx = eye[0] + dir[0] * 420;
    const sy = 60 + dir[1] * 220;
    const sz = eye[2] + dir[2] * 420;
    const sunCol = game.weather.night ? hexRgb('#d8d8e8') : pal.sun;
    // A big flat quad facing the camera, high in the sky.
    const yaw = Math.atan2(eye[0] - sx, eye[2] - sz);
    b.wallQuad(sx, sy - 14, sz, 34, 34, sunCol, yaw);
    // Stars at night, fixed to the world so they never move with the camera.
    if (game.weather.night) {
      const twinkle = 0.7 + 0.3 * Math.sin(this.time * 2);
      for (const st of this.stars) {
        const sx2 = eye[0] + st.x;
        const sz2 = eye[2] + st.z;
        b.box(sx2, st.y, sz2, st.s, st.s, st.s, [0.9 * twinkle, 0.9 * twinkle, 1.0 * twinkle], 0);
      }
      // The moon: a pale disc opposite the sun.
      const mx = eye[0] - dir[0] * 400;
      const my = 150 + dir[1] * 120;
      const mz = eye[2] - dir[2] * 400;
      const myaw = Math.atan2(eye[0] - mx, eye[2] - mz);
      b.wallQuad(mx, my - 9, mz, 18, 18, hexRgb('#e8e8d8'), myaw);
    }
    for (const c of game.weather.clouds) {
      const cc = game.weather.raining ? hexRgb('#6a6a72') : hexRgb('#f0f0f0');
      b.box(c.x, 70, c.z, c.s, 2, c.s * 0.5, cc, 0);
    }
  }

  /** Rain streaks around the player. */
  drawRain(game, px, pz) {
    const b = this.builder;
    if (game.weather.rainAmount < 0.05) return;
    const col = hexRgb('#9ab8d8');
    for (const d of game.weather.drops) {
      const rx = px + (d.x - px) * 0.4;
      const rz = pz + (d.z - pz) * 0.4;
      b.box(rx, d.y, rz, 0.06, 1.4, 0.06, col, 0);
    }
  }

  /** Bullet tracers: thin bright boxes along each shot line. */
  drawTracers(game) {    const b = this.builder;
    for (const t of game.combat.tracers) {
      const dx = t.x2 - t.x1;
      const dz = t.z2 - t.z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.5) continue;
      const mx = (t.x1 + t.x2) / 2;
      const mz = (t.z1 + t.z2) / 2;
      const yaw = Math.atan2(dx, dz);
      b.box(mx, t.y1, mz, 0.12, 0.12, len, hexRgb('#ffe9a8'), yaw);
    }
  }
}
