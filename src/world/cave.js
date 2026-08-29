// The Moxolotl Cave — a sinkhole pit inside the U of the mountains (the pit
// itself is carved into the height field by terrain.js), with a ramp tunnel
// descending under the rock into a large torch-lit chamber. The chamber and
// tunnel are real geometry; floorAt() gives the underground ground height so
// the controller can walk down into it. Someone lives here... later.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';

const ROCK = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1, side: THREE.BackSide });
const ROCK_OUT = new THREE.MeshStandardMaterial({ color: 0x565049, roughness: 1 });
const FLOOR = new THREE.MeshStandardMaterial({ color: 0x3b3630, roughness: 1 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.9 });
const FLAME = new THREE.MeshStandardMaterial({
  color: 0xffb44d, emissive: 0xff8c2a, emissiveIntensity: 3.2, roughness: 1,
});

const CHAMBER_R = 8.5;
const TUNNEL_HALF_W = 1.7;
const DROP = 7.5; // chamber floor below the pit floor

export function buildCave(field, scene, seed) {
  const rng = mulberry32(seed ^ 0xca4e);
  const ground = field.groundAt;
  const K = WORLD.cave;
  const E = { x: K.x, z: K.z };
  const dir = new THREE.Vector2(K.dirX, K.dirZ).normalize();

  const pitFloorH = ground(E.x, E.z);
  const mouth = { x: E.x + dir.x * K.pitR * 0.55, z: E.z + dir.y * K.pitR * 0.55 };
  // far enough in that the ramp grade stays well under the 0.9 climb gate
  const C = { x: E.x + dir.x * (K.pitR + 20), z: E.z + dir.y * (K.pitR + 20) };
  const chamberFloorH = pitFloorH - DROP;
  // the ramp foot lands exactly on the chamber's flat circle — any overlap
  // makes a floor step at the seam that the slope gate reads as a wall
  const segEnd = { x: C.x - dir.x * (CHAMBER_R - 0.3), z: C.z - dir.y * (CHAMBER_R - 0.3) };
  const segLen = Math.hypot(segEnd.x - mouth.x, segEnd.z - mouth.z);

  const group = new THREE.Group();
  group.name = 'moxolotlCave';

  // --- walk surface for the underground ----------------------------------
  function floorAt(x, z) {
    const dC = Math.hypot(x - C.x, z - C.z);
    if (dC < CHAMBER_R - 0.3) return chamberFloorH;
    const px = x - mouth.x, pz = z - mouth.z;
    const t = (px * (segEnd.x - mouth.x) + pz * (segEnd.z - mouth.z)) / (segLen * segLen);
    if (t > -0.15 && t < 1.02) {
      const lat = Math.abs(px * dir.y - pz * dir.x);
      if (lat < TUNNEL_HALF_W) {
        const tt = Math.max(0, Math.min(1, t));
        // linear ramp — a smoothstep profile peaks 1.5× steeper mid-slope
        return pitFloorH - 0.15 + (chamberFloorH - (pitFloorH - 0.15)) * tt;
      }
    }
    return null;
  }

  // --- chamber: jittered dome + floor -------------------------------------
  const domeGeo = new THREE.SphereGeometry(CHAMBER_R + 0.8, 24, 14);
  {
    const pos = domeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const n = 1 + (rng() - 0.5) * 0.14;
      pos.setXYZ(i, pos.getX(i) * n, Math.abs(pos.getY(i)) * 0.72 * n, pos.getZ(i) * n);
    }
    domeGeo.computeVertexNormals();
  }
  const dome = new THREE.Mesh(domeGeo, ROCK);
  dome.position.set(C.x, chamberFloorH - 0.9, C.z); // rim sinks below the floor — no daylight seam
  group.add(dome);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(CHAMBER_R + 1.2, 28), FLOOR);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(C.x, chamberFloorH, C.z);
  floor.receiveShadow = true;
  group.add(floor);

  // a few stalagmites around the edge
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, r = CHAMBER_R * (0.62 + rng() * 0.26);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.32 + rng() * 0.3, 1.1 + rng() * 1.6, 6), ROCK_OUT);
    s.position.set(C.x + Math.sin(a) * r, chamberFloorH, C.z + Math.cos(a) * r);
    group.add(s);
  }

  // --- tunnel: ramp + enclosing shell -------------------------------------
  const angle = Math.atan2(dir.x, dir.y);
  const slope = Math.atan2(chamberFloorH - (pitFloorH - 0.15), segLen);
  const rampLen = segLen / Math.cos(slope) + 2;
  const mid = {
    x: (mouth.x + segEnd.x) / 2, z: (mouth.z + segEnd.z) / 2,
    y: (pitFloorH - 0.15 + chamberFloorH) / 2,
  };
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(TUNNEL_HALF_W * 2 + 0.8, 0.5, rampLen), FLOOR);
  ramp.position.set(mid.x, mid.y - 0.25, mid.z);
  ramp.rotation.y = angle;
  ramp.rotation.x = -slope;
  ramp.receiveShadow = true;
  group.add(ramp);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(TUNNEL_HALF_W + 0.9, TUNNEL_HALF_W + 0.9, rampLen + 2.5, 10, 1, true), ROCK);
  shell.geometry.rotateX(Math.PI / 2);       // axis along Z…
  shell.rotation.set(-slope, angle, 0);      // …then pitch down and yaw into place

  shell.position.set(mid.x, mid.y + 0.7, mid.z);
  group.add(shell);

  // --- pit portal: rock pillars + lintel over the mouth --------------------
  const pR = { x: -dir.y, z: dir.x }; // perpendicular
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), ROCK_OUT);
    p.position.set(mouth.x + pR.x * side * 2.1, pitFloorH + 0.7, mouth.z + pR.z * side * 2.1);
    p.scale.set(0.8, 1.7, 0.8);
    p.rotation.y = rng() * Math.PI;
    p.castShadow = true;
    group.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), ROCK_OUT);
  lintel.position.set(mouth.x, pitFloorH + 2.6, mouth.z);
  lintel.scale.set(2.3, 0.7, 0.9);
  lintel.rotation.y = angle;
  lintel.castShadow = true;
  group.add(lintel);

  // --- torches along the chamber walls + a pair at the tunnel mouth --------
  const lights = [];
  const torchSpots = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    torchSpots.push({
      x: C.x + Math.sin(a) * (CHAMBER_R - 1.1),
      z: C.z + Math.cos(a) * (CHAMBER_R - 1.1),
      y: chamberFloorH,
    });
  }
  torchSpots.push({ x: mouth.x + pR.x * 1.4, z: mouth.z + pR.z * 1.4, y: pitFloorH });
  torchSpots.push({ x: mouth.x - pR.x * 1.4, z: mouth.z - pR.z * 1.4, y: pitFloorH });

  const flames = [];
  for (const t of torchSpots) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.25, 6), WOOD);
    post.position.set(t.x, t.y + 0.62, t.z);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.14, 6), ROCK_OUT);
    cup.position.set(t.x, t.y + 1.28, t.z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 6), FLAME);
    flame.position.set(t.x, t.y + 1.54, t.z);
    group.add(post, cup, flame);
    flames.push(flame);
  }
  // three real lights carry the room (constant count — no runtime changes).
  // Physical falloff needs big numbers: ~55 cd reads like real torchlight.
  for (const i of [0, 2, 4]) {
    const L = new THREE.PointLight(0xff9a45, 55, 26, 1.8);
    L.position.set(torchSpots[i].x, torchSpots[i].y + 1.7, torchSpots[i].z);
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
  return {
    group, floorAt, update,
    landmark: { name: 'Moxolotl Cave', x: E.x, z: E.z, r: 12 },
    entrance: E, chamber: { x: C.x, z: C.z, floorH: chamberFloorH },
    dispose(sc) { sc.remove(group); group.traverse((o) => o.geometry && o.geometry.dispose()); },
  };
}
