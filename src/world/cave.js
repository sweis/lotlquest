// The Moxolotl Cave — a great rock structure ON the surface: a ring of
// boulders with a doorway facing the village, capped by a rocky dome, torch
// lit inside. Sits on a pad the terrain generator levels at WORLD.cave.
// Someone lives here... later.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';

const ROCK_IN = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1, side: THREE.DoubleSide });
const ROCK = new THREE.MeshStandardMaterial({ color: 0x6a645c, roughness: 1 });
const FLOOR = new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 1 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9 });
const FLAME = new THREE.MeshStandardMaterial({
  color: 0xffb44d, emissive: 0xff8c2a, emissiveIntensity: 3.2, roughness: 1,
});

const RING_R = 8;      // boulder-wall radius
const DOOR_HALF = 0.5; // half-angle of the doorway gap (radians)

export function buildCave(field, scene, seed) {
  const rng = mulberry32(seed ^ 0xca4e);
  const ground = field.groundAt;
  const C = { x: WORLD.cave.x, z: WORLD.cave.z };
  const baseY = ground(C.x, C.z);
  const doorDir = Math.atan2(WORLD.village.x - C.x, WORLD.village.z - C.z);

  const group = new THREE.Group();
  group.name = 'moxolotlCave';
  const obstacles = [];

  // boulder ring with a gap at the door
  for (let a = 0; a < Math.PI * 2; a += 0.38) {
    let diff = a - doorDir;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < DOOR_HALF) continue;
    const bx = C.x + Math.sin(a) * RING_R, bz = C.z + Math.cos(a) * RING_R;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 0), ROCK);
    b.position.set(bx, baseY + 1.5, bz);
    b.scale.set(1.15, 1.5 + rng() * 0.6, 1.15);
    b.rotation.set(rng() * 0.3, rng() * Math.PI, rng() * 0.3);
    b.castShadow = b.receiveShadow = true;
    group.add(b);
    obstacles.push({ x: bx, z: bz, r: 2.15 }); // covers the boulder's visual girth
  }
  // door pillars + lintel
  for (const side of [-1, 1]) {
    const a = doorDir + side * (DOOR_HALF + 0.12);
    const px = C.x + Math.sin(a) * RING_R, pz = C.z + Math.cos(a) * RING_R;
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), ROCK);
    p.position.set(px, baseY + 1.5, pz);
    p.scale.set(0.9, 2.0, 0.9);
    p.rotation.y = rng() * Math.PI;
    p.castShadow = true;
    group.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), ROCK);
  lintel.position.set(C.x + Math.sin(doorDir) * RING_R, baseY + 3.6, C.z + Math.cos(doorDir) * RING_R);
  lintel.scale.set(2.6, 0.8, 1.1);
  lintel.rotation.y = doorDir;
  lintel.castShadow = true;
  group.add(lintel);

  // rocky dome cap — DoubleSide, so it's a boulder outside and a ceiling inside
  const domeGeo = new THREE.SphereGeometry(RING_R + 2.2, 26, 16);
  {
    const pos = domeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const n = 1 + (rng() - 0.5) * 0.12;
      pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * 0.55 * n, pos.getZ(i) * n);
    }
    domeGeo.computeVertexNormals();
  }
  const dome = new THREE.Mesh(domeGeo, ROCK_IN);
  dome.position.set(C.x, baseY + 1.3, C.z);
  dome.castShadow = true;
  group.add(dome);

  // interior: dark floor, stalagmites, torches
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RING_R - 0.6, 26), FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(C.x, baseY + 0.06, C.z);
  floor.receiveShadow = true;
  group.add(floor);
  for (let i = 0; i < 6; i++) {
    const a = rng() * Math.PI * 2, r = RING_R * (0.5 + rng() * 0.3);
    let diff = a - doorDir;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < 0.7) continue; // keep the doorway clear
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.3 + rng() * 0.25, 1.0 + rng() * 1.4, 6), ROCK);
    s.position.set(C.x + Math.sin(a) * r, baseY, C.z + Math.cos(a) * r);
    s.castShadow = true;
    group.add(s);
  }

  const lights = [];
  const flames = [];
  const torchSpots = [];
  for (let i = 0; i < 6; i++) {
    const a = doorDir + Math.PI + ((i - 2.5) / 6) * Math.PI * 1.5;
    torchSpots.push({
      x: C.x + Math.sin(a) * (RING_R - 1.6),
      z: C.z + Math.cos(a) * (RING_R - 1.6),
    });
  }
  for (const side of [-1, 1]) {
    const a = doorDir + side * (DOOR_HALF + 0.28);
    torchSpots.push({ x: C.x + Math.sin(a) * (RING_R - 0.6), z: C.z + Math.cos(a) * (RING_R - 0.6) });
  }
  for (const t of torchSpots) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.25, 6), WOOD);
    post.position.set(t.x, baseY + 0.62, t.z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 6), FLAME);
    flame.position.set(t.x, baseY + 1.44, t.z);
    group.add(post, flame);
    flames.push(flame);
  }
  for (const i of [0, 2, 4]) {
    const L = new THREE.PointLight(0xff9a45, 55, 24, 1.8);
    L.position.set(torchSpots[i].x, baseY + 1.8, torchSpots[i].z);
    group.add(L);
    lights.push(L);
  }

  let t = 0;
  function update(dt) { // torch flicker — intensity only, never light count
    t += dt;
    for (let i = 0; i < lights.length; i++) {
      lights[i].intensity = 55 + Math.sin(t * 9 + i * 2.1) * 8 + Math.sin(t * 23 + i) * 3.5;
    }
    for (let i = 0; i < flames.length; i++) {
      const s = 1 + Math.sin(t * 11 + i * 1.7) * 0.14;
      flames[i].scale.set(s, 1 / s + 0.12 * Math.sin(t * 17 + i), s);
    }
  }

  scene.add(group);
  const entrance = { x: C.x + Math.sin(doorDir) * (RING_R + 2), z: C.z + Math.cos(doorDir) * (RING_R + 2) };
  return {
    group, update, obstacles,
    floorAt: () => null, // surface structure — no underground grounding
    landmark: { name: 'Moxolotl Cave', x: C.x, z: C.z, r: 13 },
    entrance,
    chamber: { x: C.x, z: C.z, floorH: baseY },
    inside: (x, z) => Math.hypot(x - C.x, z - C.z) < RING_R - 0.5,
    dispose(sc) { sc.remove(group); group.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
