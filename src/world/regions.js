// The far realms — the Dark Forest, the Shifting Sands, the Crystal Cave and
// the Ice Castle. Evil-olm country, far from the village lights. The terrain
// generator picks the sites (WORLD.realms) and levels pads for the two built
// structures; this file raises what stands on them.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';

const ROCK = new THREE.MeshStandardMaterial({ color: 0x5e5866, roughness: 1 });
const ROCK_IN = new THREE.MeshStandardMaterial({ color: 0x3e3948, roughness: 1, side: THREE.DoubleSide });
const CAVE_FLOOR = new THREE.MeshStandardMaterial({
  color: 0x2f2b3a, roughness: 1,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
const CRYSTAL = new THREE.MeshStandardMaterial({
  color: 0x9fe8ff, emissive: 0x3fb8e8, emissiveIntensity: 1.6, roughness: 0.25,
});
const CRYSTAL_B = new THREE.MeshStandardMaterial({
  color: 0xc9a8ff, emissive: 0x7a4ae0, emissiveIntensity: 1.4, roughness: 0.25,
});
const ICE = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.25 });
const ICE_DARK = new THREE.MeshStandardMaterial({ color: 0x9cc4dc, roughness: 0.35 });
const SNOWCAP = new THREE.MeshStandardMaterial({ color: 0xeff6fa, roughness: 0.9 });
const OBSIDIAN = new THREE.MeshStandardMaterial({ color: 0x232028, roughness: 0.55 });
const SANDSTONE = new THREE.MeshStandardMaterial({ color: 0xc9a15e, roughness: 0.95 });

export function buildRealms(field, scene, seed) {
  const rng = mulberry32(seed ^ 0x0e17);
  const ground = field.groundAt;
  const group = new THREE.Group();
  group.name = 'realms';
  const obstacles = [];
  const landmarks = [];
  const R = WORLD.realms;
  const V = WORLD.village;
  const mesh = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // ---- Crystal Cave: a rock ring + dome like the Moxolotl's, but lit by ---
  // glowing crystal clusters instead of torches
  {
    const C = R.crystal, RING = 7;
    const baseY = ground(C.x, C.z);
    const doorDir = Math.atan2(V.x - C.x, V.z - C.z);
    for (let a = 0; a < Math.PI * 2; a += 0.42) {
      let diff = Math.atan2(Math.sin(a - doorDir), Math.cos(a - doorDir));
      if (Math.abs(diff) < 0.5) continue; // doorway gap faces the village
      const bx = C.x + Math.sin(a) * RING, bz = C.z + Math.cos(a) * RING;
      const b = mesh(new THREE.DodecahedronGeometry(1.9, 0), ROCK, bx, baseY + 1.4, bz);
      b.scale.set(1.1, 1.4 + rng() * 0.6, 1.1);
      b.rotation.set(rng() * 0.3, rng() * Math.PI, rng() * 0.3);
      obstacles.push({ x: bx, z: bz, r: 1.95 });
    }
    const domeGeo = new THREE.SphereGeometry(RING + 2.0, 24, 14);
    {
      const pos = domeGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const n = 1 + (rng() - 0.5) * 0.12;
        pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * 0.55 * n, pos.getZ(i) * n);
      }
      domeGeo.computeVertexNormals();
    }
    mesh(domeGeo, ROCK_IN, C.x, baseY + 1.2, C.z);
    const floor = mesh(new THREE.CircleGeometry(RING - 0.5, 24), CAVE_FLOOR, C.x, baseY + 0.06, C.z);
    floor.rotation.x = -Math.PI / 2;
    floor.castShadow = false;
    // crystal clusters around the walls, plus a big centrepiece
    const spots = [];
    for (let i = 0; i < 7; i++) {
      const a = doorDir + Math.PI + ((i - 3) / 7) * Math.PI * 1.6;
      spots.push({ x: C.x + Math.sin(a) * (RING - 1.5), z: C.z + Math.cos(a) * (RING - 1.5), s: 0.7 + rng() * 0.7 });
    }
    spots.push({ x: C.x, z: C.z, s: 1.7 });
    for (const t of spots) {
      for (let k = 0; k < 3; k++) {
        const c = mesh(new THREE.OctahedronGeometry(0.24 * t.s, 0),
          k % 2 ? CRYSTAL_B : CRYSTAL,
          t.x + (rng() - 0.5) * 0.5 * t.s, baseY + 0.45 * t.s + k * 0.1, t.z + (rng() - 0.5) * 0.5 * t.s);
        c.scale.y = 2.2 + rng();
        c.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
      }
    }
    obstacles.push({ x: C.x, z: C.z, r: 0.9 }); // the centrepiece cluster
    for (const i of [0, 3, 6]) {
      const L = new THREE.PointLight(0x7fd4ff, 45, 22, 1.8);
      L.position.set(spots[i].x, baseY + 1.6, spots[i].z);
      group.add(L);
    }
    landmarks.push({ name: 'The Crystal Cave', x: C.x, z: C.z, r: 12 });
  }

  // ---- Ice Castle: curtain walls, four towers, a gate facing the village --
  {
    const I = R.ice, HALF = 9;
    const baseY = ground(I.x, I.z);
    const rot = Math.atan2(V.x - I.x, V.z - I.z); // gate side toward the village
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const toWorld = (lx, lz) => ({ x: I.x + lx * cs + lz * sn, z: I.z - lx * sn + lz * cs });
    const castle = new THREE.Group();
    const cmesh = (geo, mat, lx, y, lz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(lx, y, lz);
      m.castShadow = m.receiveShadow = true;
      castle.add(m);
      return m;
    };
    const GATE_HW = 1.7, WALL_H = 4.2, T = 0.8;
    // front wall split around the gate + lintel
    const segW = HALF - GATE_HW;
    cmesh(new THREE.BoxGeometry(segW, WALL_H, T), ICE, -(GATE_HW + segW / 2), WALL_H / 2, HALF);
    cmesh(new THREE.BoxGeometry(segW, WALL_H, T), ICE, GATE_HW + segW / 2, WALL_H / 2, HALF);
    cmesh(new THREE.BoxGeometry(GATE_HW * 2, WALL_H - 2.6, T), ICE, 0, 2.6 + (WALL_H - 2.6) / 2, HALF);
    cmesh(new THREE.BoxGeometry(HALF * 2, WALL_H, T), ICE, 0, WALL_H / 2, -HALF); // back
    cmesh(new THREE.BoxGeometry(T, WALL_H, HALF * 2), ICE, -HALF, WALL_H / 2, 0); // left
    cmesh(new THREE.BoxGeometry(T, WALL_H, HALF * 2), ICE, HALF, WALL_H / 2, 0);  // right
    // corner towers with snow-capped cones
    for (const [lx, lz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      cmesh(new THREE.CylinderGeometry(1.7, 2.0, 6.4, 10), ICE_DARK, lx, 3.2, lz);
      cmesh(new THREE.ConeGeometry(2.1, 2.6, 10), SNOWCAP, lx, 7.6, lz);
    }
    // the frozen keep: a dais and throne at the back of the courtyard
    cmesh(new THREE.BoxGeometry(4.2, 0.5, 3.0), ICE_DARK, 0, 0.25, -HALF + 2.6);
    cmesh(new THREE.BoxGeometry(1.3, 1.1, 0.9), ICE, 0, 1.05, -HALF + 1.9);
    cmesh(new THREE.BoxGeometry(1.3, 2.3, 0.3), ICE, 0, 1.95, -HALF + 1.45);
    for (const side of [-1, 1]) { // icicle finials on the throne back
      cmesh(new THREE.ConeGeometry(0.14, 0.8, 6), ICE, side * 0.55, 3.4, -HALF + 1.45);
    }
    // ice spikes in the courtyard corners
    for (let i = 0; i < 6; i++) {
      const lx = (rng() - 0.5) * (HALF * 1.5), lz = (rng() - 0.5) * (HALF * 1.5);
      if (Math.abs(lx) < 2.5 && lz > HALF - 5) continue; // keep the dais clear
      const s = cmesh(new THREE.ConeGeometry(0.35 + rng() * 0.3, 1.4 + rng() * 1.6, 7), ICE, lx, 0.6, lz);
      s.rotation.y = rng() * Math.PI;
    }
    castle.rotation.y = rot;
    castle.position.set(I.x, baseY, I.z);
    group.add(castle);
    // wall colliders: circles marching along each wall, skipping the gate
    const walls = [
      [-HALF, HALF, HALF, HALF, true],   // front (has the gate)
      [-HALF, -HALF, HALF, -HALF, false],
      [-HALF, -HALF, -HALF, HALF, false],
      [HALF, -HALF, HALF, HALF, false],
    ];
    for (const [x0, z0, x1, z1, gated] of walls) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 1.1);
      for (let i = 0; i <= n; i++) {
        const lx = x0 + (x1 - x0) * (i / n), lz = z0 + (z1 - z0) * (i / n);
        if (gated && Math.abs(lx) < GATE_HW + 0.2) continue;
        const p = toWorld(lx, lz);
        obstacles.push({ x: p.x, z: p.z, r: 0.85 });
      }
    }
    for (const [lx, lz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      const p = toWorld(lx, lz);
      obstacles.push({ x: p.x, z: p.z, r: 2.1 });
    }
    { const p = toWorld(0, -HALF + 1.9); obstacles.push({ x: p.x, z: p.z, r: 0.9 }); } // throne
    landmarks.push({ name: 'The Ice Castle', x: I.x, z: I.z, r: 24 });
  }

  // ---- Dark Forest: an obsidian monolith circle marks its heart -----------
  {
    const F = R.forest;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, mx = F.x + Math.sin(a) * 4.2, mz = F.z + Math.cos(a) * 4.2;
      const m = mesh(new THREE.BoxGeometry(0.9, 2.6 + rng() * 1.2, 0.7), OBSIDIAN, mx, ground(mx, mz) + 1.2, mz);
      m.rotation.y = a + (rng() - 0.5) * 0.4;
      obstacles.push({ x: mx, z: mz, r: 0.8 });
    }
    landmarks.push({ name: 'The Dark Forest', x: F.x, z: F.z, r: 28 });
  }

  // ---- Shifting Sands: a leaning sandstone obelisk ------------------------
  {
    const D = R.desert;
    const o = mesh(new THREE.BoxGeometry(1.1, 4.6, 1.1), SANDSTONE, D.x, ground(D.x, D.z) + 2.0, D.z);
    o.rotation.z = 0.12;
    mesh(new THREE.ConeGeometry(0.85, 0.9, 4), SANDSTONE, D.x - 0.55, ground(D.x, D.z) + 4.6, D.z);
    obstacles.push({ x: D.x, z: D.z, r: 1.1 });
    landmarks.push({ name: 'The Shifting Sands', x: D.x, z: D.z, r: 30 });
  }

  let t = 0;
  function update(dt) { // crystals breathe — material pulse, light count fixed
    t += dt;
    CRYSTAL.emissiveIntensity = 1.6 + Math.sin(t * 1.7) * 0.5;
    CRYSTAL_B.emissiveIntensity = 1.4 + Math.sin(t * 2.3 + 1.5) * 0.45;
  }

  scene.add(group);
  return {
    group, obstacles, landmarks, update,
    // the camera pulls in close inside the crystal dome, like the houses/cave
    insideCrystal: (x, z) => Math.hypot(x - R.crystal.x, z - R.crystal.z) < 6.5,
    dispose(sc) { sc.remove(group); group.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
