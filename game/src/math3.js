// math3.js — Tiny 3D maths for the custom WebGL2 engine: vectors, matrices
// and a look-at camera. Written from scratch for this game; no library is
// used anywhere. All matrices are column-major Float32Array(16), the way
// WebGL expects them, and every helper writes into a supplied output array
// so the render loop never allocates.

// ---- vectors ---------------------------------------------------------------

/** Subtract b from a (3D). */
export function sub3(a, b, out) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

/** Add a and b (3D). */
export function add3(a, b, out) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

/** Scale a 3D vector by s. */
export function scale3(a, s, out) {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

/** Length of a 3D vector. */
export function len3(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/** Normalise a 3D vector in place (leaves zero vectors alone). */
export function norm3(a) {
  const l = len3(a);
  if (l > 0.000001) {
    a[0] /= l;
    a[1] /= l;
    a[2] /= l;
  }
  return a;
}

/** Cross product a x b. */
export function cross3(a, b, out) {
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
  return out;
}

/** Dot product of two 3D vectors. */
export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// ---- matrices --------------------------------------------------------------

/** Identity matrix. */
export function matIdentity(out) {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

/** Perspective projection. fovY in radians. */
export function matPerspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** Look-at view matrix: eye, target and up are [x, y, z]. */
export function matLookAt(out, eye, target, up) {
  const z = sub3(eye, target, new Float32Array(3));
  norm3(z);
  const x = cross3(up, z, new Float32Array(3));
  norm3(x);
  const y = cross3(z, x, new Float32Array(3));
  out[0] = x[0]; out[4] = x[1]; out[8] = x[2]; out[12] = -dot3(x, eye);
  out[1] = y[0]; out[5] = y[1]; out[9] = y[2]; out[13] = -dot3(y, eye);
  out[2] = z[0]; out[6] = z[1]; out[10] = z[2]; out[14] = -dot3(z, eye);
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return out;
}

/** Multiply two matrices: out = a * b. */
export function matMultiply(out, a, b) {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = sum;
    }
  }
  out.set(r);
  return out;
}

/** Translation matrix. */
export function matTranslate(out, x, y, z) {
  matIdentity(out);
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

/** Rotation about the Y axis. */
export function matRotateY(out, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  matIdentity(out);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

/** Rotation about the X axis. */
export function matRotateX(out, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  matIdentity(out);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

/** Rotation about the Z axis. */
export function matRotateZ(out, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  matIdentity(out);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

// ---- colour ----------------------------------------------------------------

/** Parse a #rrggbb colour into [r, g, b] floats in [0, 1]. */
export function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** Scale an rgb triple by a brightness factor, clamped to [0, 1]. */
export function shade(rgb, f) {
  return [
    Math.min(1, Math.max(0, rgb[0] * f)),
    Math.min(1, Math.max(0, rgb[1] * f)),
    Math.min(1, Math.max(0, rgb[2] * f)),
  ];
}

/** Mix two rgb triples by t in [0, 1]. */
export function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** A deterministic hash of two integers, for stable per-building variation. */
export function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967296;
}
