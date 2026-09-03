// The village and named landmarks from the character sheet: houses, the
// armory, the food market, the town square, Hope of the Axolotls Hill,
// the kelp grounds and the hunting point. All procedural primitives, placed
// deterministically on sites chosen by the terrain generator (WORLD.*).

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';
import { buildCoal, buildAxolotl } from '../player/coal.js';

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

// procedural surface textures: stucco for plaster walls, granite for stone
// (statues, fountain, armory) — neutral, multiplying the material colours
function surfaceTex(seed, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d4d4d4';
  ctx.fillRect(0, 0, 128, 128);
  let a = seed | 0;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  paint(ctx, rnd);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const stuccoTex = surfaceTex(0x57cc, (ctx, rnd) => {
  for (let i = 0; i < 160; i++) { // soft trowel blotches
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(120,115,105,0.07)' : 'rgba(255,255,250,0.08)';
    ctx.beginPath();
    ctx.arc(rnd() * 128, rnd() * 128, 3 + rnd() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
});
const graniteTex = surfaceTex(0x6a41, (ctx, rnd) => {
  for (let i = 0; i < 1400; i++) { // salt-and-pepper mineral flecks
    const v = rnd();
    ctx.fillStyle = v > 0.66 ? 'rgba(35,35,40,0.22)' : v > 0.33 ? 'rgba(255,255,255,0.16)' : 'rgba(160,150,140,0.14)';
    ctx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
  }
});
for (const m of MAT.plaster) m.map = stuccoTex;
MAT.stone.map = graniteTex;
MAT.stoneDark.map = graniteTex;

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function house(rng, own = false) {
  // hollow, enterable and TWO stories: table downstairs, bed on the upper
  // floor, a straight stair ramp along the right wall. Coal's own house also
  // gets a weapon display rack and a potion-maker cauldron.
  const g = new THREE.Group();
  const w = (own ? 6.4 : 5.6) + rng() * 0.8, d = (own ? 5.6 : 5.0) + rng() * 0.6;
  const h = 4.9; // two floors
  const wallMat = MAT.plaster[(rng() * MAT.plaster.length) | 0].clone();
  const roofMat = MAT.roof[(rng() * MAT.roof.length) | 0].clone();
  const T = 0.15, doorW = 1.1, doorH = 1.75;

  // floor rides 0.14 above the terrain — coplanar floors z-fight and flicker
  mesh(new THREE.BoxGeometry(w, 0.14, d), MAT.wood, g, 0, 0.15, 0);
  mesh(new THREE.BoxGeometry(w, h, T), wallMat, g, 0, h / 2, -(d - T) / 2); // back
  mesh(new THREE.BoxGeometry(T, h, d), wallMat, g, -(w - T) / 2, h / 2, 0); // left
  mesh(new THREE.BoxGeometry(T, h, d), wallMat, g, (w - T) / 2, h / 2, 0);  // right
  const segW = (w - doorW) / 2; // front, split around the doorway
  mesh(new THREE.BoxGeometry(segW, h, T), wallMat, g, -(doorW + segW) / 2, h / 2, (d - T) / 2);
  mesh(new THREE.BoxGeometry(segW, h, T), wallMat, g, (doorW + segW) / 2, h / 2, (d - T) / 2);
  mesh(new THREE.BoxGeometry(doorW, h - doorH, T), wallMat, g, 0, doorH + (h - doorH) / 2, (d - T) / 2);
  const cone = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 1.7 + rng() * 0.4, 4), roofMat, g, 0, h + 0.75, 0);
  cone.rotation.y = Math.PI / 4;
  // windows, both storeys
  for (const wy of [1.5, 3.6]) {
    mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), MAT.window, g, -w * 0.30, wy, (d - T) / 2 + 0.06);
    mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), MAT.window, g, w * 0.30, wy, (d - T) / 2 + 0.06);
  }
  if (own) { // Coal's door is gilded — you can't miss home
    mesh(new THREE.BoxGeometry(doorW + 0.16, 0.1, 0.1), MAT.shieldTrim, g, 0, doorH + 0.08, (d - T) / 2 + 0.04);
  }

  // upper floor: a loft slab over the FRONT (the doorway gets a real ceiling),
  // stairs along the open back wall, landing strip on the right wall
  const slabD = d * 0.55, slabY = 2.35;
  const slabZ = d / 2 - slabD / 2 - 0.05;
  mesh(new THREE.BoxGeometry(w - 0.25, 0.16, slabD), MAT.wood, g, 0, slabY, slabZ);
  const slabBack = d / 2 - slabD - 0.05;
  const stairY = slabY + 0.08;
  const stairRun = w - 1.2, stairW = 0.95;
  const stairZ = -(d - T) / 2 + 0.55;
  const slope = Math.atan2(slabY, stairRun);
  const ramp = mesh(new THREE.BoxGeometry(Math.hypot(stairRun, slabY) + 0.25, 0.12, stairW), MAT.woodDark, g,
    0, slabY / 2 - 0.02, stairZ);
  ramp.rotation.z = slope; // rises toward +x (right-back corner)
  // landing along the right wall bridging stair top → loft
  const landHL = (slabBack - stairZ) / 2 + 0.35;
  const landCZ = (slabBack + stairZ) / 2 + 0.1;
  mesh(new THREE.BoxGeometry(1.0, 0.14, landHL * 2), MAT.wood, g, w / 2 - 0.6, slabY, landCZ);

  // furniture: table + stools DOWNSTAIRS (open back zone), bed UPSTAIRS
  mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 10), MAT.woodDark, g, -w / 2 + 1.15, 0.74, -0.6);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 6), MAT.woodDark, g, -w / 2 + 1.15, 0.37, -0.6);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8), MAT.wood, g, -w / 2 + 0.55, 0.17, 0.0);
  mesh(new THREE.BoxGeometry(0.9, 0.34, 1.7), MAT.wood, g, -w / 2 + 0.75, slabY + 0.26, d / 2 - 1.15);
  mesh(new THREE.BoxGeometry(0.62, 0.15, 0.48), MAT.window, g, -w / 2 + 0.75, slabY + 0.5, d / 2 - 0.6);

  let rack = null, brewLocal = null;
  if (own) {
    // weapon display rack on the left wall — pieces appear as Coal buys them
    const bx = -(w - T) / 2 + 0.16;
    mesh(new THREE.BoxGeometry(0.1, 1.6, 2.2), MAT.woodDark, g, bx, 1.3, -0.4);
    rack = {};
    const hang = (key, builder, y, z) => {
      const item = builder();
      item.position.set(bx + 0.14, y, z);
      item.visible = false;
      g.add(item);
      rack[key] = item;
    };
    const swordMesh = (mat) => {
      const grp = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.09), mat); blade.position.y = 0.14;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), MAT.woodDark); grip.position.y = -0.28;
      grp.add(blade, grip);
      return grp;
    };
    hang('sword1', () => swordMesh(new THREE.MeshStandardMaterial({ color: 0x9a7648, roughness: 0.8 })), 1.7, -1.1);
    hang('sword2', () => swordMesh(MAT.metal), 1.7, -0.4);
    hang('bow1', () => {
      const grp = new THREE.Group();
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 14, Math.PI * 1.1),
        new THREE.MeshStandardMaterial({ color: 0x9a7648, roughness: 0.8 }));
      arc.rotation.y = Math.PI / 2; arc.rotation.z = -Math.PI * 0.55;
      grp.add(arc);
      return grp;
    }, 1.6, 0.3);
    hang('shell1', () => new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x6fa053, roughness: 0.7 })), 0.85, -1.1);
    hang('shell2', () => new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI), MAT.metal), 0.85, -0.4);
    for (const k of Object.keys(rack)) rack[k].traverse((o) => { o.castShadow = true; });

    // potion maker: a cauldron in the front-right corner (click it to brew)
    brewLocal = { x: w / 2 - 1.0, z: d / 2 - 1.15 };
    const pot = mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0x26262c, roughness: 0.6 }), g, brewLocal.x, 0.36, brewLocal.z);
    const goo = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x59c46a, roughness: 0.3, emissive: 0x1d4d26, emissiveIntensity: 0.6 }), g, brewLocal.x, 0.56, brewLocal.z);
    goo.castShadow = false;
    pot.userData.shopMode = 'brewing';
    goo.userData.shopMode = 'brewing';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 6), MAT.woodDark, g, brewLocal.x + Math.sin(a) * 0.24, 0.14, brewLocal.z + Math.cos(a) * 0.24);
      leg.userData.shopMode = 'brewing';
    }
  }

  // collider centerlines (local coords), transformed to world by place()
  const bxw = (w - T) / 2, bzw = (d - T) / 2, dhw = doorW / 2 + 0.1;
  const walls = [
    [-bxw + 0.1, -bzw, bxw - 0.1, -bzw],       // back
    [-bxw, -bzw + 0.1, -bxw, bzw - 0.1],        // left
    [bxw, -bzw + 0.1, bxw, bzw - 0.1],          // right
    [-bxw + 0.05, bzw, -dhw, bzw],              // front left of door
    [dhw, bzw, bxw - 0.05, bzw],                // front right of door
  ];
  // walkable upper surfaces (local): loft slab, back-wall stair (x-axis ramp),
  // and the right-wall landing
  const surfaces = [
    { type: 'rect', lx: 0, lz: slabZ, hw: (w - 0.25) / 2, hl: slabD / 2, y: stairY },
    { type: 'ramp', dir: 'x', lx: 0, lz: stairZ, hw: stairW / 2, hl: stairRun / 2, y0: stairY, y1: 0.05 },
    { type: 'rect', lx: w / 2 - 0.6, lz: landCZ, hw: 0.5, hl: landHL, y: stairY },
  ];
  return {
    g, r: 0, walls, surfaces, rack, brewLocal,
    fade: { mats: [wallMat, roofMat], r: Math.max(w, d) * 0.62 },
  };
}

function armory() {
  // hollow and enterable: stone walls, racks of arms inside
  const g = new THREE.Group();
  const w = 5.8, d = 4.8, h = 3.2, T = 0.18, doorW = 1.25, doorH = 1.9;
  const wallMat = MAT.stone.clone();
  const roofMat = MAT.stoneDark.clone();

  mesh(new THREE.BoxGeometry(w, 0.14, d), MAT.stoneDark, g, 0, 0.15, 0); // floor, above the terrain
  mesh(new THREE.BoxGeometry(w, h, T), wallMat, g, 0, h / 2, -(d - T) / 2);
  mesh(new THREE.BoxGeometry(T, h, d), wallMat, g, -(w - T) / 2, h / 2, 0);
  mesh(new THREE.BoxGeometry(T, h, d), wallMat, g, (w - T) / 2, h / 2, 0);
  const segW = (w - doorW) / 2;
  mesh(new THREE.BoxGeometry(segW, h, T), wallMat, g, -(doorW + segW) / 2, h / 2, (d - T) / 2);
  mesh(new THREE.BoxGeometry(segW, h, T), wallMat, g, (doorW + segW) / 2, h / 2, (d - T) / 2);
  mesh(new THREE.BoxGeometry(doorW, h - doorH, T), wallMat, g, 0, doorH + (h - doorH) / 2, (d - T) / 2);
  const cone = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 2.1, 4), roofMat, g, 0, h + 0.9, 0);
  cone.rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), MAT.window, g, -w * 0.3, 1.9, (d - T) / 2 + 0.06);
  mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), MAT.window, g, w * 0.3, 1.9, (d - T) / 2 + 0.06);

  // interior: a rack of display arms along the back wall + a counter
  mesh(new THREE.BoxGeometry(w - 1.2, 1.5, 0.12), MAT.woodDark, g, 0, 1.15, -(d - T) / 2 + 0.2);
  for (let i = 0; i < 4; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.05, 0.7, 0.08), MAT.metal, g, -1.4 + i * 0.9, 1.35, -(d - T) / 2 + 0.3);
    blade.rotation.z = (i % 2 ? 1 : -1) * 0.08;
  }
  const shieldDisp = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 16), MAT.shield, g, w / 2 - 0.55, 1.5, -0.6);
  shieldDisp.rotation.z = Math.PI / 2;
  mesh(new THREE.BoxGeometry(1.8, 0.75, 0.7), MAT.woodDark, g, -w / 2 + 1.3, 0.62, 0.8);

  // shield sign + barrels outside the door
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), MAT.woodDark, g, 1.8, 1.1, d / 2 + 0.5);
  const shield = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 18), MAT.shield, g, 1.8, 2.15, d / 2 + 0.5);
  shield.rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.14, 0.75, 0.1), MAT.shieldTrim, g, 1.8, 2.15, d / 2 + 0.53);
  mesh(new THREE.BoxGeometry(0.55, 0.14, 0.1), MAT.shieldTrim, g, 1.8, 2.15, d / 2 + 0.53);
  for (const bx of [-2.35, -3.0]) {
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 10), MAT.wood, g, bx, 0.4, d / 2 + 0.55);
  }

  const bxw = (w - T) / 2, bzw = (d - T) / 2, dhw = doorW / 2 + 0.1;
  const walls = [
    [-bxw + 0.1, -bzw, bxw - 0.1, -bzw],
    [-bxw, -bzw + 0.1, -bxw, bzw - 0.1],
    [bxw, -bzw + 0.1, bxw, bzw - 0.1],
    [-bxw + 0.05, bzw, -dhw, bzw],
    [dhw, bzw, bxw - 0.05, bzw],
  ];
  return { g, r: 0, walls, fade: { mats: [wallMat, roofMat], r: Math.max(w, d) * 0.62 } };
}

function stall(i, role) {
  const g = new THREE.Group();
  for (const [px, pz] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) {
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 6), MAT.wood, g, px, 1.0, pz);
  }
  mesh(new THREE.BoxGeometry(2.15, 0.75, 1.0), MAT.woodDark, g, 0, 0.62, 0);
  const awn = mesh(new THREE.BoxGeometry(2.5, 0.07, 1.5), MAT.awning[i % MAT.awning.length], g, 0, 2.06, 0.1);
  awn.rotation.x = -0.22;

  if (role === 'weapons') { // a display sword and a small shield on the counter
    const blade = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.05), MAT.metal, g, -0.45, 1.06, 0.1);
    blade.rotation.z = 1.25;
    mesh(new THREE.BoxGeometry(0.16, 0.05, 0.08), MAT.woodDark, g, -0.24, 1.02, 0.1);
    const shield = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14), MAT.shield, g, 0.55, 1.12, 0.1);
    shield.rotation.x = Math.PI / 2.4;
  } else if (role === 'potions') { // bottles of brew
    const glass = [0xd45f92, 0x6a4f9e, 0x4e8fa0];
    for (let b = 0; b < 3; b++) {
      const bm = new THREE.MeshStandardMaterial({ color: glass[b], roughness: 0.25 });
      mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.24, 8), bm, g, -0.5 + b * 0.5, 1.12, 0.1);
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 6), bm, g, -0.5 + b * 0.5, 1.29, 0.1);
      mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 6), MAT.wood, g, -0.5 + b * 0.5, 1.36, 0.1);
    }
  } else { // food: produce
    for (let p = 0; p < 3; p++) {
      mesh(new THREE.SphereGeometry(0.17, 10, 8), MAT.produce[(p + i) % MAT.produce.length], g, -0.6 + p * 0.6, 1.14, 0.1);
    }
  }
  mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), MAT.wood, g, 1.35, 0.25, 0.75);
  return { g, r: 1.7 };
}

function fountain() {
  // a tiered stone fountain for the square
  const g = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3585a8, roughness: 0.15 });
  mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.55, 18), MAT.stone, g, 0, 0.27, 0); // pool wall
  const pool = mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.08, 18), waterMat, g, 0, 0.5, 0);
  pool.castShadow = false;
  mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.15, 10), MAT.stoneDark, g, 0, 1.05, 0); // column
  mesh(new THREE.CylinderGeometry(0.85, 0.6, 0.3, 14), MAT.stone, g, 0, 1.68, 0); // upper basin
  const upper = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 14), waterMat, g, 0, 1.82, 0);
  upper.castShadow = false;
  // crowning statue: an axolotl holding a golden trident
  const statueTop = buildAxolotl({ name: 'fountainStatue', trident: 0xd4af37 });
  statueTop.root.traverse((o) => {
    if (o.name === 'blobShadow') { o.visible = false; return; }
    if (o.isMesh && !o.userData.noRecolor) { o.material = MAT.stone; o.castShadow = true; }
  });
  statueTop.root.scale.setScalar(0.85);
  statueTop.root.position.set(0, 1.86, 0);
  g.add(statueTop.root);
  // falling-water streams from the upper basin to the pool
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const jet = mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.25, 6), waterMat, g,
      Math.sin(a) * 0.72, 1.15, Math.cos(a) * 0.72);
    jet.castShadow = false;
    jet.rotation.z = Math.sin(a) * 0.12;
    jet.rotation.x = -Math.cos(a) * 0.12;
  }
  return { g, r: 2.35 };
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

function fishStand() {
  // the fishmonger's table on the square — sell your catch here
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(1.9, 0.8, 1.0), MAT.woodDark, g, 0, 0.62, 0);
  for (const [px, pz] of [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]) {
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), MAT.wood, g, px, 0.95, pz);
  }
  const awn = mesh(new THREE.BoxGeometry(2.2, 0.07, 1.4), MAT.awning[1], g, 0, 1.96, 0.1);
  awn.rotation.x = -0.2;
  const fishMat = new THREE.MeshStandardMaterial({ color: 0x7fa3c9, roughness: 0.35 });
  for (let f = 0; f < 3; f++) {
    const fish = mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), fishMat, g, -0.55 + f * 0.55, 1.08, 0.05);
    fish.rotation.z = Math.PI / 2;
    fish.scale.set(1, 1, 0.55);
    const tail = mesh(new THREE.ConeGeometry(0.09, 0.16, 5), fishMat, g, -0.85 + f * 0.55, 1.08, 0.05);
    tail.rotation.z = -Math.PI / 2;
    tail.scale.set(1, 1, 0.4);
  }
  mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.75, 10), MAT.wood, g, 1.25, 0.37, 0.65);
  return { g, r: 1.5 };
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

  const fadeHouses = []; // {x, z, r, mats} — main fades these when Coal is inside
  const walkSurfaces = []; // upper floors + stair ramps (world space)

  const place = (built, x, z, faceCenter = true, sink = 0.08) => {
    built.g.position.set(x, ground(x, z) - sink, z);
    if (faceCenter) built.g.rotation.y = Math.atan2(V.x - x, V.z - z);
    group.add(built.g);
    if (built.r > 0) obstacles.push({ x, z, r: built.r });
    const rot = built.g.rotation.y, cos = Math.cos(rot), sin = Math.sin(rot);
    if (built.walls) { // hollow building: circle-chains along each wall segment
      for (const [x1, z1, x2, z2] of built.walls) {
        const len = Math.hypot(x2 - x1, z2 - z1), steps = Math.max(1, Math.ceil(len / 0.45));
        for (let s = 0; s <= steps; s++) {
          const lx = x1 + ((x2 - x1) * s) / steps, lz = z1 + ((z2 - z1) * s) / steps;
          obstacles.push({ x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos, r: 0.3 });
        }
      }
    }
    if (built.surfaces) { // walkable upper floors, in world space
      const by = built.g.position.y;
      for (const s of built.surfaces) {
        walkSurfaces.push({
          type: s.type, dir: s.dir, rot, hw: s.hw, hl: s.hl,
          cx: x + s.lx * cos + s.lz * sin,
          cz: z - s.lx * sin + s.lz * cos,
          y: s.y !== undefined ? by + s.y : 0,
          y0: s.y0 !== undefined ? by + s.y0 : 0,
          y1: s.y1 !== undefined ? by + s.y1 : 0,
        });
      }
    }
    if (built.fade) fadeHouses.push({ x, z, r: built.fade.r, mats: built.fade.mats });
    return built.g;
  };

  // town square: packed-dirt plaza + fountain
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 28), MAT.dirt);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(V.x, ground(V.x, V.z) + 0.07, V.z);
  plaza.receiveShadow = true;
  group.add(plaza);
  place(fountain(), V.x, V.z);

  // the fish stand at the square's south-west edge (click to sell your catch)
  let fishStandPos = null;
  {
    const a = (205 / 180) * Math.PI;
    const x = V.x + Math.sin(a) * 6.8, z = V.z + Math.cos(a) * 6.8;
    const fg = place(fishStand(), x, z);
    fg.traverse((o) => { o.userData.shopMode = 'fishsale'; });
    fishStandPos = { x, z };
  }

  // houses ring the square — kept clear of the stall arc (30–90°) and the
  // armory (272°) so nothing stands in front of anything
  let houses = 0;
  for (const deg of [115, 150, 192, 232, 305, 5]) {
    const a = (deg / 180) * Math.PI + (rng() - 0.5) * 0.12;
    const r = 17.5 + rng() * 3.5;
    place(house(rng), V.x + Math.sin(a) * r, V.z + Math.cos(a) * r);
    houses++;
  }

  // the armory, west side (click the building to shop)
  {
    const a = (272 / 180) * Math.PI;
    const ag = place(armory(), V.x + Math.sin(a) * 21.5, V.z + Math.cos(a) * 21.5, true, 0.14);
    ag.traverse((o) => { o.userData.shopMode = 'armory'; });
  }

  // Coal's own house — gilded door, just off the square
  let rack = null, brewStand = null, ownHousePos = null;
  {
    const a = (335 / 180) * Math.PI;
    const x = V.x + Math.sin(a) * 16, z = V.z + Math.cos(a) * 16;
    const own = house(rng, true);
    place(own, x, z);
    rack = own.rack;
    ownHousePos = { x, z };
    const rot = own.g.rotation.y, cs = Math.cos(rot), sn = Math.sin(rot);
    brewStand = {
      x: x + own.brewLocal.x * cs + own.brewLocal.z * sn,
      z: z - own.brewLocal.x * sn + own.brewLocal.z * cs,
    };
    houses++;
    // a bobbing golden arrow floats over home so it's easy to find
    const arrow = new THREE.Group();
    const shaft = mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), MAT.shieldTrim, arrow, 0, 0.55, 0);
    const tip = mesh(new THREE.ConeGeometry(0.3, 0.5, 6), MAT.shieldTrim, arrow, 0, 0, 0);
    tip.rotation.x = Math.PI; // points down at the house
    shaft.castShadow = tip.castShadow = false;
    arrow.position.set(x, own.g.position.y + 7.8, z);
    group.add(arrow);
    group.userData.homeArrow = arrow;
  }

  // market stalls on the north-east edge of the square: weapons, food, potions
  let stallC = { x: 0, z: 0 };
  const stalls = [];
  const STALL_ROLES = ['weapons', 'market', 'potions'];
  for (let i = 0; i < 3; i++) {
    const a = ((38 + i * 22) / 180) * Math.PI;
    const x = V.x + Math.sin(a) * 12.5, z = V.z + Math.cos(a) * 12.5;
    const sg = place(stall(i, STALL_ROLES[i] === 'market' ? 'food' : STALL_ROLES[i]), x, z);
    sg.traverse((o) => { o.userData.shopMode = STALL_ROLES[i]; }); // click the stall to shop
    stalls.push({ x, z, mode: STALL_ROLES[i] });
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

  // the hunting point: lookout deck, targets, campfire, fishing pier
  const P = WORLD.hunt;
  let fishSpot = null;
  {
    const py = ground(P.x, P.z);
    const deck = new THREE.Group();
    deck.position.set(P.x, py, P.z);
    deck.rotation.y = Math.atan2(-P.x, -P.z); // faces inland
    for (const [lx, lz] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) {
      mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.3, 7), MAT.woodDark, deck, lx, 1.15, lz);
    }
    mesh(new THREE.BoxGeometry(3.2, 0.14, 3.2), MAT.wood, deck, 0, 2.3, 0);
    // railings — the inland (+z) edge keeps a 1m gap where the ramp arrives
    for (const [rx, rz, ry] of [[0, -1.55, 0], [-1.55, 0, Math.PI / 2], [1.55, 0, Math.PI / 2]]) {
      const rail = mesh(new THREE.BoxGeometry(3.2, 0.08, 0.08), MAT.wood, deck, rx, 3.05, rz);
      rail.rotation.y = ry;
      for (const px of [-1.4, 0, 1.4]) {
        mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), MAT.wood, deck,
          ry === 0 ? px : rx, 2.72, ry === 0 ? rz : px);
      }
    }
    for (const gx of [-1.15, 1.15]) { // short guard rails beside the gap
      mesh(new THREE.BoxGeometry(0.85, 0.08, 0.08), MAT.wood, deck, gx, 3.05, 1.55);
      mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), MAT.wood, deck, gx, 2.72, 1.55);
    }
    // climbing ramp up the inland side (grade ~0.7 — the slope gate allows it)
    const rampRise = 2.37, rampRun = 3.3;
    const rampPlank = mesh(new THREE.BoxGeometry(1.0, 0.12, Math.hypot(rampRun, rampRise) + 0.25), MAT.woodDark,
      deck, 0, rampRise / 2 - 0.03, 1.6 + rampRun / 2);
    rampPlank.rotation.x = Math.atan2(rampRise, rampRun);
    group.add(deck);
    { // walkable: ramp + platform (world-space, deck frame)
      const rot = deck.rotation.y, dc = Math.cos(rot), dsn = Math.sin(rot);
      const w2 = (lx, lz) => ({ x: P.x + lx * dc + lz * dsn, z: P.z - lx * dsn + lz * dc });
      const rampC = w2(0, 1.6 + rampRun / 2);
      const platC = w2(0, 0);
      walkSurfaces.push(
        { type: 'ramp', rot, hw: 0.55, hl: rampRun / 2 + 0.25, cx: rampC.x, cz: rampC.z, y0: py + 0.04, y1: py + rampRise + 0.06 },
        { type: 'rect', rot, hw: 1.6, hl: 1.6, cx: platC.x, cz: platC.z, y: py + rampRise + 0.06 },
      );
    }
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
    { // only the deck LEGS block movement — the platform above is walkable
      const rot = deck.rotation.y, dc = Math.cos(rot), dsn = Math.sin(rot);
      for (const [lx, lz] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) {
        obstacles.push({ x: P.x + lx * dc + lz * dsn, z: P.z - lx * dsn + lz * dc, r: 0.2 });
      }
    }

    // fishing pier: march out from the point to a gentle water entry
    let W = null;
    for (let a = 0; a < Math.PI * 2 && !W; a += 0.2) {
      for (let r = 6; r < 45; r += 2) {
        const x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
        const h = ground(x, z);
        if (h < WORLD.seaLevel + 0.35 && h > WORLD.seaLevel - 0.5) {
          const slope = Math.abs(ground(x + 2, z) - h) + Math.abs(ground(x, z + 2) - h);
          if (slope < 1.1) W = { x, z, a, gy: h };
          break; // water reached along this bearing either way
        }
        if (h < WORLD.seaLevel - 0.5) break;
      }
    }
    if (W) {
      const deckY = WORLD.seaLevel + 0.45;
      const pier = new THREE.Group();
      pier.position.set(W.x, 0, W.z);
      pier.rotation.y = Math.atan2(Math.sin(W.a), Math.cos(W.a)); // seaward
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 4.2), MAT.wood);
      deck.position.set(0, deckY, 1.9);
      const walkOn = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 1.6), MAT.wood);
      walkOn.position.set(0, (W.gy + deckY) / 2 - 0.02, -0.5);
      walkOn.rotation.x = Math.atan2(deckY - W.gy, 1.5);
      pier.add(deck, walkOn);
      for (const ppz of [0.6, 2.1, 3.6]) {
        for (const ppx of [-0.5, 0.5]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.7, 6), MAT.woodDark);
          post.position.set(ppx, deckY - 0.75, ppz);
          pier.add(post);
        }
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 1.8, 5), MAT.woodDark);
      rod.position.set(0.5, deckY + 0.7, 3.5);
      rod.rotation.set(-0.55, 0, 0.35);
      pier.add(rod);
      pier.traverse((o) => { o.userData.fishSpot = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(pier);
      const rot = pier.rotation.y, cs2 = Math.cos(rot), sn2 = Math.sin(rot);
      // walkable: an approach ramp from the shore, then the deck itself
      walkSurfaces.push(
        { type: 'ramp', rot, hw: 0.65, hl: 0.85, cx: W.x - 0.5 * sn2, cz: W.z - 0.5 * cs2, y0: deckY + 0.06, y1: W.gy + 0.03 },
        { type: 'rect', rot, hw: 0.65, hl: 2.1, cx: W.x + 1.9 * sn2, cz: W.z + 1.9 * cs2, y: deckY + 0.06 },
      );
      fishSpot = { x: W.x + 3.2 * sn2, z: W.z + 3.2 * cs2 };
    }
  }

  const landmarks = [
    { name: 'Axolotl Village', x: V.x, z: V.z, r: 30 },
    { name: 'Town Square', x: V.x, z: V.z, r: 8.5 },
    { name: 'Food Market', x: stallC.x, z: stallC.z, r: 7 },
    { name: 'The Armory', x: V.x + Math.sin((272 / 180) * Math.PI) * 21.5, z: V.z + Math.cos((272 / 180) * Math.PI) * 21.5, r: 6.5 },
    { name: 'Hope of the Axolotls Hill', x: H.x, z: H.z, r: 11 },
    { name: 'The Kelp Grounds', x: K.x, z: K.z, r: 14 },
    { name: 'The Hunting Point', x: P.x, z: P.z, r: 10 },
    { name: "Coal's House", x: ownHousePos.x, z: ownHousePos.z, r: 5.5 },
  ];

  group.userData.counts = { houses, stalls: 3, kelp: kelpSpots.length, landmarks: landmarks.length };
  return { group, obstacles, landmarks, fadeHouses, stalls, walkSurfaces, rack, brewStand, fishStandPos, fishSpot };
}
