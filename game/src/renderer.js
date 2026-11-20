// renderer.js — a compact from-scratch WebGL renderer for Tanjung Matahari.
// No libraries. One shader, vertex-lit coloured boxes: the whole city is a
// single static mesh, and everything that moves (player, cars, peds, heli)
// is drawn as boxes pushed into a dynamic buffer each frame.

import { mat4Compose, mat4Point, mat4Dir, mat4Transpose } from './math.js';

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute float aMisc;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uSun;
uniform float uTime;
uniform float uAmbient;
varying vec3 vColor;
varying float vLight;
varying float vDepth;
varying float vMisc;
varying vec3 vWorld;
void main() {
  vec4 world = vec4(aPos, 1.0);
  vec4 view = uView * world;
  gl_Position = uProj * view;
  vWorld = aPos;
  vDepth = -view.z;
  vMisc = aMisc;
  float diff = max(dot(normalize(aNormal), normalize(uSun)), 0.0);
  vLight = uAmbient + 0.55 * diff;
  vColor = aColor;
}
`;

const FRAG = `
precision mediump float;
uniform float uTime;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
varying vec3 vColor;
varying float vLight;
varying float vDepth;
varying float vMisc;
varying vec3 vWorld;
void main() {
  vec3 c = vColor;
  if (vMisc > 1.5) {
    // Emissive (sun, clouds, lamps): no shading, no fog.
    gl_FragColor = vec4(c, 1.0);
    return;
  }
  float light = vLight;
  if (vMisc > 0.5) {
    // Water: gentle shimmer so the harbour feels alive.
    light *= 0.92 + 0.10 * sin(vWorld.x * 0.35 + uTime * 1.4) * sin(vWorld.z * 0.30 - uTime * 1.1);
  }
  c *= light;
  float f = clamp((vDepth - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  c = mix(c, uFogColor, f * 0.75);
  gl_FragColor = vec4(c, 1.0);
}
`;

// Unit-box faces: [normal, 4 corners] with a consistent winding.
const FACES = [
  { n: [0, 1, 0], c: [[-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, -1, 0], c: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]] },
  { n: [1, 0, 0], c: [[0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]] },
  { n: [-1, 0, 0], c: [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, 1], c: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], c: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
];

const VERTS_PER_BOX = 36;
const FLOATS_PER_VERT = 10;

// Accumulates transformed box vertices into a plain array. Shared by the
// static city mesh and the per-frame dynamic mesh.
export class MeshBuilder {
  constructor() {
    this.data = [];
  }
  get vertexCount() { return this.data.length / FLOATS_PER_VERT; }

  // A box centred at (x, y, z) with size (sx, sy, sz), rotated by euler
  // angles (rx, ry, rz). Colour is [r, g, b] in 0..1. misc: 0 normal,
  // 1 water, 2 emissive.
  box(x, y, z, sx, sy, sz, rx, ry, rz, color, misc = 0) {
    const m = mat4Compose(x, y, z, rx, ry, rz, sx, sy, sz);
    for (const face of FACES) {
      const n = mat4Dir(m, face.n);
      const idx = [0, 1, 2, 0, 2, 3];
      for (const i of idx) {
        const p = mat4Point(m, face.c[i]);
        this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], misc);
      }
    }
  }

  // Flat quad (a ground tile) at height y, facing up. Corners given as
  // [x, z] pairs in counter-clockwise order. Emitted double-sided so the
  // winding can never cull the ground, roads or water.
  quad(corners, y, color, misc = 0) {
    const n = [0, 1, 0];
    const idx = [0, 1, 2, 0, 2, 3, 0, 3, 2, 0, 2, 1];
    for (const i of idx) {
      const c = corners[i];
      this.data.push(c[0], y, c[1], n[0], n[1], n[2], color[0], color[1], color[2], misc);
    }
  }

  toFloat32() { return new Float32Array(this.data); }
}

// Lighting presets. The sun direction, fog colour, sky colour, ambient
// floor and fog range are fixed per preset, so a golden-hour or night shot
// is the same every run: no time-of-day randomness, only a chosen preset.
export const LIGHTING_PRESETS = {
  // Bright midday, the default for normal play.
  day: { sun: [0.55, 0.85, 0.35], fog: [0.72, 0.84, 0.92], clear: [0.45, 0.72, 0.92], ambient: 0.62, fogRange: [320, 1100] },
  // Low warm sun from the west, orange haze: 17:45 on Jalan Pantai.
  golden: { sun: [0.92, 0.28, 0.18], fog: [0.98, 0.62, 0.38], clear: [0.99, 0.60, 0.34], ambient: 0.58, fogRange: [260, 950] },
  // Dark blue night: lamps, headlights and neon carry the scene. Ambient
  // stays high enough that streets and cars still read at a glance.
  night: { sun: [0.25, 0.55, 0.30], fog: [0.10, 0.12, 0.22], clear: [0.08, 0.11, 0.22], ambient: 0.42, fogRange: [200, 800] },
};

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true }) || canvas.getContext('webgl', { antialias: true });
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('shader link: ' + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    this.uProj = gl.getUniformLocation(prog, 'uProj');
    this.uView = gl.getUniformLocation(prog, 'uView');
    this.uSun = gl.getUniformLocation(prog, 'uSun');
    this.uTime = gl.getUniformLocation(prog, 'uTime');
    this.uAmbient = gl.getUniformLocation(prog, 'uAmbient');
    this.uFogColor = gl.getUniformLocation(prog, 'uFogColor');
    this.uFogRange = gl.getUniformLocation(prog, 'uFogRange');
    gl.useProgram(prog);
    this.lighting = 'day';
    this.setLighting('day');
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.staticCount = 0;
    this.staticBuf = null;
    this.dyn = new Float32Array(FLOATS_PER_VERT * VERTS_PER_BOX * 4096);
    this.dynCount = 0;
    this.dynBuf = gl.createBuffer();
    this.time = 0;
  }

  // Switch the lighting preset ('day', 'golden' or 'night'). The uniforms
  // are applied in begin(), so a preset change takes effect next frame.
  setLighting(name) {
    const p = LIGHTING_PRESETS[name] ?? LIGHTING_PRESETS.day;
    this.lighting = LIGHTING_PRESETS[name] ? name : 'day';
    this._preset = p;
  }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  // Upload the city mesh once.
  setStatic(builder) {
    const gl = this.gl;
    const arr = builder.toFloat32();
    this.staticCount = builder.vertexCount;
    this.staticBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }

  _bind(buf, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = FLOATS_PER_VERT * 4;
    const aPos = gl.getAttribLocation(this.prog, 'aPos');
    const aNormal = gl.getAttribLocation(this.prog, 'aNormal');
    const aColor = gl.getAttribLocation(this.prog, 'aColor');
    const aMisc = gl.getAttribLocation(this.prog, 'aMisc');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNormal);
    gl.enableVertexAttribArray(aColor);
    gl.enableVertexAttribArray(aMisc);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 24);
    gl.vertexAttribPointer(aMisc, 1, gl.FLOAT, false, stride, 36);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  begin(proj, view, dt) {
    const gl = this.gl;
    this.time += dt;
    this.dynCount = 0;
    const p = this._preset ?? LIGHTING_PRESETS.day;
    gl.clearColor(p.clear[0], p.clear[1], p.clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3f(this.uSun, p.sun[0], p.sun[1], p.sun[2]);
    gl.uniform3f(this.uFogColor, p.fog[0], p.fog[1], p.fog[2]);
    gl.uniform2f(this.uFogRange, p.fogRange[0], p.fogRange[1]);
    gl.uniform1f(this.uAmbient, p.ambient);
    gl.uniformMatrix4fv(this.uProj, false, new Float32Array(mat4Transpose(proj)));
    gl.uniformMatrix4fv(this.uView, false, new Float32Array(mat4Transpose(view)));
    gl.uniform1f(this.uTime, this.time);
  }

  // Push one box into the dynamic buffer (same signature as MeshBuilder.box).
  box(x, y, z, sx, sy, sz, rx, ry, rz, color, misc = 0) {
    const m = mat4Compose(x, y, z, rx, ry, rz, sx, sy, sz);
    let o = this.dynCount * FLOATS_PER_VERT;
    if (o + VERTS_PER_BOX * FLOATS_PER_VERT > this.dyn.length) return;
    for (const face of FACES) {
      const n = mat4Dir(m, face.n);
      const idx = [0, 1, 2, 0, 2, 3];
      for (const i of idx) {
        const p = mat4Point(m, face.c[i]);
        this.dyn[o++] = p[0]; this.dyn[o++] = p[1]; this.dyn[o++] = p[2];
        this.dyn[o++] = n[0]; this.dyn[o++] = n[1]; this.dyn[o++] = n[2];
        this.dyn[o++] = color[0]; this.dyn[o++] = color[1]; this.dyn[o++] = color[2];
        this.dyn[o++] = misc;
      }
    }
    this.dynCount += VERTS_PER_BOX;
  }

  end() {
    const gl = this.gl;
    if (this.staticBuf && this.staticCount > 0) this._bind(this.staticBuf, this.staticCount);
    if (this.dynCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.dyn.subarray(0, this.dynCount * FLOATS_PER_VERT), gl.DYNAMIC_DRAW);
      this._bind(this.dynBuf, this.dynCount);
    }
  }
}
