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

  // Moxolotl Cave: right beside the village — the first bearing with dry
  // land that clears the stall arc (30–90°), the armory (272°), the hill and
  // the hunt trailhead. A short stroll from the square, per the mayor.
  let caveSpot = null;
  for (const deg of [20, 320, 171, 255, 210]) {
    const a = (deg / 180) * Math.PI;
    const x = vSite.x + Math.sin(a) * 50, z = vSite.z + Math.cos(a) * 50;
    if (rawHeightAt(x, z) < WORLD.seaLevel + 1.0) continue;
    if (Math.hypot(x - hill.x, z - hill.z) < 30) continue;
    if (Math.hypot(x - hunt.x, z - hunt.z) < 34) continue;
    caveSpot = { x, z };
    break;
  }
  if (!caveSpot) caveSpot = { x: vSite.x + 50, z: vSite.z };
  WORLD.cave = {
    x: caveSpot.x, z: caveSpot.z,
    r: 11, h: Math.max(rawHeightAt(caveSpot.x, caveSpot.z), WORLD.seaLevel + 1.5),
  };
  { // ramped corridor from the door toward the village edge, so the walk in
    // is always gentle. The endpoint height must match heightAt's village
    // blend or the corridor ends on a seam.
    const dvx = vSite.x - caveSpot.x, dvz = vSite.z - caveSpot.z;
    const dl = Math.hypot(dvx, dvz) || 1;
    const ex = caveSpot.x + (dvx / dl) * 24, ez = caveSpot.z + (dvz / dl) * 24;
    const dv = Math.hypot(ex - vSite.x, ez - vSite.z);
    const eh = lerp(villageH, rawHeightAt(ex, ez),
      smoothstep(WORLD.village.r * 0.55, WORLD.village.r * 1.2, dv));
    WORLD.cave.approach = { ex, ez, eh };
  }

  // ---- the far realms: four evil corners, spread by bearing window --------
  // (the village faces the island centre from the south, bearing ~180, so
  // the realms take the other quarters). Two passes: strict height band,
  // then any dry land, so every seed gets all four.
  function realmSite(degLo, degHi, hLo, hHi, avoid) {
    let best = null;
    for (let pass = 0; pass < 2 && !best; pass++) {
      const lo = pass ? WORLD.seaLevel + 1.5 : hLo, hi = pass ? 30 : hHi;
      for (let deg = degLo; deg <= degHi; deg += 4) {
        const a = (deg / 180) * Math.PI;
        for (let rad = 110; rad <= 235; rad += 7) {
          const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
          const h = rawHeightAt(x, z);
          if (h < lo || h > hi) continue;
          if (Math.hypot(x - vSite.x, z - vSite.z) < 85) continue;
          if (Math.hypot(x - hunt.x, z - hunt.z) < 45) continue;
          if (Math.hypot(x - hill.x, z - hill.z) < 40) continue;
          if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < 80)) continue;
          const spread = Math.max(
            Math.abs(rawHeightAt(x + 12, z) - h), Math.abs(rawHeightAt(x - 12, z) - h),
            Math.abs(rawHeightAt(x, z + 12) - h), Math.abs(rawHeightAt(x, z - 12) - h));
          const score = -spread + Math.min(h - lo, hi - h) * 0.15; // flat, mid-band
          if (!best || score > best.score) best = { x, z, score };
        }
      }
    }
    return best;
  }
  const picked = [];
  const pick = (lo, hi, hLo, hHi, fx, fz) => {
    const s = realmSite(lo, hi, hLo, hHi, picked) ?? { x: fx, z: fz };
    picked.push(s);
    return s;
  };
  const fSite = pick(30, 100, 4, 14, 120, 60);     // dark forest: NE lowland
  const dSite = pick(102, 148, 3.5, 9, 150, -40);  // desert: SE flats
  const iSite = pick(212, 280, 10, 26, -150, -40); // ice castle: SW heights
  const cSite = pick(282, 350, 6, 18, -100, 110);  // crystal cave: NW slopes
  WORLD.realms = {
    forest: { x: fSite.x, z: fSite.z, r: 34 },
    desert: { x: dSite.x, z: dSite.z, r: 36 },
    ice: { x: iSite.x, z: iSite.z, r: 30 },
    crystal: { x: cSite.x, z: cSite.z, r: 14 },
  };
  // level pads under the built structures (crystal cave ring, ice castle)
  WORLD.pads = [
    { x: cSite.x, z: cSite.z, r: 11, h: Math.max(rawHeightAt(cSite.x, cSite.z), WORLD.seaLevel + 1.5) },
    { x: iSite.x, z: iSite.z, r: 16, h: Math.max(rawHeightAt(iSite.x, iSite.z), WORLD.seaLevel + 1.5) },
  ];

  // keep trees/rocks out of the built-up spots
  WORLD.landmarkExclusions = [
    { x: WORLD.village.x, z: WORLD.village.z, r: WORLD.village.r + 6 },
    { x: WORLD.hill.x, z: WORLD.hill.z, r: 9 },
    { x: WORLD.hunt.x, z: WORLD.hunt.z, r: 10 },
    { x: WORLD.cave.x, z: WORLD.cave.z, r: 13 },
    { x: cSite.x, z: cSite.z, r: 14 },
    { x: iSite.x, z: iSite.z, r: 19 },
  ];

  function heightAt(x, z) {
    let h = rawHeightAt(x, z);
    // gently level the coastal landing so the beach stays easy ground
    const ds = Math.hypot(x - WORLD.landing.x, z - WORLD.landing.z);
    h = lerp(spawnH, h, smoothstep(WORLD.spawnFlatR * 0.4, WORLD.spawnFlatR * 1.5, ds));
    // level the village site so buildings sit naturally
    const dv = Math.hypot(x - WORLD.village.x, z - WORLD.village.z);
    h = lerp(WORLD.village.h, h, smoothstep(WORLD.village.r * 0.55, WORLD.village.r * 1.2, dv));
    // level a pad for the Moxolotl Cave's rock structure
    const dcv = Math.hypot(x - WORLD.cave.x, z - WORLD.cave.z);
    h = lerp(WORLD.cave.h, h, smoothstep(WORLD.cave.r * 0.55, WORLD.cave.r * 1.25, dcv));
    // …and a ramped corridor from its door toward the village, so the pocket
    // is always reachable on foot (grade ≈ Δh/40, well under the climb gate)
    const A = WORLD.cave.approach;
    if (A) {
      const vx = A.ex - WORLD.cave.x, vz = A.ez - WORLD.cave.z;
      const t = ((x - WORLD.cave.x) * vx + (z - WORLD.cave.z) * vz) / (vx * vx + vz * vz);
      if (t > 0 && t < 1) {
        const lat = Math.hypot(x - (WORLD.cave.x + vx * t), z - (WORLD.cave.z + vz * t));
        h = lerp(lerp(WORLD.cave.h, A.eh, t), h, smoothstep(3.5, 8.5, lat));
      }
    }
    // level pads for realm structures
    for (const p of WORLD.pads ?? []) {
      const dp = Math.hypot(x - p.x, z - p.z);
      if (dp < p.r * 1.25) h = lerp(p.h, h, smoothstep(p.r * 0.55, p.r * 1.25, dp));
    }
    return h;
  }

  return { seed: S, heightAt };
}

// tiling ground-grain canvas: soft value noise + speckles + blade strokes.
// Multiplies the vertex colours, so grass/sand/rock all pick up the detail.
function makeGroundTexture(seed) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rnd = (function () { let a = (seed | 0) ^ 0x9e37; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { // per-pixel soft grain
    const v = 208 + (rnd() * 46 - 20);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const stroke = (alpha, light) => {
    ctx.strokeStyle = light ? `rgba(255,255,255,${alpha})` : `rgba(70,80,60,${alpha})`;
    ctx.lineWidth = 1;
    // draw wrapped so the tile seams stay invisible
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 3 + rnd() * 6;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + Math.sin(a) * l, y + oy - Math.abs(Math.cos(a)) * l);
      ctx.stroke();
    }
  };
  for (let i = 0; i < 420; i++) stroke(0.10, false); // dark blade strokes
  for (let i = 0; i < 260; i++) stroke(0.08, true);  // light catches
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(WORLD.size / 7, WORLD.size / 7); // ~7m tiles, hidden by the two-frequency tint
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COL = {
  sand:  new THREE.Color(0xd8c093),
  grassA: new THREE.Color(0x6f9c4b),
  grassB: new THREE.Color(0x93b158), // macro tint second frequency
  rock:  new THREE.Color(0x87837b),
  snow:  new THREE.Color(0xe8ecee),
  dune:  new THREE.Color(0xd7b06a), // desert realm
  moss:  new THREE.Color(0x2e4429), // dark-forest realm floor
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
    const R = WORLD.realms;
    if (R) { // the far realms recolour their ground
      const dD = Math.hypot(x - R.desert.x, z - R.desert.z);
      c.lerp(COL.dune, (1 - smoothstep(R.desert.r * 0.75, R.desert.r * 1.3, dD)) * 0.9);
      const dI = Math.hypot(x - R.ice.x, z - R.ice.z);
      c.lerp(COL.snow, (1 - smoothstep(R.ice.r * 0.75, R.ice.r * 1.35, dI)) * 0.95);
      const dF = Math.hypot(x - R.forest.x, z - R.forest.z);
      c.lerp(COL.moss, (1 - smoothstep(R.forest.r * 0.65, R.forest.r * 1.25, dF)) * 0.7);
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // DoubleSide: an underground camera must see solid ground, never x-ray sky.
  // A procedural grain texture (multiplying the vertex-colour splat) breaks up
  // the flat single-colour read — speckle + faint blade strokes, no photos.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1.0, metalness: 0, side: THREE.DoubleSide,
    map: makeGroundTexture(field.seed),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
