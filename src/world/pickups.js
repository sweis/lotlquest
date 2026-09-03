// Collectible potion ingredients scattered where they grow: kelp fronds in
// the shallows, berries in the groves, petals in the flower meadows. Walk
// over one to collect it; it regrows a while later.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { fbm } from '../util/noise.js';
import { WORLD } from './terrain.js';

const RESPAWN_S = 75;
const KINDS = {
  kelp: { color: 0x3f9d55, count: 8 },
  berry: { color: 0xd94f4f, count: 8 },
  petal: { color: 0xe58bb0, count: 8 },
};

function buildItemMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'kelp') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: KINDS.kelp.color, roughness: 0.7 }));
    m.position.y = 0.35; m.rotation.z = 0.25;
    g.add(m);
  } else if (kind === 'berry') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8),
      new THREE.MeshStandardMaterial({ color: KINDS.berry.color, roughness: 0.45 }));
    m.position.y = 0.3;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 5),
      new THREE.MeshStandardMaterial({ color: 0x4c7a41, roughness: 0.8 }));
    leaf.position.y = 0.46;
    g.add(m, leaf);
  } else {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: KINDS.petal.color, roughness: 0.5 }));
    m.position.y = 0.32; m.scale.set(1, 0.55, 1);
    g.add(m);
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function buildPickups(field, seed, scene) {
  const ground = field.groundAt;
  const rng = mulberry32(seed ^ 0x1e6);
  const items = [];

  function spawnSet(kind, pick) {
    let placed = 0;
    for (let i = 0; i < 4000 && placed < KINDS[kind].count; i++) {
      const spot = pick();
      if (!spot) continue;
      const mesh = buildItemMesh(kind);
      mesh.position.set(spot.x, ground(spot.x, spot.z), spot.z);
      scene.add(mesh);
      items.push({ kind, mesh, home: spot, alive: true, respawnT: 0, phase: rng() * 6.28 });
      placed++;
    }
  }

  spawnSet('kelp', () => { // shoreline of the kelp grounds
    const a = rng() * Math.PI * 2, r = rng() * WORLD.kelp.r;
    const x = WORLD.kelp.x + Math.sin(a) * r, z = WORLD.kelp.z + Math.cos(a) * r;
    const h = ground(x, z);
    return h > WORLD.seaLevel - 0.6 && h < WORLD.seaLevel + 1.5 ? { x, z } : null;
  });
  spawnSet('berry', () => { // grove country
    const x = (rng() - 0.5) * WORLD.size * 0.85, z = (rng() - 0.5) * WORLD.size * 0.85;
    const h = ground(x, z);
    if (h < 3 || h > 15) return null;
    if (Math.hypot(x - WORLD.village.x, z - WORLD.village.z) < 25) return null;
    return fbm(x * 0.02 + 900, z * 0.02 + 900, 3, seed + 5) > 0.55 ? { x, z } : null;
  });
  spawnSet('petal', () => { // flower meadows
    const x = (rng() - 0.5) * WORLD.size * 0.85, z = (rng() - 0.5) * WORLD.size * 0.85;
    const h = ground(x, z);
    if (h < 3 || h > 13) return null;
    return fbm(x * 0.03 + 1500, z * 0.03 + 1500, 3, seed + 33) > 0.6 ? { x, z } : null;
  });

  let t = 0;
  function update(dt, player, onCollect) {
    t += dt;
    for (const it of items) {
      if (!it.alive) {
        it.respawnT -= dt;
        if (it.respawnT <= 0) { it.alive = true; it.mesh.visible = true; }
        continue;
      }
      // gentle bob + spin so they read as pickups
      it.mesh.position.y = ground(it.home.x, it.home.z) + Math.sin(t * 2 + it.phase) * 0.08 + 0.1;
      it.mesh.rotation.y += dt * 1.4;
      const d = Math.hypot(player.pos.x - it.home.x, player.pos.z - it.home.z);
      if (d < 1.2) {
        it.alive = false;
        it.mesh.visible = false;
        it.respawnT = RESPAWN_S;
        onCollect(it.kind);
      }
    }
  }

  return {
    items, update,
    counts: () => items.filter((i) => i.alive).length,
    dispose(sc) { for (const it of items) sc.remove(it.mesh); },
  };
}
