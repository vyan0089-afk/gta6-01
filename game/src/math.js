// math.js — the little vector and matrix toolkit the renderer and the game
// share. Matrices are 4x4, row-major, and multiply column vectors:
// v' = M * v. The renderer transposes them before upload, because GLSL
// uniforms want column-major order.

// ---- 4x4 matrices -------------------------------------------------------

export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = sum;
    }
  }
  return out;
}

// GLSL uniform matrices are column-major; ours are row-major, so flip
// before uploading.
export function mat4Transpose(m) {
  return [
    m[0], m[4], m[8], m[12],
    m[1], m[5], m[9], m[13],
    m[2], m[6], m[10], m[14],
    m[3], m[7], m[11], m[15],
  ];
}

export function mat4Translate(x, y, z) {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
}

export function mat4Scale(sx, sy, sz) {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}

export function mat4RotateX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

export function mat4RotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

export function mat4RotateZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// Full object transform: rotate (Z, then X, then Y, so yaw goes last),
// scale, then translate. This is what every box in the city and every
// moving car, ped and helicopter is placed with.
export function mat4Compose(x, y, z, rx, ry, rz, sx, sy, sz) {
  const rot = mat4Multiply(mat4RotateY(ry), mat4Multiply(mat4RotateX(rx), mat4RotateZ(rz)));
  const scaled = mat4Multiply(rot, mat4Scale(sx, sy, sz));
  return mat4Multiply(mat4Translate(x, y, z), scaled);
}

export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, 2 * far * near * nf,
    0, 0, -1, 0,
  ];
}

// Camera matrix: eye looks at target, with +Y up. Builds the three
// orthonormal axes by hand, so no cross-product helper is needed.
export function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  const zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  const xl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];
  return [
    x[0], x[1], x[2], -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    y[0], y[1], y[2], -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    z[0], z[1], z[2], -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    0, 0, 0, 1,
  ];
}

// ---- Transforming points and directions ---------------------------------

export function mat4Point(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}

// A direction has no translation, and comes back normalised — used for
// face normals after rotation.
export function mat4Dir(m, d) {
  const x = m[0] * d[0] + m[1] * d[1] + m[2] * d[2];
  const y = m[4] * d[0] + m[5] * d[1] + m[6] * d[2];
  const z = m[8] * d[0] + m[9] * d[1] + m[10] * d[2];
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

// ---- Scalars ------------------------------------------------------------

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Wrap an angle to [-PI, PI]: the short way around, for steering and
// hostile peds turning toward the player.
export function clampAngle(a) {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smooth 0..1 ramp between two edges; marker pulses and fades use this.
export function smoothstep(a, b, t) {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
}

// Shortest signed difference between two headings, in [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Interpolate between two headings along the short way around.
export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * clamp01(t);
}

export function dist2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Degrees and radians, for the rare place that thinks in degrees.
export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

// Length of a 3D vector, and its normalised form.
export function vec3Length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function vec3Normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
