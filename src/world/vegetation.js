// Seeded scatter: broadleaf trees (jittered-icosahedron clump canopies, not
// cone/sphere primitives) + coastal rocks. Instanced — 4 draw calls total.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { fbm } from '../util/noise.js';
import { WORLD } from './terrain.js';

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

  // --- gather placements -------------------------------------------------
  const trees = [];
  const rocks = [];
  const maxTries = 4000;
  for (let i = 0; i < maxTries && trees.length < 150; i++) {
    const x = (rng() - 0.5) * WORLD.size * 0.92;
    const z = (rng() - 0.5) * WORLD.size * 0.92;
    const h = field.heightAt(x, z);
    if (h < WORLD.seaLevel + 1.4 || h > 24) continue;
    const slope = Math.abs(field.heightAt(x + 2, z) - h) + Math.abs(field.heightAt(x, z + 2) - h);
    if (slope > 1.6) continue;
    const ds = Math.hypot(x - WORLD.spawn.x, z - WORLD.spawn.z);
    if (ds < WORLD.spawnFlatR * 0.9) continue;
    // grove clustering: accept mostly where a low-freq mask is high
    const grove = fbm(x * 0.02 + 900, z * 0.02 + 900, 3, seed + 5);
    if (grove < 0.52 && rng() > 0.12) continue;
    trees.push({ x, z, h, s: 0.75 + rng() * 0.8, r: rng() * Math.PI * 2, tint: rng() });
  }
  for (let i = 0; i < 1200 && rocks.length < 60; i++) {
    const x = (rng() - 0.5) * WORLD.size * 0.95;
    const z = (rng() - 0.5) * WORLD.size * 0.95;
    const h = field.heightAt(x, z);
    if (h < WORLD.seaLevel - 0.5 || h > 6) continue; // coastal band
    rocks.push({ x, z, h, s: 0.4 + rng() * 1.3, r: rng() * Math.PI * 2 });
  }

  // --- geometry ----------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a36, roughness: 0.95 });

  // canopy: three offset jittered icosa clumps merged look via two instanced meshes
  const clumpA = jitterGeometry(new THREE.IcosahedronGeometry(1.5, 1), mulberry32(seed + 11), 0.55);
  clumpA.scale(1.15, 0.9, 1.15); clumpA.translate(0, 3.0, 0);
  const clumpB = jitterGeometry(new THREE.IcosahedronGeometry(1.0, 1), mulberry32(seed + 23), 0.45);
  clumpB.scale(1.05, 0.85, 1.05); clumpB.translate(0.75, 3.8, 0.35);
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });

  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
  rockGeo.scale(1.3, 0.75, 1.0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.95 });

  // --- instances ---------------------------------------------------------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const canA = new THREE.InstancedMesh(clumpA, canopyMat, trees.length);
  const canB = new THREE.InstancedMesh(clumpB, canopyMat, trees.length);
  trees.forEach((t, i) => {
    q.setFromAxisAngle(up, t.r);
    m.compose(new THREE.Vector3(t.x, t.h - 0.1, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m); canA.setMatrixAt(i, m); canB.setMatrixAt(i, m);
    col.setHSL(0.26 + t.tint * 0.06, 0.52, 0.26 + t.tint * 0.09);
    canA.setColorAt(i, col); canB.setColorAt(i, col.offsetHSL(0.01, 0, 0.03));
  });

  const rocksMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rocks.forEach((t, i) => {
    q.setFromAxisAngle(up, t.r);
    m.compose(new THREE.Vector3(t.x, t.h + 0.1 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    rocksMesh.setMatrixAt(i, m);
  });

  for (const im of [trunks, canA, canB, rocksMesh]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  group.userData.counts = { trees: trees.length, rocks: rocks.length };
  return group;
}
