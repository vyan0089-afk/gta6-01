// render.js — The custom WebGL2 renderer for Tanjung Matahari.
//
// No engine, no library: one shader program, one box, one cylinder and one
// quad, drawn hundreds of times a frame with a different model matrix, colour
// and texture tile. Building faces come from a small canvas texture atlas
// (sixteen facades painted at runtime), roads from a repeating asphalt tile
// with a dashed centre line. Lighting is a single sun direction plus ambient,
// fogged toward the sky colour; the time of day (day, golden hour, night)
// just moves the sun and recolours the sky. The camera is a chase camera
// behind Raka, or behind his car.

import { clamp, lerp } from './rng.js';

// ---------- tiny mat4 helpers (column-major, like WebGL expects) ----------

function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

/** Model matrix: translate, rotate around Y, scale. */
function mat4Model(x, y, z, rotY, sx, sy, sz) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const out = new Float32Array(16);
  out[0] = c * sx; out[1] = 0; out[2] = -s * sx; out[3] = 0;
  out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
  out[8] = s * sz; out[9] = 0; out[10] = c * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

// ---------- shaders ----------

const VERT_SRC = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec4 uTile;
out vec3 vNormal;
out vec2 vUV;
out float vDepth;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV * uTile.zw + uTile.xy;
  vec4 view = uView * world;
  vDepth = -view.z;
  gl_Position = uProj * view;
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec3 vNormal;
in vec2 vUV;
in float vDepth;
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform sampler2D uTex;
uniform int uUseTex;
uniform float uEmissive;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 tex = uUseTex == 1 ? texture(uTex, vUV).rgb : vec3(1.0);
  vec3 lit = (uAmbient + uSunColor * diff) * uColor * tex;
  lit += uColor * uEmissive;
  float fog = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  fragColor = vec4(mix(lit, uFogColor, fog), 1.0);
}`;

// ---------- texture painting (canvas, at runtime, no files) ----------

/** Paint the 4x4 facade atlas: each tile is a building face with windows. */
function paintFacadeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const bases = [
    '#d8c49a', '#cfa98f', '#aebfc4', '#e0d3a8', '#bfa8c0', '#a8c4a0',
    '#e0b08a', '#9fb4d8', '#d8c49a', '#cfa98f', '#aebfc4', '#e0d3a8',
    '#bfa8c0', '#a8c4a0', '#e0b08a', '#9fb4d8',
  ];
  for (let tile = 0; tile < 16; tile += 1) {
    const tx = (tile % 4) * 128;
    const ty = Math.floor(tile / 4) * 128;
    g.fillStyle = bases[tile];
    g.fillRect(tx, ty, 128, 128);
    // Window grid, some lit warm.
    const cols = 4 + (tile % 3);
    const rows = 6 + (tile % 4);
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const wx = tx + 10 + cx * ((128 - 20) / cols);
        const wy = ty + 10 + cy * ((128 - 20) / rows);
        const lit = (cx * 7 + cy * 3 + tile) % 5 === 0;
        g.fillStyle = lit ? '#ffd98a' : '#2c3a4a';
        g.fillRect(wx, wy, (128 - 20) / cols - 6, (128 - 20) / rows - 6);
      }
    }
    // Ground-floor shopfront strip.
    g.fillStyle = tile % 2 === 0 ? '#8a4a3a' : '#3a5a7a';
    g.fillRect(tx, ty + 108, 128, 20);
    g.fillStyle = '#f5e9c8';
    g.font = 'bold 11px sans-serif';
    g.fillText(tile % 2 === 0 ? 'WARUNG' : 'TOKO', tx + 8, ty + 122);
  }
  return canvas;
}

/** Paint the repeating road tile: asphalt with a dashed centre line. */
function paintRoadTile() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#33363c';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3d4046';
  for (let i = 0; i < 200; i += 1) {
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#e8c84a';
  g.fillRect(60, 8, 8, 44);
  g.fillRect(60, 72, 8, 44);
  g.fillStyle = '#e8e8e8';
  g.fillRect(4, 0, 3, 128);
  g.fillRect(121, 0, 3, 128);
  return canvas;
}

// ---------- geometry ----------

/** A unit box centred on the origin, 1 wide, 1 high, 1 deep, with UVs. */
function boxGeometry() {
  // Each face: 4 corners, two triangles (6 vertices), normal + uv.
  const faces = [
    { n: [0, 0, 1], c: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { n: [0, 0, -1], c: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { n: [1, 0, 0], c: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { n: [-1, 0, 0], c: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { n: [0, 1, 0], c: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { n: [0, -1, 0], c: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const face of faces) {
    const order = [0, 1, 2, 0, 2, 3];
    for (const idx of order) {
      pos.push(...face.c[idx]);
      nor.push(...face.n);
      uv.push(...uvs[idx]);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), count: 36 };
}

/** A unit cylinder (radius 0.5, height 1), 14 sides, with UVs. */
function cylinderGeometry() {
  const sides = 14;
  const pos = [];
  const nor = [];
  const uv = [];
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.5;
    const z0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5;
    const z1 = Math.sin(a1) * 0.5;
    const tris = [
      [[x0, -0.5, z0], [x1, -0.5, z1], [x1, 0.5, z1]],
      [[x0, -0.5, z0], [x1, 0.5, z1], [x0, 0.5, z0]],
      [[0, 0.5, 0], [x1, 0.5, z1], [x0, 0.5, z0]],
      [[0, -0.5, 0], [x0, -0.5, z0], [x1, -0.5, z1]],
    ];
    const normals = [
      [Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a1), 0, Math.sin(a1)],
      [Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)],
      [0, 1, 0], [0, 1, 0], [0, 1, 0],
      [0, -1, 0], [0, -1, 0], [0, -1, 0],
    ];
    const uvs = [[i / sides, 0], [(i + 1) / sides, 0], [(i + 1) / sides, 1], [i / sides, 0], [(i + 1) / sides, 1], [i / sides, 1], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]];
    let n = 0;
    for (const tri of tris) {
      for (const v of tri) {
        pos.push(...v);
        nor.push(...normals[n]);
        uv.push(...uvs[n]);
        n += 1;
      }
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), count: pos.length / 3 };
}

// ---------- time of day ----------

/** Lighting presets keyed by hour of the game clock. */
export function lightingForHour(hour) {
  if (hour >= 6 && hour < 16.5) {
    return {
      name: 'day', sky: [0.55, 0.75, 0.92], fog: [0.62, 0.78, 0.92],
      sunDir: [0.45, 0.75, 0.35], sunColor: [1.0, 0.95, 0.85], ambient: [0.42, 0.45, 0.5],
      fogNear: 90, fogFar: 620, night: 0,
    };
  }
  if (hour >= 16.5 && hour < 18.75) {
    return {
      name: 'golden', sky: [0.98, 0.62, 0.35], fog: [0.98, 0.68, 0.42],
      sunDir: [0.85, 0.28, 0.2], sunColor: [1.0, 0.62, 0.3], ambient: [0.5, 0.38, 0.3],
      fogNear: 70, fogFar: 520, night: 0.25,
    };
  }
  return {
    name: 'night', sky: [0.05, 0.07, 0.16], fog: [0.07, 0.09, 0.2],
    sunDir: [-0.3, 0.6, -0.4], sunColor: [0.45, 0.55, 0.85], ambient: [0.16, 0.18, 0.26],
    fogNear: 50, fogFar: 420, night: 1,
  };
}

// ---------- the renderer ----------

/** Create the renderer for a canvas. Returns null when WebGL2 is missing. */
export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  const loc = {
    proj: gl.getUniformLocation(program, 'uProj'),
    view: gl.getUniformLocation(program, 'uView'),
    model: gl.getUniformLocation(program, 'uModel'),
    tile: gl.getUniformLocation(program, 'uTile'),
    color: gl.getUniformLocation(program, 'uColor'),
    sunDir: gl.getUniformLocation(program, 'uSunDir'),
    sunColor: gl.getUniformLocation(program, 'uSunColor'),
    ambient: gl.getUniformLocation(program, 'uAmbient'),
    fogColor: gl.getUniformLocation(program, 'uFogColor'),
    fogNear: gl.getUniformLocation(program, 'uFogNear'),
    fogFar: gl.getUniformLocation(program, 'uFogFar'),
    useTex: gl.getUniformLocation(program, 'uUseTex'),
    emissive: gl.getUniformLocation(program, 'uEmissive'),
  };

  function makeTexture(sourceCanvas, repeat) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }
  const facadeTex = makeTexture(paintFacadeAtlas(), false);
  const roadTex = makeTexture(paintRoadTile(), true);

  function makeBuffer(geo) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const interleaved = new Float32Array(geo.count * 8);
    for (let i = 0; i < geo.count; i += 1) {
      interleaved[i * 8 + 0] = geo.pos[i * 3 + 0];
      interleaved[i * 8 + 1] = geo.pos[i * 3 + 1];
      interleaved[i * 8 + 2] = geo.pos[i * 3 + 2];
      interleaved[i * 8 + 3] = geo.nor[i * 3 + 0];
      interleaved[i * 8 + 4] = geo.nor[i * 3 + 1];
      interleaved[i * 8 + 5] = geo.nor[i * 3 + 2];
      interleaved[i * 8 + 6] = geo.uv[i * 2 + 0];
      interleaved[i * 8 + 7] = geo.uv[i * 2 + 1];
    }
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    return { vao, count: geo.count };
  }
  const box = makeBuffer(boxGeometry());
  const cyl = makeBuffer(cylinderGeometry());

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  let drawCalls = 0;

  function setTile(tx, ty, tw, th) {
    gl.uniform4f(loc.tile, tx, ty, tw, th);
  }

  /** Draw one box. colour is [r,g,b]; tile selects a facade atlas region or null. */
  function drawBox(x, y, z, rotY, sx, sy, sz, colour, tile, emissive) {
    gl.bindVertexArray(box.vao);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(x, y, z, rotY, sx, sy, sz));
    gl.uniform3f(loc.color, colour[0], colour[1], colour[2]);
    gl.uniform1f(loc.emissive, emissive || 0);
    if (tile) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, facadeTex);
      gl.uniform1i(loc.useTex, 1);
      setTile((tile % 4) * 0.25, Math.floor(tile / 4) * 0.25, 0.25, 0.25);
    } else {
      gl.uniform1i(loc.useTex, 0);
      setTile(0, 0, 1, 1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, box.count);
    drawCalls += 1;
  }

  /** Draw one cylinder. */
  function drawCylinder(x, y, z, rotY, radius, height, colour, emissive) {
    gl.bindVertexArray(cyl.vao);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(x, y, z, rotY, radius * 2, height, radius * 2));
    gl.uniform3f(loc.color, colour[0], colour[1], colour[2]);
    gl.uniform1f(loc.emissive, emissive || 0);
    gl.uniform1i(loc.useTex, 0);
    setTile(0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, cyl.count);
    drawCalls += 1;
  }

  /** Draw a flat quad on the ground (a road strip, the sea, the beach). */
  function drawGround(x, y, z, rotY, w, d, colour, road, repeatX, repeatZ) {
    gl.bindVertexArray(box.vao);
    gl.uniformMatrix4fv(loc.model, false, mat4Model(x, y, z, rotY, w, 0.06, d));
    gl.uniform3f(loc.color, colour[0], colour[1], colour[2]);
    gl.uniform1f(loc.emissive, 0);
    if (road) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, roadTex);
      gl.uniform1i(loc.useTex, 1);
      setTile(0, 0, repeatX || 1, repeatZ || 1);
    } else {
      gl.uniform1i(loc.useTex, 0);
      setTile(0, 0, 1, 1);
    }
    gl.drawArrays(gl.TRIANGLES, 0, box.count);
    drawCalls += 1;
  }

  /** Draw one car: body, cabin, dark under-tray, and police light bar when needed. */
  function drawCar(car, time) {
    const def = car.def;
    const L = def.length;
    const W = def.width;
    const H = def.height;
    drawBox(car.x, H * 0.42, car.z, car.angle, W, H * 0.62, L, car.colour, null, 0);
    drawBox(car.x, H * 0.85, car.z - Math.sin(car.angle) * L * 0.04, car.angle, W * 0.82, H * 0.5, L * 0.52, [0.12, 0.14, 0.18], null, 0);
    drawBox(car.x, 0.22, car.z, car.angle, W * 1.04, 0.44, L * 0.96, [0.08, 0.08, 0.09], null, 0);
    if (car.defId === 'police') {
      const phase = Math.sin(time * 6 + (car.lightPhase || 0) * 6) > 0;
      const barColour = phase ? [1, 0.15, 0.15] : [0.15, 0.4, 1];
      drawBox(car.x, H * 1.12, car.z, car.angle, W * 0.5, 0.18, 0.5, barColour, null, 0.9);
    }
    if (car.defId === 'taxi') {
      drawBox(car.x, H * 1.1, car.z, car.angle, W * 0.4, 0.16, 0.5, [0.1, 0.1, 0.1], null, 0.4);
    }
  }

  /** Draw one pedestrian: shirt body and a head. */
  function drawPed(ped, time) {
    const bob = Math.sin(time * 6 + ped.x) * 0.05;
    drawBox(ped.x, 0.85 + bob, ped.z, ped.angle, 0.62, 1.1, 0.4, ped.shirt, null, 0);
    drawBox(ped.x, 1.62 + bob, ped.z, ped.angle, 0.42, 0.42, 0.4, ped.skin, null, 0);
  }

  /** The small yellow diamond mission marker, floating and bobbing. */
  function drawMarker(x, z, time) {
    const y = 3.2 + Math.sin(time * 2.2) * 0.5;
    drawBox(x, y, z, time * 1.2, 1.1, 1.6, 1.1, [1.0, 0.85, 0.1], null, 0.85);
    drawBox(x, 0.25, z, 0, 2.2, 0.12, 2.2, [1.0, 0.85, 0.1], null, 0.5);
  }

  /** Draw the whole scene for one frame. */
  function draw(game, camera, hour, time) {
    const light = lightingForHour(hour);
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(light.sky[0], light.sky[1], light.sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const proj = mat4Perspective((62 * Math.PI) / 180, w / h, 0.5, 1200);
    const view = mat4LookAt(
      [camera.x, camera.y, camera.z],
      [camera.tx, camera.ty, camera.tz],
      [0, 1, 0],
    );
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniform3f(loc.sunDir, light.sunDir[0], light.sunDir[1], light.sunDir[2]);
    gl.uniform3f(loc.sunColor, light.sunColor[0], light.sunColor[1], light.sunColor[2]);
    gl.uniform3f(loc.ambient, light.ambient[0], light.ambient[1], light.ambient[2]);
    gl.uniform3f(loc.fogColor, light.fog[0], light.fog[1], light.fog[2]);
    gl.uniform1f(loc.fogNear, light.fogNear);
    gl.uniform1f(loc.fogFar, light.fogFar);
    drawCalls = 0;

    const world = game.world;
    // Ground, sea and beach. Each layer sits a little higher than the one
    // below it, so no two quads ever share a plane and z-fight.
    drawGround(0, 0.02, 0, 0, 940, 940, [0.42, 0.45, 0.38], false);
    drawGround(-470, 0.04, 0, 0, 90, 940, [0.16, 0.45, 0.68], false);
    drawGround(-425, 0.05, 0, 0, 18, 940, [0.88, 0.78, 0.55], false);
    drawGround(120, 0.06, 430, 0, 700, 70, [0.5, 0.5, 0.48], false);
    // Roads.
    for (const a of game.roads.avenues) {
      drawGround(a.x, 0.08, 0, 0, 14, 900, [1, 1, 1], true, 1, 70);
    }
    for (const s of game.roads.streets) {
      drawGround(0, 0.08, s.z, Math.PI / 2, 14, 900, [1, 1, 1], true, 1, 70);
    }
    // Sun disc in the sky, in the sun's direction from the camera.
    const sunX = camera.x + light.sunDir[0] * 420;
    const sunY = 120 + light.sunDir[1] * 220;
    const sunZ = camera.z + light.sunDir[2] * 420;
    const sunColour = light.name === 'night' ? [0.9, 0.9, 0.75] : [1, 0.75, 0.35];
    drawBox(sunX, sunY, sunZ, 0, 34, 34, 1, sunColour, null, 1);
    // Buildings.
    for (const b of world.buildings) {
      drawBox(b.x, b.h / 2, b.z, 0, b.w, b.h, b.d, [1, 1, 1], b.tile, light.night * 0.12);
      drawBox(b.x, b.h + 0.25, b.z, 0, b.w * 0.94, 0.5, b.d * 0.94, b.roof, null, 0);
      if (b.neon) {
        drawBox(b.x, Math.min(b.h - 1.5, 8), b.z + b.d / 2 + 0.35, 0, b.w * 0.5, 1.1, 0.3, b.neon, null, 0.9);
      }
    }
    // Pasar Malam stalls with awnings.
    for (const s of world.stalls) {
      drawBox(s.x, 1.4, s.z, 0, s.w, 2.8, s.d, [0.55, 0.4, 0.28], null, 0);
      drawBox(s.x, 3.1, s.z, 0, s.w + 1, 0.25, s.d + 1, s.colour, null, light.night * 0.5);
    }
    // Harbour containers.
    for (const c of world.containers) {
      drawBox(c.x, c.h / 2, c.z, c.angle, c.w, c.h, c.d, c.colour, null, 0);
    }
    // Trees and palms.
    for (const t of world.trees) {
      drawCylinder(t.x, t.h / 2, t.z, 0, 0.35, t.h, [0.45, 0.32, 0.2], 0);
      if (t.palm) {
        drawBox(t.x, t.h + 0.6, t.z, t.x * 0.1, 4.5, 0.5, 4.5, [0.25, 0.6, 0.25], null, 0);
      } else {
        drawBox(t.x, t.h + 1.1, t.z, 0, 3.2, 2.4, 3.2, [0.25, 0.55, 0.28], null, 0);
      }
    }
    // Lighthouse: red-and-white striped tower with a glowing lamp room.
    const lh = game.landmarks.lighthouse;
    drawCylinder(lh.x, 14, lh.z, 0, 5, 28, [0.92, 0.92, 0.9], 0);
    drawCylinder(lh.x, 20, lh.z, 0, 5.4, 3, [0.85, 0.15, 0.15], 0);
    drawCylinder(lh.x, 8, lh.z, 0, 5.4, 3, [0.85, 0.15, 0.15], 0);
    drawBox(lh.x, 29.5, lh.z, 0, 4, 3, 4, [1, 0.9, 0.4], null, 0.95);
    drawBox(lh.x, 31.5, lh.z, 0, 2.4, 1, 2.4, [0.2, 0.2, 0.25], null, 0);
    // Traffic, parked cars and police.
    for (const car of world.traffic) drawCar(car, time);
    for (const car of world.parked) drawCar(car, time);
    for (const car of world.policeCars) drawCar(car, time);
    for (const rb of world.roadblocks) {
      drawBox(rb.x, 0.7, rb.z, rb.angle, 2, 1.4, 4.8, rb.colour, null, 0);
      drawBox(rb.x, 1.6, rb.z, rb.angle, 1, 0.3, 0.6, [1, 0.15, 0.15], null, 0.9);
    }
    // The player's car (drawn on top of the player when driving).
    if (game.player.car) drawCar(game.player.car, time);
    // Pedestrians and enemies.
    for (const ped of world.pedestrians) drawPed(ped, time);
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      const bob = Math.sin(time * 5 + e.x) * 0.04;
      drawBox(e.x, 0.9 + bob, e.z, e.angle, 0.7, 1.2, 0.45, [0.45, 0.12, 0.16], null, 0);
      drawBox(e.x, 1.7 + bob, e.z, e.angle, 0.45, 0.45, 0.42, e.skin || [0.8, 0.6, 0.45], null, 0);
    }
    // Pickups: spinning golden keris crates.
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      drawBox(pk.x, 1.1 + Math.sin(time * 3 + pk.bob) * 0.25, pk.z, time * 1.5, 0.9, 0.9, 0.9, [1, 0.8, 0.15], null, 0.8);
    }
    // Collectibles: small golden diamonds around the city.
    for (const c of world.collectibles) {
      if (c.taken) continue;
      drawBox(c.x, 1.0 + Math.sin(time * 2 + c.bob) * 0.3, c.z, time, 0.7, 1.0, 0.7, [1, 0.75, 0.1], null, 0.9);
    }
    // Helicopter with a spinning rotor and a spotlight cone glow.
    if (world.helicopter) {
      const h = world.helicopter;
      drawBox(h.x, h.y, h.z, h.angle, 3.2, 2.2, 6.5, [0.25, 0.3, 0.35], null, 0);
      drawBox(h.x, h.y + 1.4, h.z, h.angle + h.rotor, 10, 0.18, 0.5, [0.15, 0.15, 0.16], null, 0);
      drawBox(h.x, h.y - 0.5, h.z, h.angle, 1.2, 0.8, 1.2, [1, 0.9, 0.3], null, 0.7);
    }
    // Raka on foot.
    if (game.player.onFoot) {
      const p = game.player;
      const bob = p.moving ? Math.sin(time * 9) * 0.06 : 0;
      drawBox(p.x, 0.95 + bob, p.z, p.angle, 0.66, 1.15, 0.42, [0.15, 0.35, 0.75], null, 0);
      drawBox(p.x, 1.72 + bob, p.z, p.angle, 0.44, 0.44, 0.42, [0.85, 0.65, 0.5], null, 0);
      // Raka's red jacket stripe so he reads at a glance.
      drawBox(p.x, 1.15 + bob, p.z, p.angle, 0.68, 0.22, 0.44, [0.85, 0.1, 0.1], null, 0);
    }
    // Mission marker.
    if (game.marker) drawMarker(game.marker.x, game.marker.z, time);
    return { drawCalls, light: light.name };
  }

  return { draw, gl };
}
