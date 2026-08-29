// Flat ocean plane at sea level with a gentle shader ripple. Cheap: one draw.

import * as THREE from 'three';
import { WORLD } from './terrain.js';

export function buildWater() {
  // a RING, not a full plane: the island's core is solid mountain, and a
  // world-spanning sheet at sea level would slice through the cave chamber
  const geo = new THREE.RingGeometry(150, 2000, 64, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3585a8,
    roughness: 0.38, // soft sparkle — low values draw a harsh sun pillar
    metalness: 0,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.seaLevel;
  mesh.receiveShadow = true;
  mesh.name = 'ocean';
  return mesh;
}
