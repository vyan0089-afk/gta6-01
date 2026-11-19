// math.js — small vector/matrix helpers for the renderer and the game.
// Row-major 4x4 matrices, column vectors: v' = M * v.

export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
      out[r * 4 + c] = s;
    }
  }
  return out;
}

// GLSL uniform matrices are column-major; our matrices are row-major, so
// transpose before uploading.
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
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

export function mat4RotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

export function mat4RotateZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// Euler rotation, applied Z then X then Y (yaw last), times scale, times translate.
export function mat4Compose(x, y, z, rx, ry, rz, sx, sy, sz) {
  let m = mat4Multiply(mat4RotateY(ry), mat4Multiply(mat4RotateX(rx), mat4RotateZ(rz)));
  m = mat4Multiply(m, mat4Scale(sx, sy, sz));
  m = mat4Multiply(mat4Translate(x, y, z), m);
  return m;
}

export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, 2 * far * near * nf, 0, 0, -1, 0];
}

export function mat4LookAt(eye, target, up) {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z = [zx / zl, zy / zl, zz / zl];
  let xx = up[1] * z[2] - up[2] * z[1];
  let xy = up[2] * z[0] - up[0] * z[2];
  let xz = up[0] * z[1] - up[1] * z[0];
  let xl = Math.hypot(xx, xy, xz) || 1;
  const x = [xx / xl, xy / xl, xz / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [
    x[0], x[1], x[2], -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    y[0], y[1], y[2], -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    z[0], z[1], z[2], -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    0, 0, 0, 1,
  ];
}

// Transform a point [x,y,z] by a row-major matrix.
export function mat4Point(m, p) {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}

// Transform a direction (no translation) and normalize.
export function mat4Dir(m, d) {
  const x = m[0] * d[0] + m[1] * d[1] + m[2] * d[2];
  const y = m[4] * d[0] + m[5] * d[1] + m[6] * d[2];
  const z = m[8] * d[0] + m[9] * d[1] + m[10] * d[2];
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
// Shortest signed angle difference, in [-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
