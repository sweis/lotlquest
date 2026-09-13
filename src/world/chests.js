// Treasure chests hidden in the groves and the Dark Forest. Click one up
// close to pop the lid: tokens spill out (sometimes ingredients too), and
// the chest refills a few minutes later.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { fbm } from '../util/noise.js';
import { WORLD } from './terrain.js';

const WOOD = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.85 });
const TRIM = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.5 });
const REFILL_S = 180;

function buildChest() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.48), WOOD);
  base.position.y = 0.2;
  const lid = new THREE.Group();
  const lidBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.48), WOOD);
  lidBox.position.set(0, 0.11, 0.24); // hinge at the back edge
  lid.add(lidBox);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), TRIM);
  clasp.position.set(0, 0.06, 0.47);
  lid.add(clasp);
  lid.position.set(0, 0.4, -0.24);
  const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.06), TRIM);
  band1.position.set(0, 0.2, 0);
  g.add(base, lid, band1);
  g.traverse((o) => { o.castShadow = true; o.userData.chest = true; });
  return { g, lid };
}

export function buildChests(field, scene, seed) {
  const rng = mulberry32(seed ^ 0xc4e5);
  const ground = field.groundAt;
  const group = new THREE.Group();
  group.name = 'chests';
  const chests = [];
  const V = WORLD.village;

  function placeChest(x, z) {
    const { g, lid } = buildChest();
    g.position.set(x, ground(x, z), z);
    g.rotation.y = rng() * Math.PI * 2;
    group.add(g);
    const c = { g, lid, open: false, t: 0, refill: 0, x, z };
    g.traverse((o) => { o.userData.chestRef = c; });
    chests.push(c);
  }

  // grove chests: tucked where the trees grow thick, away from town
  let placed = 0;
  for (let i = 0; i < 9000 && placed < 7; i++) {
    const x = (rng() - 0.5) * WORLD.size * 0.85, z = (rng() - 0.5) * WORLD.size * 0.85;
    const h = ground(x, z);
    if (h < WORLD.seaLevel + 1.4 || h > 15) continue;
    if (Math.hypot(x - V.x, z - V.z) < 55) continue;
    if (fbm(x * 0.02 + 900, z * 0.02 + 900, 3, seed + 5) < 0.55) continue; // the tree-grove noise
    if (chests.some((c) => Math.hypot(c.x - x, c.z - z) < 40)) continue;
    placeChest(x, z);
    placed++;
  }
  // two richer ones in the Dark Forest
  const F = WORLD.realms?.forest;
  if (F) {
    for (const [ox, oz] of [[6, 6], [-7, -4]]) {
      placeChest(F.x + ox, F.z + oz);
      chests[chests.length - 1].rich = true;
    }
  }

  function tryOpen(mesh, playerPos, loot) {
    const c = mesh?.userData?.chestRef;
    if (!c || c.open) return false;
    if (Math.hypot(playerPos.x - c.x, playerPos.z - c.z) > 3.2) return 'far';
    c.open = true;
    c.refill = REFILL_S;
    loot(c);
    return true;
  }

  function update(dt) {
    for (const c of chests) {
      if (c.open) {
        c.t = Math.min(1, c.t + dt * 4);
        c.refill -= dt;
        if (c.refill <= 0) { c.open = false; }
      } else {
        c.t = Math.max(0, c.t - dt * 2);
      }
      c.lid.rotation.x = -c.t * 1.9; // hinge back
    }
  }

  scene.add(group);
  return {
    group, chests, tryOpen, update,
    obstacles: chests.map((c) => ({ x: c.x, z: c.z, r: 0.5 })),
    dispose(sc) { sc.remove(group); group.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
