// Seeded flora: broadleaf groves, highland pines, bushes, dry shrubs, flower
// meadows and coastal rocks. Everything instanced — ~11 draw calls total.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { fbm } from '../util/noise.js';
import { WORLD } from './terrain.js';

// small neutral canvas textures that multiply the material colours —
// procedural grain only, never photos
function canvasTex(size, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d2d2d2';
  ctx.fillRect(0, 0, size, size);
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function barkTexture(rng) {
  return canvasTex(128, (ctx, S) => {
    for (let i = 0; i < 90; i++) { // vertical bark streaks
      const x = rng() * S, l = 18 + rng() * 40, w = 1 + rng() * 2;
      ctx.fillStyle = rng() > 0.35 ? 'rgba(60,45,30,0.16)' : 'rgba(255,240,220,0.10)';
      for (const ox of [0, S, -S]) ctx.fillRect(x + ox, rng() * S - l / 2, w, l);
    }
    for (let i = 0; i < 10; i++) { // knots
      ctx.fillStyle = 'rgba(50,38,26,0.22)';
      ctx.beginPath();
      ctx.ellipse(rng() * S, rng() * S, 2.5 + rng() * 2.5, 1.5 + rng() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function leafTexture(rng) {
  return canvasTex(128, (ctx, S) => {
    for (let i = 0; i < 240; i++) { // leafy blotches, dark and light
      const x = rng() * S, y = rng() * S, r = 2 + rng() * 5;
      ctx.fillStyle = rng() > 0.45 ? 'rgba(30,60,25,0.14)' : 'rgba(240,255,220,0.10)';
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function jitterGeometry(geo, rng, amt) {
  const pos = geo.attributes.position;
  const seen = new Map(); // weld-aware jitter so shared verts move together
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) {
      seen.set(key, [
        (rng() - 0.5) * amt,
        (rng() - 0.5) * amt * 0.7,
        (rng() - 0.5) * amt,
      ]);
    }
    const j = seen.get(key);
    pos.setXYZ(i, pos.getX(i) + j[0], pos.getY(i) + j[1], pos.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildVegetation(field, seed) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const rng = mulberry32(seed ^ 0x5eed);
  const ground = field.groundAt ?? field.heightAt;
  const half = WORLD.size / 2;

  const excluded = (x, z, pad = 0) =>
    (WORLD.landmarkExclusions ?? []).some((e) => Math.hypot(x - e.x, z - e.z) < e.r + pad) ||
    Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z) < WORLD.spawnFlatR * 0.9 ||
    (WORLD.trails ?? []).some((path) => path.some((p) => Math.hypot(x - p.x, z - p.z) < 2.2));

  const slopeAt = (x, z, h) =>
    Math.abs(ground(x + 2, z) - h) + Math.abs(ground(x, z + 2) - h);

  // generic scatter: pick spots matching a predicate
  function scatter(count, tries, pick) {
    const out = [];
    for (let i = 0; i < tries && out.length < count; i++) {
      const x = (rng() - 0.5) * WORLD.size * 0.94;
      const z = (rng() - 0.5) * WORLD.size * 0.94;
      const h = ground(x, z);
      const spot = pick(x, z, h);
      if (spot) out.push(spot);
    }
    return out;
  }

  // --- placements ---------------------------------------------------------
  const trees = scatter(240, 9000, (x, z, h) => {
    if (h < WORLD.seaLevel + 1.4 || h > 15) return null;
    if (slopeAt(x, z, h) > 1.6 || excluded(x, z)) return null;
    const grove = fbm(x * 0.02 + 900, z * 0.02 + 900, 3, seed + 5);
    if (grove < 0.52 && rng() > 0.12) return null;
    return { x, z, h, s: 0.75 + rng() * 0.8, r: rng() * Math.PI * 2, tint: rng() };
  });

  const pines = scatter(140, 9000, (x, z, h) => {
    if (h < 8 || h > 24) return null;                 // highlands
    if (slopeAt(x, z, h) > 2.0 || excluded(x, z)) return null;
    const band = fbm(x * 0.017 + 300, z * 0.017 + 300, 3, seed + 77);
    if (band < 0.5 && rng() > 0.2) return null;
    return { x, z, h, s: 0.8 + rng() * 0.7, r: rng() * Math.PI * 2, tint: rng() };
  });

  const bushes = scatter(170, 7000, (x, z, h) => {
    if (h < WORLD.seaLevel + 1.0 || h > 18) return null;
    if (slopeAt(x, z, h) > 1.8 || excluded(x, z)) return null;
    return { x, z, h, s: 0.5 + rng() * 0.7, r: rng() * Math.PI * 2, tint: rng() };
  });

  const shrubs = scatter(120, 7000, (x, z, h) => {
    if (h < WORLD.seaLevel + 0.4 || h > 8) return null; // dry coastal band
    if (excluded(x, z)) return null;
    return { x, z, h, s: 0.4 + rng() * 0.5, r: rng() * Math.PI * 2 };
  });

  const flowers = scatter(340, 9000, (x, z, h) => {
    if (h < 3 || h > 13) return null;
    if (slopeAt(x, z, h) > 1.2 || excluded(x, z)) return null;
    const meadow = fbm(x * 0.03 + 1500, z * 0.03 + 1500, 3, seed + 33);
    if (meadow < 0.58) return null;
    return { x, z, h, s: 0.8 + rng() * 0.5, tint: rng() };
  });

  const blades = scatter(5200, 26000, (x, z, h) => { // grass tufts
    if (h < WORLD.seaLevel + 1.2 || h > 16) return null;
    if (slopeAt(x, z, h) > 1.4 || excluded(x, z)) return null;
    return { x, z, h, s: 0.7 + rng() * 0.7, r: rng() * Math.PI * 2, tint: rng() };
  });

  const rocks = scatter(90, 4000, (x, z, h) => {
    if (h < WORLD.seaLevel - 0.5 || h > 6) return null; // coastal band
    if (excluded(x, z)) return null;
    return { x, z, h, s: 0.4 + rng() * 1.3, r: rng() * Math.PI * 2 };
  });

  // --- geometry ------------------------------------------------------------
  const bark = barkTexture(mulberry32(seed + 71));
  bark.repeat.set(2, 1.4);
  const leaf = leafTexture(mulberry32(seed + 73));
  leaf.repeat.set(2, 2);

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a36, roughness: 0.95, map: bark });

  const clumpA = jitterGeometry(new THREE.IcosahedronGeometry(1.5, 1), mulberry32(seed + 11), 0.55);
  clumpA.scale(1.15, 0.9, 1.15); clumpA.translate(0, 3.0, 0);
  const clumpB = jitterGeometry(new THREE.IcosahedronGeometry(1.0, 1), mulberry32(seed + 23), 0.45);
  clumpB.scale(1.05, 0.85, 1.05); clumpB.translate(0.75, 3.8, 0.35);
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, map: leaf });

  const pineTrunkGeo = new THREE.CylinderGeometry(0.09, 0.18, 3.2, 6);
  pineTrunkGeo.translate(0, 1.6, 0);
  const pineLowGeo = jitterGeometry(new THREE.ConeGeometry(1.55, 2.8, 8), mulberry32(seed + 41), 0.3);
  pineLowGeo.translate(0, 2.9, 0);
  const pineTopGeo = jitterGeometry(new THREE.ConeGeometry(1.0, 2.3, 7), mulberry32(seed + 43), 0.25);
  pineTopGeo.translate(0, 4.6, 0);
  const pineMat = new THREE.MeshStandardMaterial({ roughness: 0.9, map: leaf });

  const bushGeo = jitterGeometry(new THREE.IcosahedronGeometry(0.85, 1), mulberry32(seed + 51), 0.4);
  bushGeo.scale(1.1, 0.72, 1.1); bushGeo.translate(0, 0.5, 0);
  const bushMat = new THREE.MeshStandardMaterial({ roughness: 0.9, map: leaf });

  const shrubGeo = jitterGeometry(new THREE.IcosahedronGeometry(0.5, 0), mulberry32(seed + 61), 0.3);
  shrubGeo.scale(1.2, 0.6, 1.2); shrubGeo.translate(0, 0.28, 0);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x8a8a52, roughness: 0.95 });

  // three flower kinds: dandelion puffs, tulip cups, little sunflowers
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.34, 5);
  stemGeo.translate(0, 0.17, 0);
  const sunStemGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.58, 5);
  sunStemGeo.translate(0, 0.29, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4c7a41, roughness: 0.8 });
  const headGeo = new THREE.SphereGeometry(0.08, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, map: leaf });
  const tulipGeo = new THREE.CylinderGeometry(0.088, 0.042, 0.17, 8);
  const tulipMat = new THREE.MeshStandardMaterial({ roughness: 0.55, map: leaf });
  const sunPetalGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 10);
  const sunPetalMat = new THREE.MeshStandardMaterial({ color: 0xe8c53c, roughness: 0.6, map: leaf });
  const sunCoreGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8);
  const sunCoreMat = new THREE.MeshStandardMaterial({ color: 0x6b4a26, roughness: 0.9 });

  // a tuft = three lean blades in one little geometry, instanced thousands of
  // times — the single biggest "not a flat lawn" win
  const bladeGeo = (() => {
    const single = new THREE.ConeGeometry(0.028, 0.34, 3);
    single.translate(0, 0.17, 0);
    const parts = [];
    for (const [ox, oz, lean] of [[0, 0, 0], [0.06, 0.03, 0.35], [-0.05, 0.05, -0.3]]) {
      const c = single.clone();
      c.rotateZ(lean);
      c.translate(ox, 0, oz);
      parts.push(c);
    }
    // manual merge (no BufferGeometryUtils in the vendored build) — expand to
    // non-indexed FIRST, then size the buffers from the expanded arrays
    const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
    let len = 0;
    for (const p of flat) len += p.attributes.position.array.length;
    const pos = new Float32Array(len), nrm = new Float32Array(len);
    let off = 0;
    for (const p of flat) {
      pos.set(p.attributes.position.array, off);
      nrm.set(p.attributes.normal.array, off);
      off += p.attributes.position.array.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    return g;
  })();
  const bladeMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });

  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
  rockGeo.scale(1.3, 0.75, 1.0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.95 });

  // --- instances -----------------------------------------------------------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  function fill(mesh, spots, place) {
    spots.forEach((t, i) => {
      q.setFromAxisAngle(up, t.r ?? 0);
      m.compose(new THREE.Vector3(t.x, t.h + (place?.sink ?? -0.1), t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
      if (place?.color) mesh.setColorAt(i, place.color(t, col));
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  fill(new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length), trees);
  fill(new THREE.InstancedMesh(clumpA, canopyMat, trees.length), trees,
    { color: (t, c) => c.setHSL(0.26 + t.tint * 0.06, 0.52, 0.26 + t.tint * 0.09) });
  fill(new THREE.InstancedMesh(clumpB, canopyMat, trees.length), trees,
    { color: (t, c) => c.setHSL(0.27 + t.tint * 0.06, 0.52, 0.29 + t.tint * 0.09) });

  fill(new THREE.InstancedMesh(pineTrunkGeo, trunkMat, pines.length), pines);
  fill(new THREE.InstancedMesh(pineLowGeo, pineMat, pines.length), pines,
    { color: (t, c) => c.setHSL(0.35 + t.tint * 0.04, 0.42, 0.2 + t.tint * 0.07) });
  fill(new THREE.InstancedMesh(pineTopGeo, pineMat, pines.length), pines,
    { color: (t, c) => c.setHSL(0.36 + t.tint * 0.04, 0.45, 0.24 + t.tint * 0.07) });

  fill(new THREE.InstancedMesh(bushGeo, bushMat, bushes.length), bushes,
    { color: (t, c) => c.setHSL(0.28 + t.tint * 0.07, 0.45, 0.24 + t.tint * 0.1) });
  fill(new THREE.InstancedMesh(shrubGeo, shrubMat, shrubs.length), shrubs);

  const bladesMesh = fill(new THREE.InstancedMesh(bladeGeo, bladeMat, blades.length), blades,
    { sink: 0, color: (t, c) => c.setHSL(0.26 + t.tint * 0.07, 0.5, 0.28 + t.tint * 0.11) });
  bladesMesh.castShadow = false; // thousands of tufts — shadow pass skips them

  const dands = flowers.filter((f) => f.tint < 0.4);
  const tulips = flowers.filter((f) => f.tint >= 0.4 && f.tint < 0.75);
  const suns = flowers.filter((f) => f.tint >= 0.75);
  fill(new THREE.InstancedMesh(stemGeo, stemMat, dands.length + tulips.length), [...dands, ...tulips], { sink: 0 });
  fill(new THREE.InstancedMesh(headGeo, headMat, dands.length), dands.map((f) => ({ ...f, h: f.h + 0.34 * f.s })), {
    sink: 0,
    color: (t, c) => c.setHSL(0.13, 0.25, t.tint > 0.2 ? 0.9 : 0.78), // dandelion whites & pale golds
  });
  fill(new THREE.InstancedMesh(tulipGeo, tulipMat, tulips.length), tulips.map((f) => ({ ...f, h: f.h + 0.4 * f.s })), {
    sink: 0,
    color: (t, c) => c.setHSL([0.98, 0.85, 0.75][((t.tint - 0.4) * 8.5) | 0] ?? 0.98, 0.65, 0.55), // reds, pinks, violets
  });
  fill(new THREE.InstancedMesh(sunStemGeo, stemMat, suns.length), suns, { sink: 0 });
  fill(new THREE.InstancedMesh(sunPetalGeo, sunPetalMat, suns.length), suns.map((f) => ({ ...f, h: f.h + 0.58 * f.s })), { sink: 0 });
  fill(new THREE.InstancedMesh(sunCoreGeo, sunCoreMat, suns.length), suns.map((f) => ({ ...f, h: f.h + 0.6 * f.s })), { sink: 0 });

  fill(new THREE.InstancedMesh(rockGeo, rockMat, rocks.length), rocks, { sink: 0.1 });

  group.userData.counts = {
    trees: trees.length, pines: pines.length, bushes: bushes.length,
    shrubs: shrubs.length, flowers: flowers.length, rocks: rocks.length,
  };
  // solid things you shouldn't ghost through: rock bodies + tree/pine trunks
  group.userData.obstacles = [
    ...rocks.map((t) => ({ x: t.x, z: t.z, r: 0.75 * t.s })),
    ...trees.map((t) => ({ x: t.x, z: t.z, r: 0.34 * t.s })),
    ...pines.map((t) => ({ x: t.x, z: t.z, r: 0.26 * t.s })),
  ];
  return group;
}
