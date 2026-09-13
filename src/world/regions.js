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

  // ---- Ice Castle: a real keep with ROOMS — courtyard, an armoury wing, a
  // library wing, a throne hall at the back — flower pots on the walls, and
  // King Olm's court inside (monsters.js garrisons it)
  {
    const I = R.ice, HALF = 16;
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
    const GATE_HW = 2.0, WALL_H = 5.2, T = 0.8;
    const wallRuns = []; // [x0,z0,x1,z1,gateHalf] — becomes colliders below
    const wallBox = (x0, z0, x1, z1, gateHalf = 0) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const horiz = Math.abs(z1 - z0) < 1e-6;
      if (gateHalf > 0) { // split around a doorway + lintel over it
        const seg = (len - gateHalf * 2) / 2;
        if (horiz) {
          cmesh(new THREE.BoxGeometry(seg, WALL_H, T), ICE, x0 + seg / 2, WALL_H / 2, cz);
          cmesh(new THREE.BoxGeometry(seg, WALL_H, T), ICE, x1 - seg / 2, WALL_H / 2, cz);
          cmesh(new THREE.BoxGeometry(gateHalf * 2, WALL_H - 2.7, T), ICE, cx, 2.7 + (WALL_H - 2.7) / 2, cz);
        } else {
          cmesh(new THREE.BoxGeometry(T, WALL_H, seg), ICE, cx, WALL_H / 2, z0 + seg / 2);
          cmesh(new THREE.BoxGeometry(T, WALL_H, seg), ICE, cx, WALL_H / 2, z1 - seg / 2);
          cmesh(new THREE.BoxGeometry(T, WALL_H - 2.7, gateHalf * 2), ICE, cx, 2.7 + (WALL_H - 2.7) / 2, cz);
        }
      } else if (horiz) {
        cmesh(new THREE.BoxGeometry(len, WALL_H, T), ICE, cx, WALL_H / 2, cz);
      } else {
        cmesh(new THREE.BoxGeometry(T, WALL_H, len), ICE, cx, WALL_H / 2, cz);
      }
      wallRuns.push([x0, z0, x1, z1, gateHalf]);
    };
    // curtain walls (gate at the front centre)
    wallBox(-HALF, HALF, HALF, HALF, GATE_HW);
    wallBox(-HALF, -HALF, HALF, -HALF);
    wallBox(-HALF, -HALF, -HALF, HALF);
    wallBox(HALF, -HALF, HALF, HALF);
    // interior partitions: armoury wing (left), library wing (right), and the
    // throne hall across the back — each with its own doorway
    wallBox(-HALF, 2, -6, 2, 0);            // armoury south wall...
    wallBox(-6, 2, -6, -4, 1.4);            // ...with its door on the east side
    wallBox(6, 2, HALF, 2, 0);              // library south wall
    wallBox(6, 2, 6, -4, 1.4);              // library door
    wallBox(-HALF, -4, HALF, -4, 2.2);      // throne hall wall, wide doorway
    // corner towers with snow-capped cones
    for (const [lx, lz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      cmesh(new THREE.CylinderGeometry(2.0, 2.4, 8.0, 10), ICE_DARK, lx, 4.0, lz);
      cmesh(new THREE.ConeGeometry(2.5, 3.0, 10), SNOWCAP, lx, 9.4, lz);
    }
    // THRONE HALL: dais, King Olm's throne, icicle finials
    cmesh(new THREE.BoxGeometry(6.4, 0.5, 4.2), ICE_DARK, 0, 0.25, -HALF + 3.4);
    cmesh(new THREE.BoxGeometry(1.9, 1.4, 1.1), ICE, 0, 1.2, -HALF + 2.6);
    cmesh(new THREE.BoxGeometry(1.9, 3.2, 0.35), ICE, 0, 2.4, -HALF + 2.0);
    for (const side of [-1, 1]) {
      cmesh(new THREE.ConeGeometry(0.18, 1.1, 6), ICE, side * 0.8, 4.4, -HALF + 2.0);
    }
    // ARMOURY WING: weapon racks, blades, a shield, barrels
    {
      const ax = -HALF + 4.6, az = -1;
      cmesh(new THREE.BoxGeometry(5.4, 1.8, 0.14), OBSIDIAN, ax, 1.3, -3.6);
      for (let i = 0; i < 5; i++) {
        const blade = cmesh(new THREE.BoxGeometry(0.06, 0.9, 0.1), ICE_DARK, ax - 2 + i * 1.0, 1.5, -3.45);
        blade.rotation.z = (i % 2 ? 1 : -1) * 0.07;
      }
      const sh = cmesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), ICE, ax + 2.9, 1.6, -3.45);
      sh.rotation.x = Math.PI / 2;
      for (const bx of [ax - 3.4, ax - 2.6]) {
        cmesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 10), OBSIDIAN, bx, 0.45, az + 1.6);
      }
    }
    // LIBRARY WING: two big shelves with bright frozen-book spines + lectern
    {
      const lx = HALF - 4.6;
      const spineCols = [0x5a7fc4, 0x9a6ac4, 0x4aa3c8, 0xc45a8a, 0x5aa08a];
      for (const sz of [-3.4, -1.2]) {
        cmesh(new THREE.BoxGeometry(4.6, 2.4, 0.35), ICE_DARK, lx, 1.4, sz);
        for (let s = 0; s < 10; s++) {
          const sc = new THREE.MeshStandardMaterial({ color: spineCols[s % spineCols.length], roughness: 0.7 });
          cmesh(new THREE.BoxGeometry(0.34, 0.42 + (s % 3) * 0.05, 0.16), sc,
            lx - 2 + (s % 5) * 0.9, 0.75 + Math.floor(s / 5) * 1.05, sz + 0.26);
        }
      }
      cmesh(new THREE.BoxGeometry(0.5, 1.1, 0.4), OBSIDIAN, lx, 0.73, 0.6);
      const top = cmesh(new THREE.BoxGeometry(0.62, 0.06, 0.5), ICE, lx, 1.3, 0.6);
      top.rotation.x = -0.25;
    }
    // FLOWER POTS on the walls — colour against all that ice
    const potMat = new THREE.MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.9 });
    const bloomMats = [0xe86a8a, 0x6ac4e8, 0xe8c53c].map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    let pot = 0;
    for (const [px, pz] of [[-4.5, HALF - 0.8], [4.5, HALF - 0.8], [-HALF + 0.8, 6], [HALF - 0.8, 6],
      [-HALF + 0.8, -8], [HALF - 0.8, -8], [-2.5, -4 + 0.8], [2.5, -4 + 0.8]]) {
      cmesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 8), potMat, px, WALL_H + 0.15, pz);
      const bloom = cmesh(new THREE.SphereGeometry(0.2, 8, 6), bloomMats[pot++ % 3], px, WALL_H + 0.42, pz);
      bloom.scale.y = 0.8;
    }
    // ice spikes in the courtyard
    for (let i = 0; i < 5; i++) {
      const lx = (rng() - 0.5) * 16, lz = 3.5 + rng() * 9;
      if (Math.abs(lx) < 2.6) continue; // keep the gate lane clear
      cmesh(new THREE.ConeGeometry(0.35 + rng() * 0.3, 1.4 + rng() * 1.6, 7), ICE, lx, 0.6, lz);
    }
    castle.rotation.y = rot;
    castle.position.set(I.x, baseY, I.z);
    group.add(castle);
    // colliders: circles marching along every wall run, skipping doorways
    for (const [x0, z0, x1, z1, gateHalf] of wallRuns) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 1.1));
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (let i = 0; i <= n; i++) {
        const lx = x0 + (x1 - x0) * (i / n), lz = z0 + (z1 - z0) * (i / n);
        if (gateHalf > 0 && Math.hypot(lx - cx, lz - cz) < gateHalf + 0.25) continue;
        const p = toWorld(lx, lz);
        obstacles.push({ x: p.x, z: p.z, r: 0.85 });
      }
    }
    for (const [lx, lz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      const p = toWorld(lx, lz);
      obstacles.push({ x: p.x, z: p.z, r: 2.4 });
    }
    { const p = toWorld(0, -HALF + 2.5); obstacles.push({ x: p.x, z: p.z, r: 1.2 }); } // throne
    // where monsters.js should put the king and his court (world space)
    WORLD.castle = {
      throne: toWorld(0, -HALF + 5.5),
      rooms: [toWorld(-HALF + 5, -1), toWorld(HALF - 5, -1), toWorld(-4, 8), toWorld(4, 8), toWorld(0, -HALF + 7)],
    };
    landmarks.push({ name: 'The Ice Castle', x: I.x, z: I.z, r: 30 });
  }

  // ---- Dark Forest: an obsidian monolith circle marks its heart -----------
  let blackMarket = null;
  {
    const F = R.forest;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, mx = F.x + Math.sin(a) * 4.2, mz = F.z + Math.cos(a) * 4.2;
      const m = mesh(new THREE.BoxGeometry(0.9, 2.6 + rng() * 1.2, 0.7), OBSIDIAN, mx, ground(mx, mz) + 1.2, mz);
      m.rotation.y = a + (rng() - 0.5) * 0.4;
      obstacles.push({ x: mx, z: mz, r: 0.8 });
    }
    // the Black Market: a shady stand under a violet canopy, just outside
    // the monolith ring. Click it to browse the thousand-token stock.
    {
      const dv = Math.hypot(V.x - F.x, V.z - F.z) || 1;
      const bx = F.x + ((V.x - F.x) / dv) * 8.5, bz = F.z + ((V.z - F.z) / dv) * 8.5;
      const by = ground(bx, bz);
      const rot = Math.atan2(V.x - bx, V.z - bz);
      const stand = new THREE.Group();
      const CANOPY = new THREE.MeshStandardMaterial({ color: 0x3a2450, roughness: 0.85 });
      const cnt = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 1.0), OBSIDIAN);
      cnt.position.y = 0.6;
      const awn = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.6), CANOPY);
      awn.position.set(0, 2.1, 0.1);
      awn.rotation.x = -0.2;
      stand.add(cnt, awn);
      for (const [px, pz] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.6], [1.05, 0.6]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 6), OBSIDIAN);
        post.position.set(px, 1.02, pz);
        stand.add(post);
      }
      // a sinister little lantern (emissive only — light count stays fixed)
      const lam = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xb46aff, emissive: 0x7a2ae0, emissiveIntensity: 2.2, roughness: 0.4 }));
      lam.position.set(0.9, 1.75, 0.4);
      stand.add(lam);
      // wares on the counter: a dark trident head and a black shell
      const tr = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), OBSIDIAN);
      tr.position.set(-0.5, 1.2, 0.1);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x232028, roughness: 0.35 }));
      sh.position.set(0.45, 1.1, 0.1);
      sh.rotation.x = -Math.PI / 2;
      stand.add(tr, sh);
      stand.rotation.y = rot;
      stand.position.set(bx, by, bz);
      stand.traverse((o) => {
        o.castShadow = true;
        o.userData.shopMode = 'blackmarket';
      });
      group.add(stand);
      obstacles.push({ x: bx, z: bz, r: 1.4 });
      blackMarket = { x: bx, z: bz };
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
    group, obstacles, landmarks, update, blackMarket,
    // the camera pulls in close inside the crystal dome, like the houses/cave
    insideCrystal: (x, z) => Math.hypot(x - R.crystal.x, z - R.crystal.z) < 6.5,
    dispose(sc) { sc.remove(group); group.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
