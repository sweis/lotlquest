// Seeded value noise + fBm. Analytic (no textures) so terrain height is
// exactly reproducible anywhere — the player grounds against the same
// function the mesh is built from.

import { hash2 } from './rng.js';

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function noise2(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fade(fx), v = fade(fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v); // [0,1)
}

export function fbm(x, z, octaves, seed = 0) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, z * freq, seed + i * 131);
    norm += amp;
    amp *= 0.5; freq *= 2.03;
  }
  return sum / norm; // [0,1)
}

// Sharp-crested variant for the island core.
export function ridged(x, z, octaves, seed = 0) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(2 * noise2(x * freq, z * freq, seed + 977 + i * 173) - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5; freq *= 2.11;
  }
  return sum / norm; // [0,1)
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
