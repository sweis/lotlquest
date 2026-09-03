// Island heightfield. heightAt() is the single source of truth — the mesh,
// the player grounding, vegetation placement and cameras all sample it.

import * as THREE from 'three';
import { fbm, ridged, noise2, smoothstep } from '../util/noise.js';

export const WORLD = {
  size: 768,          // world extends ±384 on x/z
  seaLevel: 2.0,
  islandRadius: 290,
  spawn: { x: 0, z: -140 },  // relocated to the town square per-seed below
  spawnFlatR: 14,
};

function lerp(a, b, t) { return a + (b - a) * t; }

export function makeHeightField(seed) {
  const S = seed | 0;

  function rawHeightAt(x, z) {
    // domain warp for an organic coastline
    const wx = x + 48 * (noise2(x * 0.006 + 13.7, z * 0.006, S) - 0.5) * 2;
    const wz = z + 48 * (noise2(x * 0.006, z * 0.006 + 71.3, S) - 0.5) * 2;
    const r = Math.hypot(wx, wz);
    const coast = WORLD.islandRadius * (0.80 + 0.30 * fbm(wx * 0.004, wz * 0.004, 3, S + 7));
    const t = 1 - r / Math.max(coast, 1);          // 1 centre → 0 coast → negative in ocean
    const falloff = smoothstep(-0.10, 0.50, t);     // 0 in ocean, 1 inland
    const hills = fbm(wx * 0.012, wz * 0.012, 4, S + 21);
    const peaks = ridged(wx * 0.017, wz * 0.017, 4, S + 42);
    const core = smoothstep(0.34, 0.88, t);         // amplitude driven radially — peaks live centre-island
    return -11 + falloff * (13 + hills * 9) + core * peaks * 27;
  }

  // Walk inland from the south until we're solidly above the waterline, so
  // the spawn is on the island's actual coast for any seed (no ocean pancake).
  let spawnZ = -WORLD.islandRadius;
  for (let z = -WORLD.islandRadius; z < 0; z += 2) {
    if (rawHeightAt(0, z) > WORLD.seaLevel + 1.8 &&
        rawHeightAt(0, z + 10) > WORLD.seaLevel + 1.8) { spawnZ = z + 8; break; }
  }
  // the coastal "landing" — anchors the beach flatten and the beach trail
  WORLD.landing = { x: 0, z: spawnZ };
  const spawnH = Math.max(rawHeightAt(0, spawnZ), WORLD.seaLevel + 1.6);

  // ---- landmark site selection (deterministic, from the raw field) --------
  // village: first flat-enough lowland pocket inland of spawn
  let vSite = { x: 0, z: spawnZ + 30 };
  for (let z = spawnZ + 26; z < spawnZ + 140; z += 4) {
    const h = rawHeightAt(0, z);
    if (h < 3.4 || h > 10) continue;
    const spread = Math.max(
      Math.abs(rawHeightAt(16, z) - h), Math.abs(rawHeightAt(-16, z) - h),
      Math.abs(rawHeightAt(0, z + 16) - h), Math.abs(rawHeightAt(0, z - 16) - h));
    if (spread < 3.5) { vSite = { x: 0, z }; break; }
  }
  const villageH = Math.min(Math.max(rawHeightAt(vSite.x, vSite.z), 3.6), 9);
  WORLD.village = { x: vSite.x, z: vSite.z, r: 34, h: villageH };
  // the game starts in the town square, just south of the well
  WORLD.spawn = { x: vSite.x, z: vSite.z - 4.5 };

  // Hope of the Axolotls Hill: the most PROMINENT knoll near the village —
  // a spot higher than its own surroundings, not a big-mountain flank
  let hill = { x: vSite.x + 60, z: vSite.z + 40, score: -Infinity };
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    for (let r = 48; r <= 96; r += 6) {
      const x = vSite.x + Math.sin(a) * r, z = vSite.z + Math.cos(a) * r;
      const h = rawHeightAt(x, z);
      if (h < 5 || h > 16) continue;
      let nb = 0;
      for (let k = 0; k < 4; k++) {
        nb += rawHeightAt(x + Math.sin(k * 1.5708) * 15, z + Math.cos(k * 1.5708) * 15) / 4;
      }
      const score = (h - nb) * 3 + h * 0.3; // prominence first, height second
      if (score > hill.score) hill = { x, z, score };
    }
  }
  WORLD.hill = { x: hill.x, z: hill.z };

  // kelp grounds: shallow water straight off the south beach
  let kelp = { x: 0, z: spawnZ - 20 };
  for (let z = spawnZ; z > -WORLD.size / 2; z -= 3) {
    if (rawHeightAt(0, z) < WORLD.seaLevel - 0.9) { kelp = { x: 0, z: z - 8 }; break; }
  }
  WORLD.kelp = { x: kelp.x, z: kelp.z, r: 20 };

  // hunting point: a high coastal brow far from the village
  let hunt = { x: 0, z: -spawnZ, score: -Infinity };
  for (let a = 0; a < Math.PI * 2; a += 0.08) {
    let brow = null;
    for (let r = 60; r < WORLD.islandRadius * 1.25; r += 4) {
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = rawHeightAt(x, z);
      if (h > 6) brow = { x, z, h };
      else if (brow && h < WORLD.seaLevel) break;
    }
    if (!brow) continue;
    const d = Math.hypot(brow.x - vSite.x, brow.z - vSite.z);
    const score = Math.min(brow.h, 16) + d * 0.04;
    if (d > 90 && score > hunt.score) hunt = { x: brow.x, z: brow.z, score };
  }
  WORLD.hunt = { x: hunt.x, z: hunt.z };

  // Moxolotl Cave: the most ENCLOSED valley pocket in the mountain core —
  // low ground ringed by high ground (the inside of the U)
  let cave = { x: 0, z: 80, score: -Infinity, dirX: 0, dirZ: 1 };
  for (let cx = -110; cx <= 110; cx += 6) {
    for (let cz = -110; cz <= 110; cz += 6) {
      const own = rawHeightAt(cx, cz);
      if (own < 6 || own > 16) continue;
      if (Math.hypot(cx - vSite.x, cz - vSite.z) < 60) continue;
      if (Math.hypot(cx - hill.x, cz - hill.z) < 25) continue;
      let ring = 0; let hi = { h: -Infinity, x: cx, z: cz + 26 };
      for (let k = 0; k < 8; k++) {
        const sx = cx + Math.sin(k * 0.785) * 26, sz = cz + Math.cos(k * 0.785) * 26;
        const h = rawHeightAt(sx, sz);
        ring += h / 8;
        if (h > hi.h) hi = { h, x: sx, z: sz };
      }
      const score = ring - own;
      if (score > cave.score) {
        const dl = Math.hypot(hi.x - cx, hi.z - cz) || 1;
        cave = { x: cx, z: cz, score, dirX: (hi.x - cx) / dl, dirZ: (hi.z - cz) / dl };
      }
    }
  }
  WORLD.cave = { x: cave.x, z: cave.z, dirX: cave.dirX, dirZ: cave.dirZ, pitR: 6.5, pitDepth: 4.5 };

  // keep trees/rocks out of the built-up spots
  WORLD.landmarkExclusions = [
    { x: WORLD.village.x, z: WORLD.village.z, r: WORLD.village.r + 6 },
    { x: WORLD.hill.x, z: WORLD.hill.z, r: 9 },
    { x: WORLD.hunt.x, z: WORLD.hunt.z, r: 10 },
    { x: WORLD.cave.x, z: WORLD.cave.z, r: 13 },
  ];

  function heightAt(x, z) {
    let h = rawHeightAt(x, z);
    // gently level the coastal landing so the beach stays easy ground
    const ds = Math.hypot(x - WORLD.landing.x, z - WORLD.landing.z);
    h = lerp(spawnH, h, smoothstep(WORLD.spawnFlatR * 0.4, WORLD.spawnFlatR * 1.5, ds));
    // level the village site so buildings sit naturally
    const dv = Math.hypot(x - WORLD.village.x, z - WORLD.village.z);
    h = lerp(WORLD.village.h, h, smoothstep(WORLD.village.r * 0.55, WORLD.village.r * 1.2, dv));
    // sink the Moxolotl Cave's entrance pit into the valley floor
    const dcv = Math.hypot(x - WORLD.cave.x, z - WORLD.cave.z);
    h -= WORLD.cave.pitDepth * (1 - smoothstep(WORLD.cave.pitR * 0.45, WORLD.cave.pitR * 1.15, dcv));
    return h;
  }

  return { seed: S, heightAt };
}

const COL = {
  sand:  new THREE.Color(0xd8c093),
  grassA: new THREE.Color(0x6f9c4b),
  grassB: new THREE.Color(0x93b158), // macro tint second frequency
  rock:  new THREE.Color(0x87837b),
  snow:  new THREE.Color(0xe8ecee),
};

export function buildTerrainMesh(field, segments = WORLD.size / 2) {
  const { size } = WORLD;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, field.heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  // Install a render-exact ground sampler: same vertex grid and the same
  // per-quad triangle split as PlaneGeometry. Grounding on the analytic field
  // floats the player above the coarser mesh at sharp crests — gameplay must
  // stand on what is rendered.
  {
    const N = segments + 1, step = size / segments, half = size / 2;
    const grid = new Float32Array(N * N); // index iz*N+ix ↔ (x=-half+ix·step, z=-half+iz·step)
    for (let i = 0; i < pos.count; i++) grid[i] = pos.getY(i);
    field.groundAt = (x, z) => {
      const gx = Math.min(Math.max((x + half) / step, 0), segments - 1e-6);
      const gz = Math.min(Math.max((z + half) / step, 0), segments - 1e-6);
      const ix = Math.floor(gx), iz = Math.floor(gz);
      const fx = gx - ix, fz = gz - iz;
      const h00 = grid[iz * N + ix], h10 = grid[iz * N + ix + 1];
      const h01 = grid[(iz + 1) * N + ix], h11 = grid[(iz + 1) * N + ix + 1];
      // PlaneGeometry splits each quad along the (x1,z0)–(x0,z1) diagonal
      return fx + fz <= 1
        ? h00 + (h10 - h00) * fx + (h01 - h00) * fz
        : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    };
  }

  // vertex-colour splat: sand → grass (two-frequency tint) → rock on slope → snow high
  const colors = new Float32Array(pos.count * 3);
  const nrm = geo.attributes.normal;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = 1 - nrm.getY(i); // 0 flat → 1 vertical
    const macro = fbm(x * 0.008 + 400, z * 0.008 + 400, 3, field.seed + 99);
    const fine = fbm(x * 0.09 + 800, z * 0.09 + 800, 2, field.seed + 151); // second frequency: patchiness
    c.copy(COL.grassA).lerp(COL.grassB, macro);
    c.multiplyScalar(0.92 + fine * 0.16);
    c.lerp(COL.sand, smoothstep(3.2, 2.5, y));            // beaches near sea level
    c.lerp(COL.rock, smoothstep(0.18, 0.42, slope));      // steep faces
    c.lerp(COL.snow, smoothstep(27, 33, y) * (1 - smoothstep(0.35, 0.6, slope)));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // DoubleSide: an underground camera must see solid ground, never x-ray sky
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
