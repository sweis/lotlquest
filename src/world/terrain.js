// Island heightfield. heightAt() is the single source of truth — the mesh,
// the player grounding, vegetation placement and cameras all sample it.

import * as THREE from 'three';
import { fbm, ridged, noise2, smoothstep } from '../util/noise.js';

export const WORLD = {
  size: 512,          // world extends ±256 on x/z
  seaLevel: 2.0,
  islandRadius: 190,
  spawn: { x: 0, z: -140 },  // relocated onto the real coast per-seed below
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
  WORLD.spawn = { x: 0, z: spawnZ };
  const spawnH = Math.max(rawHeightAt(0, spawnZ), WORLD.seaLevel + 1.6);

  function heightAt(x, z) {
    let h = rawHeightAt(x, z);
    // gently level the spawn area toward its own natural height
    const ds = Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z);
    h = lerp(spawnH, h, smoothstep(WORLD.spawnFlatR * 0.4, WORLD.spawnFlatR * 1.5, ds));
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

export function buildTerrainMesh(field, segments = 256) {
  const { size } = WORLD;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, field.heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

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

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
