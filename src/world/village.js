// The village and named landmarks from the character sheet: houses, the
// armory, the food market, the town square, Hope of the Axolotls Hill,
// the kelp grounds and the hunting point. All procedural primitives, placed
// deterministically on sites chosen by the terrain generator (WORLD.*).

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';
import { buildCoal } from '../player/coal.js';

const MAT = {
  plaster: [0xe9dfc8, 0xf0e8d8, 0xdac9a2].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
  roof: [0xa85a42, 0x687487, 0x76874f, 0x8a5a74].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })),
  wood: new THREE.MeshStandardMaterial({ color: 0x6e5a42, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x54432f, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xa19d92, roughness: 0.95 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x827e74, roughness: 0.95 }),
  window: new THREE.MeshStandardMaterial({ color: 0xf6f1de, roughness: 0.4 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0xb59b76, roughness: 1 }),
  awning: [0xc4574e, 0x4e8fa0, 0xd9a441].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
  produce: [0xd96a3f, 0x89a83d, 0xd9c441].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
  shield: new THREE.MeshStandardMaterial({ color: 0xc4574e, roughness: 0.6 }),
  shieldTrim: new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x555a61, roughness: 0.45, metalness: 0.4 }),
  kelp: new THREE.MeshStandardMaterial({ color: 0x3f7d4a, roughness: 0.8 }),
  flag: new THREE.MeshStandardMaterial({ color: 0xe58bb0, roughness: 0.7, side: THREE.DoubleSide }),
  target: [0xf2f0e8, 0xc4574e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  charcoal: new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 1 }),
};

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function house(rng) {
  const g = new THREE.Group();
  const w = 3.4 + rng() * 1.0, d = 3.0 + rng() * 0.8, h = 2.2 + rng() * 0.4;
  const wall = MAT.plaster[(rng() * MAT.plaster.length) | 0];
  const roof = MAT.roof[(rng() * MAT.roof.length) | 0];
  mesh(new THREE.BoxGeometry(w, h, d), wall, g, 0, h / 2 - 0.06, 0);
  const cone = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.5 + rng() * 0.4, 4), roof, g, 0, h + 0.68, 0);
  cone.rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.85, 1.35, 0.1), MAT.woodDark, g, 0, 0.6, d / 2 + 0.02);
  mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), MAT.window, g, -w * 0.28, 1.35, d / 2 + 0.02);
  mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), MAT.window, g, w * 0.28, 1.35, d / 2 + 0.02);
  if (rng() > 0.5) mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), MAT.stone, g, w * 0.3, h + 0.75, -d * 0.2);
  return { g, r: Math.max(w, d) * 0.72 };
}

function armory() {
  const g = new THREE.Group();
  const w = 5.2, d = 4.4, h = 2.9;
  mesh(new THREE.BoxGeometry(w, h, d), MAT.stone, g, 0, h / 2 - 0.1, 0);
  const cone = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 2.1, 4), MAT.stoneDark, g, 0, h + 0.9, 0);
  cone.rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(1.1, 1.6, 0.12), MAT.metal, g, 0, 0.72, d / 2 + 0.02);
  mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), MAT.window, g, -w * 0.3, 1.7, d / 2 + 0.02);
  mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), MAT.window, g, w * 0.3, 1.7, d / 2 + 0.02);
  // shield sign on a post by the door
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), MAT.woodDark, g, 1.6, 1.1, d / 2 + 0.5);
  const shield = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 18), MAT.shield, g, 1.6, 2.15, d / 2 + 0.5);
  shield.rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.14, 0.75, 0.1), MAT.shieldTrim, g, 1.6, 2.15, d / 2 + 0.53);
  mesh(new THREE.BoxGeometry(0.55, 0.14, 0.1), MAT.shieldTrim, g, 1.6, 2.15, d / 2 + 0.53);
  // barrels
  for (const bx of [-2.1, -2.75]) {
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 10), MAT.wood, g, bx, 0.4, d / 2 + 0.55);
  }
  return { g, r: 3.4 };
}

function stall(i) {
  const g = new THREE.Group();
  for (const [px, pz] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) {
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 6), MAT.wood, g, px, 1.0, pz);
  }
  mesh(new THREE.BoxGeometry(2.15, 0.75, 1.0), MAT.woodDark, g, 0, 0.62, 0);
  const awn = mesh(new THREE.BoxGeometry(2.5, 0.07, 1.5), MAT.awning[i % MAT.awning.length], g, 0, 2.06, 0.1);
  awn.rotation.x = -0.22;
  for (let p = 0; p < 3; p++) {
    mesh(new THREE.SphereGeometry(0.17, 10, 8), MAT.produce[(p + i) % MAT.produce.length], g, -0.6 + p * 0.6, 1.14, 0.1);
  }
  mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), MAT.wood, g, 1.35, 0.25, 0.75);
  return { g, r: 1.7 };
}

function well() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.85, 14), MAT.stone, g, 0, 0.42, 0);
  const water = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 14),
    new THREE.MeshStandardMaterial({ color: 0x2f6d8c, roughness: 0.2 }), g, 0, 0.78, 0);
  water.castShadow = false;
  for (const px of [-0.85, 0.85]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 6), MAT.woodDark, g, px, 1.2, 0);
  const roof = mesh(new THREE.ConeGeometry(1.35, 0.75, 4), MAT.roof[0], g, 0, 2.3, 0);
  roof.rotation.y = Math.PI / 4;
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 6), MAT.woodDark, g, 0, 2.0, 0).rotation.z = Math.PI / 2;
  return { g, r: 1.4 };
}

function statue() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 16), MAT.stoneDark, g, 0, 0.15, 0);
  mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.6, 14), MAT.stone, g, 0, 0.6, 0);
  const coal = buildCoal().root;
  coal.traverse((o) => {
    if (o.name === 'blobShadow') { o.visible = false; return; }
    if (o.isMesh) { o.material = MAT.stone; o.castShadow = true; }
  });
  coal.scale.setScalar(1.35);
  coal.position.y = 0.9;
  g.add(coal);
  return { g, r: 1.9 };
}

function bentKelpGeometry() {
  const geo = new THREE.CylinderGeometry(0.02, 0.07, 2.6, 5, 6);
  geo.translate(0, 1.3, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = y / 2.6;
    pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI * 1.2) * 0.4 * t);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildVillage(field, seed) {
  const ground = field.groundAt;
  const rng = mulberry32(seed ^ 0x71C3);
  const group = new THREE.Group();
  group.name = 'village';
  const obstacles = [];
  const V = WORLD.village;

  const place = (built, x, z, faceCenter = true, sink = 0.08) => {
    built.g.position.set(x, ground(x, z) - sink, z);
    if (faceCenter) built.g.rotation.y = Math.atan2(V.x - x, V.z - z);
    group.add(built.g);
    if (built.r > 0) obstacles.push({ x, z, r: built.r });
    return built.g;
  };

  // town square: packed-dirt plaza + well
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 28), MAT.dirt);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(V.x, ground(V.x, V.z) + 0.04, V.z);
  plaza.receiveShadow = true;
  group.add(plaza);
  place(well(), V.x, V.z);

  // houses ring the square
  let houses = 0;
  for (const deg of [20, 75, 140, 200, 250, 310]) {
    const a = (deg / 180) * Math.PI + (rng() - 0.5) * 0.2;
    const r = 15 + rng() * 4;
    place(house(rng), V.x + Math.sin(a) * r, V.z + Math.cos(a) * r);
    houses++;
  }

  // the armory, west side
  {
    const a = (272 / 180) * Math.PI;
    place(armory(), V.x + Math.sin(a) * 21.5, V.z + Math.cos(a) * 21.5, true, 0.14);
  }

  // food market: stall arc on the north-east edge of the square
  let stallC = { x: 0, z: 0 };
  for (let i = 0; i < 3; i++) {
    const a = ((38 + i * 22) / 180) * Math.PI;
    const x = V.x + Math.sin(a) * 12.5, z = V.z + Math.cos(a) * 12.5;
    place(stall(i), x, z);
    stallC.x += x / 3; stallC.z += z / 3;
  }

  // Hope of the Axolotls Hill: stone Coal statue, standing stones, flowers
  const H = WORLD.hill;
  place(statue(), H.x, H.z, false, 0.1).rotation.y = Math.atan2(V.x - H.x, V.z - H.z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const sx = H.x + Math.sin(a) * 3.6, sz = H.z + Math.cos(a) * 3.6;
    const s = mesh(new THREE.DodecahedronGeometry(0.5, 0), MAT.stoneDark, group, sx, ground(sx, sz) + 0.35, sz);
    s.scale.set(0.7, 1.6 + rng() * 0.5, 0.7);
    s.rotation.y = rng() * Math.PI;
    obstacles.push({ x: sx, z: sz, r: 0.5 });
  }
  { // banner pole with a pink flag
    const px = H.x + 2.2, pz = H.z - 1.5, py = ground(px, pz);
    mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), MAT.woodDark, group, px, py + 2.3, pz);
    const flag = mesh(new THREE.PlaneGeometry(1.5, 0.9), MAT.flag, group, px + 0.78, py + 4.05, pz);
    flag.castShadow = true;
  }
  const flowerStem = new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5);
  flowerStem.translate(0, 0.14, 0);
  const stems = new THREE.InstancedMesh(flowerStem, MAT.kelp, 26);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), MAT.window, 26);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fcol = new THREE.Color();
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, r = 2.4 + rng() * 2.6;
    const fx = H.x + Math.sin(a) * r, fz = H.z + Math.cos(a) * r;
    fm.compose(new THREE.Vector3(fx, ground(fx, fz), fz), fq, new THREE.Vector3(1, 0.8 + rng() * 0.5, 1));
    stems.setMatrixAt(i, fm);
    fm.compose(new THREE.Vector3(fx, ground(fx, fz) + 0.3, fz), fq, new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, fm);
    heads.setColorAt(i, fcol.setHSL([0.93, 0.12, 0.0][i % 3], 0.55, 0.72));
  }
  group.add(stems, heads);

  // the kelp grounds: swaying-looking strands in the shallows
  const K = WORLD.kelp;
  const kelpGeo = bentKelpGeometry();
  const kelpSpots = [];
  for (let i = 0; i < 900 && kelpSpots.length < 90; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * K.r;
    const x = K.x + Math.sin(a) * r, z = K.z + Math.cos(a) * r;
    const depth = WORLD.seaLevel - ground(x, z);
    if (depth < 0.35 || depth > 1.8) continue;
    // tall enough that the tips break the surface
    kelpSpots.push({ x, z, s: (depth + 0.7) / 2.6 + rng() * 0.25, rot: rng() * Math.PI * 2 });
  }
  const kelps = new THREE.InstancedMesh(kelpGeo, MAT.kelp, kelpSpots.length);
  kelpSpots.forEach((k, i) => {
    fq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.rot);
    fm.compose(new THREE.Vector3(k.x, ground(k.x, k.z), k.z), fq, new THREE.Vector3(1, k.s, 1));
    kelps.setMatrixAt(i, fm);
  });
  kelps.castShadow = true;
  group.add(kelps);

  // the hunting point: lookout deck, targets, campfire
  const P = WORLD.hunt;
  {
    const py = ground(P.x, P.z);
    const deck = new THREE.Group();
    deck.position.set(P.x, py, P.z);
    deck.rotation.y = Math.atan2(-P.x, -P.z); // faces inland
    for (const [lx, lz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
      mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.3, 7), MAT.woodDark, deck, lx, 1.15, lz);
    }
    mesh(new THREE.BoxGeometry(2.7, 0.14, 2.7), MAT.wood, deck, 0, 2.3, 0);
    for (const [rx, rz, ry] of [[0, -1.3, 0], [0, 1.3, 0], [-1.3, 0, Math.PI / 2], [1.3, 0, Math.PI / 2]]) {
      const rail = mesh(new THREE.BoxGeometry(2.7, 0.08, 0.08), MAT.wood, deck, rx, 3.05, rz);
      rail.rotation.y = ry;
      for (const px of [-1.2, 0, 1.2]) {
        const post = mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), MAT.wood, deck,
          ry === 0 ? px : rx, 2.72, ry === 0 ? rz : px);
        void post;
      }
    }
    group.add(deck);
    // two archery targets on sticks
    for (const [tx, tz] of [[4.2, 1.6], [5.0, -1.8]]) {
      const wx = P.x + tx, wz = P.z + tz, wy = ground(wx, wz);
      if (wy < WORLD.seaLevel) continue;
      const t = new THREE.Group();
      t.position.set(wx, wy, wz);
      t.rotation.y = Math.atan2(P.x - wx, P.z - wz);
      mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), MAT.woodDark, t, 0, 0.5, 0);
      const rings = [[0.45, 0], [0.32, 1], [0.2, 0], [0.09, 1]];
      rings.forEach(([rr, m], j) => {
        const ring = mesh(new THREE.CylinderGeometry(rr, rr, 0.06 + j * 0.012, 16), MAT.target[m], t, 0, 1.1, 0);
        ring.rotation.x = Math.PI / 2;
      });
      group.add(t);
    }
    // campfire
    const fx = P.x - 3.0, fz = P.z + 0.6, fy = ground(fx, fz);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new THREE.DodecahedronGeometry(0.15, 0), MAT.stone, group,
        fx + Math.sin(a) * 0.55, fy + 0.1, fz + Math.cos(a) * 0.55);
    }
    const ash = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), MAT.charcoal, group, fx, fy + 0.05, fz);
    ash.castShadow = false;
    for (const lr of [0.5, -0.4]) {
      const log = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), MAT.woodDark, group, fx, fy + 0.14, fz);
      log.rotation.set(Math.PI / 2.2, 0, lr);
    }
    obstacles.push({ x: P.x, z: P.z, r: 1.55 });
  }

  const landmarks = [
    { name: 'Axolotl Village', x: V.x, z: V.z, r: 30 },
    { name: 'Town Square', x: V.x, z: V.z, r: 8.5 },
    { name: 'Food Market', x: stallC.x, z: stallC.z, r: 7 },
    { name: 'The Armory', x: V.x + Math.sin((272 / 180) * Math.PI) * 21.5, z: V.z + Math.cos((272 / 180) * Math.PI) * 21.5, r: 6.5 },
    { name: 'Hope of the Axolotls Hill', x: H.x, z: H.z, r: 11 },
    { name: 'The Kelp Grounds', x: K.x, z: K.z, r: 14 },
    { name: 'The Hunting Point', x: P.x, z: P.z, r: 10 },
  ];

  group.userData.counts = { houses, stalls: 3, kelp: kelpSpots.length, landmarks: landmarks.length };
  return { group, obstacles, landmarks };
}
